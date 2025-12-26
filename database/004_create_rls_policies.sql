-- =====================================================
-- Step 4: Enable RLS and Create Policies
-- =====================================================
-- Run this FOURTH (after 003_create_triggers.sql)
-- Enables Row Level Security and creates policies
-- =====================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

DROP POLICY IF EXISTS "Users can view own and global categories" ON categories_v2;
DROP POLICY IF EXISTS "Users can insert own categories" ON categories_v2;
DROP POLICY IF EXISTS "Users can update own categories" ON categories_v2;
DROP POLICY IF EXISTS "Users can delete own categories" ON categories_v2;

DROP POLICY IF EXISTS "Users can view own commitments" ON commitments;
DROP POLICY IF EXISTS "Users can insert own commitments" ON commitments;
DROP POLICY IF EXISTS "Users can update own commitments" ON commitments;
DROP POLICY IF EXISTS "Users can delete own commitments" ON commitments;

DROP POLICY IF EXISTS "Users can view own terms" ON terms;
DROP POLICY IF EXISTS "Users can insert own terms" ON terms;
DROP POLICY IF EXISTS "Users can update own terms" ON terms;
DROP POLICY IF EXISTS "Users can delete own terms" ON terms;

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON payments;
DROP POLICY IF EXISTS "Users can update own payments" ON payments;
DROP POLICY IF EXISTS "Users can delete own payments" ON payments;

DROP POLICY IF EXISTS "Anyone can view exchange rates" ON exchange_rates;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- CATEGORIES POLICIES
CREATE POLICY "Users can view own and global categories"
  ON categories_v2 FOR SELECT
  USING (user_id IS NOT DISTINCT FROM auth.uid() OR is_global = TRUE);

CREATE POLICY "Users can insert own categories"
  ON categories_v2 FOR INSERT
  WITH CHECK (user_id IS NOT DISTINCT FROM auth.uid() AND is_global = FALSE);

CREATE POLICY "Users can update own categories"
  ON categories_v2 FOR UPDATE
  USING (user_id IS NOT DISTINCT FROM auth.uid() AND is_global = FALSE);

CREATE POLICY "Users can delete own categories"
  ON categories_v2 FOR DELETE
  USING (user_id IS NOT DISTINCT FROM auth.uid() AND is_global = FALSE);

-- COMMITMENTS POLICIES
CREATE POLICY "Users can view own commitments"
  ON commitments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own commitments"
  ON commitments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own commitments"
  ON commitments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own commitments"
  ON commitments FOR DELETE
  USING (auth.uid() = user_id);

-- TERMS POLICIES
CREATE POLICY "Users can view own terms"
  ON terms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM commitments
      WHERE commitments.id = terms.commitment_id
      AND commitments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own terms"
  ON terms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM commitments
      WHERE commitments.id = terms.commitment_id
      AND commitments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own terms"
  ON terms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM commitments
      WHERE commitments.id = terms.commitment_id
      AND commitments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own terms"
  ON terms FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM commitments
      WHERE commitments.id = terms.commitment_id
      AND commitments.user_id = auth.uid()
    )
  );

-- PAYMENTS POLICIES
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM commitments
      WHERE commitments.id = payments.commitment_id
      AND commitments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own payments"
  ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM commitments
      WHERE commitments.id = payments.commitment_id
      AND commitments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own payments"
  ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM commitments
      WHERE commitments.id = payments.commitment_id
      AND commitments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own payments"
  ON payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM commitments
      WHERE commitments.id = payments.commitment_id
      AND commitments.user_id = auth.uid()
    )
  );

-- EXCHANGE_RATES POLICIES
CREATE POLICY "Anyone can view exchange rates"
  ON exchange_rates FOR SELECT
  TO authenticated
  USING (TRUE);

-- ✅ RLS enabled and policies created successfully
