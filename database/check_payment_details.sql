-- Check payment_details table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payment_details'
ORDER BY ordinal_position;

-- Sample data
SELECT * FROM payment_details LIMIT 3;

-- Check how many are paid
SELECT 
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE paid = TRUE) as paid_records,
  COUNT(*) FILTER (WHERE paid = FALSE) as unpaid_records
FROM payment_details;
