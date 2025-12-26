# v2 Data Migration Guide

## Overview

Now that the schema is created, we need to migrate your existing data from v1 to v2:

- **expenses** → **commitments** + **terms**
- **payment_details** (paid only) → **payments**

## Execute in Order

### 1. Migrate Expenses → Commitments + Terms
```bash
database/006_migrate_expenses_to_v2.sql
```

This script:
- Creates user profiles
- Migrates categories to v2 format
- Converts each expense to a commitment
- Creates initial term (version 1) for each commitment

### 2. Migrate Payment Details → Payments
```bash
database/007_migrate_payments.sql
```

This script:
- Migrates only **paid** payment_details records
- Links payments to correct term
- Preserves payment dates and amounts

### 3. Verify Migration
```bash
database/008_verify_migration.sql
```

Checks:
- Record counts match
- No orphaned records
- Sample data looks correct

---

## Expected Results

After running 006 and 007:

| Table | Expected Count |
|-------|----------------|
| `commitments` | Same as `expenses` (29) |
| `terms` | Same as `expenses` (29) |
| `payments` | Same as paid `payment_details` (~139 or less) |
| `profiles` | Number of distinct users (~3) |
| `categories_v2` | 10 global + user categories |

---

## Safety Notes

- ✅ v1 tables (`expenses`, `payment_details`) are **NOT deleted**
- ✅ Scripts disable RLS temporarily for migration
- ✅ Re-enable RLS after migration
- ✅ Migration is **idempotent** (can run multiple times)

---

## Rollback

If something goes wrong:

```sql
-- Clear v2 data
TRUNCATE commitments, terms, payments, profiles CASCADE;

-- Re-run migration scripts
```

---

## Next Steps After Migration

Once verification passes:
1. Update TypeScript types (`Phase 3`)
2. Create service layer (`Phase 4`)
3. Update frontend components (`Phase 5`)
