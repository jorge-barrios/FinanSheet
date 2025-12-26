-- =====================================================
-- Fix: Auto-calculate effective_until based on installments_count
-- =====================================================
-- This trigger ensures effective_until is always correctly calculated
-- when installments_count is provided.
-- 
-- Formula: effective_until = effective_from + (installments_count - 1) * frequency_months
-- Example: 3 cuotas MONTHLY desde Nov 2025 → Nov, Dic, Ene → effective_until = 2026-01-01
-- =====================================================

-- Step 1: Create the function
CREATE OR REPLACE FUNCTION calculate_effective_until()
RETURNS TRIGGER AS $$
DECLARE
    months_per_period INTEGER;
BEGIN
    -- Only calculate if installments_count is provided
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
        -- For ONCE frequency, effective_until = effective_from
        IF months_per_period = 0 THEN
            NEW.effective_until := NEW.effective_from;
        ELSE
            NEW.effective_until := NEW.effective_from + 
                ((NEW.installments_count - 1) * months_per_period * INTERVAL '1 month');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create or replace the trigger
DROP TRIGGER IF EXISTS calculate_effective_until_trigger ON terms;

CREATE TRIGGER calculate_effective_until_trigger
    BEFORE INSERT OR UPDATE ON terms
    FOR EACH ROW
    EXECUTE FUNCTION calculate_effective_until();

-- Step 3: Fix existing data
UPDATE terms
SET effective_until = effective_from + 
    ((installments_count - 1) * 
        CASE frequency
            WHEN 'MONTHLY' THEN 1
            WHEN 'BIMONTHLY' THEN 2
            WHEN 'QUARTERLY' THEN 3
            WHEN 'SEMIANNUALLY' THEN 6
            WHEN 'ANNUALLY' THEN 12
            ELSE 0
        END * INTERVAL '1 month')
WHERE installments_count IS NOT NULL 
  AND installments_count > 1;

-- Step 4: Verify the fix
SELECT 
    c.name,
    t.effective_from,
    t.effective_until,
    t.installments_count,
    (t.effective_from + ((t.installments_count - 1) * INTERVAL '1 month'))::DATE AS expected,
    CASE 
        WHEN t.effective_until = (t.effective_from + ((t.installments_count - 1) * INTERVAL '1 month'))::DATE 
        THEN '✅ FIXED'
        ELSE '❌ STILL WRONG'
    END AS status
FROM terms t
JOIN commitments c ON c.id = t.commitment_id
WHERE t.installments_count IS NOT NULL 
  AND t.installments_count > 1;

-- ✅ Done! The trigger will now auto-calculate effective_until for new/updated terms
