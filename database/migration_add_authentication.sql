-- Migration: Add user authentication and Row Level Security (RLS)
-- This migration adds user_id columns to all tables and implements RLS policies
-- Run this in your Supabase SQL Editor

-- Step 1: Add user_id column to expenses table
ALTER TABLE public.expenses
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Add user_id column to payment_details table
ALTER TABLE public.payment_details
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 3: Add user_id column to categories table
ALTER TABLE public.categories
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 4: Create indexes for user_id columns (performance)
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_details_user_id ON public.payment_details(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

-- Step 5: Migrate existing data to a default user (OPTIONAL - see instructions below)
-- INSTRUCTIONS FOR MIGRATING EXISTING DATA:
-- 1. Create a user in Supabase Auth (via Supabase Dashboard or signup in your app)
-- 2. Copy that user's UUID from the auth.users table
-- 3. Replace 'YOUR-USER-UUID-HERE' below with the actual UUID
-- 4. Uncomment and run the following lines:

-- UPDATE public.expenses SET user_id = 'YOUR-USER-UUID-HERE' WHERE user_id IS NULL;
-- UPDATE public.payment_details SET user_id = 'YOUR-USER-UUID-HERE' WHERE user_id IS NULL;
-- UPDATE public.categories SET user_id = 'YOUR-USER-UUID-HERE' WHERE user_id IS NULL;

-- Step 6: Make user_id NOT NULL after migration (uncomment after migrating data)
-- ALTER TABLE public.expenses ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.payment_details ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.categories ALTER COLUMN user_id SET NOT NULL;

-- Step 7: Update UNIQUE constraint on categories to include user_id
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE public.categories ADD CONSTRAINT categories_name_user_unique UNIQUE(name, user_id);

-- Step 8: Enable Row Level Security (RLS)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS Policies for expenses table
CREATE POLICY "Users can view their own expenses"
    ON public.expenses
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenses"
    ON public.expenses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
    ON public.expenses
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses"
    ON public.expenses
    FOR DELETE
    USING (auth.uid() = user_id);

-- Step 10: Create RLS Policies for payment_details table
CREATE POLICY "Users can view their own payment details"
    ON public.payment_details
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment details"
    ON public.payment_details
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment details"
    ON public.payment_details
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment details"
    ON public.payment_details
    FOR DELETE
    USING (auth.uid() = user_id);

-- Step 11: Create RLS Policies for categories table
CREATE POLICY "Users can view their own categories"
    ON public.categories
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories"
    ON public.categories
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
    ON public.categories
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
    ON public.categories
    FOR DELETE
    USING (auth.uid() = user_id);

-- Step 12: Create a function to automatically set user_id on insert
CREATE OR REPLACE FUNCTION public.set_user_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_id = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 13: Create triggers to automatically set user_id
CREATE TRIGGER set_expenses_user_id
    BEFORE INSERT ON public.expenses
    FOR EACH ROW
    WHEN (NEW.user_id IS NULL)
    EXECUTE FUNCTION public.set_user_id();

CREATE TRIGGER set_payment_details_user_id
    BEFORE INSERT ON public.payment_details
    FOR EACH ROW
    WHEN (NEW.user_id IS NULL)
    EXECUTE FUNCTION public.set_user_id();

CREATE TRIGGER set_categories_user_id
    BEFORE INSERT ON public.categories
    FOR EACH ROW
    WHEN (NEW.user_id IS NULL)
    EXECUTE FUNCTION public.set_user_id();

-- Migration complete!
-- Next steps:
-- 1. Enable Email Auth in Supabase Dashboard (Authentication > Providers > Email)
-- 2. Migrate your existing data by following Step 5 instructions above
-- 3. Uncomment Step 6 to make user_id required
