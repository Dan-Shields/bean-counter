-- Rename expenses to transactions
-- This better reflects that we have multiple transaction types (expense, repayment, income)

-- Rename the main table
ALTER TABLE expenses RENAME TO transactions;

-- Rename related tables
ALTER TABLE expense_splits RENAME TO transaction_splits;
ALTER TABLE expense_changelog RENAME TO transaction_changelog;

-- Rename foreign key columns in splits table
ALTER TABLE transaction_splits RENAME COLUMN expense_id TO transaction_id;

-- Rename foreign key column in changelog table
ALTER TABLE transaction_changelog RENAME COLUMN expense_id TO transaction_id;

-- Rename indexes
ALTER INDEX idx_expenses_group_id RENAME TO idx_transactions_group_id;
ALTER INDEX idx_expenses_date RENAME TO idx_transactions_date;
ALTER INDEX idx_expenses_deleted_at RENAME TO idx_transactions_deleted_at;
ALTER INDEX idx_expenses_type RENAME TO idx_transactions_type;
ALTER INDEX idx_expense_splits_expense_id RENAME TO idx_transaction_splits_transaction_id;
ALTER INDEX idx_expense_splits_member_id RENAME TO idx_transaction_splits_member_id;
ALTER INDEX idx_expense_changelog_expense_id RENAME TO idx_transaction_changelog_transaction_id;

-- Update RLS policies (drop and recreate with new names)
DROP POLICY IF EXISTS "Expenses are accessible to anyone with group access" ON transactions;
DROP POLICY IF EXISTS "Expense splits are accessible to anyone with group access" ON transaction_splits;
DROP POLICY IF EXISTS "Expense changelog is accessible to anyone with group access" ON transaction_changelog;

CREATE POLICY "Transactions are accessible to anyone with group access"
  ON transactions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Transaction splits are accessible to anyone with group access"
  ON transaction_splits FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Transaction changelog is accessible to anyone with group access"
  ON transaction_changelog FOR ALL
  USING (true)
  WITH CHECK (true);

-- Update the trigger name
DROP TRIGGER IF EXISTS update_expenses_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
