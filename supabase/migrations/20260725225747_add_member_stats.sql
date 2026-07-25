-- Server-side expense statistics, mirroring the member_balances pattern.
--
-- Two tables are maintained by triggers on transaction changes:
--   * member_stats  - per member: how much they physically paid, and their
--                     share of the group's net spending.
--   * group_stats   - group totals: expenses, refunds, and expense count.
--
-- Intra-group repayments are ignored, since they only move money between
-- members without changing what the group spent.

-- Per-member stats table
CREATE TABLE member_stats (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
    paid DECIMAL(10,2) NOT NULL DEFAULT 0,
    share DECIMAL(10,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, member_id)
);

CREATE INDEX idx_member_stats_group_id ON member_stats(group_id);

ALTER TABLE member_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read member stats for their groups"
    ON member_stats FOR SELECT
    USING (true);

-- Group-level totals table
CREATE TABLE group_stats (
    group_id UUID PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
    total_expenses DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_refunds DECIMAL(10,2) NOT NULL DEFAULT 0,
    expense_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE group_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read group stats for their groups"
    ON group_stats FOR SELECT
    USING (true);

-- Function to recalculate stats for a group
CREATE OR REPLACE FUNCTION recalculate_group_stats(p_group_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Per-member paid & share
    WITH transaction_data AS (
        -- Active expense/income transactions (repayments ignored)
        SELECT
            t.id,
            t.type,
            t.payer_id,
            COALESCE(t.base_currency_amount, t.amount) AS amount,
            -- Income reduces spend, so it counts negatively.
            CASE WHEN t.type = 'income' THEN -1 ELSE 1 END AS stat_multiplier
        FROM transactions t
        WHERE t.group_id = p_group_id
          AND t.deleted_at IS NULL
          AND t.type IN ('expense', 'income')
    ),
    exact_totals AS (
        -- Total exact amounts per transaction
        SELECT
            ts.transaction_id,
            COALESCE(SUM(ts.exact_amount), 0) AS total_exact
        FROM transaction_splits ts
        JOIN transaction_data td ON td.id = ts.transaction_id
        WHERE ts.exact_amount IS NOT NULL
        GROUP BY ts.transaction_id
    ),
    parts_totals AS (
        -- Total parts per transaction (for parts-based splits)
        SELECT
            ts.transaction_id,
            SUM(COALESCE(ts.parts, 1)) AS total_parts
        FROM transaction_splits ts
        JOIN transaction_data td ON td.id = ts.transaction_id
        WHERE ts.exact_amount IS NULL
        GROUP BY ts.transaction_id
    ),
    payer_paid AS (
        -- What each member physically fronted (or received, for income)
        SELECT
            td.payer_id AS member_id,
            SUM(td.amount * td.stat_multiplier) AS paid
        FROM transaction_data td
        GROUP BY td.payer_id
    ),
    exact_share AS (
        -- Consumption share from exact-amount splits
        SELECT
            ts.member_id,
            SUM(ts.exact_amount * td.stat_multiplier) AS share
        FROM transaction_splits ts
        JOIN transaction_data td ON td.id = ts.transaction_id
        WHERE ts.exact_amount IS NOT NULL
        GROUP BY ts.member_id
    ),
    parts_share AS (
        -- Consumption share from parts-based splits
        SELECT
            ts.member_id,
            SUM(
                ((td.amount - COALESCE(et.total_exact, 0)) / pt.total_parts)
                * COALESCE(ts.parts, 1)
                * td.stat_multiplier
            ) AS share
        FROM transaction_splits ts
        JOIN transaction_data td ON td.id = ts.transaction_id
        LEFT JOIN exact_totals et ON et.transaction_id = ts.transaction_id
        JOIN parts_totals pt ON pt.transaction_id = ts.transaction_id
        WHERE ts.exact_amount IS NULL
        GROUP BY ts.member_id
    ),
    all_shares AS (
        SELECT member_id, share FROM exact_share
        UNION ALL
        SELECT member_id, share FROM parts_share
    ),
    aggregated AS (
        SELECT
            m.id AS member_id,
            ROUND(COALESCE(pp.paid, 0)::numeric, 2) AS paid,
            ROUND(COALESCE(SUM(als.share), 0)::numeric, 2) AS share
        FROM members m
        LEFT JOIN payer_paid pp ON pp.member_id = m.id
        LEFT JOIN all_shares als ON als.member_id = m.id
        WHERE m.group_id = p_group_id
        GROUP BY m.id, pp.paid
    )
    INSERT INTO member_stats (group_id, member_id, paid, share, updated_at)
    SELECT p_group_id, member_id, paid, share, NOW()
    FROM aggregated
    ON CONFLICT (group_id, member_id)
    DO UPDATE SET
        paid = EXCLUDED.paid,
        share = EXCLUDED.share,
        updated_at = NOW();

    -- Group-level totals
    INSERT INTO group_stats (
        group_id, total_expenses, total_refunds, expense_count, updated_at
    )
    SELECT
        p_group_id,
        ROUND(COALESCE(SUM(
            CASE WHEN t.type = 'expense'
                 THEN COALESCE(t.base_currency_amount, t.amount) END
        ), 0)::numeric, 2),
        ROUND(COALESCE(SUM(
            CASE WHEN t.type = 'income'
                 THEN COALESCE(t.base_currency_amount, t.amount) END
        ), 0)::numeric, 2),
        COUNT(*) FILTER (WHERE t.type = 'expense'),
        NOW()
    FROM transactions t
    WHERE t.group_id = p_group_id AND t.deleted_at IS NULL
    ON CONFLICT (group_id)
    DO UPDATE SET
        total_expenses = EXCLUDED.total_expenses,
        total_refunds = EXCLUDED.total_refunds,
        expense_count = EXCLUDED.expense_count,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Extend the existing balance triggers to also recalculate stats, so a single
-- trigger per table keeps both balances and stats up to date.
CREATE OR REPLACE FUNCTION trigger_recalculate_balances_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
    affected_group_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        affected_group_id := OLD.group_id;
    ELSE
        affected_group_id := NEW.group_id;
    END IF;

    PERFORM recalculate_group_balances(affected_group_id);
    PERFORM recalculate_group_stats(affected_group_id);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_recalculate_balances_on_split()
RETURNS TRIGGER AS $$
DECLARE
    affected_group_id UUID;
    affected_transaction_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        affected_transaction_id := OLD.transaction_id;
    ELSE
        affected_transaction_id := NEW.transaction_id;
    END IF;

    SELECT group_id INTO affected_group_id
    FROM transactions
    WHERE id = affected_transaction_id;

    IF affected_group_id IS NOT NULL THEN
        PERFORM recalculate_group_balances(affected_group_id);
        PERFORM recalculate_group_stats(affected_group_id);
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Initialize stats for existing groups
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM groups LOOP
        PERFORM recalculate_group_stats(r.id);
    END LOOP;
END $$;
