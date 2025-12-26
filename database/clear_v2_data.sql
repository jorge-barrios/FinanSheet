-- Clear all v2 tables to re-run migration with corrected month handling
TRUNCATE payments CASCADE;
TRUNCATE terms CASCADE;
TRUNCATE commitments CASCADE;
TRUNCATE categories_v2 CASCADE;
TRUNCATE profiles CASCADE;

SELECT 'All v2 tables cleared. Ready to re-run migrations.' as status;
