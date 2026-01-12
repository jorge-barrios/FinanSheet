/**
 * commitmentStatusUtils.ts
 * 
 * Centralized logic for determining commitment status.
 * Used by ExpenseGridVirtual, InventoryView, and other components.
 */

import type { CommitmentWithTerm, Term, PaymentWithDetails } from '../types.v2';
import { extractYearMonth } from './financialUtils.v2';

/**
 * Simplified commitment status type.
 * - ACTIVE: Running (no end date, or end date in future)
 * - COMPLETED: Installment-based commitment with all cuotas done
 * - INACTIVE: Not running (paused, terminated, or no active term)
 */
export type CommitmentStatus = 'ACTIVE' | 'COMPLETED' | 'INACTIVE';

/**
 * Legacy termination reason type (for backwards compatibility with ExpenseGrid).
 * Maps to the simplified CommitmentStatus.
 */
export type TerminationReason = 'ACTIVE' | 'PAUSED' | 'COMPLETED_INSTALLMENTS' | 'TERMINATED';

/**
 * Get the detailed termination reason for a commitment.
 * This provides granular detail for debugging or detailed displays.
 */
export function getTerminationReason(commitment: CommitmentWithTerm): TerminationReason {
    // Use the most recent term, not just active_term
    const terms = commitment.all_terms || [];
    const latestTerm = terms.length > 0
        ? terms.slice().sort((a, b) => b.version - a.version)[0]
        : commitment.active_term;

    if (!latestTerm) return 'TERMINATED';

    // No end date = active (indefinite)
    if (!latestTerm.effective_until) return 'ACTIVE';

    // Use extractYearMonth to avoid timezone issues with date parsing
    const { year: endYear, month: endMonth } = extractYearMonth(latestTerm.effective_until);
    const endOfMonth = new Date(endYear, endMonth, 0); // Last day of end month

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If end date hasn't passed yet → commitment is still ACTIVE
    if (endOfMonth >= today) {
        return 'ACTIVE';
    }

    // End date HAS PASSED - now determine why it ended
    if (latestTerm.installments_count && latestTerm.installments_count > 1) {
        return 'COMPLETED_INSTALLMENTS'; // Completed all installments
    }

    // Ended manually (pause that already passed)
    return 'PAUSED';
}

/**
 * Get the simplified commitment status.
 * Use this for most UI displays.
 */
export function getCommitmentStatus(commitment: CommitmentWithTerm): CommitmentStatus {
    const reason = getTerminationReason(commitment);

    switch (reason) {
        case 'ACTIVE':
            return 'ACTIVE';
        case 'COMPLETED_INSTALLMENTS':
            return 'COMPLETED';
        case 'PAUSED':
        case 'TERMINATED':
        default:
            return 'INACTIVE';
    }
}

/**
 * Check if a commitment is currently active.
 */
export function isCommitmentActive(commitment: CommitmentWithTerm): boolean {
    return getCommitmentStatus(commitment) === 'ACTIVE';
}

/**
 * Check if a commitment has completed all its installments.
 */
export function isCommitmentCompleted(commitment: CommitmentWithTerm): boolean {
    return getCommitmentStatus(commitment) === 'COMPLETED';
}

/**
 * Check if a commitment is no longer active (terminated or paused).
 * This is the inverse of isCommitmentActive, provided for semantic clarity.
 */
export function isCommitmentInactive(commitment: CommitmentWithTerm): boolean {
    return getCommitmentStatus(commitment) === 'INACTIVE';
}

/**
 * Check if a commitment is "terminated" in the legacy sense 
 * (has effective_until in the past). Used for filtering.
 */
export function isCommitmentTerminated(commitment: CommitmentWithTerm): boolean {
    const reason = getTerminationReason(commitment);
    return reason === 'TERMINATED' || reason === 'COMPLETED_INSTALLMENTS' || reason === 'PAUSED';
}

// ============================================================================
// CENTRALIZED COMMITMENT SUMMARY
// ============================================================================

import type { Payment } from '../types.v2';
import { getPerPeriodAmount } from './financialUtils.v2';

/**
 * Estado types for UI display
 */
export type EstadoType = 'overdue' | 'pending' | 'ok' | 'completed' | 'paused' | 'terminated' | 'no_payments';

/**
 * Commitment summary - all calculated values needed for display
 */
export interface CommitmentSummary {
    // Status
    estado: EstadoType;
    estadoDetail: string;
    terminationReason: TerminationReason;

    // Amounts
    perPeriodAmount: number | null;
    totalPaid: number;

    // Payment info
    paymentCount: number;
    overdueCount: number;
    lastPayment: Payment | null;
    nextPaymentDate: Date | null;

    // Installment progress (for cuotas)
    // Installment progress (for cuotas)
    installmentsCount: number;
    isInstallmentBased: boolean;
    firstOverduePeriod?: Date | null;
}

/**
 * Get comprehensive summary for a commitment.
 * Centralizes all calculation logic to avoid duplication.
 */
export function getCommitmentSummary(
    commitment: CommitmentWithTerm,
    allPayments: Payment[],
    lastPaymentsMap?: Map<string, Payment>
): CommitmentSummary {
    const activeTerm = commitment.active_term;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Get all payments for this commitment
    // Include if:
    // a) It has a VALID payment date (actually paid, non-empty string)
    // b) OR the amount is 0 (effectively paid/skipped/waived)
    const commitmentPayments = allPayments.filter(
        p => p.commitment_id === commitment.id && (
            (p.payment_date && typeof p.payment_date === 'string' && p.payment_date.trim() !== '') ||
            p.amount_original === 0 ||
            p.amount_in_base === 0
        )
    );

    // 2. Get last payment (prefer from map for performance, fallback to search)
    let lastPayment: Payment | null = null;
    if (lastPaymentsMap?.has(commitment.id)) {
        lastPayment = lastPaymentsMap.get(commitment.id) || null;
    } else if (commitmentPayments.length > 0) {
        const sorted = [...commitmentPayments].sort((a, b) => {
            const dateA = new Date(a.payment_date!).getTime();
            const dateB = new Date(b.payment_date!).getTime();
            return dateB - dateA;
        });
        lastPayment = sorted[0];
    }

    // 3. Calculate totals
    const totalPaid = commitmentPayments.reduce(
        (sum, p) => sum + (p.amount_in_base ?? p.amount_original ?? 0), 0
    );
    const paymentCount = commitmentPayments.length;

    // 4. Per-period amount (using getPerPeriodAmount for correct is_divided_amount handling)
    const perPeriodAmount = activeTerm
        ? getPerPeriodAmount(activeTerm, true)
        : (lastPayment?.amount_original ?? null);

    // 5. Get termination reason
    const terminationReason = getTerminationReason(commitment);

    // 6. Installment info
    const installmentsCount = activeTerm?.installments_count ?? 0;
    const isInstallmentBased = installmentsCount > 1;
    const cuotasCompleted = isInstallmentBased && paymentCount >= installmentsCount;

    // 7. Calculate status metrics (Always calculate debt, regardless of pause status)
    let overdueCount = 0;
    let nextPaymentDate: Date | null = null;
    let firstOverduePeriod: Date | null = null;
    let paidPeriods = new Set<string>();

    // Calculate DEBT Metrics first
    // Use active_term if available, otherwise use the most recent term from all_terms
    // This handles the case where a term has ended but still has unpaid periods
    const termForDebtCalc = activeTerm || (commitment.all_terms && commitment.all_terms.length > 0
        ? commitment.all_terms.reduce((latest, t) =>
            !latest || t.effective_from > latest.effective_from ? t : latest, null as Term | null)
        : null);

    if (termForDebtCalc) {
        // Calculate expected periods and check for missing payments
        // FIX: Manually parse YYYY-MM-DD to avoid timezone issues with `new Date()`
        const [startYear, startMonth, startDay] = termForDebtCalc.effective_from.split('-').map(Number);

        // Construct dates safely using local time at noon to avoid DST shifts
        const startDate = new Date(startYear, startMonth - 1, startDay || 1, 12, 0, 0);
        const dueDay = termForDebtCalc.due_day_of_month || 1;

        // Get interval in months
        let interval = 1;
        switch (termForDebtCalc.frequency) {
            case 'ONCE': interval = 0; break;
            case 'MONTHLY': interval = 1; break;
            case 'BIMONTHLY': interval = 2; break;
            case 'QUARTERLY': interval = 3; break;
            case 'SEMIANNUALLY': interval = 6; break;
            case 'ANNUALLY': interval = 12; break;
        }

        if (interval > 0) {
            // Calculate current period index
            const monthDiff = (today.getFullYear() - startYear) * 12 + (today.getMonth() - (startMonth - 1));
            const periodsPassed = Math.max(0, Math.floor(monthDiff / interval));

            // Build set of paid periods from period_date strings
            paidPeriods = new Set(commitmentPayments.map(p => {
                const dateStr = p.period_date || p.payment_date!;
                const [year, month] = dateStr.split('-').map(Number);
                // Store as "YYYY-M" (0-indexed month for consistency with Date.getMonth())
                return `${year}-${month - 1}`;
            }));

            // Count overdue periods
            for (let i = 0; i <= periodsPassed; i++) {
                const totalMonthsOffset = (startMonth - 1) + (i * interval);
                const pYear = startYear + Math.floor(totalMonthsOffset / 12);
                const pMonth = totalMonthsOffset % 12; // 0-11

                const periodKey = `${pYear}-${pMonth}`;

                // Due date for this specific period
                const dueDate = new Date(pYear, pMonth, dueDay, 23, 59, 59);

                // Create a pure date object for the period (for display purposes)
                const periodDateObj = new Date(pYear, pMonth, 1, 12, 0, 0);

                // If term ended, we shouldn't count periods AFTER the end date
                let isPeriodValid = true;
                if (termForDebtCalc.effective_until) {
                    const datePart = termForDebtCalc.effective_until.split('T')[0];
                    const [endY, endM, endD] = datePart.split('-').map(Number);
                    const endDate = new Date(endY, endM - 1, endD, 23, 59, 59);

                    // If the period started AFTER termination, ignore
                    // Actually, if the OBLIGATION (due date) is after termination, ignore
                    // But if I terminate on the 5th and due date is 10th, do I owe it?
                    // Reusing the granular logic:
                    if (endDate < periodDateObj) {
                        isPeriodValid = false; // Terminated before this period started
                    } else if (pYear === endY && pMonth === (endM - 1)) {
                        // Same month termination
                        if (endD < dueDay) {
                            isPeriodValid = false; // Terminated before due date
                        }
                    }
                }

                if (isPeriodValid && !paidPeriods.has(periodKey) && dueDate < today) {
                    overdueCount++;
                    if (!firstOverduePeriod) {
                        firstOverduePeriod = periodDateObj;
                    }
                }
            }

            // Calculate next payment date:
            // PRIORITY: First unpaid period (could be overdue or upcoming)
            // If there are overdue periods, the "next" payment to make is the first overdue one
            if (firstOverduePeriod) {
                // Use the actual due date for the first overdue period
                nextPaymentDate = new Date(
                    firstOverduePeriod.getFullYear(),
                    firstOverduePeriod.getMonth(),
                    dueDay
                );
            } else {
                // No overdue periods, calculate next upcoming period
                // Find the first unpaid period from current onwards
                let nextUnpaidPeriodIndex = -1;
                for (let i = 0; i <= periodsPassed + 1; i++) {
                    const totalMonthsOffset = (startMonth - 1) + (i * interval);
                    const pYear = startYear + Math.floor(totalMonthsOffset / 12);
                    const pMonth = totalMonthsOffset % 12;
                    const periodKey = `${pYear}-${pMonth}`;

                    if (!paidPeriods.has(periodKey)) {
                        nextUnpaidPeriodIndex = i;
                        break;
                    }
                }

                if (nextUnpaidPeriodIndex >= 0) {
                    const totalMonthsOffset = (startMonth - 1) + (nextUnpaidPeriodIndex * interval);
                    const pYear = startYear + Math.floor(totalMonthsOffset / 12);
                    const pMonth = totalMonthsOffset % 12;
                    nextPaymentDate = new Date(pYear, pMonth, dueDay);
                } else {
                    // All periods paid, calculate truly next period
                    const nextPeriodIndex = periodsPassed + 1;
                    nextPaymentDate = new Date(
                        startDate.getFullYear(),
                        startDate.getMonth() + (nextPeriodIndex * interval),
                        dueDay
                    );
                }
            }
        }
    }

    // 8. Determine FINAL STATUS (Prioritizing Debt > Completion > Pause)
    let estado: EstadoType = 'ok';
    let estadoDetail = '';
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // PRIORITY 1: DEBT (Even if paused/terminated, if you owe money, you owe money)
    if (overdueCount > 0) {
        estado = 'overdue';
        const overdueMonthName = firstOverduePeriod ? months[firstOverduePeriod.getMonth()] : '';
        const overdueYear = firstOverduePeriod ? firstOverduePeriod.getFullYear().toString().slice(-2) : '';

        if (overdueCount === 1) {
            estadoDetail = `1 pendiente (${overdueMonthName} '${overdueYear})`;
        } else {
            estadoDetail = `${overdueCount} pendientes (desde ${overdueMonthName} '${overdueYear})`;
        }
    }
    // PRIORITY 2: LIFECYCLE (Completed/Terminated/Paused)
    else if (terminationReason === 'COMPLETED_INSTALLMENTS' || cuotasCompleted) {
        estado = 'completed';
        estadoDetail = installmentsCount > 0
            ? `${paymentCount}/${installmentsCount} completado`
            : 'Completado';
    } else if (terminationReason === 'TERMINATED') {
        estado = 'terminated';
        estadoDetail = 'Terminado';
    } else if (terminationReason === 'PAUSED') {
        estado = 'paused';
        estadoDetail = 'Pausado';
    }
    // PRIORITY 3: ACTIVE STATUS
    else if (activeTerm) {
        if (activeTerm.frequency === 'ONCE') {
            if (paymentCount === 0) {
                estado = 'pending';
                estadoDetail = 'Pendiente';
            } else {
                estado = 'completed';
                estadoDetail = 'Pagado';
            }
        } else {
            const currentPeriodKey = `${today.getFullYear()}-${today.getMonth()}`;
            const dueDay = activeTerm.due_day_of_month || 1;
            const currentDueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);

            if (!paidPeriods.has(currentPeriodKey) && currentDueDate >= today) {
                estado = 'pending';
                estadoDetail = `Vence ${dueDay} ${months[today.getMonth()]}`;
            } else {
                estado = 'ok';
                estadoDetail = nextPaymentDate
                    ? `Al día · Próx: ${nextPaymentDate.getDate()} ${months[nextPaymentDate.getMonth()]}`
                    : 'Al día';
            }
        }
    } else if (paymentCount === 0) {
        estado = 'no_payments';
        estadoDetail = 'Sin pagos';
    }

    return {
        estado,
        estadoDetail,
        terminationReason,
        perPeriodAmount,
        totalPaid,
        paymentCount,
        overdueCount,
        lastPayment,
        nextPaymentDate,
        installmentsCount,
        isInstallmentBased,
        firstOverduePeriod
    };
}

/**
 * Generates the list of expected payment periods for a term based on its configuration.
 * This logic is CENTRALIZED to ensure consistency between Dashboard, Grid, and Detail views.
 * 
 * @param term The term to generate periods for
 * @param commitment The parent commitment (needed for context in result objects)
 * @param payments List of ALL available payments for this commitment (to match active vs pending)
 * @returns Array of PaymentWithDetails (some are real payments, others are virtual pending payments)
 */
export function generateExpectedPeriods(
    term: Term,
    commitment: CommitmentWithTerm,
    payments: Payment[]
): PaymentWithDetails[] {
    const termPayments = payments.filter(p => p.term_id === term.id) || [];
    const expectedPeriods: PaymentWithDetails[] = [];

    // Start iterating from term start date
    let currentPeriod = term.effective_from.slice(0, 7) + '-01'; // Ensure YYYY-MM-DD

    // Determine limit date
    // 1. If effective_until is set -> use it explicitly
    // 2. If installments_count is set -> use it to calculate roughly end date (+buffer)
    // 3. If indefinite (no until, no installments) -> limit to CURRENT MONTH + 1 (to see next due)
    let limitDateStr = term.effective_until;

    if (!limitDateStr) {
        if (term.installments_count && term.installments_count > 0) {
            // Safety buffer: active start + (installments * 2) months or +2 years max
            // This prevents infinite loops if data is weird, but allows viewing future installments
            const [y, m] = term.effective_from.split('-').map(Number);
            const safetyDate = new Date(y + 2, m, 1);
            limitDateStr = safetyDate.toISOString().slice(0, 10);
        } else {
            // Indefinite -> Stop at current month (to show "pending" for now)
            // or maybe +1 month to show next upcoming payment
            const now = new Date();
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            limitDateStr = nextMonth.toISOString().slice(0, 10);
        }
    }

    // Safety Loop Breaker
    let iterations = 0;
    const MAX_ITERATIONS = 600; // 50 years of monthly payments, should be enough

    while (currentPeriod <= limitDateStr && iterations < MAX_ITERATIONS) {
        iterations++;

        const targetMonth = currentPeriod.slice(0, 7);

        // Find REAL payment for this period (robust string matchY-M)
        const existingPayment = termPayments.find(p => p.period_date && p.period_date.includes(targetMonth));

        if (existingPayment) {
            expectedPeriods.push({
                ...existingPayment,
                commitment,
                term
            } as PaymentWithDetails);
        } else {
            // VIRTUAL Pending Payment Logic
            let shouldAddPending = true;

            // Rule: Don't exceed installments count
            if (term.installments_count) {
                // If we already have enough items (real + pending) >= total, stop adding pending
                // Note: we continue the loop just in case there are REAL payments logged beyond the count (edge case)
                // but we stop generating new VIRTUAL overdue ones.
                const currentCount = expectedPeriods.length;
                if (currentCount >= term.installments_count) {
                    shouldAddPending = false;
                }
            }

            if (shouldAddPending) {
                expectedPeriods.push({
                    id: `virtual-${term.id}-${currentPeriod}`,
                    period_date: currentPeriod,
                    payment_date: null, // Marks as pending
                    amount_original: term.is_divided_amount && term.installments_count
                        ? (term.amount_original / term.installments_count)
                        : term.amount_original,
                    currency_original: term.currency_original,
                    commitment_id: term.commitment_id,
                    term_id: term.id,
                    fx_rate_to_base: term.fx_rate_to_base,
                    amount_in_base: term.amount_in_base,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    commitment: commitment,
                    term: term
                } as PaymentWithDetails);
            }
        }

        // Advance to next month
        // Advance to next period based on frequency
        const [y, m] = currentPeriod.split('-').map(Number);
        // m is 1-12. Date constructor uses 0-11.

        let interval = 1;
        switch (term.frequency) {
            case 'ONCE': interval = 0; break; // Should loop once and stop, but we handle logic below
            case 'MONTHLY': interval = 1; break;
            case 'BIMONTHLY': interval = 2; break;
            case 'QUARTERLY': interval = 3; break;
            case 'SEMIANNUALLY': interval = 6; break;
            case 'ANNUALLY': interval = 12; break;
            default: interval = 1;
        }

        if (interval === 0) {
            // For ONCE, we only run one iteration. Break loop.
            break;
        }

        // Calculate next date securely
        // Note: m is 1-based from split, but we want to add `interval` months.
        // new Date(y, m-1, 1) is current period start.
        // new Date(y, (m-1) + interval, 1) is next period start.
        const nextDate = new Date(y, (m - 1) + interval, 1);
        currentPeriod = nextDate.toISOString().slice(0, 10);
    }

    // Sort Newest -> Oldest
    return expectedPeriods.sort((a, b) => b.period_date.localeCompare(a.period_date));
}

/**
 * Calculates the chronological installment number for a specific date.
 * It generates the full timeline of all expected periods across all terms
 * to determine exactly which number in the sequence matches the target date.
 * 
 * @param commitment The commitment to analyze
 * @param payments list of all payments for this commitment
 * @param targetDate The date (YYYY-MM) to find the installment number for
 * @returns Object with { current: number, total: number } or null if not found
 */
export function getInstallmentNumber(
    commitment: CommitmentWithTerm,
    payments: Payment[],
    targetDate: string
): { current: number; total: number; totalLabel: string } | null {
    const targetYM = targetDate.substring(0, 7);

    // 1. Get all terms
    const allTerms = commitment.all_terms && commitment.all_terms.length > 0
        ? commitment.all_terms
        : (commitment.active_term ? [commitment.active_term] : []);

    if (allTerms.length === 0) return null;

    // 2. Generate ALL expected periods for ALL terms
    let allPeriods: PaymentWithDetails[] = [];

    for (const term of allTerms) {
        const termPeriods = generateExpectedPeriods(term, commitment, payments);
        allPeriods = allPeriods.concat(termPeriods);
    }

    // 3. Sort Chronologically (Oldest -> Newest) for counting
    // Filter out duplicates if any (though terms shouldn't overlap) based on period_date
    const seenPeriods = new Set<string>();
    const uniquePeriods = allPeriods
        .filter(p => {
            const ym = p.period_date.substring(0, 7);
            if (seenPeriods.has(ym)) return false;
            seenPeriods.add(ym);
            return true;
        })
        .sort((a, b) => a.period_date.localeCompare(b.period_date)); // Ascending

    // 4. Find the index of the target date
    const index = uniquePeriods.findIndex(p => p.period_date.substring(0, 7) === targetYM);

    if (index === -1) return null;

    const currentNumber = index + 1;
    const totalCount = uniquePeriods.length;

    // Determine total label behavior
    // If the active term is open-ended (no installments_count and no effective_until), 
    // the total is dynamic/infinite, so we might want to show just "Cuota X" or "Cuota X / ..."
    const activeTerm = commitment.active_term;
    // Fix: Treat as indefinite if no effective date AND not a divided amount.
    // This ignores legacy installments_count that might be lingering on indefinite terms.
    const isIndefinite = activeTerm && !activeTerm.effective_until && !activeTerm.is_divided_amount;

    // If indefinite, showing "/ X" is confusing because X keeps growing.
    // But if we have a defined set (loans), X is fixed.
    const totalLabel = isIndefinite ? '∞' : totalCount.toString();

    return {
        current: currentNumber,
        total: totalCount,
        totalLabel
    };
}
