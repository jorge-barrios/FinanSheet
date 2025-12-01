import { Expense, PaymentFrequency, ExpenseType } from '../types';
import { getActiveExpenseVersion, getBaseExpenseIdFromObject } from './expenseVersioning';
import CurrencyService from '../services/currencyService';

export const getFrequencyInMonths = (frequency: PaymentFrequency): number => {
    switch (frequency) {
        case PaymentFrequency.MONTHLY: return 1;
        case PaymentFrequency.BIMONTHLY: return 2;
        case PaymentFrequency.QUARTERLY: return 3;
        case PaymentFrequency.SEMIANNUALLY: return 6;
        case PaymentFrequency.ANNUALLY: return 12;
        case PaymentFrequency.ONCE: return 1; // Not used for intervals, but for logic checks
        default: return 1;
    }
};

// Amount for a specific month, version-aware and historicalAmounts-aware
export const getInstallmentAmountForMonth = (
    allExpenses: Expense[],
    expense: Expense,
    year: number,
    month: number
): number => {
    if (!expense) return 0;
    // For recurring, resolve active version for the month
    const version = expense.type === ExpenseType.RECURRING
        ? (getActiveExpenseVersion(allExpenses, getBaseExpenseIdFromObject(expense), year, month) || expense)
        : expense;

    const key = `${year}-${month}`;
    const hist = version.historicalAmounts?.[key];
    if (typeof hist === 'number' && hist > 0) return hist;

    return getInstallmentAmount(version);
};

export const getInstallmentAmount = (expense: Expense): number => {
    if (!expense) return 0;

    // For recurring expenses, return the full amount per payment (not divided)
    if (expense.type === 'RECURRING') {
        return expense.amountInClp;
    }

    // For installment expenses, divide the total amount by number of installments
    if (expense.type === 'INSTALLMENT') {
        if (!expense.installments || expense.installments <= 0) return 0;
        return expense.amountInClp / expense.installments;
    }

    // For variable expenses, return the full amount
    return expense.amountInClp;
};

/**
 * Centralized function to compute the amount for a specific expense in a specific month.
 * This is the single source of truth for amount calculation across the entire app.
 *
 * Logic priority:
 * 1. If overriddenAmount exists, use it (frozen amount)
 * 2. If unpaid future month with foreign currency, recalculate with current rate
 * 3. Otherwise, use base amount from getInstallmentAmount
 *
 * @param expense - The expense to calculate amount for
 * @param year - Target year
 * @param month - Target month (0-indexed)
 * @param paymentDetails - Optional payment details with overriddenAmount and paid status
 * @returns The calculated amount in CLP
 */
export const getAmountForMonth = (
    expense: Expense,
    year: number,
    month: number,
    paymentDetails?: { paid?: boolean; overriddenAmount?: number }
): number => {
    // Priority 1: Explicit override (frozen amount)
    if (typeof paymentDetails?.overriddenAmount === 'number') {
        return paymentDetails.overriddenAmount;
    }

    // Get base amount
    const baseAmount = getInstallmentAmount(expense);

    // Priority 2: Recalculate for unpaid future months with foreign currency
    const isPaid = paymentDetails?.paid ?? false;
    const now = new Date();
    const isFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth());

    if (!isPaid && isFutureMonth && expense.originalCurrency && expense.originalCurrency !== 'CLP' && typeof expense.originalAmount === 'number') {
        // Calculate per-payment amount in original currency
        const perPaymentOriginal = expense.type === ExpenseType.INSTALLMENT && expense.installments > 0
            ? expense.originalAmount / expense.installments
            : expense.originalAmount;

        // Convert to CLP using current exchange rate
        const recalculatedAmount = CurrencyService.fromUnit(perPaymentOriginal, expense.originalCurrency as any);

        return Number.isFinite(recalculatedAmount) ? recalculatedAmount : baseAmount;
    }

    // Priority 3: Base amount
    return Number.isFinite(baseAmount) ? baseAmount : 0;
};

// Helper to parse 'YYYY-MM-DD' date string and return 0-indexed month
const parseStartDate = (startDate: string) => {
    if (typeof startDate !== 'string' || startDate.split('-').length !== 3) {
        // Return a default or invalid date structure to be handled by the caller
        return { year: 0, month: -1 };
    }
    const [year, month] = startDate.split('-').map(Number);
    return { year, month: month - 1 }; // Adjust month to be 0-indexed for calculations
};

/**
 * Check if an expense is in a specific month, considering versioning for recurring expenses
 * @param allExpenses - Array of all expenses (needed for versioning)
 * @param expense - The expense to check
 * @param year - Target year
 * @param month - Target month (0-based)
 * @returns True if the expense should appear in that month
 */
export const isInstallmentInMonthWithVersioning = (
    allExpenses: Expense[], 
    expense: Expense, 
    year: number, 
    month: number
): boolean => {
    // For recurring expenses, check if there's an active version for this date
    const baseId = getBaseExpenseIdFromObject(expense);
    const activeVersion = getActiveExpenseVersion(allExpenses, baseId, year, month);
    
    if (activeVersion && activeVersion.id !== expense.id) {
        // This expense is not the active version for this date
        return false;
    }
    
    // Use the standard logic for the active version
    return isInstallmentInMonth(activeVersion || expense, year, month);
};

/**
 * Original function - check if an expense is in a specific month (without versioning)
 * @param expense - The expense to check
 * @param year - Target year
 * @param month - Target month (0-based)
 * @returns True if the expense should appear in that month
 */
export const isInstallmentInMonth = (expense: Expense, year: number, month: number): boolean => {
    if (!expense || !expense.startDate) return false;
    const { installments, paymentFrequency } = expense;
    const { year: startYear, month: startMonth } = parseStartDate(expense.startDate);

    if (paymentFrequency === PaymentFrequency.ONCE) {
        return startYear === year && startMonth === month;
    }

    const frequencyInMonths = getFrequencyInMonths(paymentFrequency);
    const startAbsMonth = startYear * 12 + startMonth;
    const targetAbsMonth = year * 12 + month;

    if (targetAbsMonth < startAbsMonth) {
        return false;
    }

    const monthsSinceStart = targetAbsMonth - startAbsMonth;

    if (monthsSinceStart % frequencyInMonths !== 0) {
        return false;
    }

    const installmentIndex = monthsSinceStart / frequencyInMonths;

    // Recurring with infinite installments (<= 0) => always active on applicable months
    if (expense.type === 'RECURRING' && (!installments || installments <= 0)) {
        return true;
    }

    return installmentIndex < installments;
};

export const getInstallmentNumber = (expense: Expense, year: number, month: number): number | null => {
    if (!isInstallmentInMonth(expense, year, month)) return null;
    
    if (expense.paymentFrequency === PaymentFrequency.ONCE) {
        return 1;
    }

    const { year: startYear, month: startMonth } = parseStartDate(expense.startDate);
    const frequencyInMonths = getFrequencyInMonths(expense.paymentFrequency);
    const startAbsMonth = startYear * 12 + startMonth;
    const targetAbsMonth = year * 12 + month;

    const monthsSinceStart = targetAbsMonth - startAbsMonth;
    return (monthsSinceStart / frequencyInMonths) + 1;
};
