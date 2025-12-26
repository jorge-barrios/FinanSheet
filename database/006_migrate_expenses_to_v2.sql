-- =====================================================
-- v2 Data Migration: expenses → commitments + terms
-- VERSION: 1.8 - Handles retroactive payments (before start_date)
-- =====================================================
-- UPDATED VERSION: Works with category_id (UUID) instead of category (text)
-- Run this AFTER schema migration (001-005) is complete
-- =====================================================

-- Temporary: Disable RLS for migration
ALTER TABLE commitments DISABLE ROW LEVEL SECURITY;
ALTER TABLE terms DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories_v2 DISABLE ROW LEVEL SECURITY;

-- Clear existing data (in case of re-run)
TRUNCATE commitments CASCADE;
TRUNCATE terms CASCADE;
TRUNCATE categories_v2 CASCADE;
TRUNCATE profiles CASCADE;

-- Step 1: Create user profiles for all existing users
INSERT INTO profiles (user_id, base_currency, locale)
SELECT DISTINCT 
  user_id,
  'CLP' as base_currency,
  'es-CL' as locale
FROM expenses
WHERE user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Migrate categories from v1 categories table to v2
-- Copy existing categories (which are already UUIDs)
INSERT INTO categories_v2 (id, user_id, name, normalized_name, is_global)
SELECT 
  c.id,
  c.user_id,
  c.name,
  LOWER(TRIM(c.name)) as normalized_name,
  FALSE as is_global
FROM categories c
ON CONFLICT (user_id, normalized_name) DO NOTHING;

-- Step 3: Migrate expenses → commitments
-- Each expense becomes one commitment
INSERT INTO commitments (
  id,  -- Keep same ID for easier tracking
  user_id,
  category_id,  -- Use existing UUID directly
  name,
  flow_type,
  is_important,
  notes,
  linked_commitment_id,
  link_role,
  created_at,
  updated_at
)
SELECT
  e.id,
  e.user_id,
  e.category_id,  -- Already a UUID in v1
  e.name,
  CASE 
    WHEN e.amount_in_clp < 0 THEN 'INCOME'
    ELSE 'EXPENSE'
  END as flow_type,
  COALESCE(e.is_important, FALSE) as is_important,
  NULL as notes,  -- v1 doesn't have notes field
  e.linked_expense_id as linked_commitment_id,
  e.link_role,
  e.created_at,
  e.created_at as updated_at  -- v1 doesn't have updated_at
FROM expenses e;

-- Step 4: Migrate expenses → terms
-- Each expense becomes one term (version 1)
INSERT INTO terms (
  id,  -- Generate new ID
  commitment_id,
  version,
  effective_from,
  effective_until,
  frequency,
  installments_count,
  due_day_of_month,
  currency_original,
  amount_original,
  fx_rate_to_base,
  amount_in_base,
  estimation_mode,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid() as id,
  e.id as commitment_id,
  1 as version,
  -- Convert JSONB start_date {year, month} to date
  -- JavaScript uses 0-based months: 0=January, 1=February, etc.
  -- Use the earlier of start_date or first payment date to handle retroactive payments
  LEAST(
    (e.start_date->>'year' || '-' || 
     LPAD((COALESCE((e.start_date->>'month')::integer, 0) + 1)::text, 2, '0') || '-01')::date,
    COALESCE(
      (SELECT MIN(SPLIT_PART(pd.date_key, '-', 1) || '-' || 
                  LPAD((COALESCE(SPLIT_PART(pd.date_key, '-', 2)::integer, 0) + 1)::text, 2, '0') || '-01')::date
       FROM payment_details pd 
       WHERE pd.expense_id = e.id AND pd.paid = TRUE),
      (e.start_date->>'year' || '-' || 
       LPAD((COALESCE((e.start_date->>'month')::integer, 0) + 1)::text, 2, '0') || '-01')::date
    )
  ) as effective_from,
  -- Calculate effective_until based on installments and frequency
  -- Special case: ONCE expenses with multiple payments should be treated as recurring
  CASE 
    WHEN e.installments >= 999 OR e.installments <= 0 OR e.installments IS NULL THEN NULL  -- Ongoing/Recurring
    WHEN e.payment_frequency = 'ONCE' AND (SELECT COUNT(*) FROM payment_details WHERE expense_id = e.id AND paid = TRUE) > 1 THEN NULL  -- ONCE with multiple payments = recurring
    WHEN e.payment_frequency = 'ONCE' THEN 
      (e.start_date->>'year' || '-' || LPAD((COALESCE((e.start_date->>'month')::integer, 0) + 1)::text, 2, '0') || '-01')::date
    WHEN e.payment_frequency = 'MONTHLY' THEN 
      ((e.start_date->>'year' || '-' || LPAD((COALESCE((e.start_date->>'month')::integer, 0) + 1)::text, 2, '0') || '-01')::date + ((e.installments - 1) || ' months')::interval)::date
    WHEN e.payment_frequency = 'BIMONTHLY' THEN 
      ((e.start_date->>'year' || '-' || LPAD((COALESCE((e.start_date->>'month')::integer, 0) + 1)::text, 2, '0') || '-01')::date + (((e.installments - 1) * 2) || ' months')::interval)::date
    WHEN e.payment_frequency = 'QUARTERLY' THEN 
      ((e.start_date->>'year' || '-' || LPAD((COALESCE((e.start_date->>'month')::integer, 0) + 1)::text, 2, '0') || '-01')::date + (((e.installments - 1) * 3) || ' months')::interval)::date
    WHEN e.payment_frequency = 'SEMIANNUALLY' THEN 
      ((e.start_date->>'year' || '-' || LPAD((COALESCE((e.start_date->>'month')::integer, 0) + 1)::text, 2, '0') || '-01')::date + (((e.installments - 1) * 6) || ' months')::interval)::date
    WHEN e.payment_frequency = 'ANNUALLY' THEN 
      ((e.start_date->>'year' || '-' || LPAD((COALESCE((e.start_date->>'month')::integer, 0) + 1)::text, 2, '0') || '-01')::date + (((e.installments - 1) * 12) || ' months')::interval)::date
    ELSE NULL
  END as effective_until,
  e.payment_frequency as frequency,
  CASE 
    WHEN e.installments >= 999 OR e.installments <= 0 OR e.installments IS NULL THEN NULL
    ELSE e.installments
  END as installments_count,
  EXTRACT(DAY FROM e.due_date)::integer as due_day_of_month,
  e.original_currency as currency_original,
  ABS(COALESCE(e.original_amount, 0)) as amount_original,  -- Store as positive, handle NULL
  CASE 
    WHEN COALESCE(e.original_amount, 0) != 0 THEN ABS(COALESCE(e.amount_in_clp, 0) / e.original_amount)
    ELSE 1.0
  END as fx_rate_to_base,
  ABS(COALESCE(e.amount_in_clp, 0)) as amount_in_base,  -- Store as positive, handle NULL
  CASE 
    WHEN e.type = 'VARIABLE' THEN 'LAST'
    ELSE 'FIXED'
  END as estimation_mode,
  e.created_at,
  e.created_at as updated_at  -- v1 doesn't have updated_at
FROM expenses e;

-- Re-enable RLS
ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories_v2 ENABLE ROW LEVEL SECURITY;

-- Verification query
SELECT 
  'Commitments' as table_name, 
  COUNT(*) as migrated_count,
  (SELECT COUNT(*) FROM expenses) as source_count,
  CASE 
    WHEN COUNT(*) = (SELECT COUNT(*) FROM expenses) THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END as status
FROM commitments
UNION ALL
SELECT 
  'Terms' as table_name,
  COUNT(*) as migrated_count,
  (SELECT COUNT(*) FROM expenses) as source_count,
  CASE 
    WHEN COUNT(*) = (SELECT COUNT(*) FROM expenses) THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END as status
FROM terms
UNION ALL
SELECT 
  'Categories' as table_name,
  COUNT(*) as migrated_count,
  (SELECT COUNT(*) FROM categories) as source_count,
  CASE 
    WHEN COUNT(*) >= (SELECT COUNT(*) FROM categories) THEN '✅ OK (includes globals)'
    ELSE '❌ MISMATCH'
  END as status
FROM categories_v2;

-- ✅ Data migration complete
-- Next: Run 007_migrate_payments.sql
