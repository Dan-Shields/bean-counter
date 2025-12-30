-- Create member_balances table
CREATE TABLE member_balances (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, member_id)
);

-- Create index for faster lookups
CREATE INDEX idx_member_balances_group_id ON member_balances(group_id);

-- Enable RLS
ALTER TABLE member_balances ENABLE ROW LEVEL SECURITY;

-- RLS policy: anyone with group access can read balances
CREATE POLICY "Anyone can read member balances for their groups"
    ON member_balances FOR SELECT
    USING (true);

-- Function to recalculate balances for a group
CREATE OR REPLACE FUNCTION recalculate_group_balances(p_group_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Use CTEs to calculate all balance components, then UPSERT
    WITH transaction_data AS (
        -- Get all active transactions for this group
        SELECT
            t.id,
            t.type,
            t.payer_id,
            COALESCE(t.base_currency_amount, t.amount) as amount,
            CASE WHEN t.type = 'income' THEN -1 ELSE 1 END as payer_multiplier,
            CASE WHEN t.type = 'income' THEN 1 ELSE -1 END as split_multiplier
        FROM transactions t
        WHERE t.group_id = p_group_id AND t.deleted_at IS NULL
    ),
    exact_totals AS (
        -- Calculate total exact amounts per transaction
        SELECT
            ts.transaction_id,
            COALESCE(SUM(ts.exact_amount), 0) as total_exact
        FROM transaction_splits ts
        JOIN transaction_data td ON td.id = ts.transaction_id
        WHERE ts.exact_amount IS NOT NULL
        GROUP BY ts.transaction_id
    ),
    parts_totals AS (
        -- Calculate total parts per transaction (for parts-based splits)
        SELECT
            ts.transaction_id,
            SUM(COALESCE(ts.parts, 1)) as total_parts
        FROM transaction_splits ts
        JOIN transaction_data td ON td.id = ts.transaction_id
        WHERE ts.exact_amount IS NULL
        GROUP BY ts.transaction_id
    ),
    payer_balances AS (
        -- Payer credits/debits
        SELECT
            td.payer_id as member_id,
            SUM(td.amount * td.payer_multiplier) as balance
        FROM transaction_data td
        GROUP BY td.payer_id
    ),
    exact_split_balances AS (
        -- Exact amount splits
        SELECT
            ts.member_id,
            SUM(ts.exact_amount * td.split_multiplier) as balance
        FROM transaction_splits ts
        JOIN transaction_data td ON td.id = ts.transaction_id
        WHERE ts.exact_amount IS NOT NULL
        GROUP BY ts.member_id
    ),
    parts_split_balances AS (
        -- Parts-based splits
        SELECT
            ts.member_id,
            SUM(
                ((td.amount - COALESCE(et.total_exact, 0)) / pt.total_parts) *
                COALESCE(ts.parts, 1) *
                td.split_multiplier
            ) as balance
        FROM transaction_splits ts
        JOIN transaction_data td ON td.id = ts.transaction_id
        LEFT JOIN exact_totals et ON et.transaction_id = ts.transaction_id
        JOIN parts_totals pt ON pt.transaction_id = ts.transaction_id
        WHERE ts.exact_amount IS NULL
        GROUP BY ts.member_id
    ),
    all_balances AS (
        SELECT member_id, balance FROM payer_balances
        UNION ALL
        SELECT member_id, balance FROM exact_split_balances
        UNION ALL
        SELECT member_id, balance FROM parts_split_balances
    ),
    aggregated_balances AS (
        SELECT
            m.id as member_id,
            ROUND(COALESCE(SUM(ab.balance), 0)::numeric, 2) as balance
        FROM members m
        LEFT JOIN all_balances ab ON ab.member_id = m.id
        WHERE m.group_id = p_group_id
        GROUP BY m.id
    )
    INSERT INTO member_balances (group_id, member_id, balance, updated_at)
    SELECT
        p_group_id,
        member_id,
        balance,
        NOW()
    FROM aggregated_balances
    ON CONFLICT (group_id, member_id)
    DO UPDATE SET
        balance = EXCLUDED.balance,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger function for transactions table
CREATE OR REPLACE FUNCTION trigger_recalculate_balances_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
    affected_group_id UUID;
BEGIN
    -- Get the group_id from either OLD or NEW record
    IF TG_OP = 'DELETE' THEN
        affected_group_id := OLD.group_id;
    ELSE
        affected_group_id := NEW.group_id;
    END IF;

    -- Recalculate balances for the affected group
    PERFORM recalculate_group_balances(affected_group_id);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for transaction_splits table
CREATE OR REPLACE FUNCTION trigger_recalculate_balances_on_split()
RETURNS TRIGGER AS $$
DECLARE
    affected_group_id UUID;
    affected_transaction_id UUID;
BEGIN
    -- Get the transaction_id from either OLD or NEW record
    IF TG_OP = 'DELETE' THEN
        affected_transaction_id := OLD.transaction_id;
    ELSE
        affected_transaction_id := NEW.transaction_id;
    END IF;

    -- Look up the group_id from the transaction
    SELECT group_id INTO affected_group_id
    FROM transactions
    WHERE id = affected_transaction_id;

    -- Recalculate balances for the affected group
    IF affected_group_id IS NOT NULL THEN
        PERFORM recalculate_group_balances(affected_group_id);
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on transactions table
CREATE TRIGGER trigger_recalculate_balances_on_transaction
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_balances_on_transaction();

-- Create triggers on transaction_splits table
CREATE TRIGGER trigger_recalculate_balances_on_split
    AFTER INSERT OR UPDATE OR DELETE ON transaction_splits
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_balances_on_split();

-- Initialize balances for existing groups
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM groups LOOP
        PERFORM recalculate_group_balances(r.id);
    END LOOP;
END $$;
