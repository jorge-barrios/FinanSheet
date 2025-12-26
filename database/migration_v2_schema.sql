-- =====================================================
-- FinanSheet v2 Schema Migration (IDEMPOTENT VERSION)
-- =====================================================
-- This migration creates the new v2 architecture.
-- Safe to run multiple times - drops existing objects first.
-- =====================================================

-- =====================================================
-- CLEANUP: Drop existing v2 objects if they exist
-- =====================================================

-- Drop policies first (they depend on tables)
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

-- Drop triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_categories_v2_updated_at ON categories_v2;
DROP TRIGGER IF EXISTS update_commitments_updated_at ON commitments;
DROP TRIGGER IF EXISTS update_terms_updated_at ON terms;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS normalize_category_v2_name ON categories_v2;
DROP TRIGGER IF EXISTS calculate_terms_amount_in_base ON terms;
DROP TRIGGER IF EXISTS calculate_payments_amount_in_base ON payments;

-- Drop tables (CASCADE removes dependent objects)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS terms CASCADE;
DROP TABLE IF EXISTS commitments CASCADE;
DROP TABLE IF EXISTS categories_v2 CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS exchange_rates CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS normalize_category_name();
DROP FUNCTION IF EXISTS calculate_amount_in_base();
DROP FUNCTION IF EXISTS get_active_term(UUID, DATE);
DROP FUNCTION IF EXISTS get_exchange_rate(TEXT, TEXT, DATE);

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  base_currency TEXT NOT NULL DEFAULT 'CLP',
  locale TEXT NOT NULL DEFAULT 'es-CL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. CATEGORIES TABLE (Enhanced)
-- =====================================================
CREATE TABLE categories_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT,
  is_global BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT categories_v2_unique_per_user UNIQUE(user_id, normalized_name)
);

CREATE INDEX idx_categories_v2_user_id ON categories_v2(user_id);
CREATE INDEX idx_categories_v2_normalized_name ON categories_v2(normalized_name);

-- =====================================================
-- 3. COMMITMENTS TABLE
-- =====================================================
CREATE TABLE commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories_v2(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('EXPENSE', 'INCOME')),
  is_important BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  linked_commitment_id UUID REFERENCES commitments(id) ON DELETE SET NULL,
  link_role TEXT CHECK (link_role IN ('PRIMARY', 'SECONDARY')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commitments_user_id ON commitments(user_id);
CREATE INDEX idx_commitments_category_id ON commitments(category_id);
CREATE INDEX idx_commitments_linked_commitment_id ON commitments(linked_commitment_id);

-- =====================================================
-- 4. TERMS TABLE
-- =====================================================
CREATE TABLE terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id UUID NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  effective_from DATE NOT NULL,
  effective_until DATE,
  
  frequency TEXT NOT NULL CHECK (frequency IN ('ONCE', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'ANNUALLY')),
  installments_count INTEGER,
  due_day_of_month INTEGER CHECK (due_day_of_month BETWEEN 1 AND 31),
  
  currency_original TEXT NOT NULL,
  amount_original NUMERIC(15,2) NOT NULL,
  fx_rate_to_base NUMERIC(15,6) NOT NULL DEFAULT 1.0,
  amount_in_base NUMERIC(15,2),
  
  estimation_mode TEXT CHECK (estimation_mode IN ('FIXED', 'AVERAGE', 'LAST')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT terms_unique_version UNIQUE(commitment_id, version)
);

CREATE INDEX idx_terms_commitment_id ON terms(commitment_id);
CREATE INDEX idx_terms_effective_from ON terms(effective_from);
CREATE INDEX idx_terms_effective_until ON terms(effective_until);

-- =====================================================
-- 5. PAYMENTS TABLE
-- =====================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id UUID NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  
  period_date DATE NOT NULL,
  payment_date DATE,
  
  currency_original TEXT NOT NULL,
  amount_original NUMERIC(15,2) NOT NULL,
  fx_rate_to_base NUMERIC(15,6) NOT NULL DEFAULT 1.0,
  amount_in_base NUMERIC(15,2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_unique_period UNIQUE(commitment_id, period_date)
);

CREATE INDEX idx_payments_commitment_id ON payments(commitment_id);
CREATE INDEX idx_payments_term_id ON payments(term_id);
CREATE INDEX idx_payments_period_date ON payments(period_date);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- =====================================================
-- 6. EXCHANGE_RATES TABLE
-- =====================================================
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC(15,6) NOT NULL,
  effective_date DATE NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exchange_rates_unique_rate UNIQUE(from_currency, to_currency, effective_date)
);

CREATE INDEX idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency, effective_date DESC);

-- =====================================================
-- 7. FUNCTIONS (must be created before triggers)
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION normalize_category_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_name = LOWER(TRIM(NEW.name));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_amount_in_base()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount_in_base = NEW.amount_original * NEW.fx_rate_to_base;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_active_term(
  p_commitment_id UUID,
  p_date DATE
)
RETURNS UUID AS $$
DECLARE
  v_term_id UUID;
BEGIN
  SELECT id INTO v_term_id
  FROM terms
  WHERE commitment_id = p_commitment_id
    AND effective_from <= p_date
    AND (effective_until IS NULL OR effective_until >= p_date)
  ORDER BY version DESC
  LIMIT 1;
  
  RETURN v_term_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_exchange_rate(
  p_from_currency TEXT,
  p_to_currency TEXT,
  p_date DATE
)
RETURNS NUMERIC(15,6) AS $$
DECLARE
  v_rate NUMERIC(15,6);
BEGIN
  IF p_from_currency = p_to_currency THEN
    RETURN 1.0;
  END IF;
  
  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND effective_date <= p_date
  ORDER BY effective_date DESC
  LIMIT 1;
  
  RETURN COALESCE(v_rate, 1.0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. TRIGGERS
-- =====================================================

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

CREATE TRIGGER normalize_category_v2_name
  BEFORE INSERT OR UPDATE ON categories_v2
  FOR EACH ROW
  EXECUTE FUNCTION normalize_category_name();

CREATE TRIGGER calculate_terms_amount_in_base
  BEFORE INSERT OR UPDATE ON terms
  FOR EACH ROW
  EXECUTE FUNCTION calculate_amount_in_base();

CREATE TRIGGER calculate_payments_amount_in_base
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION calculate_amount_in_base();

-- =====================================================
-- 9. RLS POLICIES
-- =====================================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Categories
ALTER TABLE categories_v2 ENABLE ROW LEVEL SECURITY;

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

-- Commitments
ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;

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

-- Terms
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

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

-- Payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

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

-- Exchange Rates
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view exchange rates"
  ON exchange_rates FOR SELECT
  TO authenticated
  USING (TRUE);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Tables created successfully!
-- Next: Run seed data script (separate file)
-- Then: Run data migration from v1 to v2
-- =====================================================
