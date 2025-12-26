/**
 * CommitmentsContext
 * 
 * Centralized context for v2 data (commitments, terms, payments).
 * Provides shared state and refresh functionality across all components.
 * Eliminates duplicate fetching between Grid and Dashboard.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { CommitmentService, PaymentService, getCurrentUserId } from '../services/dataService.v2';
import type { CommitmentWithTerm, Payment, FlowType } from '../types.v2';
import { extractYearMonth, getPerPeriodAmount, getCuotaNumber } from '../utils/financialUtils.v2';
import { periodToString } from '../types.v2';

// =============================================================================
// TYPES
// =============================================================================

interface UpcomingPayment {
    commitmentId: string;
    commitmentName: string;
    amount: number;
    dueDay: number;
    dueMonth: number; // 0-indexed
    dueYear: number;
    isOverdue: boolean;
    isPaid: boolean;
    cuotaNumber: number | null;
    totalCuotas: number | null;
    flowType: FlowType;
}

interface MonthlyData {
    income: number;
    expenses: number;
    balance: number;
    hasIncomeData: boolean;  // True if there are active income commitments
    hasExpenseData: boolean; // True if there are active expense commitments
}

interface CommitmentsContextValue {
    // Raw data
    commitments: CommitmentWithTerm[];
    payments: Map<string, Payment[]>;

    // Loading state
    loading: boolean;
    error: string | null;

    // Refresh function
    refresh: () => Promise<void>;

    // Display year and month for rolling window calculations
    displayYear: number;
    displayMonth: number;
    setDisplayYear: (year: number) => void;
    setDisplayMonth: (month: number) => void;

    // Derived data (calculated from raw data)
    getUpcomingPayments: (currentMonth: number, nextMonth?: number) => UpcomingPayment[];
    getMonthlyData: () => MonthlyData[];
    isPaymentMade: (commitmentId: string, year: number, month: number) => boolean;
}

// =============================================================================
// CONTEXT
// =============================================================================

const CommitmentsContext = createContext<CommitmentsContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

interface CommitmentsProviderProps {
    children: ReactNode;
}

export const CommitmentsProvider: React.FC<CommitmentsProviderProps> = ({ children }) => {
    const [commitments, setCommitments] = useState<CommitmentWithTerm[]>([]);
    const [payments, setPayments] = useState<Map<string, Payment[]>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const now = new Date();
    const [displayYear, setDisplayYear] = useState(now.getFullYear());
    const [displayMonth, setDisplayMonth] = useState(now.getMonth()); // 0-indexed

    // ==========================================================================
    // DATA FETCHING
    // ==========================================================================

    const refresh = useCallback(async (silent: boolean = false) => {
        try {
            if (!silent) {
                setLoading(true);
            }
            setError(null);

            const userId = await getCurrentUserId();
            if (!userId) {
                setError('No user logged in');
                setLoading(false);
                return;
            }

            // Calculate wide rolling window: more history than future
            // This ensures we have data cached for navigation without constant refreshes
            const centerDate = new Date(displayYear, displayMonth, 1);

            // Start: 12 months before (to have buffer for 8-month history view)
            const startDate = new Date(centerDate);
            startDate.setMonth(startDate.getMonth() - 12);

            // End: 12 months after
            const endDate = new Date(centerDate);
            endDate.setMonth(endDate.getMonth() + 13); // +13 to include the final month

            const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
            const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;

            console.log(`CommitmentsContext: Loading ${silent ? '(silent)' : ''} wide window from ${startStr} to ${endStr}`);

            // Fetch commitments and payments in parallel
            const [commitmentsData, allPayments] = await Promise.all([
                CommitmentService.getCommitmentsWithTerms(userId),
                PaymentService.getPaymentsByDateRange(userId, startStr, endStr)
            ]);

            setCommitments(commitmentsData);

            // Group payments by commitment_id
            const paymentsByCommitment = new Map<string, Payment[]>();
            allPayments.forEach(p => {
                const existing = paymentsByCommitment.get(p.commitment_id) || [];
                paymentsByCommitment.set(p.commitment_id, [...existing, p]);
            });
            setPayments(paymentsByCommitment);

        } catch (err) {
            console.error('CommitmentsContext refresh error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [displayYear, displayMonth]);

    // Initial load only (not on every displayYear/displayMonth change)
    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps = only on mount

    // ==========================================================================
    // HELPER FUNCTIONS
    // ==========================================================================

    // Exact same logic as Grid's isActiveInMonth for consistency
    const isTermActiveForMonth = useCallback((
        term: CommitmentWithTerm['active_term'],
        year: number,
        month: number // 0-indexed
    ): boolean => {
        if (!term) return false;

        // Use extractYearMonth to avoid timezone issues
        const { year: startYear, month: startMonth } = extractYearMonth(term.effective_from);
        const startDate = new Date(startYear, startMonth - 1, 1);
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);

        // Check if term hasn't started yet
        if (startDate > monthEnd) return false;

        // Check if term has already ended
        if (term.effective_until) {
            const { year: endYear, month: endMonth } = extractYearMonth(term.effective_until);
            const endDate = new Date(endYear, endMonth - 1, 1);
            if (endDate < monthStart) return false; // Term ended before this month
        }

        // Check frequency - use extracted year/month for correct calculation
        const monthsDiff = (year - startYear) * 12 + (month + 1 - startMonth);

        if (monthsDiff < 0) return false;

        switch (term.frequency) {
            case 'ONCE': return monthsDiff === 0;
            case 'MONTHLY': return true;
            case 'BIMONTHLY': return monthsDiff % 2 === 0;
            case 'QUARTERLY': return monthsDiff % 3 === 0;
            case 'SEMIANNUALLY': return monthsDiff % 6 === 0;
            case 'ANNUALLY': return monthsDiff % 12 === 0;
            default: return true;
        }
    }, []);

    const isPaymentMade = useCallback((commitmentId: string, year: number, month: number): boolean => {
        const commitmentPayments = payments.get(commitmentId) || [];
        const periodStr = periodToString({ year, month: month + 1 });
        // Only consider it "paid" if payment_date exists (not just registered)
        return commitmentPayments.some(p =>
            p.period_date.substring(0, 7) === periodStr && !!p.payment_date
        );
    }, [payments]);

    // ==========================================================================
    // DERIVED DATA
    // ==========================================================================

    const getUpcomingPayments = useCallback((currentMonth: number, nextMonth?: number): UpcomingPayment[] => {
        const items: UpcomingPayment[] = [];
        const today = new Date();
        const currentDay = today.getDate();
        const currentYear = today.getFullYear();
        const currentMonthActual = today.getMonth();

        // 1. Get pending payments for current and next month
        const monthsToCheck = [currentMonth];
        if (nextMonth !== undefined && nextMonth !== currentMonth) {
            monthsToCheck.push(nextMonth);
        } else if (currentMonth < 11) {
            monthsToCheck.push(currentMonth + 1);
        }

        monthsToCheck.forEach(month => {
            const yearForMonth = month > 11 ? displayYear + 1 : displayYear;
            const actualMonth = month % 12;

            commitments.forEach(commitment => {
                const term = commitment.active_term;
                if (!term) return;
                if (commitment.flow_type !== 'EXPENSE') return;
                if (!isTermActiveForMonth(term, yearForMonth, actualMonth)) return;
                if (isPaymentMade(commitment.id, yearForMonth, actualMonth)) return;

                const dueDay = term.due_day_of_month || 1;
                const commitmentPayments = payments.get(commitment.id) || [];
                const periodStr = periodToString({ year: yearForMonth, month: actualMonth + 1 });
                const paymentRecord = commitmentPayments.find(p =>
                    p.period_date.substring(0, 7) === periodStr
                );
                const amount = paymentRecord && paymentRecord.amount_in_base
                    ? paymentRecord.amount_in_base
                    : getPerPeriodAmount(term, true);

                const isCurrentPeriod = actualMonth === currentMonthActual && yearForMonth === currentYear;
                const isOverdue = isCurrentPeriod && currentDay > dueDay;

                const monthDate = new Date(yearForMonth, actualMonth, 1);
                const cuotaNumber = getCuotaNumber(term, monthDate);
                const totalCuotas = term.installments_count && term.installments_count > 1
                    ? term.installments_count
                    : null;

                items.push({
                    commitmentId: commitment.id,
                    commitmentName: commitment.name,
                    amount,
                    dueDay,
                    dueMonth: actualMonth,
                    dueYear: yearForMonth,
                    isOverdue,
                    isPaid: false,
                    cuotaNumber,
                    totalCuotas,
                    flowType: commitment.flow_type as FlowType,
                });
            });
        });

        // 2. Search for overdue payments from past months (all commitments, even if "finished")
        commitments.forEach(commitment => {
            const term = commitment.active_term;
            if (!term) return;
            if (commitment.flow_type !== 'EXPENSE') return;

            // Check last 3 months for unpaid periods (reduced from 12 to avoid clutter)
            for (let i = 1; i <= 3; i++) {
                const checkDate = new Date(currentYear, currentMonthActual - i, 1);
                const checkYear = checkDate.getFullYear();
                const checkMonth = checkDate.getMonth();

                // Stop if before commitment started
                if (!isTermActiveForMonth(term, checkYear, checkMonth)) continue;

                // Skip if already paid
                if (isPaymentMade(commitment.id, checkYear, checkMonth)) continue;

                // Skip if already in monthsToCheck (this prevents duplicates if currentMonthActual - i falls into monthsToCheck)
                const isDuplicate = monthsToCheck.some(m => {
                    // Calculate the year/month for the month in monthsToCheck relative to displayYear
                    // This logic needs to be consistent with how monthsToCheck are processed above
                    let monthToCheckYear = displayYear;
                    let monthToCheckActual = m;
                    if (m > 11) { // If month is 12 (Dec) or more, it means it's next year
                        monthToCheckYear = displayYear + Math.floor(m / 12);
                        monthToCheckActual = m % 12;
                    }
                    return monthToCheckActual === checkMonth && monthToCheckYear === checkYear;
                });
                if (isDuplicate) continue;

                // This is an overdue payment!
                const dueDay = term.due_day_of_month || 1;
                const commitmentPayments = payments.get(commitment.id) || [];
                const periodStr = periodToString({ year: checkYear, month: checkMonth + 1 });
                const paymentRecord = commitmentPayments.find(p =>
                    p.period_date.substring(0, 7) === periodStr
                );
                const amount = paymentRecord && paymentRecord.amount_in_base
                    ? paymentRecord.amount_in_base
                    : getPerPeriodAmount(term, true);

                const monthDate = new Date(checkYear, checkMonth, 1);
                const cuotaNumber = getCuotaNumber(term, monthDate);
                const totalCuotas = term.installments_count && term.installments_count > 1
                    ? term.installments_count
                    : null;

                items.push({
                    commitmentId: commitment.id,
                    commitmentName: commitment.name,
                    amount,
                    dueDay,
                    dueMonth: checkMonth,
                    dueYear: checkYear,
                    isOverdue: true, // All past unpaid are overdue
                    isPaid: false,
                    cuotaNumber,
                    totalCuotas,
                    flowType: commitment.flow_type as FlowType,
                });
            }
        });

        // Sort by date (oldest overdue first, then upcoming)
        items.sort((a, b) => {
            const dateA = new Date(a.dueYear, a.dueMonth, a.dueDay);
            const dateB = new Date(b.dueYear, b.dueMonth, b.dueDay);
            return dateA.getTime() - dateB.getTime();
        });

        return items;
    }, [commitments, payments, displayYear, isTermActiveForMonth, isPaymentMade, getCuotaNumber, getPerPeriodAmount]);

    const getMonthlyData = useCallback((): MonthlyData[] => {
        const data: MonthlyData[] = Array.from({ length: 12 }, () => ({
            income: 0,
            expenses: 0,
            balance: 0,
            hasIncomeData: false,
            hasExpenseData: false
        }));

        // Calculate rolling window: 12 months (8 back + current + 3 forward)
        const centerDate = new Date(displayYear, displayMonth, 1);

        commitments.forEach(commitment => {
            const term = commitment.active_term;
            if (!term) return;

            // For each of the 12 months in the rolling window
            for (let i = 0; i < 12; i++) {
                // Calculate the actual year/month for this slot
                const slotDate = new Date(centerDate);
                slotDate.setMonth(slotDate.getMonth() - 8 + i); // Start 8 months before center

                const slotYear = slotDate.getFullYear();
                const slotMonth = slotDate.getMonth(); // 0-indexed

                if (!isTermActiveForMonth(term, slotYear, slotMonth)) continue;

                // Get payment or use expected amount
                const commitmentPayments = payments.get(commitment.id) || [];
                const periodStr = periodToString({ year: slotYear, month: slotMonth + 1 });
                const paymentForPeriod = commitmentPayments.find(p => {
                    const pPeriod = p.period_date.substring(0, 7);
                    return pPeriod === periodStr;
                });

                const amount = paymentForPeriod?.amount_in_base ?? getPerPeriodAmount(term, true);

                if (commitment.flow_type === 'INCOME') {
                    data[i].income += amount;
                    data[i].hasIncomeData = true;
                } else {
                    data[i].expenses += amount;
                    data[i].hasExpenseData = true;
                }
            }
        });

        data.forEach(d => {
            d.balance = d.income - d.expenses;
        });

        return data;
    }, [commitments, payments, displayYear, displayMonth, isTermActiveForMonth]);

    // ==========================================================================
    // CONTEXT VALUE
    // ==========================================================================

    const value = useMemo<CommitmentsContextValue>(() => ({
        commitments,
        payments,
        loading,
        error,
        refresh,
        displayYear,
        displayMonth,
        setDisplayYear,
        setDisplayMonth,
        getUpcomingPayments,
        getMonthlyData,
        isPaymentMade,
    }), [
        commitments,
        payments,
        loading,
        error,
        refresh,
        displayYear,
        getUpcomingPayments,
        getMonthlyData,
        isPaymentMade
    ]);

    return (
        <CommitmentsContext.Provider value={value}>
            {children}
        </CommitmentsContext.Provider>
    );
};

// =============================================================================
// HOOK
// =============================================================================

export const useCommitments = (): CommitmentsContextValue => {
    const context = useContext(CommitmentsContext);
    if (!context) {
        throw new Error('useCommitments must be used within a CommitmentsProvider');
    }
    return context;
};

export default useCommitments;
