-- Get sample data with all fields to check types
SELECT * FROM payment_details WHERE paid = TRUE LIMIT 2;

-- Check date_key format
SELECT DISTINCT 
  date_key,
  pg_typeof(date_key) as date_key_type
FROM payment_details 
LIMIT 5;
