/**
 * ExpenseCard.tsx
 * 
 * Single payment cell component for the ExpenseGrid.
 * Follows "Neutral Card" philosophy from DEVELOPMENT.md and identidad.md:
 * - Neutral backgrounds (slate-based)
 * - Left-bar color indicator for status
 * - Reduced color saturation
 * - Uses centralized functions
 */

import React from 'react';
import {
    CheckCircleIcon, ExclamationTriangleIcon, ClockIcon,
    CalendarIcon, EditIcon, PlusIcon
} from '../icons';
import { Minus } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { Density } from './types';
import type { CommitmentWithTerm, Term } from '../../types.v2';

// =============================================================================
// SHARED TOOLTIP COMPONENT
// =============================================================================

const CompactTooltip = ({ children, content, sideOffset = 5 }: {
    children: React.ReactNode;
    content: React.ReactNode;
    sideOffset?: number;
}) => (
    <Tooltip.Provider delayDuration={500} skipDelayDuration={0}>
        <Tooltip.Root disableHoverableContent={true}>
            <Tooltip.Trigger asChild>
                <span className="h-full w-full block outline-none">{children}</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content
                    className="z-50 rounded-lg bg-white dark:bg-slate-800 px-3 py-2 text-sm shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in-0 zoom-in-95 duration-200 pointer-events-none"
                    sideOffset={sideOffset}
                >
                    {content}
                    <Tooltip.Arrow className="fill-white dark:fill-slate-800" />
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    </Tooltip.Provider>
);

// =============================================================================
// TYPES
// =============================================================================

interface ExpenseCardProps {
    commitment: CommitmentWithTerm;
    monthDate: Date;
    density: Density;
    term: Term | null;
    isPaid: boolean;
    isOverdue: boolean;
    isPending: boolean;
    isGap: boolean;
    isDisabled: boolean;
    isFocused: boolean;
    isCurrent: boolean;
    cuotaNumber?: number | null;
    installmentsCount?: number | null;
    displayAmount: number;
    paidAmount?: number | null;
    paidOnTime?: boolean;
    dueDay: number;
    daysOverdue: number;
    daysRemaining: number;
    showOriginalCurrency?: boolean;
    originalCurrency?: string;
    perPeriodOriginal?: number;
    onRecordPayment: () => void;
    formatClp: (amount: number) => string;
}

// =============================================================================
// STATUS COLORS - Following identidad.md rules (subtle, not aggressive)
// =============================================================================

const getStatusLeftBar = (isPaid: boolean, isOverdue: boolean, isPending: boolean): string => {
    if (isPaid) return 'bg-emerald-500';
    if (isOverdue) return 'bg-rose-500';
    if (isPending) return 'bg-amber-400';
    return 'bg-slate-300 dark:bg-slate-600';
};

// =============================================================================
// COMPONENT
// =============================================================================

export const ExpenseCard: React.FC<ExpenseCardProps> = ({
    commitment: _commitment,  // Reserved for future use
    monthDate,
    density,
    term,
    isPaid,
    isOverdue,
    isPending,
    isGap,
    isDisabled,
    isFocused,
    isCurrent,
    cuotaNumber,
    installmentsCount,
    displayAmount,
    paidAmount,
    paidOnTime,
    dueDay,
    daysOverdue,
    daysRemaining,
    showOriginalCurrency,
    originalCurrency,
    perPeriodOriginal,
    onRecordPayment,
    formatClp,
}) => {
    // ==========================================================================
    // GAP STATE: No term for this period
    // ==========================================================================
    if (isGap && !isPaid) {
        return (
            <div
                className={`
                    rounded-xl w-full h-full flex items-center justify-center
                    border border-dashed border-slate-300 dark:border-slate-700
                    ${density === 'minimal' ? 'min-h-[46px]' : density === 'compact' ? 'min-h-[62px]' : 'min-h-[78px]'}
                `}
            >
                <Minus className="w-5 h-5 text-slate-300 dark:text-slate-600" />
            </div>
        );
    }

    // ==========================================================================
    // ORPHAN STATE: Payment without term
    // ==========================================================================
    if (!term && isPaid) {
        return (
            <div
                className={`
                    rounded-xl w-full h-full flex flex-col items-center justify-center
                    bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800
                    ${density === 'minimal' ? 'min-h-[46px]' : density === 'compact' ? 'min-h-[62px]' : 'min-h-[78px]'}
                `}
            >
                <span className="font-mono font-bold text-sm text-orange-600 dark:text-orange-400">
                    {formatClp(paidAmount!)} ⚠️
                </span>
                <span className="text-[10px] text-orange-500">Pago huérfano</span>
            </div>
        );
    }

    // ==========================================================================
    // MINIMAL VIEW: Icon only with tooltip
    // ==========================================================================
    if (density === 'minimal') {
        const StatusIcon = isPaid ? CheckCircleIcon : isOverdue ? ExclamationTriangleIcon : ClockIcon;
        const iconColor = isPaid ? 'text-emerald-500' : isOverdue ? 'text-rose-500' : 'text-amber-500';

        return (
            <CompactTooltip
                sideOffset={8}
                content={
                    <div className="min-w-[130px] text-slate-800 dark:text-slate-100">
                        <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5">
                            {monthDate.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-base font-bold font-mono tabular-nums">
                            {formatClp(displayAmount)}
                        </div>
                        {cuotaNumber && installmentsCount && installmentsCount > 1 && (
                            <div className="text-[10px] text-slate-500 mt-1">
                                Cuota {cuotaNumber}/{installmentsCount}
                            </div>
                        )}
                        <div className={`text-[10px] font-medium mt-1.5 ${iconColor}`}>
                            {isPaid ? '✓ Pagado' : isOverdue ? '⚠ Vencido' : '⏱ Pendiente'}
                        </div>
                    </div>
                }
            >
                <div
                    className={`
                        relative rounded-xl w-full h-full flex items-center justify-center cursor-pointer
                        transition-all duration-200 border overflow-hidden
                        ${isFocused || isCurrent ? 'border-2 border-slate-400/40 dark:border-slate-500/50' : 'border-slate-200 dark:border-slate-700/50'}
                        ${isDisabled ? 'opacity-40' : ''}
                        bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800
                        min-h-[46px]
                    `}
                    onClick={onRecordPayment}
                >
                    {/* Left bar indicator - Neutral Card pattern */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusLeftBar(isPaid, isOverdue, isPending)}`} />
                    <StatusIcon className={`w-6 h-6 ${iconColor} ${isOverdue ? 'animate-pulse' : ''}`} />
                </div>
            </CompactTooltip>
        );
    }

    // ==========================================================================
    // COMPACT VIEW: Badge style
    // ==========================================================================
    if (density === 'compact') {
        return (
            <CompactTooltip
                sideOffset={14}
                content={
                    <div className="min-w-[140px] text-slate-800 dark:text-slate-100">
                        <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">
                            {monthDate.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' })}
                        </div>
                        <div className="font-bold font-mono text-lg tabular-nums">
                            {formatClp(displayAmount)}
                        </div>
                        {cuotaNumber && installmentsCount && installmentsCount > 1 && (
                            <div className="text-xs text-slate-500 mt-1">
                                Cuota {cuotaNumber}/{installmentsCount}
                            </div>
                        )}
                        <div className="text-xs text-slate-400 mt-2">
                            Vence día {dueDay}
                        </div>
                    </div>
                }
            >
                <div
                    className={`
                        group/cell relative rounded-xl w-full h-full flex flex-col items-center justify-center cursor-pointer
                        transition-all duration-200 border overflow-hidden
                        ${isFocused || isCurrent ? 'border-2 border-slate-400/40 dark:border-slate-500/50' : 'border-slate-200 dark:border-slate-700/50'}
                        ${isDisabled ? 'opacity-40' : ''}
                        bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800
                        min-h-[62px] px-1 py-1
                    `}
                    onClick={onRecordPayment}
                >
                    {/* Left bar indicator */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusLeftBar(isPaid, isOverdue, isPending)}`} />

                    {/* Amount */}
                    <div className="font-mono font-semibold text-sm tabular-nums text-slate-800 dark:text-slate-100">
                        {formatClp(displayAmount)}
                    </div>

                    {/* Status badge - subtle */}
                    <div className="mt-1">
                        {isPaid ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                <CheckCircleIcon className="w-3 h-3 text-emerald-500" />
                                Pagado
                            </span>
                        ) : isOverdue ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                                <ExclamationTriangleIcon className="w-3 h-3" />
                                -{daysOverdue}d
                            </span>
                        ) : isPending ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                <ClockIcon className="w-3 h-3 text-amber-500" />
                                {daysRemaining}d
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500">
                                <CalendarIcon className="w-3 h-3" />
                                Prog.
                            </span>
                        )}
                    </div>
                </div>
            </CompactTooltip>
        );
    }

    // ==========================================================================
    // FULL (DETAILED) VIEW - "Neutral Card" pattern
    // ==========================================================================
    return (
        <div
            className={`
                group/cell relative rounded-xl w-full h-full flex flex-col justify-between cursor-pointer
                transition-all duration-300 ease-out border overflow-hidden
                ${isFocused || isCurrent
                    ? 'border-2 border-slate-400/40 dark:border-slate-500/50'
                    : 'border-slate-200 dark:border-white/5'}
                ${isDisabled ? 'opacity-40' : ''}
                ${isOverdue ? 'bg-rose-50/30 dark:bg-rose-900/10' : 'bg-white dark:bg-slate-800/60'}
                backdrop-blur-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-white/10
                min-h-[78px] p-1.5
            `}
            onClick={onRecordPayment}
        >
            {/* Left bar indicator - Neutral Card pattern */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusLeftBar(isPaid, isOverdue, isPending)}`} />

            {/* TOP ROW: Quota badge (left) + Original currency (right) */}
            <div className="flex items-start justify-between min-h-[16px] pl-2">
                {/* Quota/Payment badge - Compact */}
                {cuotaNumber && installmentsCount && installmentsCount > 1 ? (
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                        {cuotaNumber}/{installmentsCount}
                    </span>
                ) : (
                    <span />
                )}

                {/* Original currency (if foreign) */}
                {showOriginalCurrency && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                        {originalCurrency} {perPeriodOriginal?.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                )}
            </div>

            {/* MIDDLE ROW: Status Icon + Amount */}
            <div className="flex items-center justify-between py-1 pl-2">
                <div className="flex-shrink-0">
                    {isPaid && <CheckCircleIcon className="w-5 h-5 text-emerald-500" />}
                    {isOverdue && <ExclamationTriangleIcon className="w-5 h-5 text-rose-500 animate-pulse" />}
                    {!isPaid && !isOverdue && isPending && <ClockIcon className="w-5 h-5 text-amber-500" />}
                    {!isPaid && !isOverdue && !isPending && <CalendarIcon className="w-5 h-5 text-slate-400" />}
                </div>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-medium tracking-wide text-slate-400 dark:text-slate-500">
                        CLP
                    </span>
                    <span className="font-mono tabular-nums text-xl tracking-tighter font-semibold text-slate-800 dark:text-slate-100">
                        {formatClp(displayAmount)}
                    </span>
                </div>
            </div>

            {/* BOTTOM ROW: Action hint on hover + Date info */}
            <div className="flex items-end justify-between min-h-[16px] pl-2">
                {/* Hover action hint */}
                <div className="text-[9px] font-medium text-slate-400 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                    {isPaid ? (
                        <span className="flex items-center gap-0.5 text-slate-500">
                            <EditIcon className="w-3 h-3" /> Editar
                        </span>
                    ) : (
                        <span className="flex items-center gap-0.5 text-sky-500">
                            <PlusIcon className="w-3 h-3" /> Pagar
                        </span>
                    )}
                </div>

                {/* Date info */}
                <div className="text-right">
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        vence {dueDay} {monthDate.toLocaleDateString('es-CL', { month: 'short' })}
                    </div>
                    <div className={`text-[10px] font-semibold
                        ${isPaid ? 'text-emerald-600 dark:text-emerald-400' :
                            isOverdue ? 'text-rose-600 dark:text-rose-400' :
                                'text-slate-500 dark:text-slate-400'}`}
                    >
                        {isPaid ? (
                            paidOnTime ? 'A tiempo' : 'Pagado'
                        ) : isOverdue ? (
                            `Hace ${daysOverdue}d`
                        ) : isPending ? (
                            daysRemaining === 0 ? 'Hoy' : `En ${daysRemaining}d`
                        ) : (
                            'Programado'
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpenseCard;
