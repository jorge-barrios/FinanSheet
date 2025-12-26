-- =====================================================
-- v2 Data Migration: payment_details → payments
-- VERSION: 1.4 - Fixed 0-based months (0=Jan, 1=Feb, etc.)
-- =====================================================
-- Migrates payment data from v1 to v2
-- Run this AFTER 006_migrate_expenses_to_v2.sql
-- =====================================================

-- Temporary: Disable RLS for migration
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

-- Clear existing payments (in case of re-run)
TRUNCATE payments CASCADE;

-- Step 1: Migrate paid payment_details to payments table
-- Only migrate records where paid = TRUE AND a matching term exists
-- Handle duplicates by taking the most recent payment per commitment/period
WITH payment_with_terms AS (
  SELECT
    gen_random_uuid() as id,
    pd.expense_id as commitment_id,
    (
      -- Find the active term for this commitment at this period
      SELECT t.id 
      FROM terms t
      WHERE t.commitment_id = pd.expense_id
      AND t.effective_from <= (
        SPLIT_PART(pd.date_key, '-', 1) || '-' || 
        LPAD((COALESCE(SPLIT_PART(pd.date_key, '-', 2)::integer, 0) + 1)::text, 2, '0') || '-01'
      )::date
      AND (t.effective_until IS NULL OR t.effective_until >= (
        SPLIT_PART(pd.date_key, '-', 1) || '-' || 
        LPAD((COALESCE(SPLIT_PART(pd.date_key, '-', 2)::integer, 0) + 1)::text, 2, '0') || '-01'
      )::date)
      ORDER BY t.version DESC
      LIMIT 1
    ) as term_id,
    (SPLIT_PART(pd.date_key, '-', 1) || '-' || 
     LPAD((COALESCE(SPLIT_PART(pd.date_key, '-', 2)::integer, 0) + 1)::text, 2, '0') || '-01')::date as period_date,
    COALESCE(pd.payment_date::date, 
      (SPLIT_PART(pd.date_key, '-', 1) || '-' || 
       LPAD((COALESCE(SPLIT_PART(pd.date_key, '-', 2)::integer, 0) + 1)::text, 2, '0') || '-01')::date
    ) as payment_date,
    e.original_currency as currency_original,
    ABS(COALESCE(pd.overridden_amount::numeric, e.original_amount, 0)) as amount_original,
    CASE 
      WHEN COALESCE(e.original_amount, 0) != 0 THEN ABS(COALESCE(e.amount_in_clp, 0) / e.original_amount)
      ELSE 1.0
    END as fx_rate_to_base,
    ABS(COALESCE(
      pd.overridden_amount::numeric * (COALESCE(e.amount_in_clp, 0) / NULLIF(e.original_amount, 0)), 
      e.amount_in_clp,
      0
    )) as amount_in_base,
    pd.created_at,
    pd.created_at as updated_at,
    -- Use ROW_NUMBER to deduplicate: keep most recent payment per commitment/period
    ROW_NUMBER() OVER (
      PARTITION BY pd.expense_id, 
                   (SPLIT_PART(pd.date_key, '-', 1) || '-' || 
                    LPAD((COALESCE(SPLIT_PART(pd.date_key, '-', 2)::integer, 0) + 1)::text, 2, '0') || '-01')
      ORDER BY pd.created_at DESC, pd.payment_date DESC NULLS LAST
    ) as rn
  FROM payment_details pd
  INNER JOIN expenses e ON e.id = pd.expense_id
  WHERE pd.paid = TRUE AND pd.expense_id IS NOT NULL
)
INSERT INTO payments (
  id,
  commitment_id,
  term_id,
  period_date,
  payment_date,
  currency_original,
  amount_original,
  fx_rate_to_base,
  amount_in_base,
  created_at,
  updated_at
)
SELECT 
  id, commitment_id, term_id, period_date, payment_date,
  currency_original, amount_original, fx_rate_to_base, amount_in_base,
  created_at, updated_at
FROM payment_with_terms
WHERE term_id IS NOT NULL  -- Critical: only insert if term was found
  AND rn = 1;  -- Take only the most recent payment per commitment/period

-- Re-enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Verification query
SELECT 
  'Payments migrated' as description,
  COUNT(*) as count
FROM payments
UNION ALL
SELECT 
  'Paid payment_details in v1' as description,
  COUNT(*) as count
FROM payment_details
WHERE paid = TRUE
UNION ALL
SELECT 
  'Skipped (no matching term)' as description,
  COUNT(*) as count
FROM payment_details pd
WHERE pd.paid = TRUE
  AND pd.expense_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM terms t
    WHERE t.commitment_id = pd.expense_id
    AND t.effective_from <= (
      SPLIT_PART(pd.date_key, '-', 1) || '-' || 
      LPAD((COALESCE(SPLIT_PART(pd.date_key, '-', 2)::integer, 0) + 1)::text, 2, '0') || '-01'
    )::date
    AND (t.effective_until IS NULL OR t.effective_until >= (
      SPLIT_PART(pd.date_key, '-', 1) || '-' || 
      LPAD((COALESCE(SPLIT_PART(pd.date_key, '-', 2)::integer, 0) + 1)::text, 2, '0') || '-01'
    )::date)
  );

-- ✅ Payment data migration complete
-- Note: Some payments may be skipped if they don't have a matching term
-- This is normal for payments outside the term's effective period
