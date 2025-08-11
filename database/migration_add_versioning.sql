-- Migration: Add versioning support to expenses table
-- Run this SQL in your Supabase SQL Editor

-- Add versioning columns to the expenses table
ALTER TABLE expenses 
ADD COLUMN parent_id UUID,
ADD COLUMN version_date DATE,
ADD COLUMN end_date DATE,
ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Add foreign key constraint for parent_id (references the same table)
ALTER TABLE expenses 
ADD CONSTRAINT fk_expenses_parent 
FOREIGN KEY (parent_id) REFERENCES expenses(id) ON DELETE CASCADE;

-- Create index for better performance on versioning queries
CREATE INDEX idx_expenses_parent_id ON expenses(parent_id);
CREATE INDEX idx_expenses_version_date ON expenses(version_date);
CREATE INDEX idx_expenses_is_active ON expenses(is_active);

-- Update existing records to have is_active = true (for backwards compatibility)
UPDATE expenses SET is_active = true WHERE is_active IS NULL;

-- Add comments to document the new columns
COMMENT ON COLUMN expenses.parent_id IS 'ID of the original expense (for versioned expenses)';
COMMENT ON COLUMN expenses.version_date IS 'Date when this version becomes effective (YYYY-MM-DD)';
COMMENT ON COLUMN expenses.end_date IS 'Date when this version ends (YYYY-MM-DD)';
COMMENT ON COLUMN expenses.is_active IS 'Whether this version is currently active';
