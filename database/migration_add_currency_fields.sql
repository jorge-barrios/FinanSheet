-- Step 1: Rename the existing total_amount column to amount_in_clp
ALTER TABLE public.expenses RENAME COLUMN total_amount TO amount_in_clp;

-- Step 2: Add the new columns, allowing NULLs for now to handle existing data
ALTER TABLE public.expenses
ADD COLUMN expense_date DATE,
ADD COLUMN original_amount DECIMAL(10, 2),
ADD COLUMN original_currency TEXT,
ADD COLUMN exchange_rate DECIMAL(12, 6);

-- Step 3: Update existing rows to populate the new fields
-- For existing expenses, we assume they were created in CLP.
UPDATE public.expenses
SET 
    expense_date = start_date, -- Assume the expense date is the start date for old records
    original_amount = amount_in_clp, -- The original amount is the same as the CLP amount
    original_currency = 'CLP',       -- The original currency is CLP
    exchange_rate = 1;               -- The exchange rate is 1

-- Step 4: Alter the columns to be NOT NULL after populating them
-- This ensures all new expenses will have these fields correctly set.
ALTER TABLE public.expenses
ALTER COLUMN expense_date SET NOT NULL,
ALTER COLUMN original_amount SET NOT NULL,
ALTER COLUMN original_currency SET NOT NULL,
ALTER COLUMN exchange_rate SET NOT NULL;

-- Optional: Add indexes for new columns if they will be frequently used in queries
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);

