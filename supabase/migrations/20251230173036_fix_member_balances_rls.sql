-- Fix RLS issue: make the recalculate function run with elevated privileges
-- This allows the trigger to insert/update member_balances regardless of RLS policies

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
$$ LANGUAGE plpgsql SECURITY DEFINER;
