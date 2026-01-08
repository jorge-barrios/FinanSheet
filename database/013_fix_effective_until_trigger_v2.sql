-- =====================================================
-- Fix: Prevent trigger from overwriting manual effective_until
-- =====================================================
-- This update ensures the trigger only recalculates effective_until
-- when relevant fields change (installments_count, frequency, effective_from).
--
-- PROBLEM: When manually closing a term (pause/version new term), the trigger
-- was overwriting the manual effective_until with the calculated value.
--
-- SOLUTION: Only recalculate on INSERT, or on UPDATE if relevant fields changed.
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_effective_until()
RETURNS TRIGGER AS $$
DECLARE
    months_per_period INTEGER;
    calculated_until DATE;
BEGIN
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

        -- CRITICAL CHANGE: Only auto-calculate on INSERT
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
            -- If only effective_until changed, keep the new value (manual override)
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

-- The trigger already exists, this just updates the function it calls
-- No need to recreate the trigger since it references the function by name

-- Verification query to test the fix:
-- 1. Find a term with installments
-- 2. Update only effective_until
-- 3. Verify effective_until is NOT recalculated
/*
-- Test: Update only effective_until on a term with installments
UPDATE terms
SET effective_until = '2025-06-30'
WHERE id = 'some-term-id-with-installments';

-- Check that effective_until stayed as '2025-06-30' and wasn't recalculated
SELECT effective_from, effective_until, installments_count
FROM terms
WHERE id = 'some-term-id-with-installments';
*/
