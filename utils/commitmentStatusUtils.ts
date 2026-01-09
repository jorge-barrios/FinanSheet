/**
 * commitmentStatusUtils.ts
 * 
 * Centralized logic for determining commitment status.
 * Used by ExpenseGridVirtual, InventoryView, and other components.
 */

import type { CommitmentWithTerm } from '../types.v2';
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
    // a) It has a payment date (actually paid)
    // b) OR the amount is 0 (effectively paid/skipped, even if not marked with date)
    const commitmentPayments = allPayments.filter(
        p => p.commitment_id === commitment.id && (p.payment_date || p.amount_original === 0 || p.amount_in_base === 0)
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
    if (activeTerm) {
        // Calculate expected periods and check for missing payments
        // FIX: Manually parse YYYY-MM-DD to avoid timezone issues with `new Date()`
        const [startYear, startMonth, startDay] = activeTerm.effective_from.split('-').map(Number);

        // Construct dates safely using local time at noon to avoid DST shifts
        const startDate = new Date(startYear, startMonth - 1, startDay || 1, 12, 0, 0);
        const dueDay = activeTerm.due_day_of_month || 1;

        // Get interval in months
        let interval = 1;
        switch (activeTerm.frequency) {
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
                if (activeTerm.effective_until) {
                    const datePart = activeTerm.effective_until.split('T')[0];
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

            // Calculate next payment date (only relevant if active)
            const nextPeriodIndex = periodsPassed + 1;
            nextPaymentDate = new Date(
                startDate.getFullYear(),
                startDate.getMonth() + (nextPeriodIndex * interval),
                dueDay
            );
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
