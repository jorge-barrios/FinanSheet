/**
 * MobileCardList.tsx
 *
 * Mobile view for ExpenseGrid — compact card list with archived section.
 * Handles: filtering, sorting, rendering CommitmentCard, empty states, archived.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import { CommitmentCard } from '../CommitmentCard';
import { parseDateString } from '../../utils/financialUtils.v2';
import { dateToPeriod } from './types';
import type { CommitmentWithTerm, Payment } from '../../types.v2';
import type { ViewMode, StatusFilter } from '../../hooks/useExpenseGridLogic';

export interface MobileCardListProps {
    // Data
    commitments: CommitmentWithTerm[];
    payments: Map<string, Payment[]>;
    focusedDate: Date;
    viewMode: ViewMode;
    selectedCategory: string;
    selectedStatus: StatusFilter;
    groupedCommitments: { archived: CommitmentWithTerm[];[key: string]: any };

    // Hook functions
    getTermForPeriod: (c: CommitmentWithTerm, date: Date) => any;
    getPaymentStatus: (id: string, date: Date, dueDay: number) => { isPaid: boolean; payment: any; hasPaymentRecord: boolean };
    isActiveInMonth: (c: CommitmentWithTerm, date: Date) => boolean;
    performSmartSort: (a: CommitmentWithTerm, b: CommitmentWithTerm) => number;
    getTranslatedCategoryName: (c: CommitmentWithTerm) => string;
    getTerminationReason: (c: CommitmentWithTerm) => string | null;
    formatClp: (amount: number) => string;
    t: (key: string) => string;

    // Actions
    onEditCommitment: (c: CommitmentWithTerm) => void;
    onDetailCommitment?: (c: CommitmentWithTerm) => void;
    onPauseCommitment: (c: CommitmentWithTerm) => void;
    onResumeCommitment: (c: CommitmentWithTerm) => void;
    onDeleteCommitment: (id: string) => void;
    onRecordPayment: (id: string, period: string) => void;
}

export const MobileCardList: React.FC<MobileCardListProps> = ({
    commitments,
    payments,
    focusedDate,
    viewMode,
    selectedCategory,
    selectedStatus,
    groupedCommitments,
    getTermForPeriod,
    getPaymentStatus,
    isActiveInMonth,
    performSmartSort,
    getTranslatedCategoryName,
    getTerminationReason,
    formatClp,
    t,
    onEditCommitment,
    onDetailCommitment,
    onPauseCommitment,
    onResumeCommitment,
    onDeleteCommitment,
    onRecordPayment,
}) => {
    return (
        <div className="lg:hidden p-3 space-y-2 pb-28">
            {(() => {
                const filteredCommitments = commitments.filter(c => {
                    // In inventory mode, show ALL commitments (including terminated)
                    if (viewMode === 'inventory') return true;

                    // Verificar si hay un registro de pago en el mes enfocado
                    const activeTerm = getTermForPeriod(c, focusedDate);
                    const dueDay = activeTerm?.due_day_of_month ?? 1;
                    const { hasPaymentRecord } = getPaymentStatus(c.id, focusedDate, dueDay);

                    if (hasPaymentRecord) return true;

                    // Verificar si está activo según su término en el mes enfocado
                    return isActiveInMonth(c, focusedDate);
                }).filter(c => {
                    // Aplicar filtro de categoría
                    if (selectedCategory === 'all') return true;
                    if (selectedCategory === 'FILTER_IMPORTANT') return c.is_important;
                    return getTranslatedCategoryName(c) === selectedCategory;
                }).filter(c => {
                    // Aplicar filtro de status (pendiente/pagado/vencido)
                    if (selectedStatus === 'all') return true;
                    if (selectedStatus === 'ingresos') return c.flow_type === 'INCOME';

                    const activeTerm = getTermForPeriod(c, focusedDate);
                    const dueDay = activeTerm?.due_day_of_month ?? 1;
                    const { isPaid } = getPaymentStatus(c.id, focusedDate, dueDay);

                    // Calculate if overdue
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const dueDate = new Date(focusedDate.getFullYear(), focusedDate.getMonth(), dueDay);
                    dueDate.setHours(23, 59, 59);
                    const isOverdue = !isPaid && today > dueDate &&
                        (focusedDate.getFullYear() < today.getFullYear() ||
                         (focusedDate.getFullYear() === today.getFullYear() && focusedDate.getMonth() <= today.getMonth()));

                    if (selectedStatus === 'pagado') return isPaid;
                    if (selectedStatus === 'vencido') return isOverdue;
                    if (selectedStatus === 'pendiente') return !isPaid && !isOverdue;
                    return true;
                }).sort(performSmartSort);

                return filteredCommitments.length > 0 ? filteredCommitments.map(c => {
                    // Sync logic with desktop cells
                    const monthDate = focusedDate;
                    const term = getTermForPeriod(c, monthDate);

                    // Strict validation: Ensure term covers the current month
                    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
                    const termEnds = term?.effective_until ? new Date(term.effective_until) : null;
                    const isTermActiveInMonth = !!term && (!termEnds || termEnds >= monthStart);

                    const dueDay = term?.due_day_of_month ?? 1;
                    const { isPaid, payment: currentPayment } = getPaymentStatus(c.id, monthDate, dueDay);

                    const today = new Date();
                    const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
                    const isOverdue = isTermActiveInMonth && !isPaid && dueDate < today && monthDate <= today;

                    const daysOverdue = isOverdue
                        ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                        : 0;

                    // Prepare monthly info for CommitmentCard
                    const monthlyInfo = {
                        isPaid,
                        paymentDate: currentPayment?.payment_date
                            ? parseDateString(currentPayment.payment_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
                            : undefined,
                        dueDate: !isPaid && isTermActiveInMonth
                            ? `Vence: ${dueDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
                            : undefined,
                        daysOverdue: daysOverdue > 0 ? daysOverdue : undefined
                    };

                    return (
                        <CommitmentCard
                            key={c.id}
                            commitment={c}
                            payments={payments.get(c.id) || []}
                            mode={viewMode === 'inventory' ? 'inventory' : 'monthly'}
                            viewDate={monthDate}
                            monthlyInfo={monthlyInfo}
                            categoryName={getTranslatedCategoryName(c)}
                            formatAmount={formatClp}
                            onClick={() => {
                                // Contextual Intelligent Flow
                                if (viewMode === 'inventory') {
                                    if (onDetailCommitment) {
                                        onDetailCommitment(c);
                                    } else {
                                        onEditCommitment(c);
                                    }
                                } else {
                                    if (isTermActiveInMonth && !isPaid) {
                                        onRecordPayment(c.id, dateToPeriod(monthDate));
                                    } else if (isPaid && onDetailCommitment) {
                                        onDetailCommitment(c);
                                    } else if (onDetailCommitment) {
                                        onDetailCommitment(c);
                                    } else {
                                        onEditCommitment(c);
                                    }
                                }
                            }}
                            onEdit={() => onEditCommitment(c)}
                            onDetail={onDetailCommitment ? () => onDetailCommitment(c) : undefined}
                            onPause={() => onPauseCommitment(c)}
                            onResume={() => onResumeCommitment(c)}
                            onDelete={() => onDeleteCommitment(c.id)}
                            translateFrequency={(freq) => t(`frequency.${freq}`) || freq}
                        />
                    );
                }) : (
                    <div className="text-center py-20 px-6 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        {commitments.length === 0 ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mb-2">
                                    <Sparkles className="w-8 h-8 text-sky-500 dark:text-sky-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                        ¡Bienvenido a FinanSheet!
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6">
                                        Aún no tienes compromisos registrados. Comienza agregando tus ingresos y gastos fijos.
                                    </p>
                                    <p className="text-sm font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 py-2 px-4 rounded-full inline-block">
                                        ✨ Tip: Usa el botón "+" arriba a la derecha
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <p className="text-slate-500 dark:text-slate-400 font-medium">
                                    No hay compromisos en esta categoría
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                    Intenta seleccionar otra categoría en el filtro
                                </p>
                            </div>
                        )}
                    </div>
                )
            })()}

            {/* Archived Section (Inventory Mode Only) */}
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

                    {/* Archived Commitments */}
                    <div className="space-y-1.5 opacity-60">
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
    );
};
