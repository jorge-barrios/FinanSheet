#!/bin/bash

# Fix 006_migrate_expenses_to_v2.sql - Replace GREATEST with +1 for expenses (JSONB)
sed -i '' 's/LPAD(GREATEST(COALESCE((e\.start_date->>'\''\''month'\''\'')*::*integer, *1), *1)::text/LPAD((COALESCE((e.start_date->>'\''month'\'')::integer, 0) + 1)::text/g' database/006_migrate_expenses_to_v2.sql

# Fix 007_migrate_payments.sql - Replace GREATEST with +1 for payments (text date_key) 
sed -i '' 's/LPAD(GREATEST(COALESCE(SPLIT_PART(pd\.date_key, *'\''\''[^'\'']*'\''\'' *, *2) *::integer, *[01]) *, *1)::text/LPAD((COALESCE(SPLIT_PART(pd.date_key, '\''-'\'', 2)::integer, 0) + 1)::text/g' database/007_migrate_payments.sql

echo "✅ Both migration scripts updated for 0-based months"
