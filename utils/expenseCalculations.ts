import { Expense, PaymentFrequency } from '../types';

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
    return expense.amountInClp / expense.installments;
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
