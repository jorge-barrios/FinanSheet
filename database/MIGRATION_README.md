# v2 Schema Migration - Sequential Execution

## ✅ Execute These Scripts in Order

Run each script **one at a time** in Supabase SQL Editor:

### 1. Create Functions
```bash
database/001_create_functions.sql
```
Creates all helper functions needed by triggers.

### 2. Create Tables
```bash
database/002_create_tables.sql
```
Creates all v2 tables and indexes.

### 3. Create Triggers
```bash
database/003_create_triggers.sql
```
Attaches triggers to tables for auto-updates.

### 4. Enable RLS & Policies
```bash
database/004_create_rls_policies.sql
```
Enables Row Level Security and creates all policies.

### 5. Seed Data
```bash
database/005_seed_categories.sql
```
Inserts default global categories.

---

## Execution Steps

For each file:

1. Open Supabase SQL Editor
2. Copy the **entire content** of the file
3. Paste into a new query
4. Click **Run**
5. Wait for "Success"
6. Move to next file

---

## Verification

After completing all 5 steps, run:

```bash
node database/verify_v2_schema.js
```

Or in SQL Editor:
```sql
SELECT tablename FROM pg_tables 
WHERE tablename IN ('profiles', 'categories_v2', 'commitments', 'terms', 'payments', 'exchange_rates');
```

You should see all 6 tables listed.

---

## If You Get Errors

- **"function already exists"** - Safe to ignore, script handles this
- **"table already exists"** - Safe to ignore, script drops first
- **Any other error** - Stop and share the full error message

---

## Time Estimate

~5 minutes total (1 minute per script)
