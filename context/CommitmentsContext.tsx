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
import { useAuth } from './AuthContext';
import { periodToString } from '../types.v2';

// =============================================================================
// TYPES
// =============================================================================

type UrgencyGroup = 'overdue' | 'next7days' | 'restOfMonth';

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
    urgencyGroup: UrgencyGroup; // For grouping in UI
    daysUntilDue: number; // Negative if overdue
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
    refresh: (silent?: boolean) => Promise<void>;

    // Display year and month for rolling window calculations
    displayYear: number;
    displayMonth: number;
    setDisplayYear: (year: number) => void;
    setDisplayMonth: (month: number) => void;

    // Derived data (calculated from raw data)
    getUpcomingPayments: (selectedMonth: number) => UpcomingPayment[];
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
    const { user } = useAuth(); // SECURITY: Monitor user changes
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

    // SECURITY: Clear data when user logs out
    useEffect(() => {
        if (!user) {
            console.log('CommitmentsContext: User logged out, clearing data');
            setCommitments([]);
            setPayments(new Map());
            setError(null);
            setLoading(false);
        } else {
            // User logged in - load data
            console.log('CommitmentsContext: User logged in, loading data');
            refresh();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]); // Re-run when user changes (login/logout)

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

    const getUpcomingPayments = useCallback((selectedMonth: number): UpcomingPayment[] => {
        const items: UpcomingPayment[] = [];
        const today = new Date();
        const todayTime = today.getTime();
        const currentYear = today.getFullYear();
        const currentMonthActual = today.getMonth();

        // Helper to calculate days until due and urgency group
        const calculateUrgency = (dueYear: number, dueMonth: number, dueDay: number): { daysUntilDue: number; urgencyGroup: UrgencyGroup } => {
            const dueDate = new Date(dueYear, dueMonth, dueDay);
            const diffTime = dueDate.getTime() - todayTime;
            const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysUntilDue < 0) {
                return { daysUntilDue, urgencyGroup: 'overdue' };
            } else if (daysUntilDue <= 7) {
                return { daysUntilDue, urgencyGroup: 'next7days' };
            } else {
                return { daysUntilDue, urgencyGroup: 'restOfMonth' };
            }
        };

        // 1. Get pending payments for the SELECTED month only (not next month)
        const yearForMonth = displayYear;
        const actualMonth = selectedMonth;

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

            const { daysUntilDue, urgencyGroup } = calculateUrgency(yearForMonth, actualMonth, dueDay);
            const isOverdue = urgencyGroup === 'overdue';

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
                urgencyGroup,
                daysUntilDue,
            });
        });

        // 2. Search for overdue payments from past months (up to 3 months back)
        commitments.forEach(commitment => {
            const term = commitment.active_term;
            if (!term) return;
            if (commitment.flow_type !== 'EXPENSE') return;

            for (let i = 1; i <= 3; i++) {
                const checkDate = new Date(currentYear, currentMonthActual - i, 1);
                const checkYear = checkDate.getFullYear();
                const checkMonth = checkDate.getMonth();

                // Stop if before commitment started
                if (!isTermActiveForMonth(term, checkYear, checkMonth)) continue;

                // Skip if already paid
                if (isPaymentMade(commitment.id, checkYear, checkMonth)) continue;

                // Skip if this is the selected month (already handled above)
                if (checkMonth === actualMonth && checkYear === yearForMonth) continue;

                // This is an overdue payment from a past month
                const dueDay = term.due_day_of_month || 1;
                const commitmentPayments = payments.get(commitment.id) || [];
                const periodStr = periodToString({ year: checkYear, month: checkMonth + 1 });
                const paymentRecord = commitmentPayments.find(p =>
                    p.period_date.substring(0, 7) === periodStr
                );
                const amount = paymentRecord && paymentRecord.amount_in_base
                    ? paymentRecord.amount_in_base
                    : getPerPeriodAmount(term, true);

                const { daysUntilDue } = calculateUrgency(checkYear, checkMonth, dueDay);

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
                    isOverdue: true,
                    isPaid: false,
                    cuotaNumber,
                    totalCuotas,
                    flowType: commitment.flow_type as FlowType,
                    urgencyGroup: 'overdue', // All past unpaid are overdue
                    daysUntilDue,
                });
            }
        });

        // Sort: overdue first (most overdue), then by days until due ascending
        items.sort((a, b) => {
            // Group priority: overdue < next7days < restOfMonth
            const groupOrder: Record<UrgencyGroup, number> = { overdue: 0, next7days: 1, restOfMonth: 2 };
            const groupDiff = groupOrder[a.urgencyGroup] - groupOrder[b.urgencyGroup];
            if (groupDiff !== 0) return groupDiff;

            // Within same group, sort by days until due (ascending)
            return a.daysUntilDue - b.daysUntilDue;
        });

        return items;
    }, [commitments, payments, displayYear, isTermActiveForMonth, isPaymentMade, getCuotaNumber, getPerPeriodAmount]);

    // Helper: Get amount for a commitment in a specific period (from payment or projected)
    const getAmountForPeriod = useCallback((
        commitment: CommitmentWithTerm,
        slotYear: number,
        slotMonth: number
    ): number => {
        const term = commitment.active_term;
        if (!term) return 0;

        const commitmentPayments = payments.get(commitment.id) || [];
        const periodStr = periodToString({ year: slotYear, month: slotMonth + 1 });
        const paymentForPeriod = commitmentPayments.find(p => {
            const pPeriod = p.period_date.substring(0, 7);
            return pPeriod === periodStr;
        });

        return paymentForPeriod?.amount_in_base ?? getPerPeriodAmount(term, true);
    }, [payments]);

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

        // Build a map of commitment IDs for quick lookup
        const commitmentMap = new Map(commitments.map(c => [c.id, c]));

        // Build a set of linked pairs to track which commitments have been processed
        // For bidirectional links: A.linked_commitment_id = B.id AND B.linked_commitment_id = A.id
        // We only want to process each pair ONCE and show NET on the appropriate side
        const processedPairs = new Set<string>();

        // Helper to get the pair key (sorted IDs to ensure consistency)
        const getPairKey = (id1: string, id2: string) => [id1, id2].sort().join('|');

        commitments.forEach(commitment => {
            const term = commitment.active_term;
            if (!term) return;

            // Check if this commitment is part of a linked pair
            const linkedId = commitment.linked_commitment_id;
            const linkedCommitment = linkedId ? commitmentMap.get(linkedId) : null;

            // Skip if linked commitment doesn't have a reciprocal link (unidirectional - legacy)
            // OR if we already processed this pair
            if (linkedCommitment) {
                const pairKey = getPairKey(commitment.id, linkedId!);

                // For bidirectional links, only process once
                // Show NET on the side with the LARGER amount (the "dominant" flow)
                if (processedPairs.has(pairKey)) {
                    return; // Already processed this pair
                }

                // Mark pair as processed
                processedPairs.add(pairKey);
            }

            // For each of the 12 months in the rolling window
            for (let i = 0; i < 12; i++) {
                // Calculate the actual year/month for this slot
                const slotDate = new Date(centerDate);
                slotDate.setMonth(slotDate.getMonth() - 8 + i); // Start 8 months before center

                const slotYear = slotDate.getFullYear();
                const slotMonth = slotDate.getMonth(); // 0-indexed

                if (!isTermActiveForMonth(term, slotYear, slotMonth)) continue;

                // Get this commitment's amount for the period
                let amount = getAmountForPeriod(commitment, slotYear, slotMonth);
                let flowType = commitment.flow_type;

                // If linked, calculate NET and determine which side gets it
                if (linkedCommitment) {
                    const linkedTerm = linkedCommitment.active_term;
                    if (linkedTerm && isTermActiveForMonth(linkedTerm, slotYear, slotMonth)) {
                        const linkedAmount = getAmountForPeriod(linkedCommitment, slotYear, slotMonth);
                        const netAmount = Math.abs(amount - linkedAmount);

                        // Determine which side "wins" (larger amount determines flow type)
                        if (amount >= linkedAmount) {
                            // This commitment is larger - NET goes to this flow type
                            amount = netAmount;
                            // flowType stays as commitment.flow_type
                        } else {
                            // Linked commitment is larger - NET goes to linked's flow type
                            amount = netAmount;
                            flowType = linkedCommitment.flow_type;
                        }
                    }
                }

                if (flowType === 'INCOME') {
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
    }, [commitments, payments, displayYear, displayMonth, isTermActiveForMonth, getAmountForPeriod]);

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
