/**
 * CommitmentsContext
 * 
 * Centralized context for v2 data (commitments, terms, payments).
 * Provides shared state and refresh functionality across all components.
 * Eliminates duplicate fetching between Grid and Dashboard.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode, useRef } from 'react';
import { CommitmentService, PaymentService, getCurrentUserId } from '../services/dataService.v2';
import type { CommitmentWithTerm, Payment, FlowType, MonthTotals } from '../types.v2';
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

// MonthTotals moved to types.v2

interface CommitmentsContextValue {
    // Raw data
    commitments: CommitmentWithTerm[];
    payments: Map<string, Payment[]>;

    // Loading state
    loading: boolean;
    error: string | null;

    // Refresh function - options: { silent?: boolean, force?: boolean }
    // silent: don't show loading state, force: bypass staleTime check
    refresh: (options?: { silent?: boolean; force?: boolean }) => Promise<void>;

    // Display year and month for rolling window calculations
    displayYear: number;
    displayMonth: number;
    setDisplayYear: (year: number) => void;
    setDisplayMonth: (month: number) => void;

    // Derived data (calculated from raw data)
    getUpcomingPayments: (selectedMonth: number) => UpcomingPayment[];
    getMonthlyData: () => MonthlyData[];
    getMonthTotals: (year: number, month: number) => MonthTotals;
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
    // OPTIMIZATION: Track userId to avoid unnecessary refreshes on token refresh
    // ==========================================================================
    const prevUserIdRef = useRef<string | undefined>(undefined);
    const lastRefreshRef = useRef<number>(0);
    const STALE_TIME_MS = 300000; // 5 minutes - data considered fresh

    // ==========================================================================
    // DATA FETCHING
    // ==========================================================================

    const refresh = useCallback(async (options: { silent?: boolean; force?: boolean } = {}) => {
        const { silent = false, force = false } = options;

        // Stale time check: avoid unnecessary refreshes on visibility change / token refresh
        // Skip this check if force is true (explicit user action like saving a payment)
        const now = Date.now();
        if (silent && !force && now - lastRefreshRef.current < STALE_TIME_MS) {
            console.log('CommitmentsContext: Data is fresh, skipping silent refresh');
            return;
        }

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

            // First, fetch commitments to determine the date range for payments
            const commitmentsData = await CommitmentService.getCommitmentsWithTerms(userId);
            setCommitments(commitmentsData);

            // Calculate date range based on oldest commitment's effective_from
            // This ensures we load ALL payments that could be overdue
            const centerDate = new Date(displayYear, displayMonth, 1);

            // Find the oldest effective_from date across all terms
            let oldestEffectiveFrom: Date | null = null;
            commitmentsData.forEach(c => {
                const terms = c.all_terms || (c.active_term ? [c.active_term] : []);
                terms.forEach(t => {
                    if (t.effective_from) {
                        const termStart = new Date(t.effective_from);
                        if (!oldestEffectiveFrom || termStart < oldestEffectiveFrom) {
                            oldestEffectiveFrom = termStart;
                        }
                    }
                });
            });

            // Start: Use oldest effective_from or fallback to 12 months before
            const startDate = oldestEffectiveFrom || new Date(centerDate);
            if (!oldestEffectiveFrom) {
                startDate.setMonth(startDate.getMonth() - 12);
            }

            // End: 12 months after current view
            const endDate = new Date(centerDate);
            endDate.setMonth(endDate.getMonth() + 13); // +13 to include the final month

            const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
            const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;

            console.log(`CommitmentsContext: Loading ${silent ? '(silent)' : ''} payments from ${startStr} (oldest commitment) to ${endStr}`);

            // Now fetch payments for the calculated range
            const allPayments = await PaymentService.getPaymentsByDateRange(userId, startStr, endStr);

            // Group payments by commitment_id
            const paymentsByCommitment = new Map<string, Payment[]>();
            allPayments.forEach(p => {
                const existing = paymentsByCommitment.get(p.commitment_id) || [];
                paymentsByCommitment.set(p.commitment_id, [...existing, p]);
            });
            setPayments(paymentsByCommitment);

            // Mark successful refresh timestamp
            lastRefreshRef.current = Date.now();

        } catch (err) {
            console.error('CommitmentsContext refresh error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [displayYear, displayMonth]);

    // SECURITY + OPTIMIZATION: Handle user identity changes
    // Compares userId (stable) instead of user object reference to avoid
    // unnecessary refreshes on TOKEN_REFRESHED or visibility change events
    useEffect(() => {
        const currentUserId = user?.id;
        const previousUserId = prevUserIdRef.current;

        if (!currentUserId) {
            // === LOGOUT: Always clear data (SECURITY) ===
            console.log('CommitmentsContext: User logged out, clearing all data');
            setCommitments([]);
            setPayments(new Map());
            setError(null);
            setLoading(false);
            prevUserIdRef.current = undefined;
            lastRefreshRef.current = 0; // Reset stale time
        } else if (currentUserId !== previousUserId) {
            // === NEW USER: Different userId, must reload (SECURITY) ===
            console.log(`CommitmentsContext: User changed from ${previousUserId} to ${currentUserId}, loading data`);
            prevUserIdRef.current = currentUserId;
            lastRefreshRef.current = 0; // Force fresh data for new user
            refresh();
        } else {
            // === SAME USER: Token refresh, visibility change, etc. ===
            console.log('CommitmentsContext: Same user detected (token refresh?), no action needed');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]); // Deliberately depends on user object to catch all auth events

    // REFRESH ON YEAR CHANGE
    // This is critical: When the user navigates the grid to a different year,
    // we must fetch the data for that period. The 'refresh' function calculates
    // the window based on 'displayYear'.
    // We only trigger on YEAR change to avoid excessive fetching while scrolling months.
    useEffect(() => {
        if (user) {
            console.log(`CommitmentsContext: Year changed to ${displayYear}, refreshing data...`);
            refresh({ silent: true }); // Silent refresh to avoid full loading screens
        }
    }, [displayYear, user]); // Deliberately exclude 'refresh' to avoid loop, and 'displayMonth' to avoid churn

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

    // Get totals for a specific month - centralized calculation
    const getMonthTotals = useCallback((year: number, month: number): MonthTotals => {
        let comprometido = 0;
        let ingresos = 0;
        let pagado = 0;
        let pendiente = 0;

        const targetPeriod = periodToString({ year, month: month + 1 });

        // Note: We do NOT filter by "terminated" here - that's for UI display only.
        // A commitment that was active in January but terminated in February
        // should still count in January's totals.
        // isTermActiveForMonth already handles the date range logic correctly.

        // Build a map of commitment IDs for quick lookup (same as getMonthlyData)
        const commitmentMap = new Map(commitments.map(c => [c.id, c]));

        // Track processed linked pairs to avoid double-counting
        const processedPairs = new Set<string>();
        const getPairKey = (id1: string, id2: string) => [id1, id2].sort().join('|');

        commitments.forEach(c => {
            const term = c.active_term;
            if (!term) return;

            // Check if active in this month (handles start/end dates and frequency)
            if (!isTermActiveForMonth(term, year, month)) return;

            // Handle linked commitments (bidirectional) - calculate NET only once per pair
            const linkedId = c.linked_commitment_id;
            const linkedCommitment = linkedId ? commitmentMap.get(linkedId) : null;

            let amount = getAmountForPeriod(c, year, month);
            let flowType = c.flow_type;

            if (linkedCommitment) {
                const pairKey = getPairKey(c.id, linkedId!);

                // Skip if already processed this pair
                if (processedPairs.has(pairKey)) {
                    return;
                }

                // Mark pair as processed
                processedPairs.add(pairKey);

                // Calculate NET if linked commitment is also active
                const linkedTerm = linkedCommitment.active_term;
                if (linkedTerm && isTermActiveForMonth(linkedTerm, year, month)) {
                    const linkedAmount = getAmountForPeriod(linkedCommitment, year, month);
                    const netAmount = Math.abs(amount - linkedAmount);

                    // Determine which side "wins" (larger amount determines flow type)
                    if (amount >= linkedAmount) {
                        amount = netAmount;
                        // flowType stays as c.flow_type
                    } else {
                        amount = netAmount;
                        flowType = linkedCommitment.flow_type;
                    }
                }
            }

            // Categorize by flow type (comprometido / ingresos use NET amount)
            if (flowType === 'EXPENSE') {
                comprometido += amount;
            } else {
                ingresos += amount;
            }

            // Calculate PAGADO - sum of actual payments made
            // For linked pairs, calculate NET of both payments (not sum of both)
            const getPaymentAmount = (commitmentId: string): number => {
                const pmnts = payments.get(commitmentId) || [];
                const record = pmnts.find(p => {
                    const pPeriod = p.period_date.substring(0, 7);
                    return pPeriod === targetPeriod && !!p.payment_date;
                });
                if (!record) return 0;
                return record.currency_original === 'CLP'
                    ? record.amount_original || 0
                    : record.amount_in_base ?? record.amount_original ?? 0;
            };

            const myPaidAmount = getPaymentAmount(c.id);
            let netPaidAmount = myPaidAmount;

            if (linkedCommitment) {
                const linkedPaidAmount = getPaymentAmount(linkedCommitment.id);
                // NET of both payments (like comprometido)
                netPaidAmount = Math.abs(myPaidAmount - linkedPaidAmount);
            }

            // Add to pagado - ONLY EXPENSES (not income)
            if (flowType === 'EXPENSE') {
                pagado += netPaidAmount;
            }

            // Check pendiente - only if NOT paid and is expense
            const isPaid = myPaidAmount > 0 || (linkedCommitment && getPaymentAmount(linkedCommitment.id) > 0);
            if (!isPaid && flowType === 'EXPENSE') {
                pendiente += amount;
            }
        });

        return {
            comprometido,
            ingresos,
            pagado,
            pendiente,
            balance: ingresos - comprometido
        };
    }, [commitments, payments, isTermActiveForMonth, getAmountForPeriod]);


    const getMonthlyData = useCallback((): MonthlyData[] => {
        const data: MonthlyData[] = [];

        // Calculate rolling window: 12 months (8 back + current + 3 forward)
        const centerDate = new Date(displayYear, displayMonth, 1);

        for (let i = 0; i < 12; i++) {
            // Calculate the actual year/month for this slot
            const slotDate = new Date(centerDate);
            slotDate.setMonth(slotDate.getMonth() - 8 + i); // Start 8 months before center

            const slotYear = slotDate.getFullYear();
            const slotMonth = slotDate.getMonth(); // 0-indexed

            const totals = getMonthTotals(slotYear, slotMonth);

            data.push({
                income: totals.ingresos,
                expenses: totals.comprometido,
                balance: totals.balance,
                hasIncomeData: totals.ingresos > 0,
                hasExpenseData: totals.comprometido > 0
            });
        }

        return data;
    }, [displayYear, displayMonth, getMonthTotals]);



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
        getMonthTotals,
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
        getMonthTotals,
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
