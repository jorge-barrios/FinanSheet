/**
 * ExpenseGrid Types
 * 
 * Interfaces and types for the ExpenseGrid component suite.
 */

import type { CommitmentWithTerm, Payment } from '../../types.v2';

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface ExpenseGridProps {
    focusedDate: Date;
    onEditCommitment: (commitment: CommitmentWithTerm) => void;
    onDetailCommitment?: (commitment: CommitmentWithTerm) => void;
    onDeleteCommitment: (commitmentId: string) => void;
    onPauseCommitment: (commitment: CommitmentWithTerm) => void;
    onResumeCommitment: (commitment: CommitmentWithTerm) => void;
    onRecordPayment: (commitmentId: string, periodDate: string) => void;
    onFocusedDateChange?: (date: Date) => void;
    visibleMonthsCount?: number;
    onVisibleMonthsCountChange?: (count: number) => void;
    preloadedCommitments?: CommitmentWithTerm[];
    preloadedPayments?: Map<string, Payment[]>;
    monthlyTotals?: { expenses: number; income: number };
}

export interface ExpenseCardProps {
    commitment: CommitmentWithTerm;
    monthDate: Date;
    density: Density;
    payment: Payment | undefined;
    term: CommitmentWithTerm['terms'][0] | undefined;
    isPaid: boolean;
    isOverdue: boolean;
    isActiveThisMonth: boolean;
    cuotaNumber?: number;
    installmentsCount?: number;
    onRecordPayment: (commitmentId: string, periodDate: string) => void;
    onEdit: (commitment: CommitmentWithTerm) => void;
    onDetail?: (commitment: CommitmentWithTerm) => void;
    onDelete: (commitmentId: string) => void;
    formatClp: (amount: number) => string;
}

// =============================================================================
// INTERNAL TYPES
// =============================================================================

export type Density = 'minimal' | 'compact' | 'full';
export type StatusFilter = 'all' | 'overdue' | 'pending' | 'paid';
export type ViewMode = 'all' | 'expenses' | 'income';
export type KPIType = 'pending' | 'paid' | 'balance';

// =============================================================================
// HELPER FUNCTIONS (Pure, no dependencies)
// =============================================================================

/**
 * Convert Date to periodDate string (YYYY-MM-DD, first day of month)
 */
export const dateToPeriod = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
};
