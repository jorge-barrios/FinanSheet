-- =====================================================
-- v2 Migration Verification
-- =====================================================
-- Verifies data was migrated correctly from v1 to v2
-- Run this AFTER 006 and 007
-- =====================================================

-- 1. Count comparison
SELECT 
  'EXPENSES vs COMMITMENTS' as comparison,
  (SELECT COUNT(*) FROM expenses) as v1_count,
  (SELECT COUNT(*) FROM commitments) as v2_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM expenses) = (SELECT COUNT(*) FROM commitments) 
    THEN '✅ MATCH' 
    ELSE '❌ MISMATCH' 
  END as status;

-- 2. Count comparison (terms)
SELECT 
  'EXPENSES vs TERMS' as comparison,
  (SELECT COUNT(*) FROM expenses) as v1_count,
  (SELECT COUNT(*) FROM terms) as v2_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM expenses) = (SELECT COUNT(*) FROM terms) 
    THEN '✅ MATCH' 
    ELSE '❌ MISMATCH' 
  END as status;

-- 3. Count comparison (payments)
SELECT 
  'PAID PAYMENT_DETAILS vs PAYMENTS' as comparison,
  (SELECT COUNT(*) FROM payment_details WHERE paid = TRUE) as v1_count,
  (SELECT COUNT(*) FROM payments) as v2_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM payment_details WHERE paid = TRUE) = (SELECT COUNT(*) FROM payments) 
    THEN '✅ MATCH' 
    ELSE '❌ MISMATCH' 
  END as status;

-- 4. Check for orphaned records
SELECT 
  'Orphaned terms (no commitment)' as check_type,
  COUNT(*) as orphans
FROM terms t
LEFT JOIN commitments c ON c.id = t.commitment_id
WHERE c.id IS NULL;

SELECT 
  'Orphaned payments (no commitment)' as check_type,
  COUNT(*) as orphans
FROM payments p
LEFT JOIN commitments c ON c.id = p.commitment_id
WHERE c.id IS NULL;

SELECT 
  'Orphaned payments (no term)' as check_type,
  COUNT(*) as orphans
FROM payments p
LEFT JOIN terms t ON t.id = p.term_id
WHERE t.id IS NULL;

-- 5. Sample data validation
SELECT 
  'Sample commitment' as type,
  c.name,
  c.flow_type,
  t.frequency,
  t.amount_original,
  t.currency_original,
  (SELECT COUNT(*) FROM payments WHERE commitment_id = c.id) as payment_count
FROM commitments c
INNER JOIN terms t ON t.commitment_id = c.id
LIMIT 5;

-- 6. User count verification
SELECT 
  'Users with commitments' as metric,
  COUNT(DISTINCT user_id) as count
FROM commitments
UNION ALL
SELECT 
  'Users in profiles' as metric,
  COUNT(*) as count
FROM profiles;

-- ✅ If all counts match and no orphans, migration is successful
