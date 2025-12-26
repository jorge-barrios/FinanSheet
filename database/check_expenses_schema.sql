-- Quick diagnostic: Check expenses table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'expenses'
ORDER BY ordinal_position;

-- Sample data to understand structure
SELECT * FROM expenses LIMIT 2;
