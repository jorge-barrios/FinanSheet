/**
 * FinanSheet v2 Type Definitions
 * 
 * Type definitions for the new v2 database schema.
 * Based on database tables created in 002_create_tables.sql
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type Currency = 'USD' | 'CLP' | 'EUR' | 'BRL' | 'ARS';

export enum FlowType {
    EXPENSE = 'EXPENSE',
    INCOME = 'INCOME',
}

export enum Frequency {
    ONCE = 'ONCE',
    MONTHLY = 'MONTHLY',
    BIMONTHLY = 'BIMONTHLY',
    QUARTERLY = 'QUARTERLY',
    SEMIANNUALLY = 'SEMIANNUALLY',
    ANNUALLY = 'ANNUALLY',
}

export enum EstimationMode {
    FIXED = 'FIXED',      // Use term amount_original
    AVERAGE = 'AVERAGE',  // Calculate average from historical payments
    LAST = 'LAST',        // Use last payment amount
}

export enum LinkRole {
    PRIMARY = 'PRIMARY',      // Primary commitment (counts in totals)
    SECONDARY = 'SECONDARY',  // Secondary commitment (excluded from totals)
}

/**
 * Budget Type for categorizing expenses
 * Used for 50/30/20 rule analysis
 */
export type BudgetType = 'NEED' | 'WANT' | 'SAVING';

// ============================================================================
// DATABASE ENTITIES
// ============================================================================

/**
 * User Profile
 * Stores user preferences and base currency settings
 */
export interface Profile {
    user_id: string; // UUID, references auth.users
    base_currency: string;
    locale: string;
    budget_needs_pct: number;   // Default 50
    budget_wants_pct: number;   // Default 30
    budget_savings_pct: number; // Default 20
    created_at: string; // ISO 8601 timestamp
    updated_at: string;
}

/**
 * Category (v2)
 * Categories can be user-specific or global
 */
export interface Category {
    id: string; // UUID
    user_id: string | null; // NULL for global categories
    name: string;
    normalized_name: string; // Lowercase, trimmed
    is_global: boolean;
    budget_type: BudgetType | null; // NEED, WANT, SAVING for 50/30/20 analysis
    created_at: string;
    updated_at: string;
}

/**
 * Commitment
 * Represents a financial commitment (expense or income source)
 * This is the top-level entity that groups terms and payments
 */
export interface Commitment {
    id: string; // UUID
    user_id: string;
    category_id: string | null;
    name: string;
    flow_type: FlowType;
    is_important: boolean;
    notes: string | null;
    linked_commitment_id: string | null; // For offsetting commitments (e.g., rent vs mortgage)
    link_role: LinkRole | null;
    created_at: string;
    updated_at: string;
}

/**
 * Term
 * Represents a specific version/term of a commitment
 * Allows tracking changes in amount, frequency, etc. over time
 */
export interface Term {
    id: string; // UUID
    commitment_id: string;
    version: number; // Incrementing version number
    effective_from: string; // ISO date (YYYY-MM-DD)
    effective_until: string | null; // NULL for ongoing
    frequency: Frequency;
    installments_count: number | null; // NULL for ongoing
    due_day_of_month: number | null; // 1-31
    currency_original: string;
    amount_original: number; // NUMERIC(15,2)
    fx_rate_to_base: number; // NUMERIC(15,6)
    amount_in_base: number | null; // NUMERIC(15,2)
    estimation_mode: EstimationMode | null;
    is_divided_amount: boolean | null; // true = "En cuotas" (divide monto), false/null = "Definido" (monto por período)
    created_at: string;
    updated_at: string;
}

/**
 * Payment
 * Represents an actual payment made for a specific period
 * Links to both commitment and the term that was active at that time
 */
export interface Payment {
    id: string; // UUID
    commitment_id: string;
    term_id: string; // Which term was active for this payment
    period_date: string; // ISO date - which period this payment is for (YYYY-MM-DD)
    payment_date: string | null; // ISO date - when actually paid
    currency_original: string;
    amount_original: number; // NUMERIC(15,2)
    fx_rate_to_base: number; // NUMERIC(15,6)
    amount_in_base: number | null; // NUMERIC(15,2)
    notes: string | null; // Optional user note about the payment
    due_date: string | null; // Specific due date override. NULL = calculate from term.due_day_of_month
    created_at: string;
    updated_at: string;
}

/**
 * Exchange Rate
 * Historical exchange rates for currency conversion
 */
export interface ExchangeRate {
    id: string; // UUID
    from_currency: string;
    to_currency: string;
    rate: number; // NUMERIC(15,6)
    effective_date: string; // ISO date
    source: string | null; // Source of the rate (e.g., 'manual', 'api')
    created_at: string;
}

/**
 * Payment Adjustment (Audit Trail)
 * Tracks changes to payment period_date when terms are modified
 * Preserves original period assignments for audit purposes
 */
export interface PaymentAdjustment {
    id: string; // UUID
    payment_id: string;
    original_period_date: string; // ISO date (YYYY-MM-DD)
    new_period_date: string; // ISO date (YYYY-MM-DD)
    original_term_id: string;
    new_term_id: string;
    reason: string; // 'term_effective_from_change', 'manual_correction', etc.
    adjusted_at: string; // ISO 8601 timestamp
    adjusted_by: string | null; // User ID who made the adjustment
}

/**
 * Goal (Savings Bucket)
 * Represents a specific savings target (e.g. "Emergency Fund", "Trip")
 */
export interface Goal {
    id: string; // UUID
    user_id: string;
    name: string;
    target_amount: number | null; // NUMERIC(15,2) - NULL = sin límite
    current_amount: number;       // NUMERIC(15,2)
    target_date: string | null;   // ISO date (YYYY-MM-DD)
    priority: number;             // Para ordenar distribución de ahorros
    icon: string | null;          // Emoji or icon name
    color: string | null;         // Hex code
    is_archived: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * Budget distribution (actual or target)
 */
export interface BudgetDistribution {
    needs: number;
    wants: number;
    savings: number;
    unclassified?: number; // Solo para distribución actual
}

/**
 * Financial Health Analysis result
 * Compares actual spending vs target (50/30/20 rule)
 */
export interface FinancialHealthAnalysis {
    period: Period;
    income: number;
    totalExpenses: number;

    // Distribución real del mes
    actual: BudgetDistribution & { unclassified: number };

    // Distribución objetivo según regla del usuario
    target: BudgetDistribution;

    // Diferencias (positivo = gastaste más de lo debido)
    diff: {
        needs: number;
        wants: number;
        savings: number; // Negativo = ahorraste menos
    };

    // Porcentajes reales
    percentages: {
        needs: number;
        wants: number;
        savings: number;
        unclassified: number;
    };

    // Sugerencia textual
    suggestion: string | null;

    // Estado general: 'good', 'warning', 'critical'
    status: 'good' | 'warning' | 'critical';
}

// ============================================================================
// VIEW MODELS & DTOs
// ============================================================================

/**
 * Commitment with active term
 * Useful for displaying commitments with their current/active term
 */
export interface CommitmentWithTerm extends Commitment {
    active_term: Term | null;
    all_terms?: Term[];  // All terms for this commitment (for multi-term grid display)
    category?: Category;
}

/**
 * Payment with related data
 * Useful for payment history/lists
 */
export interface PaymentWithDetails extends Payment {
    commitment: Commitment;
    term: Term;
    category?: Category;
}

/**
 * Term with payment statistics
 * Useful for budget projections
 */
export interface TermWithStats extends Term {
    total_payments: number;
    last_payment_date: string | null;
    average_amount: number | null;
}

/**
 * Monthly commitment summary
 * For dashboard/overview displays
 */
export interface MonthlyCommitmentSummary {
    period: string; // YYYY-MM
    commitment_id: string;
    commitment_name: string;
    category_name: string | null;
    flow_type: FlowType;
    expected_amount: number; // From term
    actual_amount: number | null; // From payment (if paid)
    is_paid: boolean;
    payment_date: string | null;
}

/**
 * Totals for a specific month
 * Used for Bento Grid and KPI filtering
 */
export interface MonthTotals {
    comprometido: number;   // Total committed expenses for month
    ingresos: number;       // Total committed income for month
    pagado: number;         // Total payments made (with payment_date)
    pendiente: number;      // Active commitments without payment (not yet due)
    vencido: number;        // Unpaid commitments past due date
    balance: number;        // ingresos - comprometido
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Period identifier
 * Used throughout the app to identify a specific month/period
 */
export interface Period {
    year: number;
    month: number; // 1-12 (not 0-based!)
}

/**
 * Convert Period to string format
 */
export function periodToString(period: Period): string {
    return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

/**
 * Parse string to Period
 */
export function stringToPeriod(str: string): Period {
    const [year, month] = str.split('-').map(Number);
    return { year, month };
}

/**
 * Convert Period to ISO date (first day of month)
 */
export function periodToDate(period: Period): string {
    return `${period.year}-${String(period.month).padStart(2, '0')}-01`;
}

// ============================================================================
// FORM TYPES
// ============================================================================

/**
 * Form data for creating/editing a commitment
 */
export interface CommitmentFormData {
    name: string;
    category_id: string | null;
    flow_type: FlowType;
    is_important: boolean;
    notes: string;
    linked_commitment_id: string | null;
    link_role: LinkRole | null;
}

/**
 * Form data for creating/editing a term
 */
export interface TermFormData {
    effective_from: string; // YYYY-MM-DD
    effective_until: string | null;
    frequency: Frequency;
    installments_count: number | null;
    due_day_of_month: number | null;
    currency_original: string;
    amount_original: number;
    fx_rate_to_base: number;
    estimation_mode: EstimationMode | null;
    is_divided_amount: boolean | null; // true = "En cuotas", false/null = "Definido"
}

/**
 * Form data for recording a payment
 */
export interface PaymentFormData {
    period_date: string; // YYYY-MM-DD
    payment_date: string | null; // YYYY-MM-DD
    amount_original: number;
    currency_original: string;
    fx_rate_to_base?: number; // Exchange rate to CLP
    notes?: string | null; // Optional user note
    due_date?: string | null; // Specific due date override
}
