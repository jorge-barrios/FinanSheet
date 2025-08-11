import { Expense, PaymentFrequency } from '../types';
import { getActiveExpenseVersion, getBaseExpenseIdFromObject } from './expenseVersioning';

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

export const getInstallmentAmount = (expense: Expense): number => {
    if (!expense || expense.installments <= 0) return 0;
    
    // For recurring expenses, return the full amount per payment (not divided)
    if (expense.type === 'RECURRING') {
        return expense.amountInClp;
    }
    
    // For installment expenses, divide the total amount by number of installments
    if (expense.type === 'INSTALLMENT') {
        return expense.amountInClp / expense.installments;
    }
    
    // For variable expenses, return the full amount
    return expense.amountInClp;
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
