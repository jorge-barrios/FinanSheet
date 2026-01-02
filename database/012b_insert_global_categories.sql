-- =====================================================
-- Insert Global Categories ONLY
-- =====================================================
-- Run this if you already ran the main migration
-- and just need to insert the 19 global categories
-- =====================================================

INSERT INTO categories_v2 (id, user_id, name, base_category_key, is_global, created_at, updated_at)
VALUES 
  ('10000000-0000-0000-0000-000000000001', NULL, 'housing', 'housing', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000002', NULL, 'utilities', 'utilities', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000003', NULL, 'transport', 'transport', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000004', NULL, 'food', 'food', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000005', NULL, 'health', 'health', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000006', NULL, 'subscriptions', 'subscriptions', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000007', NULL, 'debt', 'debt', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000008', NULL, 'savings', 'savings', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000009', NULL, 'personal', 'personal', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-00000000000a', NULL, 'entertainment', 'entertainment', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-00000000000b', NULL, 'education', 'education', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-00000000000c', NULL, 'insurance', 'insurance', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-00000000000d', NULL, 'home', 'home', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-00000000000e', NULL, 'pets', 'pets', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-00000000000f', NULL, 'business', 'business', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000010', NULL, 'gifts', 'gifts', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000011', NULL, 'donations', 'donations', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000012', NULL, 'travel', 'travel', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000013', NULL, 'taxes', 'taxes', TRUE, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000014', NULL, 'other', 'other', TRUE, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Verify insertion
SELECT COUNT(*) as global_categories_count 
FROM categories_v2 
WHERE is_global = TRUE;
