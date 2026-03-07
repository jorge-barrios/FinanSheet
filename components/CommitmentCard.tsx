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
import { getCommitmentSummary, getCommitmentStatus, getInstallmentNumber } from '../utils/commitmentStatusUtils';
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
        /** Real amount paid in CLP (from payment record). Shows instead of term amount when available. */
        paidAmount?: number;
        paymentDate?: string;
        dueDate?: string;
        daysOverdue?: number;
        paidOnTime?: boolean;
    };
    /** Translation function for frequency */
    translateFrequency?: (freq: string) => string;
    /** Rate converter for live currency display */
    rateConverter?: (amount: number, currency: string) => number;
}



// ... [inside component]






// Estado badge colors context (removed)

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
    rateConverter,
}: CommitmentCardProps) {
    // Get centralized summary
    const summary = getCommitmentSummary(commitment, payments, lastPaymentsMap, rateConverter);
    const activeTerm = commitment.active_term;

    // Determine if commitment is paused/terminated
    const isInactive = summary.estado === 'paused' || summary.estado === 'terminated';

    // Format frequency
    const frequencyLabel = activeTerm?.frequency
        ? (translateFrequency ? translateFrequency(activeTerm.frequency.toLowerCase()) : activeTerm.frequency)
        : '';

    // Determine installment progress display - refined for the new badges
    const getPaymentProgress = () => {
        if (mode === 'monthly' && viewDate) {
            const viewYM = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
            const installmentInfo = getInstallmentNumber(commitment, payments, viewYM);

            if (installmentInfo) {
                return (
                    <div className="flex items-center gap-1.5 text-[0.65rem] text-slate-300 dark:text-slate-400 font-bold uppercase tracking-widest">
                        <span className="opacity-70">Cuota</span>
                        <span>{installmentInfo.current} / {installmentInfo.totalLabel}</span>
                    </div>
                );
            }
        }

        if (summary.isInstallmentBased && summary.installmentsCount) {
            return (
                <div className="flex items-center gap-1.5 text-[0.65rem] text-slate-300 dark:text-slate-400 font-bold uppercase tracking-widest">
                    <span className="opacity-70">Cuota</span>
                    <span>{summary.paymentCount} / {summary.installmentsCount}</span>
                </div>
            );
        }

        if (frequencyLabel) {
            return (
                <div className="flex items-center gap-1.5 text-[0.65rem] text-slate-300 dark:text-slate-400 font-bold uppercase tracking-widest">
                    <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{frequencyLabel}</span>
                </div>
            );
        }

        return null;
    };

    const variant: BentoCardVariant = 'neutral';

    const getAccentColor = () => {
        if (isInactive) return 'bg-slate-400 dark:bg-slate-600';
        if (mode === 'monthly' && monthlyInfo) {
            if (monthlyInfo.isPaid) return 'bg-emerald-500';
            if (monthlyInfo.daysOverdue && monthlyInfo.daysOverdue > 0) return 'bg-rose-500';
            return 'bg-amber-400';
        }
        switch (summary.estado) {
            case 'overdue': return 'bg-rose-500';
            case 'pending': return 'bg-amber-400';
            case 'ok': return 'bg-emerald-500';
            case 'completed': return 'bg-sky-500';
            default: return 'bg-slate-400 dark:bg-slate-600';
        }
    };



    const isOverdue = mode === 'monthly'
        ? (monthlyInfo?.daysOverdue && monthlyInfo.daysOverdue > 0)
        : summary.estado === 'overdue';

    // Target visual overrides for the BentoCard container
    // Matching DesktopGrid cell background: 'bg-slate-900/10 dark:bg-slate-800/30'
    const visualOverrides = isOverdue && !isInactive
        ? '!bg-rose-50/50 md:!bg-rose-100/50 dark:!bg-rose-950/40 !border-rose-200 dark:!border-rose-900/50'
        : '!bg-[var(--dashboard-surface)] md:!bg-slate-900/10 dark:!bg-slate-800/30 !border-[var(--dashboard-border-subtle)] dark:!border-slate-500/30';

    const getStatusInfo = () => {
        const status = getCommitmentStatus(commitment);

        let financial = null;

        if (mode === 'monthly' && monthlyInfo) {
            if (monthlyInfo.daysOverdue && monthlyInfo.daysOverdue > 0) {
                financial = { label: 'Vencido', detail: `hace ${monthlyInfo.daysOverdue}d`, style: { bg: 'bg-transparent', text: 'text-rose-600 dark:text-rose-400' } };
            } else if (!monthlyInfo.isPaid) {
                financial = { label: 'Pendiente', detail: monthlyInfo.dueDate || '', style: { bg: 'bg-transparent', text: 'text-amber-600 dark:text-amber-400' } };
            } else {
                financial = { label: monthlyInfo.paidOnTime ? 'A tiempo' : 'Pagado', detail: monthlyInfo.paymentDate || '', style: { bg: 'bg-transparent', text: monthlyInfo.paidOnTime ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400' } };
            }
        } else {
            if (summary.estado === 'overdue') {
                financial = { label: 'Vencido', detail: summary.estadoDetail, style: { bg: 'bg-transparent', text: 'text-rose-600 dark:text-rose-400' } };
            } else if (summary.estado === 'pending') {
                const pendingDetail = summary.nextPaymentDate ? `Vence ${summary.nextPaymentDate.getDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][summary.nextPaymentDate.getMonth()]}` : summary.estadoDetail;
                financial = { label: 'Pendiente', detail: pendingDetail, style: { bg: 'bg-transparent', text: 'text-amber-600 dark:text-amber-400' } };
            } else if (summary.estado === 'ok' && status === 'ACTIVE') {
                financial = { label: summary.paidOnTime ? 'A tiempo' : 'Al día', detail: '', style: { bg: 'bg-transparent', text: summary.paidOnTime ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400' } };
            }
        }

        return { financial };
    };

    const { financial } = getStatusInfo();
    const CategoryIconComponent = getCategoryIcon(commitment.category?.name || categoryName || '');

    return (
        <BentoCard
            variant={variant}
            interactive
            compact
            onClick={onClick}
            className={`relative overflow-hidden ${visualOverrides} ${isInactive ? 'opacity-60 grayscale' : ''}`}
        >
            {/* Bottom Accent Bar - Status Indicator (as per Design Guidelines 12.9.1) */}
            <div className={`absolute left-0 right-0 bottom-0 h-1 rounded-b-xl ${getAccentColor()}`} />

            <div className="pl-2 pb-1">
                {/* Protocol 1: Header (Avatar + Title + Actions) */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                        {/* Avatar */}
                        <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center
                            shrink-0 bg-slate-200/50 dark:bg-slate-900/40
                            border border-slate-300/50 dark:border-slate-700/50
                            ${commitment.flow_type === 'INCOME'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'}
                        `}>
                            <CategoryIconComponent className="w-4 h-4 opacity-90" />
                        </div>

                        <div className="flex flex-col min-w-0">
                            {/* Name */}
                            <h3 className={`
                                font-brand font-bold text-base text-[var(--dashboard-text-primary)]
                                leading-tight line-clamp-1
                                ${isInactive ? 'line-through opacity-60' : ''}
                            `}>
                                {commitment.name}
                            </h3>
                        </div>
                    </div>

                    {/* Actions Menu */}
                    {!isInactive && (
                        <div className="-mt-1 -mr-1 shrink-0">
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
                                        className="bg-slate-900/95 border border-slate-700/50 rounded-xl p-1.5 shadow-2xl min-w-[160px] z-50 text-slate-200"
                                        sideOffset={5}
                                    >
                                        {onEdit && (
                                            <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); onEdit(); }} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-slate-700/50 rounded-lg cursor-pointer outline-none transition-colors">
                                                <Edit2 className="w-4 h-4 text-slate-400" /> Editar
                                            </DropdownMenu.Item>
                                        )}
                                        {onDetail && (
                                            <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); onDetail(); }} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-sky-400 hover:bg-sky-500/10 rounded-lg cursor-pointer outline-none transition-colors">
                                                <Eye className="w-4 h-4" /> Detalle
                                            </DropdownMenu.Item>
                                        )}
                                        {!isInactive && onPause && (
                                            <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); onPause(); }} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-amber-400 hover:bg-amber-500/10 rounded-lg cursor-pointer outline-none transition-colors">
                                                <Pause className="w-4 h-4" /> Pausar
                                            </DropdownMenu.Item>
                                        )}
                                        {isInactive && onResume && (
                                            <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); onResume(); }} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer outline-none transition-colors">
                                                <Play className="w-4 h-4" /> Reanudar
                                            </DropdownMenu.Item>
                                        )}
                                        {onDelete && (
                                            <>
                                                <DropdownMenu.Separator className="h-px bg-slate-700/50 my-1.5" />
                                                <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); onDelete(); }} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer outline-none transition-colors">
                                                    <Trash2 className="w-4 h-4" /> Eliminar
                                                </DropdownMenu.Item>
                                            </>
                                        )}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                        </div>
                    )}
                </div>

                {/* Protocol 2: Badges Column */}
                <div className="flex flex-col gap-1.5 mt-2.5">
                    {/* Category Badge - Match DesktopGrid Badges: bg-slate-100/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/50 */}
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 w-fit">
                        <CategoryIconComponent className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                        <span className="text-[0.65rem] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400">
                            {categoryName || 'General'}
                        </span>
                    </div>

                    {/* Progress / Frequency Badge */}
                    {getPaymentProgress() && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 w-fit">
                            {getPaymentProgress()}
                        </div>
                    )}
                </div>

                {/* Protocol 3: Footer (Status & Amount) */}
                <div className="mt-2.5 pt-2 flex items-end justify-between">
                    {/* Status Text (Left) */}
                    <div className="flex flex-col gap-0.5">
                        {financial ? (
                            <span className={`font-semibold text-xs ${financial.style.text}`}>
                                {financial.label}
                                {financial.detail && <span className="text-[var(--dashboard-text-muted)] ml-1 font-medium">{financial.detail}</span>}
                            </span>
                        ) : (
                            isInactive ? <span className="text-xs font-semibold text-[var(--dashboard-text-muted)]">Sin deuda</span> : <span />
                        )}
                        {mode === 'inventory' && !isInactive && summary.nextPaymentDate && (
                            <span className="text-[0.65rem] font-medium text-[var(--dashboard-text-muted)]">
                                Vence: {summary.nextPaymentDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                            </span>
                        )}
                    </div>

                    {/* Amount Block (Right) */}
                    <div className="flex flex-col items-end">
                        {/* Secondary Currency */}
                        {activeTerm?.currency_original && activeTerm.currency_original !== 'CLP' && activeTerm.amount_original !== null && (
                            <div className="flex items-baseline gap-1 text-[0.65rem] text-[var(--dashboard-text-secondary)] mb-0.5">
                                <span className="font-semibold uppercase font-sans">{activeTerm.currency_original}</span>
                                <span className="font-sans tabular-nums font-semibold">
                                    {activeTerm.amount_original.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                        
                        {/* Primary Amount CLP */}
                        <div className="flex items-baseline gap-1">
                            {/* "CLP" string removed as requested in mobile redesign guidelines */}
                            <span className="font-sans text-xl font-bold tabular-nums tracking-tight text-[var(--dashboard-text-primary)] leading-none">
                                {mode === 'monthly' && monthlyInfo?.isPaid && monthlyInfo.paidAmount !== undefined
                                    ? formatAmount(monthlyInfo.paidAmount)
                                    : summary.perPeriodAmount !== null ? formatAmount(summary.perPeriodAmount) : '-'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </BentoCard>
    );
}

export default CommitmentCard;
