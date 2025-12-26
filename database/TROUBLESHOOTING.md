# Troubleshooting v2 Schema Migration

## The Problem
You're seeing: `ERROR: 42703: column "user_id" does not exist`

This usually means:
1. The SQL is being executed **statement by statement** instead of as a whole
2. A previous migration attempt left partial objects
3. RLS policies are being created before tables exist

## Solution: Execute in Supabase SQL Editor (ALL AT ONCE)

### Step 1: Run Diagnostic
1. Open Supabase SQL Editor
2. Copy content from `database/diagnostic_v2.sql`
3. Run it
4. **Send me the results** (screenshot or copy-paste)

### Step 2: Clean Slate
1. Copy content from `database/migration_v2_schema.sql`
2. Paste **THE ENTIRE FILE** into SQL Editor
3. **Select all** (Cmd+A or Ctrl+A)
4. Click **Run** (this executes everything together)

### Step 3: Seed Data
1. Copy content from `database/migration_v2_seed.sql`
2. Paste into SQL Editor
3. Run

---

## Why This Happens

Supabase SQL Editor has two execution modes:
- **Individual statements** (default) - runs each statement separately ❌
- **Batch execution** (select all + run) - runs everything together ✅

RLS policies reference columns that may not exist yet if statements run individually.

---

## Alternative: Manual Execution Order

If batch execution fails, run in this exact order:

```sql
-- 1. Drop everything (cleanup section)
-- 2. Create functions
-- 3. Create tables
-- 4. Create triggers
-- 5. Enable RLS
-- 6. Create policies
```

But **batch execution is easier and safer**.
