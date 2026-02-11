/**
 * ContextualFooter.tsx
 *
 * Adaptive footer that changes based on active filters and provides
 * contextual information about the current view state.
 *
 * Design: Contador + Período + Alerta Contextual
 * Priority: vencido > próximo a vencer > progreso > total
 */

import React from 'react';
import { AlertTriangle, Clock, CheckCircle, Star } from 'lucide-react';
import type { CommitmentCounts } from '../../hooks/useExpenseGridLogic';

// =============================================================================
// TYPES
// =============================================================================

export interface FooterAlert {
    type: 'overdue' | 'upcoming' | 'progress' | 'total' | 'none';
    icon: React.ReactNode;
    text: string;
    color: 'rose' | 'amber' | 'teal' | 'emerald' | 'slate';
    pulse?: boolean;
}

export interface ActiveFilter {
    type: 'important' | 'category' | 'status' | 'none';
    label: string;
    icon?: React.ReactNode;
}

export interface ContextualFooterProps {
    // Counts
    showingCount: number;
    totalCount: number;

    // Lifecycle counts (for breakdown display in inventory mode)
    commitmentCounts: CommitmentCounts;

    // View mode: 'monthly' shows simple count, 'inventory' shows breakdown
    viewMode: 'monthly' | 'inventory';

    // Period
    periodLabel: string; // e.g., "Feb 2026"

    // Alert data (calculated externally)
    overdueCount: number;
    overdueAmount: number;
    oldestOverdueDays?: number;

    upcomingCount: number; // vence en < 3 días
    upcomingAmount: number;

    paidCount: number;
    paidAmount: number;

    pendingCount: number;
    pendingAmount: number;

    // Active filter (if any)
    activeFilter?: ActiveFilter;

    // Explicit filter flag (user selected category/status)
    hasExplicitFilter?: boolean;

    // Formatter
    formatClp: (amount: number) => string;

    // Callback for clicking on overdue alert
    onOverdueClick?: () => void;
}

// =============================================================================
// HELPER: Determine which alert to show (priority based)
// =============================================================================

function getContextualAlert(props: ContextualFooterProps): FooterAlert {
    const {
        overdueCount, overdueAmount, oldestOverdueDays,
        upcomingCount,
        paidCount, showingCount, paidAmount,
        activeFilter,
        formatClp
    } = props;

    // If filtering by a specific status, show relevant info
    if (activeFilter?.type === 'status') {
        switch (activeFilter.label.toLowerCase()) {
            case 'pagado':
                return {
                    type: 'progress',
                    icon: <CheckCircle className="w-3.5 h-3.5" />,
                    text: `${formatClp(paidAmount)} completado`,
                    color: 'teal',
                };
            case 'pendiente':
                return {
                    type: 'upcoming',
                    icon: <Clock className="w-3.5 h-3.5" />,
                    text: `${formatClp(props.pendingAmount)} por pagar`,
                    color: 'amber',
                };
            case 'vencido':
                return {
                    type: 'overdue',
                    icon: <AlertTriangle className="w-3.5 h-3.5" />,
                    text: oldestOverdueDays
                        ? `${formatClp(overdueAmount)} · -${oldestOverdueDays}d más antiguo`
                        : `${formatClp(overdueAmount)} atrasado`,
                    color: 'rose',
                    pulse: true,
                };
        }
    }

    // Priority 1: Overdue items (most urgent)
    if (overdueCount > 0) {
        return {
            type: 'overdue',
            icon: <AlertTriangle className="w-3.5 h-3.5" />,
            text: `${overdueCount} vencido${overdueCount > 1 ? 's' : ''} · ${formatClp(overdueAmount)}`,
            color: 'rose',
            pulse: true,
        };
    }

    // Priority 2: Upcoming payments (< 3 days)
    if (upcomingCount > 0) {
        return {
            type: 'upcoming',
            icon: <Clock className="w-3.5 h-3.5" />,
            text: `${upcomingCount} próximo${upcomingCount > 1 ? 's' : ''} a vencer`,
            color: 'amber',
        };
    }

    // Priority 3: Progress (always show when no urgent alerts)
    const progressPercent = showingCount > 0 ? Math.round((paidCount / showingCount) * 100) : 0;

    // 100% = All done!
    if (progressPercent === 100) {
        return {
            type: 'progress',
            icon: <CheckCircle className="w-3.5 h-3.5" />,
            text: 'Todo al día',
            color: 'emerald',
        };
    }

    // Show progress percentage
    return {
        type: 'progress',
        icon: <CheckCircle className="w-3.5 h-3.5" />,
        text: `${progressPercent}% completado`,
        color: progressPercent >= 50 ? 'teal' : 'slate',
    };
}

// =============================================================================
// COLOR MAPS
// =============================================================================

const alertColorClasses: Record<FooterAlert['color'], string> = {
    rose: 'text-rose-500 dark:text-rose-400',
    amber: 'text-amber-500 dark:text-amber-400',
    teal: 'text-teal-500 dark:text-teal-400',
    emerald: 'text-emerald-500 dark:text-emerald-400',
    slate: 'text-slate-500 dark:text-slate-400',
};

const filterIconMap: Record<string, React.ReactNode> = {
    important: <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />,
};

// =============================================================================
// COMPONENT
// =============================================================================

export const ContextualFooter: React.FC<ContextualFooterProps> = (props) => {
    const {
        showingCount,
        totalCount,
        commitmentCounts,
        viewMode,
        periodLabel,
        activeFilter,
        hasExplicitFilter = false,
    } = props;

    const alert = getContextualAlert(props);
    const hasFilter = activeFilter && activeFilter.type !== 'none';

    // Build the count text based on view mode and filters
    const renderCountText = () => {
        // With explicit filter (category/status), show "X de Y activos"
        if (hasExplicitFilter) {
            return (
                <>
                    <span className="font-semibold">{showingCount}</span>
                    <span className="text-slate-400 dark:text-slate-500"> de {totalCount} activos</span>
                </>
            );
        }

        // Inventory mode: Show lifecycle breakdown
        if (viewMode === 'inventory') {
            const parts: React.ReactNode[] = [];

            if (commitmentCounts.active > 0) {
                parts.push(
                    <span key="active" className="font-semibold">
                        {commitmentCounts.active} activos
                    </span>
                );
            }

            if (commitmentCounts.paused > 0) {
                parts.push(
                    <span key="paused" className="text-slate-400 dark:text-slate-500">
                        {commitmentCounts.paused} pausados
                    </span>
                );
            }

            if (commitmentCounts.completed > 0) {
                parts.push(
                    <span key="completed" className="text-slate-400 dark:text-slate-500">
                        {commitmentCounts.completed} completados
                    </span>
                );
            }

            // Join with separator
            return (
                <>
                    {parts.map((part, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <span className="text-slate-300 dark:text-slate-600 mx-1">·</span>}
                            {part}
                        </React.Fragment>
                    ))}
                </>
            );
        }

        // Monthly mode: Simple count
        return <span className="font-semibold">{showingCount} activos</span>;
    };

    const hasOverdue = props.overdueCount > 0;

    return (
        <div
            className={`flex items-center justify-between px-4 py-2.5 h-11 mx-3 mb-2 rounded-xl border shadow-sm backdrop-blur-xl transition-all ${
                hasOverdue
                    ? 'bg-rose-50/95 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 shadow-rose-100 dark:shadow-rose-900/20'
                    : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/60 dark:border-slate-700/60 shadow-slate-100 dark:shadow-slate-900/20'
            }`}
        >
            {/* Left: Counter with filter context */}
            <div className="flex items-center gap-2 text-xs font-medium">
                {/* Filter indicator */}
                {hasFilter && (
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        {activeFilter.type === 'important' && filterIconMap.important}
                        {activeFilter.type === 'category' && activeFilter.icon}
                        {activeFilter.type === 'status' && activeFilter.icon}
                    </span>
                )}

                {/* Count */}
                <span className="text-slate-600 dark:text-slate-300">
                    {renderCountText()}
                </span>
            </div>

            {/* Center: Period */}
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {periodLabel}
            </div>

            {/* Right: Contextual Alert */}
            {alert.type !== 'none' && (
                alert.type === 'overdue' && props.onOverdueClick ? (
                    <button
                        onClick={props.onOverdueClick}
                        className={`flex items-center gap-1.5 text-xs font-medium ${alertColorClasses[alert.color]} hover:opacity-80 transition-opacity cursor-pointer`}
                    >
                        <span className={alert.pulse ? 'animate-pulse' : ''}>
                            {alert.icon}
                        </span>
                        <span>{alert.text}</span>
                        <span className="text-[10px] opacity-70">Ver →</span>
                    </button>
                ) : (
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${alertColorClasses[alert.color]}`}>
                        <span className={alert.pulse ? 'animate-pulse' : ''}>
                            {alert.icon}
                        </span>
                        <span>{alert.text}</span>
                    </div>
                )
            )}
        </div>
    );
};

export default ContextualFooter;
