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
import { getCommitmentSummary, getInstallmentNumber } from '../utils/commitmentStatusUtils';
import { getCategoryIcon } from '../utils/categoryIcons';
import { Edit2, Pause, Play, Trash2, Eye, Star } from 'lucide-react';
import { OnTimeMedalIcon, ExclamationTriangleIcon, CheckCircleIcon } from './icons';
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
                        <span className="opacity-70">Pago</span>
                        <span>{installmentInfo.current} de {installmentInfo.totalLabel}</span>
                    </div>
                );
            }
        }

        if (summary.isInstallmentBased && summary.installmentsCount) {
            return (
                <div className="flex items-center gap-1.5 text-[0.65rem] text-slate-300 dark:text-slate-400 font-bold uppercase tracking-widest">
                    <span className="opacity-70">Pago</span>
                    <span>{summary.paymentCount} de {summary.installmentsCount}</span>
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

    const isOverdue = mode === 'monthly'
        ? (monthlyInfo?.daysOverdue && monthlyInfo.daysOverdue > 0)
        : summary.estado === 'overdue';

    // Target visual overrides for the BentoCard container
    // Matching Desktop reference card background
    const visualOverrides = isOverdue && !isInactive
        ? '!bg-rose-100/60 md:!bg-rose-100/60 dark:!bg-rose-900/30 !border-rose-200 dark:!border-rose-900/50'
        : '!bg-slate-900/10 dark:!bg-slate-800/30 !border-slate-200 dark:!border-slate-700/50';


    const CategoryIconComponent = getCategoryIcon(commitment.category?.name || categoryName || '');

    // Helpers for Smart Avatar and Semantic Text
    const getShortMonth = (dateStr: string) => {
        if (!dateStr) return '';
        const datePart = dateStr.split('T')[0];
        const [, month, day] = datePart.split('-');
        if (!month || !day) return '';
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const numMonth = parseInt(month, 10);
        return `${parseInt(day, 10)} ${months[numMonth - 1] || month}`;
    };

    const isDueSoon = mode === 'monthly' && (monthlyInfo?.daysOverdue === 0);

    const getSemanticStatusText = () => {
        if (isInactive) return { label: 'ESTADO', text: 'Sin deuda', color: 'text-slate-400 dark:text-slate-500' };

        if (mode === 'monthly' && monthlyInfo) {
            if (monthlyInfo.isPaid) {
                return {
                    label: 'PAGADO',
                    text: monthlyInfo.paymentDate ? getShortMonth(monthlyInfo.paymentDate) : 'Sí',
                    color: 'text-emerald-500 font-bold'
                };
            }
            if (monthlyInfo.daysOverdue !== undefined && monthlyInfo.daysOverdue > 0) {
                return {
                    label: 'VENCIDO',
                    text: `hace ${monthlyInfo.daysOverdue} d.`,
                    color: 'text-rose-500 font-bold'
                };
            }
            if (activeTerm?.due_day_of_month) {
                const monthText = viewDate 
                    ? getShortMonth(`${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(activeTerm.due_day_of_month).padStart(2, '0')}`) 
                    : `día ${activeTerm.due_day_of_month}`;
                
                return {
                    label: 'PENDIENTE',
                    text: isDueSoon ? 'Hoy' : `Venc. ${monthText}`,
                    color: isDueSoon ? 'text-amber-500 font-bold' : 'text-slate-500 dark:text-slate-400 font-bold'
                };
            }
        }
        
        if (summary.estado === 'overdue') {
            return { label: 'VENCIDO', text: 'Sí', color: 'text-rose-500 font-bold' };
        }

        return { label: 'PENDIENTE', text: '-', color: 'text-slate-400 font-bold' };
    };

    const semanticStatus = getSemanticStatusText();



    const renderSmartAvatar = () => {
        if (!isInactive && mode === 'monthly' && monthlyInfo) {
            if (monthlyInfo.isPaid) {
                return monthlyInfo.paidOnTime ? (
                    <OnTimeMedalIcon className="w-[1.35rem] h-[1.35rem] text-emerald-500" strokeWidth={2} />
                ) : (
                    <CheckCircleIcon className="w-[1.35rem] h-[1.35rem] text-emerald-500" />
                );
            }
            if (monthlyInfo.daysOverdue && monthlyInfo.daysOverdue > 0) {
                return <ExclamationTriangleIcon className="w-[1.35rem] h-[1.35rem] text-rose-500" />;
            }
            if (isDueSoon && activeTerm?.due_day_of_month) {
                return (
                    <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 rounded overflow-hidden shadow-sm w-[1.4rem] h-[1.4rem]">
                        <div className="bg-amber-500 w-full text-center py-[0.5px]">
                            <span className="text-[0.35rem] font-bold text-white uppercase tracking-wider leading-none block pb-[0.5px]">Hoy</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                            <span className="text-[0.65rem] font-bold font-mono text-slate-700 dark:text-slate-300 leading-none">
                                {activeTerm.due_day_of_month}
                            </span>
                        </div>
                    </div>
                );
            }
        }

        return commitment.is_important ? (
            <Star className="w-[1.15rem] h-[1.15rem] text-amber-500 fill-amber-500 opacity-90" />
        ) : (
            <CategoryIconComponent className="w-[1.125rem] h-[1.125rem] opacity-90" />
        );
    };

    const getAvatarContainerStyles = () => {
        const base = "w-10 h-10 rounded-[0.80rem] flex items-center justify-center shrink-0 shadow-sm border transition-colors";
        if (isInactive) return `${base} bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 text-slate-400`;
        
        if (mode === 'monthly' && monthlyInfo) {
            if (monthlyInfo.isPaid) return `${base} bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30`;
            if (monthlyInfo.daysOverdue && monthlyInfo.daysOverdue > 0) return `${base} bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/30`;
            if (isDueSoon) return `${base} bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30`;
        }

        const defaultColor = commitment.flow_type === 'INCOME'
            ? 'text-emerald-500 dark:text-emerald-400'
            : 'text-rose-500 dark:text-rose-400';
            
        return `${base} bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/50 ${defaultColor}`;
    };

    return (
        <BentoCard
            variant={variant}
            interactive
            compact
            onClick={onClick}
            className={`relative overflow-hidden ${visualOverrides} ${isInactive ? 'opacity-60 grayscale' : ''}`}
        >

            
            <div>
                {/* SECTION 1: HEADER & IDENTITY (2-Row Layout) */}
                <div className="flex justify-between items-center gap-3">
                    {/* Left: Avatar (occupies 2 rows) & Texts */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Smart Avatar with Context Menu */}
                        {!isInactive ? (
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <div 
                                        className={`${getAvatarContainerStyles()} hover:scale-105 active:scale-95 cursor-pointer ring-offset-2 ring-offset-transparent hover:ring-2 hover:ring-slate-400/20`}
                                        onClick={(e) => e.stopPropagation()}
                                        title="Opciones"
                                    >
                                        {renderSmartAvatar()}
                                    </div>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        className="bg-slate-900/95 border border-slate-700/50 rounded-xl p-1.5 shadow-2xl min-w-[160px] z-[100] text-slate-200"
                                        sideOffset={8}
                                        align="start"
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
                                                <DropdownMenu.Separator className="h-[1px] bg-slate-700/50 my-1" />
                                                <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); onDelete(); }} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer outline-none transition-colors">
                                                    <Trash2 className="w-4 h-4" /> Eliminar
                                                </DropdownMenu.Item>
                                            </>
                                        )}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                        ) : (
                            <div className={getAvatarContainerStyles()}>
                                {renderSmartAvatar()}
                            </div>
                        )}

                        {/* Texts (Name & Category) */}
                        <div className="flex flex-col min-w-0 justify-center gap-0.5">
                            <h3 className={`
                                font-brand font-bold text-[1.05rem] text-[var(--dashboard-text-primary)]
                                leading-tight line-clamp-1 tracking-tight
                                ${isInactive ? 'line-through opacity-60' : ''}
                            `}>
                                {commitment.name}
                            </h3>
                            <span className="text-[0.65rem] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">
                                {categoryName || 'General'}
                            </span>
                        </div>
                    </div>



                    {/* Right: Actions & Amount */}
                    <div className="flex flex-col items-end shrink-0 gap-1 mt-[-2px]">
                        {/* Primary Amount */}
                        <div className="flex flex-col items-end">
                            {/* Secondary Currency (Small & above) */}
                            {activeTerm?.currency_original && activeTerm.currency_original !== 'CLP' && activeTerm.amount_original !== null && (
                                <div className="flex items-baseline gap-1 text-[0.625rem] text-slate-400 dark:text-slate-500 mb-0.5">
                                    <span className="font-semibold uppercase font-mono">{activeTerm.currency_original}</span>
                                    <span className="font-mono tabular-nums font-semibold">
                                        {activeTerm.amount_original.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                            
                            {/* Primary Amount CLP PROTAGONIST */}
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    CLP
                                </span>
                                <span className="font-mono text-xl font-bold tabular-nums tracking-tighter text-slate-800 dark:text-slate-100 leading-none">
                                    {mode === 'monthly' && monthlyInfo?.isPaid && monthlyInfo.paidAmount !== undefined
                                        ? formatAmount(monthlyInfo.paidAmount)
                                        : summary.perPeriodAmount !== null ? formatAmount(summary.perPeriodAmount) : '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: METADATA & STATUS ICONS (Footer replacement) */}
                <div className="mt-3 flex items-center justify-between pl-2">
                    {/* Left: Metadata Box (Payment Day & Installment Progress) */}
                    <div className="flex items-center gap-1.5">
                        {isInactive ? (
                            <span className="text-xs font-semibold text-slate-400">Sin deuda</span>
                        ) : (
                            getPaymentProgress() && (
                                <div className="inline-flex items-center gap-1 px-1.5 py-[0.1rem] rounded border border-slate-200 dark:border-slate-700/60 bg-transparent w-fit [&_span]:!text-slate-400 dark:[&_span]:!text-slate-400 [&_span]:!font-bold [&_span]:!text-[0.65rem] [&_span]:uppercase [&_span]:tracking-wider [&_span]:!font-mono [&_svg]:!w-3 [&_svg]:!h-3 [&_svg]:!text-slate-400">
                                    {getPaymentProgress()}
                                </div>
                            )
                        )}
                    </div>

                    {/* Right: Semantic Status Text */}
                    <div className="flex items-center gap-1.5 text-right">
                        <span className="text-[0.65rem] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 opacity-80">
                            {semanticStatus.label}
                        </span>
                        <span className={`text-[0.7rem] uppercase tracking-wider ${semanticStatus.color}`}>
                            {semanticStatus.text}
                        </span>
                    </div>
                </div>
            </div>
        </BentoCard>
    );
}

export default CommitmentCard;
