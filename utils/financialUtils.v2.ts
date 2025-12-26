/**
 * FinanSheet v2 Business Logic Utilities
 * 
 * Helper functions for calendar generation, payment status calculation,
 * and multi-currency operations.
 */

import type {
    Term,
    Payment,
    Frequency,
    Period,
    CommitmentWithTerm,
    MonthlyCommitmentSummary,
} from '../types.v2';

// ============================================================================
// CALENDAR & PERIOD UTILITIES
// ============================================================================

/**
 * Parse a date string (YYYY-MM-DD) without timezone issues.
 * This avoids the UTC interpretation that causes off-by-one day/month errors
 * in negative UTC offset timezones like Chile (UTC-3).
 */
export function parseDateString(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed in Date constructor
}

/**
 * Extract year and month from a date string without timezone issues.
 * Returns { year, month } where month is 1-indexed (1=January).
 */
export function extractYearMonth(dateString: string): { year: number; month: number } {
    const [year, month] = dateString.split('-').map(Number);
    return { year, month };
}

/**
 * Check if a term is active for a given period
 */
export function isTermActiveForPeriod(term: Term, periodDate: string): boolean {
    const period = parseDateString(periodDate);
    const from = parseDateString(term.effective_from);
    const until = term.effective_until ? parseDateString(term.effective_until) : null;

    return period >= from && (!until || period <= until);
}

// ============================================================================
// AMOUNT CALCULATIONS
// ============================================================================

/**
 * Get the per-period (per-cuota) amount for a term.
 * If the term has installments, divides total by installments count.
 * Otherwise returns the total amount.
 * 
 * @param term - The term to calculate for
 * @param useBaseCurrency - If true, returns amount_in_base (CLP), otherwise amount_original
 * @returns The per-period amount
 */
export function getPerPeriodAmount(term: Term, useBaseCurrency: boolean = true): number {
    const totalAmount = useBaseCurrency
        ? (term.amount_in_base ?? term.amount_original)
        : term.amount_original;

    const installmentsCount = term.installments_count;

    if (installmentsCount && installmentsCount > 1) {
        return totalAmount / installmentsCount;
    }

    return totalAmount;
}

/**
 * Get the cuota number for a specific month within a term.
 * Returns null if the month is outside the term's range.
 * 
 * @param term - The term to check
 * @param monthDate - The Date object for the month to check
 * @returns The cuota number (1-indexed) or null if not applicable
 */
export function getCuotaNumber(term: Term, monthDate: Date): number | null {
    if (!term.installments_count || term.installments_count <= 1) {
        return null;
    }

    const { year: startYear, month: startMonth } = extractYearMonth(term.effective_from);
    const monthsDiff = (monthDate.getFullYear() - startYear) * 12 +
        (monthDate.getMonth() + 1 - startMonth);

    const cuotaNumber = monthsDiff + 1;

    if (cuotaNumber < 1 || cuotaNumber > term.installments_count) {
        return null;
    }

    return cuotaNumber;
}


/**
 * Get all periods covered by a term
 */
export function getTermPeriods(term: Term): Period[] {
    const periods: Period[] = [];
    const from = parseDateString(term.effective_from);

    // Determine end date
    let until: Date;
    if (term.effective_until) {
        until = parseDateString(term.effective_until);
    } else {
        // For ongoing terms, get periods up to 12 months in the future
        until = new Date();
        until.setMonth(until.getMonth() + 12);
    }

    // Generate periods based on frequency
    let current = new Date(from);

    while (current <= until) {
        periods.push({
            year: current.getFullYear(),
            month: current.getMonth() + 1, // JavaScript months are 0-based
        });

        // Advance based on frequency
        switch (term.frequency) {
            case 'ONCE':
                return periods; // Only one period
            case 'MONTHLY':
                current.setMonth(current.getMonth() + 1);
                break;
            case 'BIMONTHLY':
                current.setMonth(current.getMonth() + 2);
                break;
            case 'QUARTERLY':
                current.setMonth(current.getMonth() + 3);
                break;
            case 'SEMIANNUALLY':
                current.setMonth(current.getMonth() + 6);
                break;
            case 'ANNUALLY':
                current.setMonth(current.getMonth() + 12);
                break;
        }

        // Safety check: limit to installments if specified
        if (term.installments_count && periods.length >= term.installments_count) {
            break;
        }
    }

    return periods;
}

/**
 * Generate monthly summary for a commitment with its active term
 */
export function generateMonthlySummary(
    commitment: CommitmentWithTerm,
    period: Period,
    payment: Payment | null,
    categoryName: string | null
): MonthlyCommitmentSummary {
    const term = commitment.active_term;

    return {
        period: `${period.year}-${String(period.month).padStart(2, '0')}`,
        commitment_id: commitment.id,
        commitment_name: commitment.name,
        category_name: categoryName,
        flow_type: commitment.flow_type,
        expected_amount: term ? calculateExpectedAmount(term) : 0,
        actual_amount: payment?.amount_in_base || null,
        is_paid: !!payment,
        payment_date: payment?.payment_date || null,
    };
}

// ============================================================================
// PAYMENT STATUS CALCULATION
// ============================================================================

export enum PaymentStatus {
    PAID = 'PAID',
    PENDING = 'PENDING',
    OVERDUE = 'OVERDUE',
    UPCOMING = 'UPCOMING',
    NOT_APPLICABLE = 'NOT_APPLICABLE',
}

/**
 * Calculate payment status for a commitment in a given period
 */
export function calculatePaymentStatus(
    term: Term | null,
    payment: Payment | null,
    period: Period
): PaymentStatus {
    if (!term) {
        return PaymentStatus.NOT_APPLICABLE;
    }

    const periodDate = `${period.year}-${String(period.month).padStart(2, '0')}-01`;

    // Check if term is active for this period
    if (!isTermActiveForPeriod(term, periodDate)) {
        return PaymentStatus.NOT_APPLICABLE;
    }

    // If payment exists, it's paid
    if (payment) {
        return PaymentStatus.PAID;
    }

    // Check if period is in the past
    const today = new Date();
    const periodEnd = new Date(period.year, period.month, 0); // Last day of month

    if (periodEnd < today) {
        // Check if we're past the due date
        const dueDay = term.due_day_of_month || 1;
        const dueDate = new Date(period.year, period.month - 1, dueDay);

        if (today > dueDate) {
            return PaymentStatus.OVERDUE;
        }

        return PaymentStatus.PENDING;
    }

    // Future period
    return PaymentStatus.UPCOMING;
}

/**
 * Get status color for UI display
 */
export function getStatusColor(status: PaymentStatus): string {
    switch (status) {
        case PaymentStatus.PAID:
            return 'green';
        case PaymentStatus.PENDING:
            return 'yellow';
        case PaymentStatus.OVERDUE:
            return 'red';
        case PaymentStatus.UPCOMING:
            return 'blue';
        case PaymentStatus.NOT_APPLICABLE:
            return 'gray';
    }
}

// ============================================================================
// CURRENCY & AMOUNT CALCULATIONS
// ============================================================================

/**
 * Calculate expected amount from term
 */
export function calculateExpectedAmount(term: Term): number {
    if (term.amount_in_base !== null) {
        return term.amount_in_base;
    }
    return term.amount_original * term.fx_rate_to_base;
}

/**
 * Calculate actual amount from payment
 */
export function calculateActualAmount(payment: Payment): number {
    if (payment.amount_in_base !== null) {
        return payment.amount_in_base;
    }
    return payment.amount_original * payment.fx_rate_to_base;
}

/**
 * Convert amount to base currency
 */
export function convertToBaseCurrency(
    amount: number,
    fromCurrency: string,
    baseCurrency: string,
    fxRate: number
): number {
    if (fromCurrency === baseCurrency) {
        return amount;
    }
    return amount * fxRate;
}

/**
 * Format amount for display
 */
export function formatAmount(amount: number, currency: string, locale: string = 'es-CL'): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

// ============================================================================
// AGGREGATION HELPERS
// ============================================================================

/**
 * Calculate total for a period
 */
export function calculatePeriodTotal(
    summaries: MonthlyCommitmentSummary[],
    useActual: boolean = true
): number {
    return summaries.reduce((total, summary) => {
        const amount = useActual && summary.actual_amount !== null
            ? summary.actual_amount
            : summary.expected_amount;
        return total + amount;
    }, 0);
}

/**
 * Group summaries by period
 */
export function groupByPeriod(
    summaries: MonthlyCommitmentSummary[]
): Map<string, MonthlyCommitmentSummary[]> {
    const grouped = new Map<string, MonthlyCommitmentSummary[]>();

    summaries.forEach(summary => {
        const existing = grouped.get(summary.period) || [];
        existing.push(summary);
        grouped.set(summary.period, existing);
    });

    return grouped;
}

/**
 * Calculate balance (income - expenses) for a period
 */
export function calculateBalance(summaries: MonthlyCommitmentSummary[]): {
    income: number;
    expenses: number;
    balance: number;
} {
    const income = summaries
        .filter(s => s.flow_type === 'INCOME')
        .reduce((sum, s) => sum + (s.actual_amount || s.expected_amount), 0);

    const expenses = summaries
        .filter(s => s.flow_type === 'EXPENSE')
        .reduce((sum, s) => sum + (s.actual_amount || s.expected_amount), 0);

    return {
        income,
        expenses,
        balance: income - expenses,
    };
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Get current period
 */
export function getCurrentPeriod(): Period {
    const now = new Date();
    return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
    };
}

/**
 * Get next period
 */
export function getNextPeriod(period: Period): Period {
    let { year, month } = period;
    month++;
    if (month > 12) {
        month = 1;
        year++;
    }
    return { year, month };
}

/**
 * Get previous period
 */
export function getPreviousPeriod(period: Period): Period {
    let { year, month } = period;
    month--;
    if (month < 1) {
        month = 12;
        year--;
    }
    return { year, month };
}

/**
 * Get period range (for pagination)
 */
export function getPeriodRange(start: Period, count: number): Period[] {
    const periods: Period[] = [];
    let current = { ...start };

    for (let i = 0; i < count; i++) {
        periods.push({ ...current });
        current = getNextPeriod(current);
    }

    return periods;
}

/**
 * Compare periods
 */
export function comparePeriods(a: Period, b: Period): number {
    if (a.year !== b.year) {
        return a.year - b.year;
    }
    return a.month - b.month;
}

/**
 * Check if period is in the past
 */
export function isPastPeriod(period: Period): boolean {
    const current = getCurrentPeriod();
    return comparePeriods(period, current) < 0;
}

/**
 * Format period for display
 */
export function formatPeriod(period: Period, locale: string = 'es-CL'): string {
    const date = new Date(period.year, period.month - 1, 1);
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
    }).format(date);
}
