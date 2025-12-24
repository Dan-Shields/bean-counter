-- Bean Counter Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  default_currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Members table
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses table
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL,
  base_currency_amount DECIMAL(10,2),
  payer_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense splits table
CREATE TABLE expense_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  parts INTEGER,
  exact_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(expense_id, member_id)
);

-- Expense changelog table
CREATE TABLE expense_changelog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  changed_fields JSONB,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_members_group_id ON members(group_id);
CREATE INDEX idx_expenses_group_id ON expenses(group_id);
CREATE INDEX idx_expenses_date ON expenses(date DESC);
CREATE INDEX idx_expenses_deleted_at ON expenses(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX idx_expense_splits_member_id ON expense_splits(member_id);
CREATE INDEX idx_expense_changelog_expense_id ON expense_changelog(expense_id);

-- Enable Row Level Security (RLS)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_changelog ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Anyone who knows the group ID can access it
-- (This is a simple approach for link-based sharing without accounts)

-- Groups policies
CREATE POLICY "Groups are accessible to anyone with the ID"
  ON groups FOR ALL
  USING (true)
  WITH CHECK (true);

-- Members policies
CREATE POLICY "Members are accessible to anyone with group access"
  ON members FOR ALL
  USING (true)
  WITH CHECK (true);

-- Expenses policies
CREATE POLICY "Expenses are accessible to anyone with group access"
  ON expenses FOR ALL
  USING (true)
  WITH CHECK (true);

-- Expense splits policies
CREATE POLICY "Expense splits are accessible to anyone with group access"
  ON expense_splits FOR ALL
  USING (true)
  WITH CHECK (true);

-- Expense changelog policies
CREATE POLICY "Expense changelog is accessible to anyone with group access"
  ON expense_changelog FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable Realtime for expenses table (for delete notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on expenses
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
