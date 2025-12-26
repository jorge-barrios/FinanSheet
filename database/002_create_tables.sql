-- =====================================================
-- Step 2: Create Tables and Indexes
-- =====================================================
-- Run this SECOND (after 001_create_functions.sql)
-- Creates all v2 tables without RLS or triggers
-- =====================================================

-- Drop existing tables (cascade removes dependent objects)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS terms CASCADE;
DROP TABLE IF EXISTS commitments CASCADE;
DROP TABLE IF EXISTS categories_v2 CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS exchange_rates CASCADE;

-- 1. PROFILES
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  base_currency TEXT NOT NULL DEFAULT 'CLP',
  locale TEXT NOT NULL DEFAULT 'es-CL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CATEGORIES_V2
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

-- 3. COMMITMENTS
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

-- 4. TERMS
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

-- 5. PAYMENTS
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

-- 6. EXCHANGE_RATES
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

-- ✅ All tables created successfully
