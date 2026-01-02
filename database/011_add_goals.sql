-- database/011_add_goals.sql

-- 1. Create the goals table
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,           -- e.g. "Emergency Fund"
    target_amount NUMERIC(15,2),  -- e.g. 5000.00
    current_amount NUMERIC(15,2) DEFAULT 0,
    target_date DATE,
    icon TEXT,                    -- Emoji or icon name
    color TEXT,                   -- Hex code
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Allow users to view their own goals
CREATE POLICY "Users can view own goals" 
ON public.goals 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to insert their own goals
CREATE POLICY "Users can insert own goals" 
ON public.goals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own goals
CREATE POLICY "Users can update own goals" 
ON public.goals 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Allow users to delete their own goals
CREATE POLICY "Users can delete own goals" 
ON public.goals 
FOR DELETE 
USING (auth.uid() = user_id);

-- 4. Create trigger to update updated_at
CREATE TRIGGER update_goals_modtime
    BEFORE UPDATE ON public.goals
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
