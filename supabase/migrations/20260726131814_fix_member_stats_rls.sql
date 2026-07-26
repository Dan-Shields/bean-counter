-- Fix RLS issue: recalculate_group_stats writes to member_stats and group_stats,
-- which only have SELECT policies. Like recalculate_group_balances, it must run
-- with SECURITY DEFINER so the trigger can upsert stats regardless of RLS.

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
$$ LANGUAGE plpgsql SECURITY DEFINER;
