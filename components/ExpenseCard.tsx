import React from 'react';
import { Expense, PaymentStatus } from '../types';
import { useLocalization } from '../hooks/useLocalization';
import { getInstallmentAmount, isInstallmentInMonth } from '../utils/expenseCalculations';
import { EditIcon, TrashIcon, StarIcon } from './icons';
import { getCategoryIcon } from '../utils/categoryIcons';

interface ExpenseCardProps {
    expense: Expense;
    paymentStatus: PaymentStatus;
    currentYear: number;
    onEditExpense: (expense: Expense) => void;
    onDeleteExpense: (expenseId: string) => void;
    onOpenCellEditor: (expenseId: string, year: number, month: number) => void;
}

const ExpenseCard: React.FC<ExpenseCardProps> = ({ expense, paymentStatus, currentYear, onEditExpense, onDeleteExpense, onOpenCellEditor }) => {
    const { formatClp } = useLocalization();
    const currentMonth = new Date().getMonth();

    const isInCurrentMonth = isInstallmentInMonth(expense, currentYear, currentMonth);
    const paymentDetails = isInCurrentMonth ? paymentStatus[expense.id]?.[`${currentYear}-${currentMonth}`] : undefined;
    const amountInBase = paymentDetails?.overriddenAmount ?? getInstallmentAmount(expense);
    const isPaid = paymentDetails?.paid ?? false;
    const dueDate = paymentDetails?.overriddenDueDate ?? expense.dueDate;


    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDateForMonth = new Date(currentYear, currentMonth, dueDate);
    const isOverdue = !isPaid && dueDateForMonth < today;

    // Enhanced status text with days calculation (same logic as desktop)
    const getPaymentStatusInfo = () => {
        if (isPaid && paymentDetails?.paymentDate) {
            const paymentDate = new Date(paymentDetails.paymentDate);
            const wasOnTime = paymentDate <= dueDateForMonth;
            const formattedDate = paymentDate.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return {
                text: `Pagado ${formattedDate}`,
                showStar: wasOnTime,
                color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
            };
        } else if (isOverdue) {
            const daysOverdue = Math.floor((today.getTime() - dueDateForMonth.getTime()) / (1000 * 60 * 60 * 24));
            return {
                text: `Atrasado (${daysOverdue} día${daysOverdue !== 1 ? 's' : ''})`,
                showStar: false,
                color: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
            };
        } else {
            // Only show status for current month (same logic as desktop)
            const isCurrentMonthNow = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
            if (isCurrentMonthNow) {
                const daysUntilDue = Math.floor((dueDateForMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const text = daysUntilDue >= 0
                    ? `Pendiente (${daysUntilDue} día${daysUntilDue !== 1 ? 's' : ''} restantes)`
                    : `Pendiente`;
                return {
                    text,
                    showStar: false,
                    color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                };
            } else {
                // For future months, return null to not show status
                return null;
            }
        }
    };

    const statusInfo = getPaymentStatusInfo();

    const handleCardClick = (e: React.MouseEvent) => {
        // Prevent click from firing when pressing buttons inside the card
        if ((e.target as HTMLElement).closest('button')) {
            return;
        }
        if (isInCurrentMonth) {
            onOpenCellEditor(expense.id, currentYear, currentMonth);
        }
    };

    return (
        <div
            className={`p-4 rounded-xl flex flex-col justify-between transition-all duration-300 ease-out
                ${expense.isImportant
                    ? 'bg-fuchsia-50/90 dark:bg-fuchsia-900/20 ring-1 ring-fuchsia-500/20'
                    : 'bg-white/90 dark:bg-slate-800/60'
                }
                backdrop-blur-md border border-white/50 dark:border-white/5
                shadow-sm dark:shadow-xl dark:shadow-slate-900/20
                hover:shadow-md dark:hover:shadow-slate-900/40
                hover:scale-[1.02] active:scale-[0.98]
                ring-1 ring-transparent hover:ring-sky-500/50
            `}
            onClick={handleCardClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(e as any); }}
            aria-label={`Edit payment for ${expense.name} in the current month`}
        >
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="font-bold dark:text-white text-slate-800 text-lg">{expense.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        {getCategoryIcon(expense.category)}
                        <span>{expense.category}</span>
                    </div>
                </div>
                <div className="flex items-center">
                    <button onClick={(e) => { e.stopPropagation(); onEditExpense(expense); }} aria-label={`Edit ${expense.name}`} className="text-slate-500 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50"><EditIcon /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteExpense(expense.id); }} aria-label={`Delete ${expense.name}`} className="text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50"><TrashIcon /></button>
                </div>
            </div>

            <div className="flex justify-between items-center mt-2">
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatClp(amountInBase)}
                </span>
                {isInCurrentMonth ? (
                    statusInfo ? (
                        <div className="flex items-center gap-1">
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>
                                {statusInfo.text}
                            </span>
                            {statusInfo.showStar && (
                                <StarIcon className="w-4 h-4 text-yellow-500" />
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center">
                            <span className="px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-500 rounded-full bg-slate-200 dark:bg-slate-700">
                                N/A
                            </span>
                        </div>
                    )
                ) : (
                    <div className="flex items-center">
                        <span className="px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-500 rounded-full bg-slate-200 dark:bg-slate-700">
                            N/A
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExpenseCard;