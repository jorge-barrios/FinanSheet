import React from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { X, Edit2 } from 'lucide-react';
import type { CommitmentWithTerm, Payment } from '../types.v2';
import { TermsListView } from './TermsListView';
import { getCategoryIcon } from '../utils/categoryIcons';
import { getCommitmentSummary } from '../utils/commitmentStatusUtils';
import { useCommitmentHistory } from '../hooks/useCommitmentHistory';

interface CommitmentDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    commitment: CommitmentWithTerm;
    payments: Payment[]; // All payments passed down to calculate summary/history
    onEdit: () => void;
    onPaymentClick?: (commitment: CommitmentWithTerm, periodDate: string) => void;
}

export const CommitmentDetailModal: React.FC<CommitmentDetailModalProps> = ({
    isOpen,
    onClose,
    commitment,
    payments, // Context payments (12-month window)
    onEdit,
    onPaymentClick
}) => {
    const { t, formatClp } = useLocalization();
    const CategoryIcon = getCategoryIcon(commitment.category?.name || '');

    // 1. Fetch FULL history for this commitment (to find 2024 payments etc.)
    const { historyPayments, isLoadingHistory, refreshHistory } = useCommitmentHistory(commitment.id, payments);

    // Calculate Summary using centralized utility
    // We prefer historyPayments if available, otherwise fallback to context payments
    const effectivePayments = historyPayments.length > 0 ? historyPayments : payments;

    const summary = React.useMemo(() => {
        return getCommitmentSummary(commitment, effectivePayments, new Map());
    }, [commitment, effectivePayments]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Sheet Content (Slide-in from right) */}
            <div className="relative w-full sm:max-w-xl h-full bg-slate-50 dark:bg-slate-950/90 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-slate-200 dark:border-slate-800/50">

                {/* Header with quick actions - Safe Area for Mobile Notch */}
                <div className="sticky top-0 z-20 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5 px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl bg-white dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-white/5 shadow-sm`}>
                            <CategoryIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                {commitment.name}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                {t(`categories.${commitment.category?.name}`, commitment.category?.name)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onEdit}
                            className="h-9 px-4 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 rounded-full hover:bg-slate-50 dark:hover:bg-white/10 transition-all"
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Editar</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-8">
                    {/* Key Stats Grid - Bento Glass Style */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white/50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-white/5 backdrop-blur-sm">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Estado</label>
                            {/* Simplified Status Badge: Just the status name, no date redundancy */}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold capitalize
                                ${summary.estado === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : ''}
                                ${summary.estado === 'pending' ? 'bg-amber-500/10 text-amber-500' : ''}
                                ${summary.estado === 'overdue' ? 'bg-rose-500/10 text-rose-500' : ''}
                                ${summary.estado === 'terminated' ? 'bg-slate-500/10 text-slate-500' : ''}
                            `}>
                                {summary.estado === 'ok' && 'Al Día'}
                                {summary.estado === 'pending' && 'Pendiente'}
                                {summary.estado === 'overdue' && 'Vencido'}
                                {summary.estado === 'terminated' && 'Terminado'}
                            </span>
                        </div>
                        <div className="bg-white/50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-white/5 backdrop-blur-sm">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Monto Actual</label>
                            {/* Increased font size for Amount */}
                            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-sky-400">
                                {formatClp(summary.perPeriodAmount ?? 0)}
                            </div>
                        </div>
                        <div className="bg-white/50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-white/5 backdrop-blur-sm">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Pagado Total</label>
                            <div className="text-sm sm:text-base font-bold text-slate-700 dark:text-slate-200">
                                {formatClp(summary.totalPaid)}
                            </div>
                        </div>
                        <div className="bg-white/50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-white/5 backdrop-blur-sm">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Próximo Pago</label>
                            {/* Increased font size and made it dynamic color based on urgency */}
                            <div className={`text-base sm:text-lg font-bold truncate ${summary.estado === 'overdue' ? 'text-rose-500' : 'text-slate-700 dark:text-slate-200'
                                }`}>
                                {summary.nextPaymentDate ? new Date(summary.nextPaymentDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '-'}
                            </div>
                        </div>
                    </div>

                    {/* Terms & Payment History - Floating Style */}
                    <div>
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                Historial Completo
                                <div className="flex items-center gap-1.5 ml-2">
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-xs font-medium text-slate-500 dark:text-slate-400 border border-transparent dark:border-white/5">
                                        {effectivePayments.filter(p => p.commitment_id === commitment.id).length} pagos
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-xs font-medium text-slate-500 dark:text-slate-400 border border-transparent dark:border-white/5">
                                        {(commitment.all_terms?.length || (commitment.active_term ? 1 : 0))} {(commitment.all_terms?.length || (commitment.active_term ? 1 : 0)) === 1 ? 'término' : 'términos'}
                                    </span>
                                </div>
                            </h3>
                            {isLoadingHistory && (
                                <div className="ml-auto">
                                    <div className="animate-spin w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full"></div>
                                </div>
                            )}
                        </div>

                        {/* Removed rigid borders for floating look */}
                        <div className="rounded-xl overflow-hidden">
                            <TermsListView
                                commitment={commitment}
                                payments={effectivePayments}
                                isReadOnly={true}
                                hideTitle={true}
                                isLoading={isLoadingHistory}
                                onTermUpdate={async () => { }}
                                onTermCreate={async () => { }}
                                onTermDelete={async () => { }}
                                onRefresh={refreshHistory}
                                onPaymentClick={(date) => onPaymentClick?.(commitment, date)}
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
