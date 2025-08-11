import React, { useMemo } from 'react';
import { Expense, PaymentStatus } from '../types';
import { useLocalization } from '../hooks/useLocalization';
import ExpenseCard from './ExpenseCard';

interface ExpenseGridVirtualProps {
    expenses: Expense[];
    paymentStatus: PaymentStatus;
    focusedDate: Date;
    onEditExpense: (expense: Expense) => void;
    onDeleteExpense: (expenseId: string) => void;
    onOpenCellEditor: (expenseId: string, year: number, month: number) => void;
    onFocusedDateChange?: (date: Date) => void;
}

const ExpenseGridVirtual: React.FC<ExpenseGridVirtualProps> = ({
    expenses,
    paymentStatus,
    focusedDate,
    onEditExpense,
    onDeleteExpense,
    onOpenCellEditor
}) => {
    const { t } = useLocalization();

    // Generar meses visibles centrados en focusedDate
    const visibleMonths = useMemo(() => {
        const months = [];
        const startDate = new Date(focusedDate);
        startDate.setMonth(startDate.getMonth() - 2); // 2 meses antes
        startDate.setDate(1);

        for (let i = 0; i < 5; i++) { // 5 meses total
            const monthDate = new Date(startDate);
            monthDate.setMonth(startDate.getMonth() + i);
            months.push(monthDate);
        }
        return months;
    }, [focusedDate]);

    // Agrupar gastos por categoría
    const groupedExpenses = useMemo(() => {
        const groups: { [category: string]: Expense[] } = {};
        expenses.forEach(expense => {
            if (!groups[expense.category]) {
                groups[expense.category] = [];
            }
            groups[expense.category].push(expense);
        });
        return Object.entries(groups).map(([category, categoryExpenses]) => ({
            category,
            expenses: categoryExpenses
        }));
    }, [expenses]);

    const formatClp = (amount: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const getMonthName = (date: Date) => {
        return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    const isCurrentMonth = (date: Date) => {
        const today = new Date();
        return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    };

    return (
        <div className="px-4 pb-8">
            {/* Vista móvil */}
            <div className="lg:hidden space-y-4">
                {expenses.length > 0 ? expenses.map(expense => (
                    <ExpenseCard
                        key={expense.id}
                        expense={expense}
                        paymentStatus={paymentStatus}
                        currentYear={new Date().getFullYear()}
                        onEditExpense={onEditExpense}
                        onDeleteExpense={onDeleteExpense}
                        onOpenCellEditor={onOpenCellEditor}
                    />
                )) : (
                    <div className="text-center py-16 text-slate-500">
                        <p className="text-lg">{t('grid.noMatch')}</p>
                    </div>
                )}
            </div>

            {/* Vista desktop simplificada - SIN navegación duplicada */}
            <div className="hidden lg:block">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden">
                    {/* Header simple sin navegación */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Grilla de Gastos
                            </h2>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                Vista centrada en mes actual • 5 meses
                            </div>
                        </div>
                    </div>
                    
                    {/* Grilla con altura optimizada */}
                    <div className="relative">
                        <div 
                            className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent"
                            style={{ height: `${Math.min(350, Math.max(200, groupedExpenses.length * 60 + 80))}px` }}
                        >
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                                    <tr>
                                        {/* Columna de categorías sticky */}
                                        <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 text-left p-4 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 min-w-[200px]">
                                            Categoría / Gasto
                                        </th>
                                        
                                        {/* Headers de meses */}
                                        {visibleMonths.map((month, index) => (
                                            <th 
                                                key={index}
                                                className={`text-center p-4 font-semibold border-r border-slate-200 dark:border-slate-700 last:border-r-0 min-w-[160px] ${
                                                    isCurrentMonth(month) 
                                                        ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-l-4 border-l-teal-500' 
                                                        : 'text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                <div className="space-y-1">
                                                    <div className="text-sm font-medium capitalize">
                                                        {month.toLocaleDateString('es-ES', { month: 'long' })}
                                                    </div>
                                                    <div className="text-xs opacity-75">
                                                        {month.getFullYear()}
                                                    </div>
                                                    {isCurrentMonth(month) && (
                                                        <div className="text-xs font-bold text-teal-600 dark:text-teal-400">
                                                            Actual
                                                        </div>
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedExpenses.map(({ category, expenses: categoryExpenses }) => (
                                        <React.Fragment key={category}>
                                            {/* Fila de categoría */}
                                            <tr className="bg-slate-100 dark:bg-slate-800/50">
                                                <td 
                                                    colSpan={visibleMonths.length + 1}
                                                    className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-800/50 p-3 font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700"
                                                >
                                                    {category}
                                                </td>
                                            </tr>
                                            
                                            {/* Filas de gastos */}
                                            {categoryExpenses.map(expense => (
                                                <tr key={expense.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                    {/* Nombre del gasto */}
                                                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/30 p-4 border-r border-slate-200 dark:border-slate-700">
                                                        <div className="font-medium text-slate-900 dark:text-white">
                                                            {expense.name}
                                                        </div>
                                                        <div className="text-sm text-slate-500 dark:text-slate-400">
                                                            {expense.type === 'RECURRING' && '🔄 Recurrente'}
                                                            {expense.type === 'INSTALLMENT' && '📅 Cuotas'}
                                                            {expense.type === 'VARIABLE' && '📊 Variable'}
                                                        </div>
                                                    </td>
                                                    
                                                    {/* Columnas de meses */}
                                                    {visibleMonths.map((month, monthIndex) => {
                                                        const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
                                                        const payment = paymentStatus[expense.id]?.[monthKey];
                                                        
                                                        return (
                                                            <td 
                                                                key={monthIndex}
                                                                className="text-center p-4 border-r border-slate-200 dark:border-slate-700 last:border-r-0"
                                                            >
                                                                {payment ? (
                                                                    <div className="space-y-1">
                                                                        <div className="font-semibold text-slate-900 dark:text-white">
                                                                            {formatClp(payment.amount)}
                                                                        </div>
                                                                        <div className={`text-xs px-2 py-1 rounded ${
                                                                            payment.status === 'paid' 
                                                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                                                : payment.status === 'overdue'
                                                                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                                                                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                                                        }`}>
                                                                            {payment.status === 'paid' && '✓ Pagado'}
                                                                            {payment.status === 'overdue' && '⚠ Atrasado'}
                                                                            {payment.status === 'pending' && '⏳ Pendiente'}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-slate-400 dark:text-slate-500">
                                                                        <button 
                                                                            onClick={() => onOpenCellEditor(expense.id, month.getFullYear(), month.getMonth())}
                                                                            className="w-8 h-8 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-teal-500 dark:hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors flex items-center justify-center text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    {/* Footer simplificado */}
                    <div className="p-3 text-center text-sm text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
                        <div className="text-xs">
                            Navegación controlada desde el header principal
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpenseGridVirtual;
