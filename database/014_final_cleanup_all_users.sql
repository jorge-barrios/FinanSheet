-- =====================================================
-- Final Cleanup - All Users
-- =====================================================
-- This script:
-- 1. Migrates commitments using "Shopping" to "Compras" 
-- 2. Deletes "Shopping" category
-- 3. Deletes ALL duplicate custom categories for ALL users
-- 4. Keeps only truly custom categories per user
-- =====================================================

-- Step 1: Merge Shopping → Compras
-- Update any commitments using "Shopping" to use "Compras" instead
UPDATE commitments 
SET category_id = '35b72cd2-9656-4ac5-9f07-63a25f8dd104' -- Compras
WHERE category_id = 'a1da02d3-0d48-4293-aaed-1f8c1dc22380'; -- Shopping

-- Delete Shopping category
DELETE FROM categories_v2 
WHERE id = 'a1da02d3-0d48-4293-aaed-1f8c1dc22380';

-- Step 2: Delete duplicate Spanish categories for ALL users
-- These are duplicates of global categories
DELETE FROM categories_v2 
WHERE is_global = FALSE
  AND name IN (
    'Ahorro',        -- global: savings
    'Alimentación',  -- global: food
    'Deuda',         -- global: debt
    'Donaciones',    -- global: donations
    'Educación',     -- global: education
    'Entretenimiento', -- global: entertainment
    'Hogar',         -- global: home
    'Impuestos',     -- global: taxes
    'Mascotas',      -- global: pets
    'Negocios',      -- global: business
    'Otros',         -- global: other
    'Personal',      -- global: personal
    'Regalos',       -- global: gifts
    'Salud',         -- global: health
    'Seguros',       -- global: insurance
    'Servicios',     -- global: utilities (or could be custom, but duplicated)
    'Suscripciones', -- global: subscriptions
    'Transporte',    -- global: transport
    'Viajes',        -- global: travel
    'Vivienda'       -- global: housing
  );

-- Step 3: Verify final state
SELECT 
  'Global categories' as type,
  COUNT(*) as count
FROM categories_v2 
WHERE is_global = TRUE

UNION ALL

SELECT 
  'Custom categories (total across all users)' as type,
  COUNT(*) as count
FROM categories_v2 
WHERE is_global = FALSE

UNION ALL

SELECT 
  CONCAT('User: ', user_id) as type,
  COUNT(*) as count
FROM categories_v2 
WHERE is_global = FALSE
GROUP BY user_id;

-- Show all remaining custom categories
SELECT 
  user_id,
  name,
  COUNT(*) OVER (PARTITION BY user_id) as user_total
FROM categories_v2 
WHERE is_global = FALSE
ORDER BY user_id, name;

-- Verify: Should show ~20 global + minimal custom (1-3 per user if any)
