-- add_tracking_and_skipped.sql

-- 1. Add tracking_start_date to profiles (Global Setting)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tracking_start_date DATE;

-- 2. Add is_skipped to payments (Specific skipped periods)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN DEFAULT false;
