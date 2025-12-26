-- =====================================================
-- FinanSheet v2 Seed Data
-- =====================================================
-- Run this AFTER migration_v2_schema.sql succeeds
-- Inserts global categories
-- =====================================================

-- Temporarily disable RLS for seed data insertion
ALTER TABLE categories_v2 DISABLE ROW LEVEL SECURITY;

-- Insert global categories
INSERT INTO categories_v2 (id, user_id, name, normalized_name, is_global)
VALUES
  (gen_random_uuid(), NULL, 'Sin categoría', 'sin categoría', TRUE),
  (gen_random_uuid(), NULL, 'Vivienda', 'vivienda', TRUE),
  (gen_random_uuid(), NULL, 'Transporte', 'transporte', TRUE),
  (gen_random_uuid(), NULL, 'Alimentación', 'alimentación', TRUE),
  (gen_random_uuid(), NULL, 'Salud', 'salud', TRUE),
  (gen_random_uuid(), NULL, 'Educación', 'educación', TRUE),
  (gen_random_uuid(), NULL, 'Entretenimiento', 'entretenimiento', TRUE),
  (gen_random_uuid(), NULL, 'Servicios', 'servicios', TRUE),
  (gen_random_uuid(), NULL, 'Sueldo', 'sueldo', TRUE),
  (gen_random_uuid(), NULL, 'Inversiones', 'inversiones', TRUE)
ON CONFLICT DO NOTHING;

-- Re-enable RLS
ALTER TABLE categories_v2 ENABLE ROW LEVEL SECURITY;

-- Verify insertion
SELECT COUNT(*) as global_categories_count 
FROM categories_v2 
WHERE is_global = TRUE;
