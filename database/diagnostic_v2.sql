-- =====================================================
-- Database Diagnostic Script
-- =====================================================
-- Run this to see current state of v2 tables
-- =====================================================

-- Check what v2 tables exist
SELECT 
  tablename,
  schemaname
FROM pg_tables
WHERE tablename IN ('profiles', 'categories_v2', 'commitments', 'terms', 'payments', 'exchange_rates')
ORDER BY tablename;

-- Check what columns exist in each table
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('profiles', 'categories_v2', 'commitments', 'terms', 'payments', 'exchange_rates')
ORDER BY table_name, ordinal_position;

-- Check what RLS policies exist
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename IN ('profiles', 'categories_v2', 'commitments', 'terms', 'payments', 'exchange_rates')
ORDER BY tablename, policyname;

-- Check what functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'update_updated_at_column',
  'normalize_category_name', 
  'calculate_amount_in_base',
  'get_active_term',
  'get_exchange_rate'
)
ORDER BY routine_name;
