-- =====================================================
-- Cleanup script for Dividendo GHM commitment
-- Run this in Supabase SQL Editor to reset to clean state
-- =====================================================

-- Variables
DO $$
DECLARE
    commitment_uuid UUID := 'a7a9d679-959d-4152-911b-6c0d0c2ae769';
    term_v1_uuid UUID;
    original_dates TEXT[] := ARRAY['2021-07-01', '2021-08-01', '2021-09-01', '2021-10-01', '2021-11-01'];
    payment_rec RECORD;
    idx INT := 1;
BEGIN
    -- Find the v1 term
    SELECT id INTO term_v1_uuid
    FROM terms
    WHERE commitment_id = commitment_uuid AND version = 1;

    IF term_v1_uuid IS NULL THEN
        RAISE NOTICE 'No v1 term found!';
        RETURN;
    END IF;

    RAISE NOTICE 'Found v1 term: %', term_v1_uuid;

    -- Delete all payment_adjustments for this commitment's payments
    DELETE FROM payment_adjustments
    WHERE payment_id IN (
        SELECT id FROM payments WHERE commitment_id = commitment_uuid
    );
    RAISE NOTICE 'Deleted payment adjustments';

    -- Update all payments to v1 term with original dates
    FOR payment_rec IN
        SELECT id, period_date
        FROM payments
        WHERE commitment_id = commitment_uuid
        ORDER BY period_date
    LOOP
        IF idx <= array_length(original_dates, 1) THEN
            UPDATE payments
            SET term_id = term_v1_uuid,
                period_date = original_dates[idx]::DATE
            WHERE id = payment_rec.id;
            RAISE NOTICE 'Updated payment % -> %', payment_rec.period_date, original_dates[idx];
        END IF;
        idx := idx + 1;
    END LOOP;

    -- Delete all terms except v1
    DELETE FROM terms
    WHERE commitment_id = commitment_uuid AND version > 1;
    RAISE NOTICE 'Deleted extra terms';

    -- Reset v1 term
    UPDATE terms
    SET effective_until = NULL,
        effective_from = '2021-07-01'
    WHERE id = term_v1_uuid;
    RAISE NOTICE 'Reset v1 term to original state';

    RAISE NOTICE 'Cleanup complete!';
END $$;

-- Verify final state
SELECT
    'Term' as type,
    id::TEXT,
    version::TEXT as info,
    effective_from::TEXT as date1,
    effective_until::TEXT as date2
FROM terms
WHERE commitment_id = 'a7a9d679-959d-4152-911b-6c0d0c2ae769'
ORDER BY version;

SELECT
    'Payment' as type,
    id::TEXT,
    period_date::TEXT as info,
    term_id::TEXT as date1,
    NULL as date2
FROM payments
WHERE commitment_id = 'a7a9d679-959d-4152-911b-6c0d0c2ae769'
ORDER BY period_date;
