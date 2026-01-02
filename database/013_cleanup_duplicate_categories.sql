-- =====================================================
-- Cleanup Duplicate Categories
-- =====================================================
-- This script:
-- 1. Updates commitments to use global categories instead of duplicates
-- 2. Deletes duplicate custom categories
-- 3. Keeps only truly custom categories (Compras, Shopping, Sueldo)
-- =====================================================

-- Step 1: Map Spanish duplicates to global categories
-- Update commitments that use Spanish custom categories to use global equivalents

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000008' -- global savings
WHERE category_id = '5b8f519b-45be-4c87-ad74-e4fa75ea1b42'; -- Ahorro

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000004' -- global food
WHERE category_id = '5eee9f79-e0eb-4617-84d3-21a2b83fe59d'; -- Alimentación

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000007' -- global debt
WHERE category_id = 'b2d70200-b646-49eb-b955-01df9f95821a'; -- Deuda

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-00000000000b' -- global education
WHERE category_id = '9b274a46-a1c5-4093-84ff-15cae71057e5'; -- Educación

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-00000000000a' -- global entertainment
WHERE category_id = '9720f147-d363-4635-a5b6-8578f10a03bd'; -- Entretenimiento

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-00000000000d' -- global home
WHERE category_id = '27880c46-3e95-4d15-b2c3-97ed3f0eeb6c'; -- Hogar

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000014' -- global other
WHERE category_id = '55f556ca-6222-4e4f-a413-d69b5e3c99fd'; -- Otros

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000005' -- global health
WHERE category_id = '1a6a2314-57b6-42ff-b026-1d97c091246d'; -- Salud

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000002' -- global utilities (assuming "Servicios" = utilities)
WHERE category_id = 'b64fdcfb-2223-46d9-83f0-6dd5fbb1ade5'; -- Servicios

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000006' -- global subscriptions
WHERE category_id = '1dcae6dc-8153-47df-b813-f483c0d54c89'; -- Suscripciones

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000003' -- global transport
WHERE category_id = 'c6493814-c165-4658-8ada-11a6d0d2c992'; -- Transporte

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000001' -- global housing
WHERE category_id = '31c3631a-bcf0-4107-b1a9-bd1f931d5d04'; -- Vivienda

-- Step 2: Map English duplicates to global categories

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-00000000000b' -- global education
WHERE category_id = '263a7d55-75de-4b2d-adfa-942ae0037b97'; -- Education

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-00000000000a' -- global entertainment
WHERE category_id = '267ed2ad-54a6-4ab3-926b-ac1d79106b02'; -- Entertainment

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000004' -- global food
WHERE category_id = '058730bf-81df-49a2-946c-e3e66315b3d8'; -- Food

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000005' -- global health
WHERE category_id = '80c849d9-5eb9-4a27-9863-7dc40fb5e270'; -- Health

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000001' -- global housing
WHERE category_id = '79b1ff17-fd98-45ef-baaf-7d913773b0d1'; -- Housing

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000008' -- global savings
WHERE category_id = '5d058db6-4ddb-4ee9-8a00-b5a7c008b133'; -- Savings

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000003' -- global transport
WHERE category_id = 'e4e08528-901f-41d2-ae0d-3ba6b2e1660d'; -- Transport

UPDATE commitments 
SET category_id = '10000000-0000-0000-0000-000000000002' -- global utilities
WHERE category_id = '73c54e27-bfe1-4f35-9b30-17fc00f9ac42'; -- Utilities

-- Step 3: Delete duplicate custom categories (keep only Compras, Shopping, Sueldo)
DELETE FROM categories_v2 
WHERE user_id = 'bce0062c-d7cb-4b14-bd2a-4c90d39042c8'
  AND is_global = FALSE
  AND name NOT IN ('Compras', 'Shopping', 'Sueldo');

-- Step 4: Verify cleanup
SELECT 
  'Global categories' as type,
  COUNT(*) as count
FROM categories_v2 
WHERE is_global = TRUE

UNION ALL

SELECT 
  'Custom categories (should be 3)' as type,
  COUNT(*) as count
FROM categories_v2 
WHERE user_id = 'bce0062c-d7cb-4b14-bd2a-4c90d39042c8'
  AND is_global = FALSE;

-- Show remaining custom categories
SELECT id, name 
FROM categories_v2 
WHERE user_id = 'bce0062c-d7cb-4b14-bd2a-4c90d39042c8'
  AND is_global = FALSE
ORDER BY name;
