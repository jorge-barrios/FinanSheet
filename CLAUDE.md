# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev              # Start dev server at http://localhost:5173
npm run build            # Build for production
npm run preview          # Preview production build
```

### Testing
```bash
npm test                 # Run tests in watch mode
npm run test:ui          # Open Vitest UI for interactive testing
npm run test:run         # Run all tests once
npm run test:coverage    # Generate coverage report
npm run test:supabase    # Test Supabase connection
```

## Architecture

### Dual Data Model System

This codebase is in **active transition** between two data models:

**V1 (Legacy - `types.ts`)**:
- Original model with `Expense`, `PaymentDetails`, `PaymentStatus`
- Single-table approach with embedded payment tracking
- Uses in-memory `PaymentStatus` object (localStorage backed)
- Components: `Dashboard.tsx`, `ExpenseForm.tsx`, `ExpenseGrid.tsx`

**V2 (Active - `types.v2.ts`)**:
- New normalized schema with `Commitment`, `Term`, `Payment` separation
- Database-backed payment tracking via Supabase
- Supports versioning, multi-currency, and term changes over time
- Components: `Dashboard.v2.tsx`, `CommitmentForm.v2.tsx`, `ExpenseGridVirtual.v2.tsx`
- Database: `database/00X_*.sql` migration files (run in order)

**CRITICAL**: When adding features or fixing bugs, determine which model you're working with by:
1. Checking component file suffix (`.v2.tsx` = v2, no suffix = v1)
2. Reading imports (`types.ts` vs `types.v2.ts`)
3. Looking at service layer (`dataService.ts` vs `dataService.v2.ts`)

### Key Architectural Patterns

**Three-Tier Separation**:
- Components render UI and handle user interaction
- Services (`services/`) provide data access layer (Supabase queries)
- Utils (`utils/`) contain pure calculation logic (currency, expense calculations)

**Financial Calculations** (`utils/expenseCalculations.ts`):
- `getAmountForMonth()`: **Single source of truth** for expense amounts in any given month
- Priority: overriddenAmount → recalculated FX (unpaid future) → base amount
- Always version-aware for recurring expenses (checks `historicalAmounts`)

**Currency System**:
- Multi-currency support: CLP, USD, UF, UTM, EUR, BRL, ARS
- Exchange rates stored in `exchange_rates` table (v2) or fetched via `currencyService`
- Amounts stored in both original currency and base currency (CLP)

**Payment Tracking**:
- V1: In-memory `PaymentStatus` object with structure `Record<expenseId, Record<"YYYY-M", PaymentDetails>>`
- V2: `payments` table with proper relational structure

### Component Organization

**Core V2 Components**:
- `Dashboard.v2.tsx` - Main dashboard with monthly grid and charts (2088 lines)
- `ExpenseGridVirtual.v2.tsx` - Virtualized grid for performance with large datasets
- `CommitmentForm.v2.tsx` - Form for creating/editing commitments and terms
- `PaymentRecorder.v2.tsx` - Record payment for a specific period
- `CellEditModal.tsx` - Quick edit modal for grid cells

**Authentication**:
- `context/AuthContext.tsx` - Supabase auth integration
- `components/Auth/` - Login, signup, protected routes
- Row-level security (RLS) enabled on all tables

**State Management**:
- React Context API for global state (`context/`)
- `CommitmentsContext.tsx` - V2 commitment/term/payment state
- `FeatureFlagsContext.tsx` - Toggle v1/v2 UI
- Zustand considered but not yet implemented

### Database Schema (V2)

**Core Entities** (see `database/002_create_tables.sql`):
- `commitments` - Top-level financial obligation (expense or income)
- `terms` - Version/configuration of a commitment (amount, frequency, dates)
- `payments` - Actual payment record for a specific period
- `categories_v2` - User-specific or global categories
- `profiles` - User preferences and base currency

**Critical Relationships**:
- Commitment → Terms (1:many) - Each commitment can have multiple terms over time
- Term → Payments (1:many) - Each payment references the active term at that time
- Payment uniqueness: `(commitment_id, period_date)` - One payment per commitment per month

**Migration Path**:
Run files in `database/` in numerical order (001 → 009). See `database/MIGRATION_README.md`.

### Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key  # Optional, for AI features
```

For testing, copy `.env.test.example` to `.env.test` with test credentials.

### Common Gotchas

1. **Don't mix v1 and v2**: If working in v2 component, only import v2 types and services
2. **Month indexing**: V1 uses 0-based months (Jan=0), v2 uses 1-based (Jan=1)
3. **Amount calculations**: Always use `getAmountForMonth()` - don't manually calculate
4. **Frequency vs installments**:
   - Frequency = how often (MONTHLY, QUARTERLY, etc.)
   - Installments = how many times (null = ongoing/infinite)
5. **Term versioning**: When editing a recurring commitment, create new term with `effective_from`, don't modify existing term
6. **Currency amounts**: Always store both `amount_original` (in original currency) and `amount_in_base` (converted to CLP)

### Testing Philosophy

- Vitest for unit tests, React Testing Library for components
- Focus on critical calculation functions (`expenseCalculations`, `currency`)
- Mock Supabase in tests using `vi.mock()`
- Test files mirror source structure: `utils/foo.ts` → `tests/utils/foo.test.ts`

### Code Style

- TypeScript strict mode enabled
- React 19 with functional components only
- Prefer explicit return types on exported functions
- Use Zod for runtime validation in forms (`react-hook-form` + `@hookform/resolvers`)
- Tailwind CSS v4 for styling (PostCSS-based, not JIT)

### Deployment

- Hosted on Netlify
- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables must be set in Netlify dashboard
- See `netlify.toml` for configuration
