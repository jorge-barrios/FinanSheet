-- =====================================================
-- Step 1: Create Functions
-- =====================================================
-- Run this FIRST
-- These functions are used by triggers and must exist before tables
-- =====================================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS normalize_category_name();
DROP FUNCTION IF EXISTS calculate_amount_in_base();
DROP FUNCTION IF EXISTS get_active_term(UUID, DATE);
DROP FUNCTION IF EXISTS get_exchange_rate(TEXT, TEXT, DATE);

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Normalize category names
CREATE OR REPLACE FUNCTION normalize_category_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_name = LOWER(TRIM(NEW.name));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate amount in base currency
CREATE OR REPLACE FUNCTION calculate_amount_in_base()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount_in_base = NEW.amount_original * NEW.fx_rate_to_base;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Get active term for a commitment on a given date
-- NOTE: Compares at MONTH level, not exact day.
-- This ensures that period_date (always 1st of month) matches
-- terms that start on any day of that month (e.g., due_day = 15).
-- Fixed in 017_fix_date_comparison.sql
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
    -- Compare at MONTH level, not exact day
    AND DATE_TRUNC('month', effective_from) <= DATE_TRUNC('month', p_date)
    AND (
      effective_until IS NULL
      OR DATE_TRUNC('month', effective_until) >= DATE_TRUNC('month', p_date)
    )
  ORDER BY version DESC
  LIMIT 1;

  RETURN v_term_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get exchange rate for a given date
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

-- ✅ Functions created successfully
