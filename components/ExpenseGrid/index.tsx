/**
 * ExpenseGridVirtual.v2.tsx
 *
 * V2 version of the expense grid that uses Commitments + Terms data model
 * instead of the v1 Expense model. Fetches data directly from v2 services.
 *
 * Design matches the v2 style guide:
 * - Color-coded expense/income (red/green)
 * - Dynamic theming
 * - Icon-based feedback
 */

import React, { useCallback } from 'react';

import { useExpenseGridLogic } from '../../hooks/useExpenseGridLogic';
import type { CommitmentWithTerm, Payment } from '../../types.v2';

import { KPISelectorModal } from './KPISelectorModal';
import { MobileFilterSheet } from './MobileFilterSheet';
import { HeaderToolbar } from './HeaderToolbar';
import { MobileCardList } from './MobileCardList';
import { DesktopGrid } from './DesktopGrid';


// =============================================================================
// TYPES
// =============================================================================

interface ExpenseGridV2Props {
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
    // New Controlled Props for Mobile Filter
    showMobileFilters?: boolean;
    onCloseMobileFilters?: () => void;
}


// =============================================================================
// COMPONENT
// =============================================================================

const ExpenseGridVirtual2: React.FC<ExpenseGridV2Props> = ({
    focusedDate,
    onEditCommitment,
    onDetailCommitment,
    onDeleteCommitment,
    onPauseCommitment,
    onResumeCommitment,
    onRecordPayment,
    onFocusedDateChange,
    showMobileFilters = false, // Default to false if not controlled
    onCloseMobileFilters = () => { }, // Default no-op
}) => {
    // Logic extracted to custom hook
    const {
        loading, error, density, setDensity,
        selectedCategory, setSelectedCategory,
        selectedStatus, setSelectedStatus,
        viewMode, setViewMode,
        commitmentCounts,
        currentKPI, handleKPIChange,
        showKPISelector, setShowKPISelector,
        commitments, payments, groupedCommitments, availableCategories, visibleMonths,
        getPaymentStatus, performSmartSort, isActiveInMonth, getTranslatedCategoryName,
        formatClp, getTermForPeriod, getTerminationReason, isCommitmentTerminated,
        t, getMonthTotals, rateConverter
    } = useExpenseGridLogic({ focusedDate, onFocusedDateChange });

    // Local state for Mobile Filters removed - now controlled by parent

    // Status change handler that syncs both filter AND visual KPI indicator
    type StatusFilter = 'all' | 'pendiente' | 'pagado' | 'vencido' | 'ingresos';
    type KPIType = 'ingresos' | 'comprometido' | 'pagado' | 'pendiente' | 'vencido';

    const handleStatusChange = useCallback((status: StatusFilter) => {
        const kpiMap: Record<StatusFilter, KPIType> = {
            'all': 'comprometido',
            'pendiente': 'pendiente',
            'pagado': 'pagado',
            'vencido': 'vencido',
            'ingresos': 'ingresos',
        };
        handleKPIChange(kpiMap[status]);
    }, [handleKPIChange]);

    // ==========================================================================
    // RENDER
    // ==========================================================================

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-red-500">{error}</p>
            </div>
        );
    }

    // Safe formatter that handles null/undefined
    const safeFormatClp = (amount: number | null | undefined): string => {
        if (amount == null) return '-';
        return formatClp(amount);
    };

    const totals = getMonthTotals(focusedDate.getFullYear(), focusedDate.getMonth());

    return (
        <div className="w-full h-full flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
            <HeaderToolbar
                focusedDate={focusedDate}
                viewMode={viewMode}
                setViewMode={setViewMode}
                density={density}
                setDensity={setDensity}
                currentKPI={currentKPI}
                handleKPIChange={handleKPIChange}
                totals={totals}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                selectedStatus={selectedStatus}
                setSelectedStatus={setSelectedStatus}
                availableCategories={availableCategories}
                setShowKPISelector={setShowKPISelector}
                formatClp={safeFormatClp as any} // Cast to satisfy strict typing if needed, or update types
            />


            <MobileCardList
                commitments={commitments}
                payments={payments}
                focusedDate={focusedDate}
                viewMode={viewMode}
                selectedCategory={selectedCategory}
                selectedStatus={selectedStatus}
                groupedCommitments={groupedCommitments}
                getTermForPeriod={getTermForPeriod}
                getPaymentStatus={getPaymentStatus}
                isActiveInMonth={isActiveInMonth}
                performSmartSort={performSmartSort}
                getTranslatedCategoryName={getTranslatedCategoryName}
                getTerminationReason={getTerminationReason}
                formatClp={safeFormatClp}
                t={t}
                onEditCommitment={onEditCommitment}
                onDetailCommitment={onDetailCommitment}
                onPauseCommitment={onPauseCommitment}
                onResumeCommitment={onResumeCommitment}
                onDeleteCommitment={onDeleteCommitment}
                onRecordPayment={onRecordPayment}
                rateConverter={rateConverter}
            />

            {/* Desktop View Content */}
            <DesktopGrid
                focusedDate={focusedDate}
                density={density}
                viewMode={viewMode}
                selectedCategory={selectedCategory}
                selectedStatus={selectedStatus}
                commitments={commitments}
                payments={payments}
                groupedCommitments={groupedCommitments}
                visibleMonths={visibleMonths}
                commitmentCounts={commitmentCounts}
                getPaymentStatus={getPaymentStatus}
                getTermForPeriod={getTermForPeriod}
                isActiveInMonth={isActiveInMonth}
                isCommitmentTerminated={isCommitmentTerminated}
                getTranslatedCategoryName={getTranslatedCategoryName}
                getTerminationReason={getTerminationReason}
                getMonthTotals={getMonthTotals}
                formatClp={safeFormatClp}
                onEditCommitment={onEditCommitment}
                onDetailCommitment={onDetailCommitment}
                onDeleteCommitment={onDeleteCommitment}
                onPauseCommitment={onPauseCommitment}
                onResumeCommitment={onResumeCommitment}
                onRecordPayment={onRecordPayment}
                onFocusedDateChange={onFocusedDateChange}
                onStatusChange={handleStatusChange}
            />

            {/* KPI Selector Bottom Sheet (Mobile Only) */}
            <KPISelectorModal
                isOpen={showKPISelector}
                onClose={() => setShowKPISelector(false)}
                totals={getMonthTotals(focusedDate.getFullYear(), focusedDate.getMonth())}
                currentKPI={currentKPI}
                onSelect={(kpi) => {
                    handleKPIChange(kpi);
                    setShowKPISelector(false);
                }}
            />

            {/* Mobile Filter Bottom Sheet */}
            <MobileFilterSheet
                isOpen={showMobileFilters}
                onClose={onCloseMobileFilters}
                categories={availableCategories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                selectedStatus={selectedStatus}
                onStatusChange={handleStatusChange}
            />


        </div>
    );
};

export default ExpenseGridVirtual2;
