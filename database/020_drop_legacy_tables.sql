-- =====================================================
-- Migration 020: Drop Legacy v1 Tables & Functions
-- =====================================================
-- These tables have been fully replaced by v2 schema:
--   payment_details → payments
--   expenses → commitments + terms
--   categories → categories_v2
-- =====================================================

-- Drop tables (CASCADE removes triggers, RLS policies, FK constraints)
-- Order matters: payment_details → expenses → categories (FK chain)
DROP TABLE IF EXISTS payment_details CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Drop legacy-only functions
DROP FUNCTION IF EXISTS set_user_id();
DROP FUNCTION IF EXISTS upsert_payment_details(uuid, text, jsonb);
