-- =====================================================
-- Category System Refactor - Step 1: Database Setup
-- =====================================================
-- This migration adds support for:
-- 1. base_category_key to categories_v2 (links to i18n keys)
-- 2. user_category_preferences table (hide/show preferences)
-- 3. Seeds 19 global base categories with fixed UUIDs
-- =====================================================

-- Add base_category_key column to categories_v2
-- This links categories to i18n translation keys
ALTER TABLE categories_v2 
ADD COLUMN IF NOT EXISTS base_category_key TEXT;

CREATE INDEX IF NOT EXISTS idx_categories_v2_base_key 
ON categories_v2(base_category_key);

COMMENT ON COLUMN categories_v2.base_category_key IS 
'Links to base category i18n key (e.g., housing, transport). Used for translation lookups.';

-- Create user_category_preferences table
CREATE TABLE IF NOT EXISTS user_category_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_category_key TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, base_category_key)
);

CREATE INDEX IF NOT EXISTS idx_user_category_prefs_user 
ON user_category_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_user_category_prefs_hidden 
ON user_category_preferences(user_id, is_hidden) 
WHERE is_hidden = TRUE;

COMMENT ON TABLE user_category_preferences IS 
'Stores user preferences for base categories (e.g., which ones to hide from dropdown)';

-- Enable RLS
ALTER TABLE user_category_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own category preferences" ON user_category_preferences;
DROP POLICY IF EXISTS "Users can insert their own category preferences" ON user_category_preferences;
DROP POLICY IF EXISTS "Users can update their own category preferences" ON user_category_preferences;
DROP POLICY IF EXISTS "Users can delete their own category preferences" ON user_category_preferences;
DROP POLICY IF EXISTS "Anyone can view global categories" ON categories_v2;

-- RLS Policies for user_category_preferences
CREATE POLICY "Users can view their own category preferences"
  ON user_category_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own category preferences"
  ON user_category_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own category preferences"
  ON user_category_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own category preferences"
  ON user_category_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_category_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_category_preferences_updated_at
  BEFORE UPDATE ON user_category_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_category_preferences_updated_at();

-- =====================================================
-- Seed Global Base Categories (19 total)
-- =====================================================
-- These are GLOBAL categories (user_id = NULL, is_global = TRUE)
-- Frontend translates them via i18n based on base_category_key
-- Fixed UUIDs for consistency across deployments
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

-- Add RLS policy to allow everyone to view global categories
CREATE POLICY "Anyone can view global categories"
  ON categories_v2 FOR SELECT
  USING (is_global = TRUE);

-- ✅ Migration complete
-- 
-- Next steps:
-- 1. Update categoryService.v2.ts to load globals from DB
-- 2. Integrate into App.tsx
-- 3. Migrate existing user categories to categories_v2
-- 4. Clean up old duplicate categories

