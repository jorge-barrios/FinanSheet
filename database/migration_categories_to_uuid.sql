-- ============================================================================
-- MIGRATION: Categories to UUID-based Multi-User Architecture
-- ============================================================================
-- This migration transforms the categories table from TEXT-based to UUID-based
-- to support proper multi-user isolation while maintaining data integrity.
--
-- BEFORE RUNNING: Backup your data!
-- ESTIMATED TIME: 1-2 minutes for small datasets
-- DOWNTIME: Minimal (app should continue working during migration)
-- ============================================================================

-- ============================================================================
-- PHASE 1: ADD NEW STRUCTURE (Non-Breaking)
-- ============================================================================

-- Step 1.1: Add id column to categories (UUID)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Step 1.2: Populate UUIDs for existing categories
UPDATE categories SET id = gen_random_uuid() WHERE id IS NULL;

-- Step 1.3: Make id NOT NULL
ALTER TABLE categories ALTER COLUMN id SET NOT NULL;

-- Step 1.4: Add category_id column to expenses (new UUID-based foreign key)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_id UUID;

-- Step 1.5: Create index on category_id for performance
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);

-- ============================================================================
-- PHASE 2: DATA MIGRATION
-- ============================================================================

-- Step 2.1: Create mapping from category names to UUIDs for the main user
-- This maps each expense's TEXT category to the correct category UUID

DO $$
DECLARE
    expense_record RECORD;
    category_uuid UUID;
    main_user_id UUID := 'bce0062c-d7cb-4b14-bd2a-4c90d39042c8';
BEGIN
    -- Loop through all expenses
    FOR expense_record IN
        SELECT id, category, user_id FROM expenses WHERE category_id IS NULL
    LOOP
        -- Find or create the category for this user
        SELECT id INTO category_uuid
        FROM categories
        WHERE name = expense_record.category
          AND user_id = expense_record.user_id
        LIMIT 1;

        -- If category doesn't exist for this user, create it
        IF category_uuid IS NULL THEN
            -- First, try to find a category with this name for the main user
            SELECT id INTO category_uuid
            FROM categories
            WHERE name = expense_record.category
              AND user_id = main_user_id
            LIMIT 1;

            -- If still not found, create a new category for this user
            IF category_uuid IS NULL THEN
                INSERT INTO categories (name, user_id)
                VALUES (expense_record.category, expense_record.user_id)
                RETURNING id INTO category_uuid;

                RAISE NOTICE 'Created new category "%" for user %', expense_record.category, expense_record.user_id;
            END IF;
        END IF;

        -- Update the expense with the category UUID
        UPDATE expenses
        SET category_id = category_uuid
        WHERE id = expense_record.id;
    END LOOP;

    RAISE NOTICE 'Migration completed successfully';
END $$;

-- Step 2.2: Verify all expenses have category_id assigned
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM expenses
    WHERE category_id IS NULL;

    IF orphan_count > 0 THEN
        RAISE WARNING 'WARNING: % expenses still have NULL category_id!', orphan_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All expenses have category_id assigned';
    END IF;
END $$;

-- ============================================================================
-- PHASE 3: STRUCTURAL CHANGES (Breaking Changes)
-- ============================================================================

-- Step 3.0: Drop old FOREIGN KEY from expenses that references categories(name)
-- This must be done BEFORE dropping the PRIMARY KEY on categories
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_fkey;

-- Step 3.1: Drop old PRIMARY KEY from categories
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_pkey;

-- Step 3.2: Add new PRIMARY KEY on id
ALTER TABLE categories ADD PRIMARY KEY (id);

-- Step 3.3: Ensure UNIQUE constraint on (name, user_id) exists
-- This already exists from migration_add_authentication.sql
-- But we verify it here
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'categories_name_user_unique'
    ) THEN
        ALTER TABLE categories ADD CONSTRAINT categories_name_user_unique UNIQUE(name, user_id);
    END IF;
END $$;

-- Step 3.4: Make category_id NOT NULL in expenses (after data migration)
ALTER TABLE expenses ALTER COLUMN category_id SET NOT NULL;

-- Step 3.5: Add foreign key constraint from expenses to categories
ALTER TABLE expenses
ADD CONSTRAINT fk_expenses_category
FOREIGN KEY (category_id) REFERENCES categories(id)
ON DELETE RESTRICT;  -- Prevent deleting categories that are in use

-- Step 3.6: Drop old TEXT-based category column (CAREFUL!)
-- Commented out for safety - uncomment after verifying everything works
-- ALTER TABLE expenses DROP COLUMN category;

-- ============================================================================
-- PHASE 4: VERIFICATION
-- ============================================================================

-- Step 4.1: Verify categories structure
SELECT
    'Categories Structure' as check_name,
    COUNT(*) as total_categories,
    COUNT(DISTINCT user_id) as unique_users
FROM categories;

-- Step 4.2: Verify expenses structure
SELECT
    'Expenses Structure' as check_name,
    COUNT(*) as total_expenses,
    COUNT(category_id) as expenses_with_category_id,
    COUNT(category) as expenses_with_category_text
FROM expenses;

-- Step 4.3: Show category distribution by user
SELECT
    user_id,
    COUNT(*) as category_count,
    array_agg(name ORDER BY name) as categories
FROM categories
GROUP BY user_id
ORDER BY user_id;

-- Step 4.4: Verify foreign key integrity
SELECT
    'Orphaned Expenses' as check_name,
    COUNT(*) as count
FROM expenses e
LEFT JOIN categories c ON e.category_id = c.id
WHERE c.id IS NULL;

-- ============================================================================
-- PHASE 5: ROLLBACK SCRIPT (In case of emergency)
-- ============================================================================

-- UNCOMMENT ONLY IF YOU NEED TO ROLLBACK:
/*
-- Rollback Step 1: Re-populate category TEXT from category_id
UPDATE expenses e
SET category = c.name
FROM categories c
WHERE e.category_id = c.id;

-- Rollback Step 2: Drop new constraints
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS fk_expenses_category;
ALTER TABLE expenses ALTER COLUMN category_id DROP NOT NULL;

-- Rollback Step 3: Drop new columns
ALTER TABLE expenses DROP COLUMN IF EXISTS category_id;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_pkey;

-- Rollback Step 4: Restore old PRIMARY KEY
ALTER TABLE categories ADD PRIMARY KEY (name);
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Update application code to use category_id instead of category name
-- 2. Test thoroughly with multiple users
-- 3. After 100% confidence, uncomment Step 3.6 to drop old category column
-- ============================================================================
