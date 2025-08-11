-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL REFERENCES categories(name),
    total_amount DECIMAL(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Fixed', 'Variable', 'RECURRING', 'INSTALLMENT', 'VARIABLE')),
    start_date DATE NOT NULL,
    installments INTEGER NOT NULL DEFAULT 1,
    payment_frequency TEXT NOT NULL CHECK (payment_frequency IN (
        'ONCE', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'ANNUALLY'
    )),
    is_important BOOLEAN NOT NULL DEFAULT false,
    due_date INTEGER NOT NULL CHECK (due_date BETWEEN 1 AND 31),
    -- Additional fields for enhanced functionality
    expense_date DATE,
    original_amount DECIMAL(10,2),
    original_currency TEXT CHECK (original_currency IN ('CLP', 'USD', 'EUR', 'UF', 'UTM')),
    exchange_rate DECIMAL(10,4) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create payment_details table
CREATE TABLE IF NOT EXISTS public.payment_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID NOT NULL REFERENCES expenses(id),
    date_key TEXT NOT NULL, -- Format: YYYY-M (e.g., "2024-0" for Jan 2024)
    paid BOOLEAN NOT NULL DEFAULT false,
    payment_date TIMESTAMP WITH TIME ZONE,
    overridden_amount DECIMAL(10,2),
    overridden_due_date INTEGER CHECK (overridden_due_date BETWEEN 1 AND 31),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(expense_id, date_key)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_start_date ON expenses(start_date);
CREATE INDEX IF NOT EXISTS idx_payment_details_expense_id ON payment_details(expense_id);
CREATE INDEX IF NOT EXISTS idx_payment_details_date_key ON payment_details(date_key);
