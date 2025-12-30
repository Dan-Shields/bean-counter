-- Add transaction type to expenses table
-- Supports: expense (default), repayment, income

ALTER TABLE expenses
ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'
CHECK (type IN ('expense', 'repayment', 'income'));

-- Create index for filtering by type
CREATE INDEX idx_expenses_type ON expenses(type);
