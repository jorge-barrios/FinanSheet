-- =====================================================
-- Fix Dividendo GHM term effective_from to 2025
-- Payments are correct (Jul-Nov 2025), but term has wrong effective_from (2021-07-01)
-- =====================================================

-- Current state shows:
-- Payments: 2025-07-01 to 2025-11-01 (CORRECT)
-- Term effective_from: 2021-07-01 (WRONG - should be 2025-07-01)

-- Fix ONLY the term effective_from
UPDATE terms
SET effective_from = '2025-07-01'
WHERE commitment_id = 'a7a9d679-959d-4152-911b-6c0d0c2ae769'
  AND version = 1;

-- Verify the fix
SELECT
    'Fixed Term' as info,
    id::TEXT,
    version::TEXT,
    effective_from::TEXT,
    effective_until::TEXT
FROM terms
WHERE commitment_id = 'a7a9d679-959d-4152-911b-6c0d0c2ae769'
ORDER BY version;

SELECT
    'Payments (unchanged)' as info,
    period_date::TEXT,
    payment_date::TEXT
FROM payments
WHERE commitment_id = 'a7a9d679-959d-4152-911b-6c0d0c2ae769'
ORDER BY period_date;
