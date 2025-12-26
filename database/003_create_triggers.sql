-- =====================================================
-- Step 3: Create Triggers
-- =====================================================
-- Run this THIRD (after 002_create_tables.sql)
-- Attaches triggers to tables
-- =====================================================

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_categories_v2_updated_at ON categories_v2;
DROP TRIGGER IF EXISTS update_commitments_updated_at ON commitments;
DROP TRIGGER IF EXISTS update_terms_updated_at ON terms;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS normalize_category_v2_name ON categories_v2;
DROP TRIGGER IF EXISTS calculate_terms_amount_in_base ON terms;
DROP TRIGGER IF EXISTS calculate_payments_amount_in_base ON payments;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_v2_updated_at
  BEFORE UPDATE ON categories_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commitments_updated_at
  BEFORE UPDATE ON commitments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_terms_updated_at
  BEFORE UPDATE ON terms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for category name normalization
CREATE TRIGGER normalize_category_v2_name
  BEFORE INSERT OR UPDATE ON categories_v2
  FOR EACH ROW
  EXECUTE FUNCTION normalize_category_name();

-- Triggers for amount calculations
CREATE TRIGGER calculate_terms_amount_in_base
  BEFORE INSERT OR UPDATE ON terms
  FOR EACH ROW
  EXECUTE FUNCTION calculate_amount_in_base();

CREATE TRIGGER calculate_payments_amount_in_base
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION calculate_amount_in_base();

-- ✅ All triggers created successfully
