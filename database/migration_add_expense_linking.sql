-- Migration: Add Expense Linking Support
-- Purpose: Allow linking income/expense pairs (e.g., rent income vs mortgage payment)
--          to show net amounts in statistics while keeping both records visible
-- Date: 2025-01-29

-- Add linking columns to expenses table
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS linked_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS link_role TEXT CHECK (link_role IN ('primary', 'secondary'));

-- Create index for performance on linked expense lookups
CREATE INDEX IF NOT EXISTS idx_expenses_linked_expense_id ON expenses(linked_expense_id);

-- Add constraint to ensure link_role consistency
-- A secondary expense MUST have a linked_expense_id
-- A primary expense MUST have a linked_expense_id
-- An expense with no link MUST have NULL for both fields
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_link_role_consistency'
    ) THEN
        ALTER TABLE expenses
        ADD CONSTRAINT check_link_role_consistency
        CHECK (
          (link_role = 'secondary' AND linked_expense_id IS NOT NULL) OR
          (link_role = 'primary' AND linked_expense_id IS NOT NULL) OR
          (link_role IS NULL AND linked_expense_id IS NULL)
        );
    END IF;
END $$;

-- Add documentation comments
COMMENT ON COLUMN expenses.linked_expense_id IS 'ID of the linked income/expense (e.g., rent linked to mortgage payment). Used to calculate net amounts in statistics.';
COMMENT ON COLUMN expenses.link_role IS 'Role in the link: "primary" counts in totals (shows net amount), "secondary" is excluded from totals but remains visible in grids.';

-- Example usage:
-- Rent income (primary): amountInClp = -1,000,000, linkedExpenseId = <mortgage_id>, linkRole = 'primary'
-- Mortgage (secondary): amountInClp = 700,000, linkedExpenseId = <rent_id>, linkRole = 'secondary'
-- Result: Dashboard shows net income of $300,000, but both expenses are visible in the grid
