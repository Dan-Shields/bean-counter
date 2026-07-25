-- Create transaction_attachments table for storing image attachment metadata
CREATE TABLE transaction_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching attachments by transaction
CREATE INDEX idx_transaction_attachments_transaction ON transaction_attachments(transaction_id);

-- Index for potential cleanup queries by group
CREATE INDEX idx_transaction_attachments_group ON transaction_attachments(group_id);

-- Enable RLS (matching app's permissive link-based access model)
ALTER TABLE transaction_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to transaction attachments"
ON transaction_attachments FOR ALL USING (true) WITH CHECK (true);
