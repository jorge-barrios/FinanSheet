-- =====================================================
-- 016_validate_payment_term.sql
-- =====================================================
-- Validates that a payment's term_id corresponds to the
-- term that covers the payment's period_date.
--
-- This prevents data inconsistencies where a payment
-- might be incorrectly associated with the wrong term.
--
-- Uses the existing get_active_term() function.
-- =====================================================

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS validate_payment_term ON payments;
DROP FUNCTION IF EXISTS validate_payment_term_period();

-- Function: Validate that term_id matches the term that covers period_date
CREATE OR REPLACE FUNCTION validate_payment_term_period()
RETURNS TRIGGER AS $$
DECLARE
    v_correct_term_id UUID;
BEGIN
    -- Use the existing get_active_term function to find the correct term
    v_correct_term_id := get_active_term(NEW.commitment_id, NEW.period_date);

    -- If no term covers this period, block the payment
    -- This happens when trying to pay for a "paused" month
    IF v_correct_term_id IS NULL THEN
        RAISE EXCEPTION 'No hay término activo para el período %. Este mes está pausado o fuera del rango del compromiso.',
            NEW.period_date
        USING ERRCODE = 'P0001';  -- Custom error code for application handling
    END IF;

    -- If the provided term_id doesn't match the correct one, block the payment
    -- This catches bugs in the frontend that might send the wrong term_id
    IF NEW.term_id != v_correct_term_id THEN
        RAISE EXCEPTION 'El term_id (%) no coincide con el término que cubre el período % (correcto: %)',
            NEW.term_id, NEW.period_date, v_correct_term_id
        USING ERRCODE = 'P0002';  -- Different error code for this case
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
-- Runs BEFORE INSERT OR UPDATE to catch issues before data is written
CREATE TRIGGER validate_payment_term
    BEFORE INSERT OR UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION validate_payment_term_period();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these after applying the migration to verify it works:

-- Test 1: This should succeed (assuming term exists for the period)
-- INSERT INTO payments (commitment_id, term_id, period_date, ...)
-- VALUES ('...', '...', '2025-01-01', ...);

-- Test 2: This should fail with "No hay término activo para el período"
-- INSERT INTO payments (commitment_id, term_id, period_date, ...)
-- VALUES ('...', '...', '1990-01-01', ...);  -- Unlikely to have a term

-- =====================================================
-- NOTES
-- =====================================================
-- 1. This trigger uses get_active_term() which already exists in 001_create_functions.sql
--    but was not being used. Now it serves as the source of truth for term↔period validation.
--
-- 2. The error codes (P0001, P0002) can be used by the frontend to show appropriate messages.
--
-- 3. This trigger runs on both INSERT and UPDATE because:
--    - INSERT: Validates new payments
--    - UPDATE: Prevents changing term_id or period_date to invalid combinations
--
-- 4. Performance: get_active_term() uses indexed columns (commitment_id, effective_from, effective_until)
--    so this should be fast even with many terms.
