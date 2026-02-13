/**
 * DesktopGrid.tsx
 *
 * Desktop grid view for the ExpenseGrid component.
 * Extracted from index.tsx to reduce file size and improve maintainability.
 * Contains: month header navigation, commitment rows (minimal/compact/detailed),
 * payment cells, archived section, and ContextualFooter.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
    EditIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon,
    CheckCircleIcon, ExclamationTriangleIcon, ClockIcon,
    CalendarIcon,
    PauseIcon, PlusIcon, MoreVertical, Link2,
    HashIcon
} from '../icons';
import type { CommitmentWithTerm, Payment } from '../../types.v2';
import { getPerPeriodAmount } from '../../utils/financialUtils.v2';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { Sparkles, Minus, RefreshCw, Eye, Star } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ContextualFooter } from './ContextualFooter';
import { getCommitmentSummary } from '../../utils/commitmentStatusUtils';
import { useCommitmentValue } from '../../hooks/useCommitmentValue';
import type { Density, ViewMode, StatusFilter } from '../../hooks/useExpenseGridLogic';

// =============================================================================
// TOOLTIP COMPONENT (same as in index.tsx)
// =============================================================================
const CompactTooltip = ({
    children,
    content,
    sideOffset = 5,
    triggerClassName = '',
}: {
    children: React.ReactNode;
    content: React.ReactNode;
    sideOffset?: number;
    triggerClassName?: string;
}) => (
    <Tooltip.Provider delayDuration={200}>
        <Tooltip.Root>
            <Tooltip.Trigger asChild>
                <div className={triggerClassName}>{children}</div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content
                    className="z-[100] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl px-3 py-2.5 text-sm"
                    sideOffset={sideOffset}
                    side="bottom"
                    align="center"
                    avoidCollisions
                >
                    {content}
                    <Tooltip.Arrow className="fill-white dark:fill-slate-800 border-t border-l border-slate-200" />
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    </Tooltip.Provider>
);

// Helper to convert Date to periodDate string (YYYY-MM-DD, first day of month)
const dateToPeriod = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
};

// =============================================================================
// TYPES
// =============================================================================

interface DesktopGridProps {
    focusedDate: Date;
    density: Density;
    viewMode: ViewMode;
    selectedCategory: string;
    selectedStatus: StatusFilter;
    commitments: CommitmentWithTerm[];
    payments: Map<string, Payment[]>;
    groupedCommitments: {
        active: { category: string; commitments: CommitmentWithTerm[] }[];
        archived: CommitmentWithTerm[];
    };
    visibleMonths: Date[];
    commitmentCounts: { active: number; paused: number; archived: number; total: number };
    // Hook functions
    getPaymentStatus: (commitmentId: string, monthDate: Date, dueDay: number) => {
        isPaid: boolean;
        amount: number | null;
        paidOnTime: boolean;
        payment: Payment | null;
        hasPaymentRecord: boolean;
    };
    getTermForPeriod: (commitment: CommitmentWithTerm, monthDate: Date) => CommitmentWithTerm['active_term'] | null;
    isActiveInMonth: (commitment: CommitmentWithTerm, monthDate: Date) => boolean;
    isCommitmentTerminated: (commitment: CommitmentWithTerm) => boolean;
    getTranslatedCategoryName: (commitment: CommitmentWithTerm) => string;
    getTerminationReason: (commitment: CommitmentWithTerm) => string | null;
    getMonthTotals: (year: number, month: number) => {
        comprometido: number;
        pagado: number;
        pendiente: number;
        ingresos: number;
        vencido: number;
    };
    formatClp: (amount: number | null | undefined) => string;
    // Action callbacks
    onEditCommitment: (commitment: CommitmentWithTerm) => void;
    onDetailCommitment?: (commitment: CommitmentWithTerm) => void;
    onDeleteCommitment: (commitmentId: string) => void;
    onPauseCommitment: (commitment: CommitmentWithTerm) => void;
    onResumeCommitment: (commitment: CommitmentWithTerm) => void;
    onRecordPayment: (commitmentId: string, periodDate: string) => void;
    onFocusedDateChange?: (date: Date) => void;
    onStatusChange?: (status: StatusFilter) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const DesktopGrid: React.FC<DesktopGridProps> = ({
    focusedDate,
    density,
    viewMode,
    selectedCategory,
    selectedStatus,
    commitments,
    payments,
    groupedCommitments,
    visibleMonths,
    commitmentCounts,
    getPaymentStatus,
    getTermForPeriod,
    isActiveInMonth,
    isCommitmentTerminated,
    getTranslatedCategoryName,
    getTerminationReason,
    getMonthTotals,
    formatClp,
    onEditCommitment,
    onDetailCommitment,
    onDeleteCommitment,
    onPauseCommitment,
    onResumeCommitment,
    onRecordPayment,
    onFocusedDateChange,
    onStatusChange,
}) => {
    // UI State & Layout
    const scrollAreaRef = useRef<HTMLDivElement | null>(null);
    const { getDisplayValue } = useCommitmentValue();
    const [availableHeight, setAvailableHeight] = useState<number>(400);
    const footerRef = useRef<HTMLDivElement | null>(null);
    const pad = density === 'minimal' ? 'p-0.5' : density === 'compact' ? 'p-1' : 'p-3';

    // Helper: Is Current Month
    const isCurrentMonth = (date: Date) => {
        const today = new Date();
        return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    };

    // Auto-scroll to current month
    useEffect(() => {
        if (!scrollAreaRef.current) return;
        const today = new Date();
        const currentMonthIndex = visibleMonths.findIndex(m => m.getMonth() === today.getMonth() && m.getFullYear() === today.getFullYear());

        if (currentMonthIndex !== -1) {
            setTimeout(() => {
                const headerEl = document.getElementById(`month-header-${currentMonthIndex}`);
                if (headerEl && scrollAreaRef.current) {
                    const containerWidth = scrollAreaRef.current.clientWidth;
                    const headerLeft = headerEl.offsetLeft;
                    const headerWidth = headerEl.clientWidth;
                    const offset = headerLeft - (containerWidth / 2) + (headerWidth / 2);
                    scrollAreaRef.current.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
                }
            }, 100);
        }
    }, [density, visibleMonths]);

    // Height Calculation
    useEffect(() => {
        const recalc = () => {
            const el = scrollAreaRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const vh = window.innerHeight || document.documentElement.clientHeight;
            const footerH = footerRef.current ? footerRef.current.offsetHeight : 48;
            const bottomMargin = footerH + 16;
            const h = Math.max(200, vh - rect.top - bottomMargin);
            setAvailableHeight(h);
        };
        recalc();
        const timer = setTimeout(recalc, 100);
        window.addEventListener('resize', recalc);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', recalc);
        };
    }, []);

    // ==========================================================================
    // FOOTER STATS CALCULATION
    // ==========================================================================
    const footerStats = useMemo(() => {
        const today = new Date();
        const focusedPeriod = dateToPeriod(focusedDate);

        let overdueCount = 0;
        let overdueAmount = 0;
        let oldestOverdueDays = 0;

        let upcomingCount = 0; // vence en < 3 días
        let upcomingAmount = 0;

        let paidCount = 0;
        let paidAmount = 0;

        let pendingCount = 0;
        let pendingAmount = 0;

        // Base count: total active commitments (for "X of Y activos" display)
        const baseCount = commitmentCounts.active;

        // Count from visible active commitments in focused month (after all filters)
        const visibleCommitments = groupedCommitments.active.flatMap(g => g.commitments);

        visibleCommitments.forEach(c => {
            const commitmentPayments = payments.get(c.id) || [];
            const summary = getCommitmentSummary(c, commitmentPayments);
            const term = getTermForPeriod(c, focusedDate);

            if (!term) return;
            if (!isActiveInMonth(c, focusedDate)) return;

            const amount = summary.perPeriodAmount || 0;
            const dueDay = term.due_day_of_month || 1;
            const dueDate = new Date(focusedDate.getFullYear(), focusedDate.getMonth(), dueDay);

            // Check payment status for focused month
            const { isPaid, hasPaymentRecord, payment } = getPaymentStatus(c.id, focusedDate, dueDay);

            if (isPaid) {
                paidCount++;
                paidAmount += payment?.amount_in_base || amount;
            } else {
                // Check if overdue
                const isOverdue = today > dueDate && focusedDate.getMonth() <= today.getMonth() && focusedDate.getFullYear() <= today.getFullYear();

                if (isOverdue) {
                    overdueCount++;
                    overdueAmount += amount;
                    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysOverdue > oldestOverdueDays) {
                        oldestOverdueDays = daysOverdue;
                    }
                } else {
                    // Check if upcoming (< 3 days)
                    const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysUntilDue >= 0 && daysUntilDue <= 3) {
                        upcomingCount++;
                        upcomingAmount += amount;
                    }
                    pendingCount++;
                    pendingAmount += amount;
                }
            }
        });

        // Period label
        const periodLabel = focusedDate.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });

        // Active filter info
        let activeFilter: { type: 'important' | 'category' | 'status' | 'none'; label: string } = { type: 'none', label: '' };

        if (selectedCategory === 'FILTER_IMPORTANT') {
            activeFilter = { type: 'important', label: 'Importantes' };
        } else if (selectedCategory !== 'all') {
            activeFilter = { type: 'category', label: selectedCategory };
        } else if (selectedStatus !== 'all') {
            activeFilter = { type: 'status', label: selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1) };
        }

        // Explicit filter = user selected category, status, or important
        const hasExplicitFilter = selectedCategory !== 'all' || selectedStatus !== 'all';

        return {
            showingCount: visibleCommitments.length,
            totalCount: baseCount,
            commitmentCounts,
            viewMode,
            periodLabel: periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1),
            overdueCount,
            overdueAmount,
            oldestOverdueDays,
            upcomingCount,
            upcomingAmount,
            paidCount,
            paidAmount,
            pendingCount,
            pendingAmount,
            activeFilter,
            hasExplicitFilter,
        };
    }, [groupedCommitments, commitmentCounts, viewMode, focusedDate, selectedCategory, selectedStatus, getPaymentStatus, getTermForPeriod, isActiveInMonth]);

    // ==========================================================================
    // RENDER
    // ==========================================================================
    return (
        <div className="hidden lg:block px-4">
            <div className="mt-4">


                {/* Grid */}
                <div className="relative mb-2">
                    {/* Scroll Indicator - Right Edge Gradient */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/80 dark:from-slate-900/80 to-transparent pointer-events-none z-30" />

                    <div
                        ref={scrollAreaRef}
                        className="relative overflow-x-auto overflow-y-auto scrollbar-thin pr-1"
                        style={{ height: `${availableHeight}px` }}
                    >
                        <table className="w-full border-separate border-spacing-0">
                            <thead className="sticky top-0 z-40">
                                {/* Month Header - Card Style (Separated) */}
                                <tr className="bg-slate-50 dark:bg-slate-900">
                                    {/* COMPROMISO - Left end (Card Style) */}
                                    <th className={`sticky left-0 z-50 min-w-[220px] max-w-[240px] w-[220px] p-1 bg-slate-50 dark:bg-slate-900 align-middle`}>
                                        <div className="h-full w-full flex flex-col justify-center">
                                            {/* Embedded Month Selector: Premium Glass Capsule */}
                                            <div className={`
                                                    flex items-center gap-1 w-full rounded-xl transition-all duration-300 ease-out
                                                    border shadow-sm group/selector px-1.5
                                                    bg-white dark:bg-slate-800/60 backdrop-blur-sm
                                                    bg-gradient-to-br from-white/5 to-transparent dark:from-white/5 dark:to-transparent shadow-inner
                                                    border-slate-200 dark:border-white/5
                                                    hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-white/10
                                                    ${density === 'minimal' ? 'min-h-10 py-1' : density === 'compact' ? 'min-h-14 py-1.5' : 'min-h-20 py-2'}
                                                `}>
                                                {/* Home/Today Action - Stable (Left) */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onFocusedDateChange && onFocusedDateChange(new Date());
                                                    }}
                                                    disabled={isCurrentMonth(focusedDate)}
                                                    className={`
                                                            w-9 h-9 flex items-center justify-center rounded-lg transition-all active:scale-95
                                                            ${isCurrentMonth(focusedDate)
                                                            ? 'text-slate-300 dark:text-slate-700 opacity-50 cursor-default'
                                                            : 'text-sky-500 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 cursor-pointer'}
                                                        `}
                                                    title="Volver a Hoy"
                                                >
                                                    <CalendarIcon className="w-5 h-5" />
                                                </button>

                                                {/* Divider */}
                                                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

                                                {/* Navigation Group */}
                                                <div className="flex-1 flex items-center justify-between">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const d = new Date(focusedDate);
                                                            d.setMonth(d.getMonth() - 1);
                                                            onFocusedDateChange && onFocusedDateChange(d);
                                                        }}
                                                        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95"
                                                    >
                                                        <ChevronLeftIcon className="w-5 h-5" />
                                                    </button>

                                                    <div className="flex flex-row items-baseline justify-center gap-1.5">
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                                                            {focusedDate.toLocaleDateString('es-Cl', { month: 'short' }).replace('.', '')}
                                                        </span>
                                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                            {focusedDate.getFullYear()}
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const d = new Date(focusedDate);
                                                            d.setMonth(d.getMonth() + 1);
                                                            onFocusedDateChange && onFocusedDateChange(d);
                                                        }}
                                                        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95"
                                                    >
                                                        <ChevronRightIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </th>
                                    {/* Month cells (Card Style) */}
                                    {visibleMonths.map((month, i) => (
                                        <th
                                            key={i}
                                            id={`month-header-${i}`}
                                            className={`relative min-w-[85px] w-auto py-2 px-1 text-center align-middle bg-slate-50 dark:bg-slate-900`}
                                        >
                                            {/* Inner Card - 3 states: Current, Focused, Normal */}
                                            {(() => {
                                                const isFocused = month.getFullYear() === focusedDate.getFullYear() && month.getMonth() === focusedDate.getMonth();
                                                const isCurrent = isCurrentMonth(month);

                                                let cardStyle = 'bg-white dark:bg-slate-700/60 border-slate-200 dark:border-slate-600/50 hover:border-slate-300 dark:hover:border-slate-500'; // Normal

                                                if (isCurrent || isFocused) {
                                                    // Commit-card style for active month
                                                    cardStyle = 'bg-white dark:bg-slate-700/60 border border-slate-400/60 dark:border-slate-500/60 hover:bg-slate-100 dark:hover:bg-slate-700/80 shadow-sm backdrop-blur-sm';
                                                }

                                                return (
                                                    <div className={`relative h-full w-full rounded-xl border transition-all duration-300 overflow-hidden ${cardStyle}`}>
                                                        {/* Top bar indicator for current/focused month - like commit cards */}
                                                        {(isCurrent || isFocused) && (
                                                            <div className={`
                                                                    absolute top-1.5 rounded-full left-1/2 -translate-x-1/2 transition-all duration-300
                                                                    ${isCurrent ? 'bg-sky-400/60' : 'bg-slate-400 dark:bg-slate-500'}
                                                                    ${density === 'minimal'
                                                                    ? 'w-6 h-1' // Bar matching text width (~FEB)
                                                                    : density === 'compact' ? 'w-1/2 h-1' // 50% Bar for compact
                                                                        : 'w-[calc(100%-12px)] h-1' // Full Bar for detailed
                                                                }
                                                                `} />
                                                        )}
                                                        {/* Month content - ENHANCED with KPI metrics */}
                                                        {(() => {
                                                            const monthTotals = getMonthTotals(month.getFullYear(), month.getMonth());
                                                            return (
                                                                <div className={`
                                                            flex flex-col items-center justify-center px-1 transition-all duration-200 cursor-pointer
                                                            hover:bg-slate-50 dark:hover:bg-slate-700/50
                                                            ${density === 'minimal' ? 'py-1 min-h-10' :
                                                                        density === 'compact' ? 'py-1.5 min-h-14' :
                                                                            'py-2 min-h-20'}
                                                        `}
                                                                    onClick={() => onFocusedDateChange && onFocusedDateChange(month)}
                                                                    title={`${month.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}\nComprometido: ${formatClp(monthTotals.comprometido)}\nPagado: ${formatClp(monthTotals.pagado)}\nPendiente: ${formatClp(monthTotals.pendiente)}`}
                                                                >
                                                                    {/* Month name - Protagonist (neutral text, bar carries color) */}
                                                                    <span className={`tracking-wide ${density === 'minimal' ? 'text-xs' : 'text-sm'
                                                                        } ${isCurrentMonth(month)
                                                                            ? 'font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest'
                                                                            : 'font-semibold text-slate-400 dark:text-slate-400'
                                                                        }`}>
                                                                        {/* Full name for highlighted, short for others */}
                                                                        {(isCurrent || isFocused)
                                                                            ? density === 'minimal'
                                                                                ? month.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '').toUpperCase() // FEB
                                                                                : month.toLocaleDateString('es-CL', { month: 'long' }).charAt(0).toUpperCase() + month.toLocaleDateString('es-CL', { month: 'long' }).slice(1) // Febrero
                                                                            : month.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '').charAt(0).toUpperCase() + month.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '').slice(1) // Feb
                                                                        }
                                                                        {' '}
                                                                        {(month.getFullYear() !== focusedDate.getFullYear() || month.getMonth() === 0) && (
                                                                            <span className="text-[11px] font-normal text-slate-400">
                                                                                {month.getFullYear()}
                                                                            </span>
                                                                        )}
                                                                    </span>

                                                                    {/* Metrics Row - TEMPORARILY HIDDEN */}
                                                                    {/* 
                                                                <div className={`font-mono font-medium tabular-nums mt-0.5 ${isCurrentMonth(month) ? 'text-sky-100' : 'text-slate-400'
                                                                    } ${density === 'minimal' ? 'text-[9px]' : 'text-[10px]'}`}>
                                                                    {formatClp(monthTotals.comprometido)}
                                                                </div>

                                                                {density !== 'minimal' && (
                                                                    <div className="flex items-center gap-1 mt-0.5 text-[9px] font-mono tabular-nums">
                                                                        <span className={`${monthTotals.pagado > 0
                                                                            ? 'text-emerald-400'
                                                                            : 'text-slate-600'
                                                                            }`}>
                                                                            {formatClp(monthTotals.pagado).replace('$', '')}
                                                                        </span>
                                                                        <span className="text-slate-700 dark:text-slate-600">/</span>
                                                                        <span className={`${monthTotals.pendiente > 0
                                                                            ? 'text-amber-500'
                                                                            : 'text-slate-600'
                                                                            }`}>
                                                                            {formatClp(monthTotals.pendiente).replace('$', '')}
                                                                        </span>
                                                                    </div>
                                                                )} 
                                                                */}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                );
                                            })()}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-transparent">

                                {groupedCommitments.active.map(({ category, commitments: catCommitments }) => (
                                    <React.Fragment key={category}>
                                        {/* Category badge is now inside each commitment card - no separator needed */}
                                        {/* Commitment rows */}
                                        {catCommitments.map((commitment) => {
                                            const monthDate = focusedDate; // En vista compacta, solo vemos el mes enfocado

                                            const isGloballyTerminated = isCommitmentTerminated(commitment);

                                            // Necesitamos saber si está pagado en este mes para decidir el tachado
                                            const termForMonth = getTermForPeriod(commitment, monthDate);
                                            const dueDay = termForMonth?.due_day_of_month ?? 1;
                                            const { isPaid } = getPaymentStatus(commitment.id, monthDate, dueDay);

                                            // Solo tachar si: está terminado globalmente, ESTABA activo en este mes, Y YA FUE PAGADO
                                            const wasActiveInMonth = termForMonth !== null;
                                            const terminated = isGloballyTerminated && wasActiveInMonth && isPaid;
                                            const terminationReason = getTerminationReason(commitment);
                                            return (
                                                <tr
                                                    key={commitment.id}
                                                    className={`
                                                            group
                                                            transition-all duration-200 ease-out
                                                            ${terminated ? 'opacity-60 grayscale-[0.5]' : ''}
                                                        `}
                                                >
                                                    <td
                                                        onClick={() => onDetailCommitment ? onDetailCommitment(commitment) : onEditCommitment(commitment)}
                                                        className={`
                                                            relative sticky left-0 z-30 p-1 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.1)]
                                                            bg-transparent dark:bg-slate-900
                                                            min-w-[220px] max-w-[240px] w-[220px]
                                                            h-[1px]
                                                        `}>
                                                        {/* Inner Content - Card style matching data cells */}
                                                        <div className={`
                                                                relative cursor-pointer group/card h-full rounded-xl
                                                                ${density === 'minimal' ? 'min-h-10 px-2 py-1' : density === 'compact' ? 'min-h-14 px-2.5 py-1.5' : 'min-h-20 px-3 py-2'}
                                                                bg-slate-50 dark:bg-slate-700/60 border border-slate-200/50 dark:border-slate-700/50
                                                                hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:border-slate-300 dark:hover:border-slate-500
                                                                transition-all duration-200
                                                                ${terminated ? 'opacity-70' : ''}
                                                            `}>
                                                            {/* Flow Type Indicator - Density Aware */}
                                                            <div className={`
                                                                    absolute left-1.5 rounded-full transition-all duration-300
                                                                    ${commitment.flow_type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'}
                                                                    ${density === 'minimal'
                                                                    ? 'top-1/2 -translate-y-1/2 h-3.5 w-1' // Bar height of text (~14px)
                                                                    : density === 'compact'
                                                                        ? 'top-2 bottom-2 w-1' // Spans full content area (minus padding)
                                                                        : 'top-1.5 bottom-1.5 w-1' // Full bar for detailed
                                                                }
                                                                `} />

                                                            {/* Content Container - Different layouts for minimal/compact/detailed */}
                                                            {density === 'minimal' ? (
                                                                /* === MINIMAL: Single line with tooltip === */
                                                                <div
                                                                    className="flex items-center justify-between h-full pl-5 pr-3"
                                                                    title={`${commitment.name} · ${getTranslatedCategoryName(commitment)} · ${formatClp(Math.round(getDisplayValue(
                                                                        termForMonth ? getPerPeriodAmount(termForMonth, false) : 0,
                                                                        termForMonth?.currency_original || 'CLP',
                                                                        getPaymentStatus(commitment.id, monthDate, dueDay).payment
                                                                    )))}`}
                                                                >
                                                                    <span className={`font-semibold truncate text-sm ${terminated ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                                                        {commitment.name}
                                                                    </span>
                                                                    <div className="flex items-center gap-1 shrink-0 ml-1">
                                                                        {commitment.is_important && <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />}
                                                                        {commitment.linked_commitment_id && <Link2 className="w-2.5 h-2.5 text-sky-500" />}
                                                                        {/* Frequency indicator */}
                                                                        {termForMonth?.installments_count && termForMonth.installments_count > 1 ? (
                                                                            <span className="text-[9px] text-sky-400">#{termForMonth.installments_count}</span>
                                                                        ) : termForMonth?.effective_until ? (
                                                                            <CalendarIcon className="w-2.5 h-2.5 text-slate-500" />
                                                                        ) : termForMonth ? (
                                                                            <RefreshCw className="w-2.5 h-2.5 text-slate-500" />
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            ) : density === 'compact' ? (
                                                                /* === COMPACT: 2 rows === */
                                                                <div className="flex flex-col justify-center h-full pl-3.5 pr-3">
                                                                    {/* Row 1: Name (left) + Icons right-aligned (fav, linked, frequency) */}
                                                                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                                                                        <span className={`font-semibold truncate text-sm ${terminated ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`} title={commitment.name}>
                                                                            {commitment.name}
                                                                        </span>
                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                            {commitment.is_important && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                                                            {commitment.linked_commitment_id && <Link2 className="w-3 h-3 text-sky-500" />}
                                                                            {/* Frequency indicator */}
                                                                            {termForMonth?.installments_count && termForMonth.installments_count > 1 ? (
                                                                                <span className="text-[10px] text-sky-400" title={`${termForMonth.installments_count} cuotas`}>
                                                                                    #{termForMonth.installments_count}
                                                                                </span>
                                                                            ) : termForMonth?.effective_until ? (
                                                                                <span title="Fecha de término"><CalendarIcon className="w-3 h-3 text-slate-500" /></span>
                                                                            ) : termForMonth ? (
                                                                                <span title="Mensual indefinido"><RefreshCw className="w-3 h-3 text-slate-500" /></span>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                    {/* Row 2: Category Badge with Icon (left) + Amount with Currency (right) */}
                                                                    <div className="flex items-center justify-between gap-2 mt-1">
                                                                        {(() => {
                                                                            return (
                                                                                <div className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.6rem] uppercase tracking-widest font-bold bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 text-slate-600 dark:text-slate-400 min-w-0">
                                                                                    <span className="truncate">{getTranslatedCategoryName(commitment)}</span>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                        <div className="flex items-baseline gap-1 shrink-0">
                                                                            <span className="text-[0.625rem] font-medium text-slate-500 dark:text-slate-400 uppercase">CLP</span>
                                                                            <span className="font-mono font-semibold text-sm tabular-nums text-slate-700 dark:text-slate-200">
                                                                                {formatClp(Math.round(getDisplayValue(
                                                                                    termForMonth ? getPerPeriodAmount(termForMonth, false) : 0,
                                                                                    termForMonth?.currency_original || 'CLP',
                                                                                    getPaymentStatus(commitment.id, monthDate, dueDay).payment
                                                                                )))}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                /* === DETAILED: 3 rows (Header, Body, Footer) === */
                                                                /* === DETAILED: 5 vertical zones === */
                                                                <div className="flex flex-col h-full pt-2 pb-2 px-2.5 justify-between gap-0.5 relative group/card">

                                                                    {/* Zone 1: Header - Icon (Left) + Name (Inline) */}
                                                                    <div className="flex items-center gap-2 h-7 shrink-0">
                                                                        {/* Icon Avatar: Dynamic Content, Static Container */}
                                                                        <div className={`
                                                                                w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                                                                                bg-slate-100 dark:bg-slate-800
                                                                                border border-slate-200 dark:border-slate-700
                                                                            `}>
                                                                            {(() => {
                                                                                // Priority 1: Important (Star)
                                                                                if (commitment.is_important) {
                                                                                    return <Star className="w-4 h-4 text-amber-500 fill-amber-500" />;
                                                                                }
                                                                                // Priority 2: Linked (Link)
                                                                                if (commitment.linked_commitment_id) {
                                                                                    return <Link2 className="w-4 h-4 text-sky-500" />;
                                                                                }
                                                                                // Priority 3: Category Icon (Default)
                                                                                const CategoryIconComponent = getCategoryIcon(commitment.category?.name || '');
                                                                                return (
                                                                                    <CategoryIconComponent className={`
                                                                                            w-3.5 h-3.5
                                                                                            ${commitment.flow_type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
                                                                                        `} />
                                                                                );
                                                                            })()}
                                                                        </div>

                                                                        <span className={`font-bold truncate text-[0.9rem] leading-none ${terminated ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`} title={commitment.name}>
                                                                            {commitment.name}
                                                                        </span>
                                                                    </div>

                                                                    {/* Zone 2: Metadata Badges (Stacked) */}
                                                                    <div className="flex flex-col items-start gap-1 mt-1 shrink-0">
                                                                        {/* Category Name */}
                                                                        <div className="inline-flex items-center px-[0.65em] py-[0.15em] rounded-[4px] text-[0.6em] uppercase tracking-widest font-bold bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 text-slate-600 dark:text-slate-400 leading-none">
                                                                            {getTranslatedCategoryName(commitment)}
                                                                        </div>

                                                                        {/* Frequency Badge - Standard */}
                                                                        <span className="inline-flex items-center gap-[0.35em] px-[0.65em] py-[0.2em] rounded-[4px] text-[0.6em] font-bold bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 text-slate-500 dark:text-slate-400 leading-none">
                                                                            <RefreshCw className="w-[1em] h-[1em] opacity-70" />
                                                                            {(() => {
                                                                                const freq = termForMonth?.frequency;
                                                                                switch (freq) {
                                                                                    case 'ONCE': return 'ÚNICO';
                                                                                    case 'MONTHLY': return 'MENSUAL';
                                                                                    case 'BIMONTHLY': return 'BIMESTRAL';
                                                                                    case 'QUARTERLY': return 'TRIMESTRAL';
                                                                                    case 'SEMIANNUALLY': return 'SEMESTRAL';
                                                                                    case 'ANNUALLY': return 'ANUAL';
                                                                                    default: return 'MENSUAL';
                                                                                }
                                                                            })()}
                                                                        </span>
                                                                    </div>

                                                                    {/* Zone 3: Spacer / Term Status (Flexible) */}
                                                                    <div className="flex-1 min-h-[0.5rem] flex items-center">
                                                                        {/* Reserved for future status or spacing */}
                                                                        {/* Status icons moved here if needed, or kept at bottom */}
                                                                    </div>

                                                                    {/* Zone 4: Secondary Info (Right Aligned) */}
                                                                    <div className="flex justify-end h-4 shrink-0">
                                                                        {termForMonth?.currency_original && termForMonth.currency_original !== 'CLP' && termForMonth.amount_original && (
                                                                            <div className="flex items-baseline gap-1 text-[0.625rem] text-slate-400 dark:text-slate-500">
                                                                                <span className="font-medium uppercase">{termForMonth.currency_original}</span>
                                                                                <span className="font-mono tabular-nums">
                                                                                    {termForMonth.amount_original.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Zone 5: Footer - Term (Left) + Primary Amount (Right) */}
                                                                    <div className="flex items-end justify-between shrink-0 h-6">
                                                                        <div className="flex flex-col gap-0.5">
                                                                            {/* Term/Cuotas Badge (Minimal) */}
                                                                            {termForMonth?.effective_until && (
                                                                                <div className="flex items-center gap-1 text-[0.65rem] font-medium text-slate-400 dark:text-slate-500">
                                                                                    {termForMonth.installments_count && termForMonth.installments_count > 1 ? (
                                                                                        <>
                                                                                            <HashIcon className="w-2.5 h-2.5 opacity-70" />
                                                                                            <span>{termForMonth.installments_count} Cuotas</span>
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <CalendarIcon className="w-2.5 h-2.5 opacity-70" />
                                                                                            <span>
                                                                                                {(() => {
                                                                                                    // Format: "Dic 2025" or "Dic '25" if constrained
                                                                                                    const [y, m] = termForMonth.effective_until.substring(0, 7).split('-');
                                                                                                    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                                                                                    return `${months[parseInt(m) - 1]} ${y}`;
                                                                                                })()}
                                                                                            </span>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            )}

                                                                            {/* Status icons row */}
                                                                            <div className="flex items-center gap-2 h-3.5">
                                                                                {terminationReason === 'PAUSED' && (
                                                                                    <PauseIcon className="w-3.5 h-3.5 text-amber-500" />
                                                                                )}
                                                                                {terminationReason === 'COMPLETED_INSTALLMENTS' && (
                                                                                    <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
                                                                                )}
                                                                                {terminationReason === 'TERMINATED' && (
                                                                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fin</span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Primary Amount */}
                                                                        <div className="flex items-baseline gap-1 mb-0.5">
                                                                            <span className="text-[0.625rem] font-medium text-slate-500 dark:text-slate-400 uppercase">CLP</span>
                                                                            <span className="font-mono font-bold text-lg tabular-nums text-slate-900 dark:text-white tracking-tight">
                                                                                {formatClp(Math.round(getDisplayValue(
                                                                                    termForMonth ? getPerPeriodAmount(termForMonth, false) : 0,
                                                                                    termForMonth?.currency_original || 'CLP',
                                                                                    getPaymentStatus(commitment.id, monthDate, dueDay).payment
                                                                                )))}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Actions Menu (Absolute, hover) */}
                                                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/card:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                                        <DropdownMenu.Root>
                                                                            <DropdownMenu.Trigger asChild>
                                                                                <button className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                                                                    <MoreVertical className="w-4 h-4" />
                                                                                </button>
                                                                            </DropdownMenu.Trigger>
                                                                            <DropdownMenu.Portal>
                                                                                <DropdownMenu.Content
                                                                                    className="min-w-[160px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 p-1 z-50 animate-in fade-in zoom-in-95 duration-200"
                                                                                    sideOffset={5}
                                                                                    align="end"
                                                                                >
                                                                                    <DropdownMenu.Item
                                                                                        className="flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer outline-none"
                                                                                        onClick={(e) => { e.stopPropagation(); onEditCommitment(commitment); }}
                                                                                    >
                                                                                        <EditIcon className="w-3.5 h-3.5 text-blue-500" /> Editar
                                                                                    </DropdownMenu.Item>
                                                                                    {onDetailCommitment && (
                                                                                        <DropdownMenu.Item
                                                                                            className="flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-sky-600 dark:text-sky-400 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 cursor-pointer outline-none"
                                                                                            onClick={(e) => { e.stopPropagation(); onDetailCommitment(commitment); }}
                                                                                        >
                                                                                            <Eye className="w-3.5 h-3.5" /> Detalle
                                                                                        </DropdownMenu.Item>
                                                                                    )}
                                                                                    <DropdownMenu.Item
                                                                                        className={`flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer outline-none ${terminationReason === 'COMPLETED_INSTALLMENTS' ? 'opacity-50' : ''}`}
                                                                                        disabled={terminationReason === 'COMPLETED_INSTALLMENTS'}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const hasEndDate = !!commitment.active_term?.effective_until;
                                                                                            if (hasEndDate || terminationReason === 'PAUSED' || terminationReason === 'TERMINATED') {
                                                                                                onResumeCommitment(commitment);
                                                                                            } else {
                                                                                                onPauseCommitment(commitment);
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <PauseIcon className="w-3.5 h-3.5 text-amber-500" />
                                                                                        {(() => {
                                                                                            const hasEndDate = !!commitment.active_term?.effective_until;
                                                                                            if (terminationReason === 'COMPLETED_INSTALLMENTS') return 'Completado';
                                                                                            if (hasEndDate || terminationReason === 'PAUSED' || terminationReason === 'TERMINATED') return 'Reanudar';
                                                                                            return 'Pausar';
                                                                                        })()}
                                                                                    </DropdownMenu.Item>
                                                                                    <DropdownMenu.Separator className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                                                                    <DropdownMenu.Item
                                                                                        className="flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/10 cursor-pointer outline-none"
                                                                                        onClick={(e) => { e.stopPropagation(); onDeleteCommitment(commitment.id); }}
                                                                                    >
                                                                                        <TrashIcon className="w-3.5 h-3.5" /> Eliminar
                                                                                    </DropdownMenu.Item>
                                                                                </DropdownMenu.Content>
                                                                            </DropdownMenu.Portal>
                                                                        </DropdownMenu.Root>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Month cells */}
                                                    {
                                                        visibleMonths.map((monthDate, mi) => {
                                                            // Get term for THIS specific period (supports multi-term)
                                                            const term = getTermForPeriod(commitment, monthDate);
                                                            const isActive = isActiveInMonth(commitment, monthDate);
                                                            const dueDay = term?.due_day_of_month ?? 1;
                                                            const { isPaid, amount: paidAmount, paidOnTime, payment: currentPayment, hasPaymentRecord } = getPaymentStatus(commitment.id, monthDate, dueDay);

                                                            // Calculate expected per-period amount from term (only used when no payment)
                                                            const totalAmount = term?.amount_in_base ?? term?.amount_original ?? 0;
                                                            const installmentsCount = term?.installments_count ?? null;

                                                            // Solo dividir si is_divided_amount = true (tipo "En cuotas")
                                                            const perPeriodAmount = term?.is_divided_amount && installmentsCount && installmentsCount > 1
                                                                ? totalAmount / installmentsCount
                                                                : totalAmount;

                                                            // Show REAL data: if there's a payment record (even if not marked paid), show that amount
                                                            // Otherwise show expected amount from term
                                                            const displayAmount = (hasPaymentRecord && paidAmount !== null) ? paidAmount : perPeriodAmount;

                                                            // Calculate cuota number if installments
                                                            let cuotaNumber: number | null = null;
                                                            if (term && installmentsCount && installmentsCount > 1) {
                                                                // Parse date parts directly to avoid timezone issues
                                                                const [startYear, startMonth] = term.effective_from.split('-').map(Number);
                                                                const monthsDiff = (monthDate.getFullYear() - startYear) * 12 +
                                                                    (monthDate.getMonth() + 1 - startMonth); // +1 because getMonth() is 0-indexed
                                                                cuotaNumber = monthsDiff + 1;
                                                                if (cuotaNumber < 1 || cuotaNumber > installmentsCount) {
                                                                    cuotaNumber = null; // Out of range
                                                                }
                                                            }

                                                            // Original currency display
                                                            const originalCurrency = term?.currency_original;
                                                            const originalAmount = term?.amount_original ?? 0;
                                                            // Solo dividir si is_divided_amount = true (tipo "En cuotas")
                                                            const perPeriodOriginal = term?.is_divided_amount && installmentsCount && installmentsCount > 1
                                                                ? originalAmount / installmentsCount
                                                                : originalAmount;
                                                            const showOriginalCurrency = originalCurrency && originalCurrency !== 'CLP';

                                                            const today = new Date();
                                                            const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
                                                            const isOverdue = !!term && !isPaid && dueDate < today && monthDate <= today;
                                                            const isPending = !!term && !isPaid && !isOverdue && isCurrentMonth(monthDate);
                                                            const isGap = !term && !isPaid;

                                                            // Check if this is a future month (after current month)
                                                            // BUT don't dim if there's a payment record (pre-registered amount)
                                                            const isFutureMonth = monthDate > today && !isCurrentMonth(monthDate) && !hasPaymentRecord;

                                                            // Days overdue/remaining calculation
                                                            const daysOverdue = isOverdue
                                                                ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                                                                : 0;
                                                            const daysRemaining = !isOverdue
                                                                ? Math.max(0, Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
                                                                : 0;
                                                            const isDisabled = isFutureMonth && !(hasPaymentRecord || (installmentsCount && installmentsCount > 1));

                                                            // === Render Status Badge Helper ===
                                                            const renderStatusBadge = () => {
                                                                if (isPaid) {
                                                                    return (
                                                                        <div className="grid grid-cols-1 items-center justify-items-center group/badge w-full mt-1">
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 group-hover/cell:opacity-0">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 ring-1 ring-emerald-500/10">
                                                                                    {paidOnTime && <Sparkles className="w-3 h-3" />}
                                                                                    <CheckCircleIcon className="w-3.5 h-3.5" />
                                                                                    Pagado
                                                                                </span>
                                                                            </div>
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 opacity-0 group-hover/cell:opacity-100">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 cursor-pointer">
                                                                                    <EditIcon className="w-3.5 h-3.5" />
                                                                                    Editar
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                if (isOverdue) {
                                                                    return (
                                                                        <div className="flex flex-col items-center gap-1 w-full mt-1">
                                                                            {/* Overdue countdown - always visible, larger */}
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700 ring-1 ring-rose-500/20">
                                                                                <ExclamationTriangleIcon className="w-3.5 h-3.5 animate-pulse" />
                                                                                -{daysOverdue}d
                                                                            </span>
                                                                            {/* Pagar button - always visible for overdue */}
                                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-600 dark:bg-rose-500 text-white border border-rose-700 dark:border-rose-400 cursor-pointer hover:bg-rose-700 dark:hover:bg-rose-600 transition-colors shadow-sm">
                                                                                <PlusIcon className="w-3 h-3" />
                                                                                Pagar
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                }
                                                                if (isPending && (isCurrentMonth(monthDate) || !(daysRemaining > 45))) {
                                                                    return (
                                                                        <div className="grid grid-cols-1 items-center justify-items-center group/badge w-full mt-1">
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 group-hover/cell:opacity-0">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800 ring-1 ring-amber-500/10">
                                                                                    <ClockIcon className="w-3.5 h-3.5" />
                                                                                    {daysRemaining === 0 ? 'Hoy' : `${daysRemaining}d`}
                                                                                </span>
                                                                            </div>
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 opacity-0 group-hover/cell:opacity-100">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700 cursor-pointer">
                                                                                    <PlusIcon className="w-3.5 h-3.5" />
                                                                                    Pagar
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                // Default: Scheduled / Future
                                                                return (
                                                                    <div className="grid grid-cols-1 items-center justify-items-center group/badge w-full mt-1">
                                                                        <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 group-hover/cell:opacity-0">
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                                <CalendarIcon className="w-3.5 h-3.5" />
                                                                                Prog.
                                                                            </span>
                                                                        </div>
                                                                        <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 opacity-0 group-hover/cell:opacity-100">
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 cursor-pointer">
                                                                                <PlusIcon className="w-3.5 h-3.5" />
                                                                                Pagar
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            };
                                                            const isFocused = monthDate.getMonth() === focusedDate.getMonth() && monthDate.getFullYear() === focusedDate.getFullYear();
                                                            const isCurrent = isCurrentMonth(monthDate);

                                                            return (
                                                                <td
                                                                    key={mi}
                                                                    className="p-0.5 h-[1px]" // Minimal cell padding
                                                                    onClick={() => onRecordPayment(commitment.id, dateToPeriod(monthDate))}
                                                                >
                                                                    {/* Payment Cell with Card Lift + Neutral Card Pattern */}
                                                                    <div className={`
                                                                        group/cell relative overflow-hidden
                                                                        rounded-xl w-full h-full cursor-pointer
                                                                        flex flex-col items-center justify-center border
                                                                        transition-all duration-300 ease-out
                                                                        hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-white/10
                                                                        ${density === 'minimal' ? 'px-0.5 py-0.5 min-h-10' : density === 'compact' ? 'px-1 py-1 min-h-14' : 'p-1 min-h-20'}
                                                                        ${isFocused || isCurrent
                                                                            ? 'border border-slate-400/60 dark:border-slate-500/60 bg-slate-50 dark:bg-slate-800/70 ring-1 ring-slate-400/30 dark:ring-slate-400/20'
                                                                            : 'bg-slate-900/10 dark:bg-slate-800/30 border-slate-400/30 dark:border-slate-500/30'}
                                                                        ${isDisabled ? 'opacity-40 hover:shadow-none hover:translate-y-0' : ''}
                                                                        ${isGap && !isDisabled ? 'bg-transparent border-dashed border-slate-300 dark:border-slate-700/40 hover:shadow-none hover:translate-y-0' : ''}
                                                                        ${isOverdue && !isPaid ? 'bg-rose-100/60 dark:bg-rose-900/30 border-l-4 border-l-rose-500 dark:border-l-rose-400' : ''}
                                                                    `}>

                                                                        {/* GAP: No term for this period */}
                                                                        {!term && !isPaid ? (
                                                                            <div className="flex items-center justify-center h-full w-full text-slate-400 dark:text-slate-600 select-none" title="Sin término activo en este período">
                                                                                <Minus className="w-5 h-5" />
                                                                            </div>
                                                                        ) : !term && isPaid ? (
                                                                            /* ORPHAN: Payment without term */
                                                                            <div className="space-y-1">
                                                                                <div className="font-bold font-mono tabular-nums text-base text-orange-600 dark:text-orange-500" title="⚠️ Pago registrado sin término activo">
                                                                                    {formatClp(paidAmount!)} ⚠️
                                                                                </div>
                                                                                <div className="text-xs text-orange-500">
                                                                                    Pago huérfano
                                                                                </div>
                                                                            </div>
                                                                        ) : (isActive || isPaid) ? (
                                                                            /* === MINIMAL VIEW: Amount + icon only === */
                                                                            density === 'minimal' ? (
                                                                                <CompactTooltip
                                                                                    triggerClassName="p-0"
                                                                                    sideOffset={8}
                                                                                    content={
                                                                                        <div className="min-w-[130px] text-slate-800 dark:text-slate-100">
                                                                                            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5">
                                                                                                {monthDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                                                                                            </div>
                                                                                            <div className="text-base font-bold font-mono tabular-nums">
                                                                                                {formatClp(displayAmount!)}
                                                                                            </div>
                                                                                            {(cuotaNumber && installmentsCount && installmentsCount > 1) && (
                                                                                                <div className="text-[10px] text-slate-500 mt-1">
                                                                                                    Cuota {cuotaNumber}/{installmentsCount}
                                                                                                </div>
                                                                                            )}
                                                                                            <div className={`text-[10px] font-medium mt-1.5 ${isPaid ? 'text-emerald-600 dark:text-emerald-400' :
                                                                                                isOverdue ? 'text-rose-600 dark:text-rose-400' :
                                                                                                    'text-amber-600 dark:text-amber-400'
                                                                                                }`}>
                                                                                                {isPaid ? '✓ Pagado' : isOverdue ? '⚠ Vencido' : '⏱ Pendiente'}
                                                                                            </div>
                                                                                        </div>
                                                                                    }
                                                                                >
                                                                                    {/* Minimal cell: ONLY status icon (centered, larger for visibility) */}
                                                                                    <div className="flex items-center justify-center h-full w-full">
                                                                                        {isPaid ? (
                                                                                            <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
                                                                                        ) : isOverdue ? (
                                                                                            <ExclamationTriangleIcon className="w-6 h-6 text-rose-500 animate-pulse" />
                                                                                        ) : isPending ? (
                                                                                            <ClockIcon className="w-6 h-6 text-amber-500" />
                                                                                        ) : isDisabled ? (
                                                                                            <CalendarIcon className="w-5 h-5 text-slate-400 dark:text-slate-600" />
                                                                                        ) : (
                                                                                            <CalendarIcon className="w-6 h-6 text-sky-400" />
                                                                                        )}
                                                                                    </div>
                                                                                </CompactTooltip>
                                                                            ) :
                                                                                /* === COMPACT VIEW: Rectangular pill badges === */
                                                                                density === 'compact' ? (
                                                                                    <CompactTooltip
                                                                                        triggerClassName={pad}
                                                                                        sideOffset={14}
                                                                                        content={
                                                                                            <div className="min-w-[140px] text-slate-800 dark:text-slate-100">
                                                                                                {/* --- HEADER: Fecha del período --- */}
                                                                                                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-2">
                                                                                                    {monthDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                                                                                                </div>

                                                                                                {/* --- CONTENT: Monto + Badge en línea --- */}
                                                                                                <div className="flex items-center justify-between gap-3 mb-1">
                                                                                                    {/* Monto - protagonista, siempre neutro */}
                                                                                                    <div className="text-base font-semibold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                                                                                                        {formatClp(displayAmount!)}
                                                                                                    </div>
                                                                                                    {/* Badge de estado compacto */}
                                                                                                    {isPaid ? (
                                                                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-inset ring-emerald-500/20 px-2 py-0.5 rounded-full">
                                                                                                            <CheckCircleIcon className="w-4 h-4" />
                                                                                                            Pagado
                                                                                                        </span>
                                                                                                    ) : isOverdue ? (
                                                                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 ring-1 ring-inset ring-red-500/20 px-2 py-0.5 rounded-full">
                                                                                                            <ExclamationTriangleIcon className="w-4 h-4" />
                                                                                                            Vencido
                                                                                                        </span>
                                                                                                    ) : isDisabled ? (
                                                                                                        <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                                                                                                            <CalendarIcon className="w-4 h-4" />
                                                                                                            Futuro
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                                                                                                            <ClockIcon className="w-4 h-4" />
                                                                                                            Pendiente
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>

                                                                                                {/* Original Currency (si aplica) */}
                                                                                                {showOriginalCurrency && (
                                                                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums mb-1">
                                                                                                        {originalCurrency} {perPeriodOriginal?.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                                    </div>
                                                                                                )}

                                                                                                {/* Cuota info (si aplica) */}
                                                                                                {(cuotaNumber && installmentsCount && installmentsCount > 1) ? (
                                                                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                                                        {term?.is_divided_amount ? 'Cuota' : 'Pago'} {cuotaNumber}/{installmentsCount}
                                                                                                    </div>
                                                                                                ) : term && term.effective_from && term.frequency === 'MONTHLY' && (!installmentsCount || installmentsCount <= 1) ? (
                                                                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                                                        Pago {(() => {
                                                                                                            const [startYear, startMonth] = term.effective_from.split('-').map(Number);
                                                                                                            const paymentNumber = (monthDate.getFullYear() - startYear) * 12 +
                                                                                                                (monthDate.getMonth() + 1 - startMonth) + 1;
                                                                                                            return paymentNumber > 0 ? paymentNumber : 1;
                                                                                                        })()}/∞
                                                                                                    </div>
                                                                                                ) : null}

                                                                                                {/* --- FOOTER: Fecha relativa + CTA --- */}
                                                                                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                                                                                                    <span className="text-slate-400 dark:text-slate-500">
                                                                                                        {isPaid && currentPayment?.payment_date ? (
                                                                                                            `Pagado: ${new Date(currentPayment.payment_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
                                                                                                        ) : isOverdue ? (
                                                                                                            `Venció hace ${daysOverdue} ${daysOverdue === 1 ? 'día' : 'días'}`
                                                                                                        ) : daysRemaining === 0 ? (
                                                                                                            'Vence hoy'
                                                                                                        ) : isCurrentMonth(monthDate) ? (
                                                                                                            `Vence en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}`
                                                                                                        ) : (
                                                                                                            `Vence: ${new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
                                                                                                        )}
                                                                                                    </span>
                                                                                                    {!isPaid && !isDisabled && (
                                                                                                        <span className="text-sky-500 dark:text-sky-400 font-medium">
                                                                                                            Click →
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        }
                                                                                    >
                                                                                        <div className="flex items-center justify-between w-full h-full px-1 gap-2">
                                                                                            {/* Left: Status Icon */}
                                                                                            <div className={`transition-opacity ${isPaid ? 'text-emerald-600 dark:text-emerald-400' :
                                                                                                isOverdue ? 'text-rose-500 dark:text-rose-400' :
                                                                                                    'text-slate-400 dark:text-slate-300'
                                                                                                }`}>
                                                                                                {isPaid ? <CheckCircleIcon className="w-5 h-5" /> :
                                                                                                    isOverdue ? <ExclamationTriangleIcon className="w-5 h-5" /> :
                                                                                                        isPending ? <ClockIcon className="w-5 h-5" /> :
                                                                                                            (installmentsCount && installmentsCount > 1) ? <CalendarIcon className="w-5 h-5" /> :
                                                                                                                null}
                                                                                            </div>

                                                                                            {/* Right: Amount + Cuota */}
                                                                                            <div className="flex flex-col items-end leading-none">
                                                                                                <span className="text-sm font-semibold font-mono tabular-nums text-slate-700 dark:text-slate-100">
                                                                                                    {formatClp(displayAmount!)}
                                                                                                </span>
                                                                                                {(cuotaNumber && installmentsCount && installmentsCount > 1) && (
                                                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                                                                                        {cuotaNumber}/{installmentsCount}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </CompactTooltip>
                                                                                ) : (
                                                                                    /* === FULL VIEW: Balances Corners Layout === */
                                                                                    <div
                                                                                        className="relative w-full h-full flex flex-col justify-between cursor-pointer py-1.5 px-2 rounded-lg shadow-inner"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onRecordPayment(commitment.id, dateToPeriod(monthDate));
                                                                                        }}
                                                                                    >
                                                                                        {/* ABSOLUTE: Progress Badge (bottom-left corner) */}
                                                                                        {(cuotaNumber && installmentsCount && installmentsCount > 1) ? (
                                                                                            <div className="absolute bottom-2 left-2 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 rounded-md shadow-md min-w-10">
                                                                                                <span className="text-[0.5rem] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 leading-none mb-0.5">Cuota</span>
                                                                                                <span className="text-xs tabular-nums text-slate-700 dark:text-white font-bold leading-none">{cuotaNumber}/{installmentsCount}</span>
                                                                                            </div>
                                                                                        ) : term && term.effective_from && term.frequency === 'MONTHLY' && (!installmentsCount || installmentsCount <= 1) ? (
                                                                                            <div className="absolute bottom-2 left-2 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 rounded-md shadow-md min-w-10">
                                                                                                <span className="text-[0.5rem] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 leading-none mb-0.5">Pago</span>
                                                                                                <span className="text-xs tabular-nums text-slate-700 dark:text-white font-bold leading-none">
                                                                                                    {(() => {
                                                                                                        const [startYear, startMonth] = term.effective_from.split('-').map(Number);
                                                                                                        const paymentNumber = (monthDate.getFullYear() - startYear) * 12 +
                                                                                                            (monthDate.getMonth() + 1 - startMonth) + 1;
                                                                                                        return paymentNumber > 0 ? paymentNumber : 1;
                                                                                                    })()}
                                                                                                </span>
                                                                                            </div>
                                                                                        ) : null}
                                                                                        {/* TOP ROW: Insight (Left) + Original Currency (Right) */}
                                                                                        <div className="flex items-start justify-between min-h-[16px]">
                                                                                            {/* Left: Financial Insight / Variance / Tag */}
                                                                                            <div className="text-[10px] font-medium truncate pr-1">
                                                                                                {isPaid && currentPayment ? (
                                                                                                    (() => {
                                                                                                        // Variance Analysis
                                                                                                        const expectedAmount = term?.is_divided_amount && installmentsCount && installmentsCount > 1
                                                                                                            ? (term.amount_in_base ?? term.amount_original) / installmentsCount
                                                                                                            : (term?.amount_in_base ?? term?.amount_original ?? 0);

                                                                                                        const paidAmountBase = currentPayment.amount_in_base ?? currentPayment.amount_original;
                                                                                                        const diff = paidAmountBase - expectedAmount;

                                                                                                        if (Math.abs(diff) > 100) {
                                                                                                            const isHigher = diff > 0;
                                                                                                            return (
                                                                                                                <span className="flex items-center gap-0.5 text-slate-400 dark:text-slate-500">
                                                                                                                    {isHigher ? '↗' : '↘'} {Math.abs(diff).toLocaleString('es-CL')}
                                                                                                                </span>
                                                                                                            );
                                                                                                        }
                                                                                                        return <span className="text-slate-500 dark:text-slate-600 text-[10px]">Sin variación</span>;
                                                                                                    })()
                                                                                                ) : (
                                                                                                    // Unpaid: Show Budget Tag (Need/Want/Savings)
                                                                                                    commitment.category?.budget_type ? (
                                                                                                        <span className={`
                                                                                                    px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider text-[9px] font-bold
                                                                                                    ${commitment.category.budget_type === 'NEED' ? 'bg-indigo-100/50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300' :
                                                                                                                commitment.category.budget_type === 'WANT' ? 'bg-pink-100/50 text-pink-600 dark:bg-pink-500/20 dark:text-pink-300' :
                                                                                                                    'bg-emerald-100/50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300'}
                                                                                                `}>
                                                                                                            {commitment.category.budget_type === 'NEED' ? 'Necesidad' :
                                                                                                                commitment.category.budget_type === 'WANT' ? 'Deseo' : 'Ahorro'}
                                                                                                        </span>
                                                                                                    ) : <span className="text-slate-300 dark:text-slate-600">—</span>
                                                                                                )}
                                                                                            </div>

                                                                                            {/* Right: Empty (secondary currency moved to amount section) */}
                                                                                            <div />
                                                                                        </div>

                                                                                        {/* MIDDLE ROW: Status Icon + Amount Stack - Main Visual */}
                                                                                        <div className="flex items-center justify-between py-1">
                                                                                            <div className="flex-shrink-0">
                                                                                                {isPaid && <CheckCircleIcon className="w-5 h-5 text-emerald-500" />}
                                                                                                {isOverdue && <ExclamationTriangleIcon className="w-5 h-5 text-rose-500" />}
                                                                                                {!isPaid && !isOverdue && <ClockIcon className="w-5 h-5 text-amber-500" />}
                                                                                            </div>
                                                                                            {/* Amount Stack: Secondary above, Primary below */}
                                                                                            <div className="flex flex-col items-end">
                                                                                                {/* Secondary Currency (if exists) */}
                                                                                                {showOriginalCurrency && (
                                                                                                    <div className="flex items-baseline gap-1 text-[0.625rem] text-slate-400 dark:text-slate-500">
                                                                                                        <span className="font-medium uppercase">{originalCurrency}</span>
                                                                                                        <span className="font-mono tabular-nums">
                                                                                                            {perPeriodOriginal.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                )}
                                                                                                {/* Primary Amount with CLP prefix */}
                                                                                                <div className="flex items-baseline gap-1">
                                                                                                    <span className="text-[0.625rem] font-medium tracking-wide text-slate-400 dark:text-slate-500 uppercase">
                                                                                                        CLP
                                                                                                    </span>
                                                                                                    <span className="font-mono tabular-nums text-xl tracking-tighter font-semibold text-slate-800 dark:text-slate-100">
                                                                                                        {formatClp(displayAmount)}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* BOTTOM ROW: Dates aligned right */}
                                                                                        <div className="flex items-end justify-end">
                                                                                            {/* Stacked Dates */}
                                                                                            <div className="flex flex-col items-end gap-0.5">
                                                                                                {/* Line 1: Due Date */}
                                                                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium lowercase">
                                                                                                    vence {dueDay} {monthDate.toLocaleDateString('es-CL', { month: 'short' })}
                                                                                                </div>

                                                                                                {/* Line 2: Status/Context - Neutral text, icons carry the color */}
                                                                                                <div className="text-[11px] font-semibold tracking-tight text-slate-600 dark:text-slate-300">
                                                                                                    {isPaid ? (
                                                                                                        currentPayment?.payment_date
                                                                                                            ? `Pagado: ${new Date(currentPayment.payment_date + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
                                                                                                            : 'Pagado'
                                                                                                    ) : isOverdue ? (
                                                                                                        (() => {
                                                                                                            const today = new Date();
                                                                                                            const dueDateObj = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
                                                                                                            const daysLate = Math.floor((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
                                                                                                            return `Hace ${daysLate}d`;
                                                                                                        })()
                                                                                                    ) : (
                                                                                                        (() => {
                                                                                                            const today = new Date();
                                                                                                            const dueDateObj = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
                                                                                                            const daysLeft = Math.ceil((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                                                                                            if (daysLeft <= 0) return 'Hoy';
                                                                                                            return `Quedan ${daysLeft}d`;
                                                                                                        })()
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )
                                                                        ) : (
                                                                            <div className="text-slate-300 dark:text-slate-600">—</div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })
                                                    }
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>

                        {/* Archived Section - Only in Inventory Mode */}
                        {viewMode === 'inventory' && groupedCommitments.archived.length > 0 && (
                            <>
                                {/* Separator */}
                                <div className="flex items-center gap-3 px-4 py-3 mt-2">
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                                        Archivados ({groupedCommitments.archived.length})
                                    </span>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                </div>

                                {/* Archived Commitments - Simplified cards */}
                                <div className="px-2 pb-4 space-y-1.5 opacity-60">
                                    {groupedCommitments.archived.map((commitment) => {
                                        const lifecycleLabel = getTerminationReason(commitment) === 'COMPLETED_INSTALLMENTS'
                                            ? 'completado'
                                            : 'pausado';
                                        const commitmentPayments = payments.get(commitment.id) || [];
                                        const paymentCount = commitmentPayments.filter(p => p.payment_date).length;

                                        return (
                                            <div
                                                key={commitment.id}
                                                onClick={() => onDetailCommitment ? onDetailCommitment(commitment) : onEditCommitment(commitment)}
                                                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
                                                        border-l-2 border-slate-400 dark:border-slate-500
                                                        bg-slate-50/50 dark:bg-slate-800/30
                                                        hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                                            >
                                                {/* Flow indicator */}
                                                <div className={`w-1.5 h-4 rounded-full ${commitment.flow_type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                                                {/* Name + badge */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm text-slate-600 dark:text-slate-300 truncate">
                                                            {commitment.name}
                                                        </span>
                                                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                                            {lifecycleLabel}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Payment count */}
                                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                                    {paymentCount} pago{paymentCount !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div >

                {/* Grid Footer: Contextual Adaptive */}
                <ContextualFooter
                    showingCount={footerStats.showingCount}
                    totalCount={footerStats.totalCount}
                    commitmentCounts={footerStats.commitmentCounts}
                    viewMode={footerStats.viewMode}
                    periodLabel={footerStats.periodLabel}
                    overdueCount={footerStats.overdueCount}
                    overdueAmount={footerStats.overdueAmount}
                    oldestOverdueDays={footerStats.oldestOverdueDays}
                    upcomingCount={footerStats.upcomingCount}
                    upcomingAmount={footerStats.upcomingAmount}
                    paidCount={footerStats.paidCount}
                    paidAmount={footerStats.paidAmount}
                    pendingCount={footerStats.pendingCount}
                    pendingAmount={footerStats.pendingAmount}
                    activeFilter={footerStats.activeFilter}
                    hasExplicitFilter={footerStats.hasExplicitFilter}
                    formatClp={formatClp}
                    onOverdueClick={onStatusChange ? () => onStatusChange('vencido') : undefined}
                />
            </div>
        </div>
    );
};
