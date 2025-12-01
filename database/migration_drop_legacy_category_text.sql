-- ============================================================================
-- MIGRATION: Drop Legacy category TEXT Field
-- ============================================================================
-- This migration removes the old TEXT-based category column from expenses.
-- PREREQUISITE: Application code must be using category_id with JOIN.
-- EXECUTE ONLY AFTER: 1 week of verification that JOIN implementation works.
-- ============================================================================

-- Step 1: Verify all expenses have category_id (NOT NULL)
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM expenses
    WHERE category_id IS NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION '% expenses have NULL category_id! Aborting migration.', orphan_count;
    END IF;

    RAISE NOTICE '✓ Verification passed: All % expenses have category_id', (SELECT COUNT(*) FROM expenses);
END $$;

-- Step 2: Verify FK integrity (no orphaned expenses)
DO $$
DECLARE
    broken_fk_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO broken_fk_count
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE c.id IS NULL;

    IF broken_fk_count > 0 THEN
        RAISE EXCEPTION '% expenses have broken FK to categories! Aborting migration.', broken_fk_count;
    END IF;

    RAISE NOTICE '✓ Verification passed: All FKs are valid';
END $$;

-- Step 3: Show current schema (before)
SELECT
    'BEFORE DROP' as status,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'expenses'
  AND column_name IN ('category', 'category_id')
ORDER BY column_name;

-- Step 4: Drop the old category TEXT column
DO $$
BEGIN
    ALTER TABLE expenses DROP COLUMN IF EXISTS category;
    RAISE NOTICE '✓ Dropped legacy category (TEXT) column';
END $$;

-- Step 5: Show final schema (after)
SELECT
    'AFTER DROP' as status,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'expenses'
  AND column_name IN ('category', 'category_id')
ORDER BY column_name;

-- Expected output: Only category_id (uuid, NOT NULL), no category (text)

-- Step 6: Final verification
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'expenses'
          AND column_name = 'category'
    ) THEN
        RAISE EXCEPTION 'Migration failed: category column still exists!';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'expenses'
          AND column_name = 'category_id'
    ) THEN
        RAISE EXCEPTION 'Migration failed: category_id column missing!';
    END IF;

    RAISE NOTICE '✓✓✓ Migration completed successfully ✓✓✓';
    RAISE NOTICE 'Legacy category (TEXT) column has been removed';
    RAISE NOTICE 'Only category_id (UUID) remains as the source of truth';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- - ✓ Verified all expenses have category_id (NOT NULL)
-- - ✓ Verified FK integrity to categories table
-- - ✓ Dropped legacy category (TEXT) column
-- - ✓ Confirmed only category_id (UUID) remains
--
-- Next steps:
-- - Application now uses JOIN to fetch category names
-- - FK ensures data integrity
-- - Renaming categories automatically updates all expenses (via JOIN)
-- ============================================================================
