import React from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { X, Edit2 } from 'lucide-react';
import type { CommitmentWithTerm, Payment } from '../types.v2';
import { TermsListView } from './TermsListView';
import { getCategoryIcon } from '../utils/categoryIcons';
import { getCommitmentSummary } from '../utils/commitmentStatusUtils';
import { useCommitmentHistory } from '../hooks/useCommitmentHistory';
import { TermService } from '../services/dataService.v2';
import type { TermFormData } from '../types.v2';
import { useToast } from '../context/ToastContext';

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
    const { showToast } = useToast();
    const CategoryIcon = getCategoryIcon(commitment.category?.name || '');

    // 1. Fetch FULL history for this commitment (to find 2024 payments etc.)
    const { historyPayments, isLoadingHistory, refreshHistory } = useCommitmentHistory(commitment.id, payments);

    // Calculate Summary using centralized utility
    // We prefer historyPayments if available, otherwise fallback to context payments
    const effectivePayments = historyPayments.length > 0 ? historyPayments : payments;

    const summary = React.useMemo(() => {
        return getCommitmentSummary(commitment, effectivePayments, new Map());
    }, [commitment, effectivePayments]);

    // Local state for toggling "Manage Terms" mode
    const [isTermsEditing, setIsTermsEditing] = React.useState(false);

    // Handlers for Direct Term Editing
    const handleTermCreate = async (termData: Partial<TermFormData>) => {
        try {
            // Cast to TermFormData as we know the form validates required fields
            await TermService.createTerm(commitment.id, termData as TermFormData);
            showToast('Término creado exitosamente', 'success');
            await refreshHistory(); // Refresh local history
        } catch (error) {
            console.error('Error creating term:', error);
            const msg = error instanceof Error ? error.message : 'Error desconocido';
            showToast(`Error: ${msg}`, 'error');
        }
    };

    const handleTermUpdate = async (termId: string, termData: Partial<TermFormData>) => {
        try {
            await TermService.updateTerm(termId, termData);
            showToast('Término actualizado', 'success');
            await refreshHistory();
        } catch (error) {
            console.error('Error updating term:', error);
            const msg = error instanceof Error ? error.message : 'Error desconocido';
            showToast(`Error: ${msg}`, 'error');
        }
    };

    const handleTermDelete = async (termId: string) => {
        try {
            await TermService.deleteTerm(termId);
            showToast('Término eliminado', 'success');
            await refreshHistory();
        } catch (error) {
            console.error('Error deleting term:', error);
            const msg = error instanceof Error ? error.message : 'Error desconocido';
            showToast(`Error: ${msg}`, 'error');
        }
    };

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
                    {/* Key Stats Grid - Premium Glass Style */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Estado Card */}
                        <div className={`
                            relative overflow-hidden rounded-2xl p-4 border transition-all duration-300
                            ${summary.estado === 'overdue' ? 'bg-rose-500/5 border-rose-500/20 shadow-rose-500/10 shadow-lg' : ''}
                            ${summary.estado === 'ok' ? 'bg-emerald-500/5 border-emerald-500/20 shadow-emerald-500/10 shadow-lg' : ''}
                            ${summary.estado === 'pending' ? 'bg-amber-500/5 border-amber-500/20 shadow-amber-500/10 shadow-lg' : ''}
                            ${!['overdue', 'ok', 'pending'].includes(summary.estado) ? 'bg-slate-100/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50' : ''}
                        `}>
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">Estado Actual</label>
                            <div className={`text-lg sm:text-xl font-black capitalize tracking-tight
                                ${summary.estado === 'overdue' ? 'text-rose-600 dark:text-rose-400' : ''}
                                ${summary.estado === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : ''}
                                ${summary.estado === 'pending' ? 'text-amber-600 dark:text-amber-400' : ''}
                                ${summary.estado === 'terminated' ? 'text-slate-600 dark:text-slate-400' : ''}
                             `}>
                                {summary.estado === 'ok' && 'Al Día'}
                                {summary.estado === 'pending' && 'Pendiente'}
                                {summary.estado === 'overdue' && 'Vencido'}
                                {summary.estado === 'terminated' && 'Terminado'}
                            </div>
                        </div>

                        {/* Monto Actual Card */}
                        <div className="rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl shadow-sm">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">Monto Cuota</label>
                            <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                                {formatClp(summary.perPeriodAmount ?? 0)}
                            </div>
                        </div>

                        {/* Pagado Total Card */}
                        <div className="rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl shadow-sm">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">Total Pagado</label>
                            <div className="text-lg sm:text-xl font-bold text-slate-700 dark:text-slate-300 tabular-nums tracking-tight">
                                {formatClp(summary.totalPaid)}
                            </div>
                        </div>

                        {/* Próximo Pago Card */}
                        <div className="rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl shadow-sm">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">Próximo Pago</label>
                            <div className={`text-lg sm:text-xl font-bold tabular-nums tracking-tight
                                ${summary.estado === 'overdue' ? 'text-rose-500' : 'text-sky-600 dark:text-sky-400'}
                            `}>
                                {summary.nextPaymentDate ? new Date(summary.nextPaymentDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                            </div>
                        </div>
                    </div>

                    {/* Terms & Payment History - Unified Component */}
                    <div>
                        {/* Using TermsListView's integrated header by setting hideTitle={false} */}
                        <div className="rounded-xl overflow-hidden bg-white/50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50">
                            {/* Custom Header with Toggle */}
                            <div className="px-4 py-3 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">
                                        Historial de Términos
                                    </h3>
                                    {isTermsEditing && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/10 text-amber-600 dark:text-amber-500 border border-amber-400/20 uppercase tracking-wide animate-in fade-in zoom-in-95 duration-200">
                                            Modo Edición
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={() => setIsTermsEditing(!isTermsEditing)}
                                    className={`
                                        text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 border
                                        ${isTermsEditing
                                            ? 'bg-slate-900 text-white border-slate-800 hover:bg-slate-800 dark:bg-white dark:text-slate-900'
                                            : 'bg-sky-50 text-sky-600 border-sky-200/50 hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20 dark:hover:bg-sky-500/20'
                                        }
                                        shadow-sm
                                    `}
                                >
                                    {isTermsEditing ? (
                                        <>
                                            Listo
                                        </>
                                    ) : (
                                        <>
                                            Gestionar
                                        </>
                                    )}
                                </button>
                            </div>

                            <TermsListView
                                commitment={commitment}
                                payments={effectivePayments}
                                isReadOnly={!isTermsEditing}
                                hideTitle={true}
                                isLoading={isLoadingHistory}
                                onTermUpdate={handleTermUpdate}
                                onTermCreate={handleTermCreate}
                                onTermDelete={handleTermDelete}
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
