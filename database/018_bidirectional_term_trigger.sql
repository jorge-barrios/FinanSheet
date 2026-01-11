-- =====================================================
-- Migration 018: Bidirectional Term Data Integrity
-- =====================================================
-- PROBLEM: The existing trigger only calculates effective_until from
-- installments_count, but does NOT clear installments_count when a 
-- term becomes indefinite (effective_until = NULL).
--
-- This creates invalid states where:
--   effective_until = NULL (indefinite)
--   installments_count = 12 (but... shouldn't have a count)
--
-- SOLUTION: Update the trigger to enforce bidirectional consistency:
--   1. If installments_count is set → calculate effective_until (existing)
--   2. If effective_until is NULL AND NOT is_divided_amount → clear installments_count (NEW)
--
-- EXCEPTION: For divided amounts (is_divided_amount = TRUE), we KEEP the
-- installments_count even if effective_until is NULL, because loans/purchases
-- can be interrupted early but we want to preserve the original plan.
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_effective_until()
RETURNS TRIGGER AS $$
DECLARE
    months_per_period INTEGER;
    calculated_until DATE;
BEGIN
    -- =========================================================
    -- CASE 0: ONCE frequency is ALWAYS a single defined payment
    -- =========================================================
    -- 'ONCE' means exactly 1 occurrence. No exceptions.
    -- Force: installments_count = 1, effective_until = effective_from
    IF NEW.frequency = 'ONCE' THEN
        NEW.installments_count := 1;
        NEW.effective_until := NEW.effective_from;
        RETURN NEW; -- Exit early, this case is fully handled
    END IF;

    -- =========================================================
    -- CASE 1: Clear installments_count for TRUE indefinite terms
    -- =========================================================
    -- If effective_until is being set to NULL (or already NULL)
    -- AND this is NOT a divided amount (loan/purchase),
    -- then clear any legacy installments_count.
    -- This prevents the "12 cuotas but indefinite" contradiction.
    IF NEW.effective_until IS NULL AND (NEW.is_divided_amount IS NULL OR NEW.is_divided_amount = FALSE) THEN
        NEW.installments_count := NULL;
        RETURN NEW; -- Exit early, no further calculations needed
    END IF;

    -- =========================================================
    -- CASE 2: Calculate effective_until from installments_count
    -- =========================================================
    -- Only process if installments_count is provided and > 0
    IF NEW.installments_count IS NOT NULL AND NEW.installments_count > 0 THEN
        -- Determine months per payment based on frequency
        months_per_period := CASE NEW.frequency
            WHEN 'MONTHLY' THEN 1
            WHEN 'BIMONTHLY' THEN 2
            WHEN 'QUARTERLY' THEN 3
            WHEN 'SEMIANNUALLY' THEN 6
            WHEN 'ANNUALLY' THEN 12
            WHEN 'ONCE' THEN 0
            ELSE 1
        END;

        -- Calculate effective_until: start + (count - 1) periods
        IF months_per_period = 0 THEN
            calculated_until := NEW.effective_from;
        ELSE
            calculated_until := NEW.effective_from +
                ((NEW.installments_count - 1) * months_per_period * INTERVAL '1 month');
        END IF;

        -- Only auto-calculate on INSERT
        -- or if relevant fields changed (not if only effective_until changed)
        IF TG_OP = 'INSERT' THEN
            NEW.effective_until := calculated_until;
        ELSIF TG_OP = 'UPDATE' THEN
            -- Only recalculate if these fields changed:
            -- - installments_count
            -- - frequency
            -- - effective_from
            -- DO NOT overwrite if only effective_until changed (manual pause)
            IF (OLD.installments_count IS DISTINCT FROM NEW.installments_count) OR
               (OLD.frequency IS DISTINCT FROM NEW.frequency) OR
               (OLD.effective_from IS DISTINCT FROM NEW.effective_from) THEN
                NEW.effective_until := calculated_until;
            END IF;
        END IF;

    ELSIF NEW.installments_count = 1 AND NEW.frequency = 'ONCE' THEN
        -- Special case: single occurrence
        IF TG_OP = 'INSERT' THEN
            NEW.effective_until := NEW.effective_from;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Verification Queries
-- =====================================================
-- After running this migration, all indefinite non-divided terms
-- should automatically get their installments_count cleared on next update.
--
-- To verify current bad data:
-- SELECT id, commitment_id, effective_until, installments_count, is_divided_amount
-- FROM terms
-- WHERE effective_until IS NULL 
--   AND installments_count IS NOT NULL
--   AND (is_divided_amount IS NULL OR is_divided_amount = FALSE);
--
-- To manually clean existing bad data (run AFTER this migration):
-- UPDATE terms
-- SET installments_count = NULL
-- WHERE effective_until IS NULL 
--   AND installments_count IS NOT NULL
--   AND (is_divided_amount IS NULL OR is_divided_amount = FALSE);
-- =====================================================
