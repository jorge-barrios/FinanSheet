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
import { getCommitmentSummary, getCommitmentStatus, EstadoType, getInstallmentNumber } from '../utils/commitmentStatusUtils';
import { getCategoryIcon } from '../utils/categoryIcons';
import { MoreVertical, Edit2, Pause, Play, Trash2, Eye } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface CommitmentCardProps {
    commitment: CommitmentWithTerm;
    payments: Payment[];
    lastPaymentsMap?: Map<string, Payment>;
    /** Display mode: 'inventory' shows global info, 'monthly' shows period-specific info */
    mode?: 'inventory' | 'monthly';
    /** Current view date for contextual installment counting (optional) */
    viewDate?: Date;
    /** Category name */
    categoryName?: string;
    /** Format currency */
    formatAmount?: (amount: number) => string;
    /** Handlers */
    onClick?: () => void;
    onEdit?: () => void;
    onDetail?: () => void;  // NEW: Opens detail modal with terms history
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



// ... [inside component]






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
    viewDate,
    categoryName,
    formatAmount = (n) => `$${n.toLocaleString('es-CL')}`,
    onClick,
    onEdit,
    onDetail,
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

    // Format frequency
    const frequencyLabel = activeTerm?.frequency
        ? (translateFrequency ? translateFrequency(activeTerm.frequency.toLowerCase()) : activeTerm.frequency)
        : '';

    // Determine installment progress display
    const getPaymentProgress = () => {
        // Mode MONTHLY + viewDate available -> Use Contextual Counter
        if (mode === 'monthly' && viewDate) {
            const viewYM = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
            const installmentInfo = getInstallmentNumber(commitment, payments, viewYM);

            if (installmentInfo) {
                return (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded text-[10px] tracking-wide uppercase">
                            Cuota
                        </span>
                        <span>
                            {installmentInfo.current} / {installmentInfo.totalLabel}
                        </span>
                    </div>
                );
            }
        }

        // Mode INVENTORY (or fallback) -> Use Global Progress
        if (summary.isInstallmentBased && summary.installmentsCount) {
            return (
                <span className="text-xs font-mono text-[var(--dashboard-text-muted)]">
                    {summary.paymentCount}/{summary.installmentsCount}
                </span>
            );
        }

        // Final fallback: Frequency Label
        if (frequencyLabel) {
            return (
                <span className="text-[10px] uppercase font-semibold tracking-wide text-[var(--dashboard-text-muted)]">
                    {frequencyLabel}
                </span>
            );
        }

        return null;
    };

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
            if (monthlyInfo.daysOverdue && monthlyInfo.daysOverdue > 0) return 'bg-rose-500';
            return 'bg-amber-400'; // pending
        }

        // Inventory mode
        switch (summary.estado) {
            case 'overdue': return 'bg-rose-500';
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

    // Stronger overdue styling - consistent with desktop cells
    const overdueClasses = isOverdue && !isInactive
        ? 'bg-rose-100/50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800'
        : '';

    // Remove legacy customClasses overrides
    const customClasses = overdueClasses;



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
                // For pending, show next payment date if available (more useful than generic "Pendiente")
                const pendingDetail = summary.nextPaymentDate
                    ? `Vence ${summary.nextPaymentDate.getDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][summary.nextPaymentDate.getMonth()]}`
                    : summary.estadoDetail;
                financial = {
                    label: 'Pendiente',
                    detail: pendingDetail,
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
            compact
            onClick={onClick}
            className={`h-full relative overflow-hidden ${customClasses} ${isInactive ? 'opacity-60 grayscale' : ''}`}
        >
            {/* Bottom Accent Bar - Status Indicator (more visible than lateral) */}
            <div className={`absolute left-0 right-0 bottom-0 h-1 rounded-b-xl ${getAccentColor()}`} />

            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2.5">
                    {/* Avatar - Compact size (32px) */}
                    <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center
                        shrink-0
                        bg-slate-100 dark:bg-slate-800
                        border border-slate-200 dark:border-slate-700
                        ${commitment.flow_type === 'INCOME'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'}
                    `}>
                        <CategoryIconComponent className="w-4 h-4" />
                    </div>

                    {/* Name + Category Badge */}
                    <div className="flex-1 min-w-0">
                        <h3 className={`
                                font-bold text-base text-[var(--dashboard-text-primary)]
                                leading-tight line-clamp-2
                                ${isInactive ? 'line-through opacity-60' : ''}
                            `}>
                            {commitment.name}
                        </h3>
                        {/* Category Badge - Tech/Dark Style matching screenshot */}
                        <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-md text-[0.6rem] uppercase tracking-widest font-bold bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 text-slate-500 dark:text-slate-400">
                            <CategoryIconComponent className="w-3 h-3 opacity-70" />
                            {categoryName || 'Sin categoría'}
                        </div>
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
                                    className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl p-1.5 shadow-2xl min-w-[160px] z-50"
                                    sideOffset={5}
                                >
                                    {onEdit && (
                                        <DropdownMenu.Item
                                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                                            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700/50 rounded-lg cursor-pointer outline-none transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4 text-slate-400" />
                                            Editar
                                        </DropdownMenu.Item>
                                    )}
                                    {onDetail && (
                                        <DropdownMenu.Item
                                            onClick={(e) => { e.stopPropagation(); onDetail(); }}
                                            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-sky-400 hover:bg-sky-500/10 rounded-lg cursor-pointer outline-none transition-colors"
                                        >
                                            <Eye className="w-4 h-4" />
                                            Detalle
                                        </DropdownMenu.Item>
                                    )}
                                    {!isInactive && onPause && (
                                        <DropdownMenu.Item
                                            onClick={(e) => { e.stopPropagation(); onPause(); }}
                                            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-amber-400 hover:bg-amber-500/10 rounded-lg cursor-pointer outline-none transition-colors"
                                        >
                                            <Pause className="w-4 h-4" />
                                            Pausar
                                        </DropdownMenu.Item>
                                    )}
                                    {isInactive && onResume && (
                                        <DropdownMenu.Item
                                            onClick={(e) => { e.stopPropagation(); onResume(); }}
                                            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer outline-none transition-colors"
                                        >
                                            <Play className="w-4 h-4" />
                                            Reanudar
                                        </DropdownMenu.Item>
                                    )}
                                    {onDelete && (
                                        <>
                                            <DropdownMenu.Separator className="h-px bg-slate-700/50 my-1.5" />
                                            <DropdownMenu.Item
                                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer outline-none transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
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

            {/* Amount Row - Right aligned with currency prefix */}
            <div className="mt-1.5 flex items-center justify-between">
                {/* Left: Payment Progress */}
                {getPaymentProgress()}

                {/* Right: Amount Stack (Secondary above, Primary below) */}
                <div className="flex flex-col items-end">
                    {/* Secondary Currency (if exists) - Above primary */}
                    {activeTerm?.currency_original && activeTerm.currency_original !== 'CLP' && activeTerm.amount_original && (
                        <div className="flex items-baseline gap-1 text-[0.625rem] text-slate-500 dark:text-slate-400">
                            <span className="font-medium uppercase">{activeTerm.currency_original}</span>
                            <span className="font-mono tabular-nums">
                                {activeTerm.amount_original.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                    {/* Primary Amount with CLP prefix */}
                    <div className="flex items-baseline gap-1">
                        <span className="text-[0.625rem] font-medium text-slate-500 dark:text-slate-400 uppercase">
                            CLP
                        </span>
                        <span className="text-lg font-black tabular-nums tracking-tight text-[var(--dashboard-text-primary)]">
                            {summary.perPeriodAmount !== null ? formatAmount(summary.perPeriodAmount) : '-'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Simplified Footer: Just status text + date, no heavy badges */}
            <div className="mt-2 pt-1.5 border-t border-slate-200/30 dark:border-slate-700/30 flex items-center justify-between text-xs">
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
