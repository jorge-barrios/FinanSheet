-- =====================================================
-- 017_fix_date_comparison.sql
-- =====================================================
-- Fixes the get_active_term() function to compare dates
-- at the MONTH level, not the exact day.
--
-- PROBLEM:
-- When a commitment starts on 2025-11-06 (effective_from),
-- and user tries to pay for November (period_date = 2025-11-01),
-- the old comparison failed because 2025-11-01 < 2025-11-06.
--
-- SOLUTION:
-- Compare using DATE_TRUNC('month', date) so that any day
-- in the same month is considered valid.
-- =====================================================

-- Update the get_active_term function to use month-level comparison
CREATE OR REPLACE FUNCTION get_active_term(
  p_commitment_id UUID,
  p_date DATE
)
RETURNS UUID AS $$
DECLARE
  v_term_id UUID;
BEGIN
  SELECT id INTO v_term_id
  FROM terms
  WHERE commitment_id = p_commitment_id
    -- Compare at MONTH level, not exact day
    AND DATE_TRUNC('month', effective_from) <= DATE_TRUNC('month', p_date)
    AND (
      effective_until IS NULL
      OR DATE_TRUNC('month', effective_until) >= DATE_TRUNC('month', p_date)
    )
  ORDER BY version DESC
  LIMIT 1;

  RETURN v_term_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- After running this migration, test with:
--
-- SELECT get_active_term(
--   'your-commitment-id'::uuid,
--   '2025-11-01'::date
-- );
--
-- This should now return the term even if effective_from
-- is any day in November (e.g., 2025-11-06).
-- =====================================================
