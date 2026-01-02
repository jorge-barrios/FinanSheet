-- Migration: Merge custom categories that match base keys (e.g. 'donations', 'transport') into global categories
-- This fixes the issue where users see 'donations' instead of 'Donaciones' because they are using a legacy custom category.

-- 1. Create a temporary mapping of custom_id -> global_id based on name matching
-- We match by checking if the custom category's normalized name matches a global category's base_category_key
-- or if it strictly matches the global category's English name (which is often the key)

DO $$ 
DECLARE 
    r RECORD;
    target_global_id UUID;
    moved_count INT := 0;
BEGIN
    -- For each custom category (is_global = false)
    FOR r IN SELECT * FROM categories_v2 WHERE is_global = false LOOP
        
        -- Try to find a matching global category
        -- Logic: 
        -- 1. Match name against base_category_key (case insensitive)
        -- 2. Match name against common variations? For now, stick to direct key match which handles "donations", "transport", "debt"
        
        SELECT id INTO target_global_id 
        FROM categories_v2 
        WHERE is_global = true 
        AND (
            base_category_key = lower(trim(r.name)) 
            OR 
            -- Also handle cases where name might be "Housing" (Capitalized)
            base_category_key = lower(trim(r.name))
        )
        LIMIT 1;

        -- If match found, migrate commitments and delete custom category
        IF target_global_id IS NOT NULL THEN
            RAISE NOTICE 'Merging custom category "%" (%) into global category %', r.name, r.id, target_global_id;

            -- Update commitments
            UPDATE commitments 
            SET category_id = target_global_id 
            WHERE category_id = r.id;

            -- Delete custom category
            DELETE FROM categories_v2 WHERE id = r.id;

            moved_count := moved_count + 1;
        END IF;

    END LOOP;

    RAISE NOTICE 'Total custom categories merged: %', moved_count;
END $$;
