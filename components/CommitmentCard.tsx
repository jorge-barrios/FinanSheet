/**
 * CommitmentCard.tsx
 * 
 * Unified card component for displaying commitments.
 * Uses BentoCard internally for consistent styling.
 * Shared between InventoryView and ExpenseGrid.
 */

import { BentoCard, BentoCardVariant } from './BentoCard';
import { CommitmentWithTerm, Payment } from '../types.v2';
// useLocalization removed
import { getCommitmentSummary, getCommitmentStatus, EstadoType } from '../utils/commitmentStatusUtils';
import { getCategoryIcon } from '../utils/categoryIcons';
import { MoreVertical } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface CommitmentCardProps {
    commitment: CommitmentWithTerm;
    payments: Payment[];
    lastPaymentsMap?: Map<string, Payment>;
    /** Display mode: 'inventory' shows global info, 'monthly' shows period-specific info */
    mode?: 'inventory' | 'monthly';
    /** Category name */
    categoryName?: string;
    /** Format currency */
    formatAmount?: (amount: number) => string;
    /** Handlers */
    onClick?: () => void;
    onEdit?: () => void;
    onPause?: () => void;
    onResume?: () => void;
    onDelete?: () => void;
    /** For monthly mode: current period info */
    monthlyInfo?: {
        isPaid: boolean;
        paymentDate?: string;
        dueDate?: string;
        daysOverdue?: number;
    };
    /** Translation function for frequency */
    translateFrequency?: (freq: string) => string;
}



// Estado badge colors
const estadoBadgeStyles: Record<EstadoType, { bg: string; text: string; dot: string }> = {
    overdue: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
    pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
    ok: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
    completed: { bg: 'bg-sky-500/10', text: 'text-sky-400', dot: 'bg-sky-500' },
    paused: { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-500' },
    terminated: { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-500' },
    no_payments: { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-500' },
};

export function CommitmentCard({
    commitment,
    payments,
    lastPaymentsMap,
    mode = 'inventory',
    categoryName,
    formatAmount = (n) => `$${n.toLocaleString('es-CL')}`,
    onClick,
    onEdit,
    onPause,
    onResume,
    onDelete,
    monthlyInfo,
    translateFrequency,
}: CommitmentCardProps) {
    // Get centralized summary
    const summary = getCommitmentSummary(commitment, payments, lastPaymentsMap);
    const activeTerm = commitment.active_term;

    // Determine if commitment is paused/terminated
    const isInactive = summary.estado === 'paused' || summary.estado === 'terminated';

    // Card variant based on estado
    // ============================================================
    // NEUTRAL CARD PHILOSOPHY (see DEVELOPMENT.md)
    // Cards are ALWAYS neutral. Color expressed via:
    // 1. Left accent bar (3px) for quick visual scanning
    // 2. Ultra-subtle background tint ONLY for overdue items
    // ============================================================
    const variant: BentoCardVariant = 'neutral';

    // Determine left accent bar color based on financial state
    const getAccentColor = () => {
        if (isInactive) return 'bg-slate-300 dark:bg-slate-600';

        if (mode === 'monthly' && monthlyInfo) {
            if (monthlyInfo.isPaid) return 'bg-emerald-500';
            if (monthlyInfo.daysOverdue && monthlyInfo.daysOverdue > 0) return 'bg-red-500';
            return 'bg-amber-400'; // pending
        }

        // Inventory mode
        switch (summary.estado) {
            case 'overdue': return 'bg-red-500';
            case 'pending': return 'bg-amber-400';
            case 'ok': return 'bg-emerald-500';
            case 'completed': return 'bg-sky-500';
            default: return 'bg-slate-300 dark:bg-slate-600';
        }
    };

    // Determine if we need a subtle background tint (only for overdue)
    const isOverdue = mode === 'monthly'
        ? (monthlyInfo?.daysOverdue && monthlyInfo.daysOverdue > 0)
        : summary.estado === 'overdue';

    const overdueClasses = isOverdue && !isInactive
        ? 'bg-red-50/30 dark:bg-red-950/20 border-red-200/50 dark:border-red-800/30'
        : '';

    // Remove legacy customClasses overrides
    const customClasses = overdueClasses;

    // Format frequency
    const frequencyLabel = activeTerm?.frequency
        ? (translateFrequency ? translateFrequency(activeTerm.frequency.toLowerCase()) : activeTerm.frequency)
        : '';

    // Determine status labels based on mode
    const getStatusInfo = () => {
        // 1. LIFECYCLE (Identity) - Sky Blue for Active
        let lifecycle = { label: 'Inactivo', style: { bg: 'bg-slate-500/10', text: 'text-slate-500', dot: 'bg-slate-500' } };
        const status = getCommitmentStatus(commitment); // ACTIVE, PAUSED, COMPLETED, INACTIVE

        switch (status) {
            case 'ACTIVE':
                lifecycle = {
                    label: 'Activo',
                    style: { bg: 'bg-sky-500/10 dark:bg-sky-900/20', text: 'text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' }
                };
                break;
            case 'COMPLETED':
                lifecycle = {
                    label: 'Completado',
                    style: { bg: 'bg-emerald-500/10 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' }
                };
                break;
            case 'INACTIVE':
            default:
                lifecycle = {
                    label: 'Pausado',
                    style: { bg: 'bg-slate-500/10 dark:bg-slate-800', text: 'text-slate-500 dark:text-slate-400', dot: 'bg-slate-500' }
                };
                break;
        }

        // 2. FINANCIAL (Alerts) - Red/Amber text for issues
        let financial = null;

        if (mode === 'monthly' && monthlyInfo) {
            if (monthlyInfo.daysOverdue && monthlyInfo.daysOverdue > 0) {
                financial = {
                    label: 'Vencido',
                    detail: `hace ${monthlyInfo.daysOverdue}d`,
                    style: { ...estadoBadgeStyles['overdue'], bg: 'bg-transparent', text: 'text-rose-600 dark:text-rose-400' }
                };
            } else if (!monthlyInfo.isPaid) {
                financial = {
                    label: 'Pendiente',
                    detail: monthlyInfo.dueDate || '',
                    style: { ...estadoBadgeStyles['pending'], bg: 'bg-transparent', text: 'text-amber-600 dark:text-amber-400' }
                };
            } else {
                financial = {
                    label: 'Pagado',
                    detail: monthlyInfo.paymentDate || '',
                    style: { ...estadoBadgeStyles['ok'], bg: 'bg-transparent', text: 'text-emerald-600 dark:text-emerald-400' }
                };
            }
        } else {
            // Inventory Logic
            if (summary.estado === 'overdue') {
                financial = {
                    label: 'Vencido',
                    detail: summary.estadoDetail,
                    style: { ...estadoBadgeStyles['overdue'], bg: 'bg-transparent', text: 'text-rose-600 dark:text-rose-400' }
                };
            } else if (summary.estado === 'pending') {
                financial = {
                    label: 'Pendiente',
                    detail: summary.estadoDetail,
                    style: { ...estadoBadgeStyles['pending'], bg: 'bg-transparent', text: 'text-amber-600 dark:text-amber-400' }
                };
            } else if (summary.estado === 'ok' && status === 'ACTIVE') {
                financial = {
                    label: 'Al día',
                    detail: '',
                    style: { ...estadoBadgeStyles['ok'], bg: 'bg-transparent', text: 'text-emerald-600 dark:text-emerald-400' }
                };
            }
        }

        return { lifecycle, financial };
    };

    const { lifecycle, financial } = getStatusInfo();
    const CategoryIconComponent = getCategoryIcon(commitment.category?.name || categoryName || '');

    return (
        <BentoCard
            variant={variant}
            interactive
            onClick={onClick}
            className={`h-full relative overflow-hidden ${customClasses} ${isInactive ? 'opacity-60 grayscale' : ''}`}
        >
            {/* Left Accent Bar - Status Indicator */}
            <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${getAccentColor()}`} />

            <div className="flex justify-between items-start pl-1">
                <div className="flex items-center gap-3">
                    {/* Avatar - Neutral BG, Colored Icon for differentiation */}
                    <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center
                        shrink-0
                        bg-slate-100 dark:bg-slate-800 
                        border border-slate-200 dark:border-slate-700
                        ${commitment.flow_type === 'INCOME'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'}
                    `}>
                        <CategoryIconComponent className="w-5 h-5" />
                    </div>

                    {/* Name + Category */}
                    <div className="flex-1 min-w-0">
                        <h3 className={`
                                font-bold text-base text-[var(--dashboard-text-primary)]
                                leading-tight line-clamp-2
                                ${isInactive ? 'line-through opacity-60' : ''}
                            `}>
                            {commitment.name}
                        </h3>
                        <span className="text-[10px] text-[var(--dashboard-text-muted)] uppercase tracking-wider font-bold">
                            {categoryName || 'Sin categoría'}
                        </span>
                    </div>
                </div>

                {/* Header Right: Lifecycle Badge + Actions */}
                <div className="flex items-center gap-1">
                    {/* Lifecycle Badge (Primary Identity) */}
                    <span className={`
                        hidden sm:inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ml-2
                        ${lifecycle.style.bg} ${lifecycle.style.text}
                    `}>
                        {lifecycle.label}
                    </span>

                    {/* Actions Menu */}
                    {!isInactive && (
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <button
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded-lg text-[var(--dashboard-text-muted)] hover:bg-[var(--dashboard-surface-hover)] transition-colors"
                                >
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                    className="bg-[var(--dashboard-surface)] backdrop-blur-xl border border-[var(--dashboard-border)] rounded-xl p-1 shadow-xl min-w-[140px] z-50"
                                    sideOffset={5}
                                >
                                    {onEdit && (
                                        <DropdownMenu.Item
                                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                                            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--dashboard-text-primary)] hover:bg-[var(--dashboard-accent)]/10 rounded-lg cursor-pointer outline-none"
                                        >
                                            Editar
                                        </DropdownMenu.Item>
                                    )}
                                    {!isInactive && onPause && (
                                        <DropdownMenu.Item
                                            onClick={(e) => { e.stopPropagation(); onPause(); }}
                                            className="flex items-center gap-2 px-3 py-2 text-sm text-amber-400 hover:bg-amber-500/10 rounded-lg cursor-pointer outline-none"
                                        >
                                            Pausar
                                        </DropdownMenu.Item>
                                    )}
                                    {isInactive && onResume && (
                                        <DropdownMenu.Item
                                            onClick={(e) => { e.stopPropagation(); onResume(); }}
                                            className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer outline-none"
                                        >
                                            Reanudar
                                        </DropdownMenu.Item>
                                    )}
                                    {onDelete && (
                                        <>
                                            <DropdownMenu.Separator className="h-px bg-[var(--dashboard-border)] my-1" />
                                            <DropdownMenu.Item
                                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                                className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer outline-none"
                                            >
                                                Eliminar
                                            </DropdownMenu.Item>
                                        </>
                                    )}
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                    )}
                </div>
            </div>

            {/* Amount Row - Tighter spacing */}
            <div className="mt-2 flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono tracking-tight text-[var(--dashboard-text-primary)]">
                        {summary.perPeriodAmount !== null ? formatAmount(summary.perPeriodAmount) : '-'}
                    </span>
                    <span className="text-[10px] font-semibold text-[var(--dashboard-text-muted)] uppercase">
                        CLP
                    </span>
                </div>

                {/* Progress (for installments) OR Frequency badge */}
                {summary.isInstallmentBased ? (
                    <span className="text-xs font-mono text-[var(--dashboard-text-muted)]">
                        {summary.paymentCount}/{summary.installmentsCount}
                    </span>
                ) : frequencyLabel && (
                    <span className="text-[10px] uppercase font-semibold tracking-wide text-[var(--dashboard-text-muted)]">
                        {frequencyLabel}
                    </span>
                )}
            </div>

            {/* Simplified Footer: Just status text + date, no heavy badges */}
            <div className="mt-3 pt-2 border-t border-slate-200/30 dark:border-slate-700/30 flex items-center justify-between text-xs">
                {/* Left: Status as simple text (color from left bar reinforces this) */}
                {financial ? (
                    <span className={`font-medium ${financial.style.text}`}>
                        {financial.label}
                        {financial.detail && (
                            <span className="text-[var(--dashboard-text-muted)] ml-1 font-normal">{financial.detail}</span>
                        )}
                    </span>
                ) : (
                    isInactive
                        ? <span className="text-[var(--dashboard-text-muted)]">Sin deuda</span>
                        : <span />
                )}

                {/* Right: Smart Date */}
                {mode === 'inventory' && (
                    <span className="text-[var(--dashboard-text-muted)]">
                        {!isInactive && summary.nextPaymentDate && (
                            <>
                                Próx: <span className="font-medium text-[var(--dashboard-text-secondary)]">
                                    {summary.nextPaymentDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                                </span>
                            </>
                        )}
                        {isInactive && summary.lastPayment && (
                            <>
                                Último: <span className="font-medium text-[var(--dashboard-text-secondary)]">
                                    {new Date(summary.lastPayment.payment_date || summary.lastPayment.period_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                                </span>
                            </>
                        )}
                    </span>
                )}
            </div>
        </BentoCard>
    );
}

export default CommitmentCard;
