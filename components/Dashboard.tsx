import React, { useMemo } from 'react';
import { Expense, PaymentStatus } from '../types';
import { useLocalization } from '../hooks/useLocalization';
import { isInstallmentInMonth } from '../utils/expenseCalculations';
import { getCategoryIcon } from './ExpenseGrid';
import { XMarkIcon, Cog6ToothIcon } from './icons';



interface DashboardProps {
    expenses: Expense[];
    paymentStatus: PaymentStatus;
    displayYear: number;
    isOpen: boolean;
    onClose: () => void;
    onOpenCategoryManager: () => void;
}

const stringToHslColor = (str: string, s: number, l: number) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, ${s}%, ${l}%)`;
};


const Dashboard: React.FC<DashboardProps> = ({ expenses, paymentStatus, displayYear, isOpen, onClose, onOpenCategoryManager }) => {
        const { t, formatClp } = useLocalization();

    const summary = useMemo(() => {
        let totalAnnualAmountInBase = 0;
        let totalPaidAmountInBase = 0;
        const categoryTotalsInBase: Record<string, number> = {};

        expenses.forEach(expense => {
            const category = expense.category || t('grid.uncategorized');
            if (!categoryTotalsInBase[category]) {
                categoryTotalsInBase[category] = 0;
            }

            for (let month = 0; month < 12; month++) {
                if (isInstallmentInMonth(expense, displayYear, month)) {
                    const paymentDetails = paymentStatus[expense.id]?.[`${displayYear}-${month}`];
                                                                                const installmentAmount = (expense.amountInClp || 0) / (expense.installments || 1);
                    const amountInBase = paymentDetails?.overriddenAmount ?? installmentAmount;
                    
                    totalAnnualAmountInBase += amountInBase;
                    categoryTotalsInBase[category] += amountInBase;

                    if (paymentDetails?.paid) {
                        totalPaidAmountInBase += amountInBase;
                    }
                }
            }
        });

        const sortedCategories = Object.entries(categoryTotalsInBase)
            .sort(([, a], [, b]) => b - a)
            .map(([name, totalInBase]) => ({
                name,
                totalInBase,
                percentage: totalAnnualAmountInBase > 0 ? (totalInBase / totalAnnualAmountInBase) * 100 : 0,
            }));

        return {
            totalAnnualAmountInBase,
            totalPaidAmountInBase,
            totalPendingAmountInBase: totalAnnualAmountInBase - totalPaidAmountInBase,
            paidPercentage: totalAnnualAmountInBase > 0 ? (totalPaidAmountInBase / totalAnnualAmountInBase) * 100 : 0,
            categories: sortedCategories,
        };
    }, [expenses, paymentStatus, displayYear, t]);



    const dashboardContent = (
        <>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('dashboard.title')}</h2>
                 <button onClick={onClose} className="lg:hidden p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white" aria-label={t('mobile.closeMenu')}>
                    <XMarkIcon />
                </button>
            </div>

            {/* Annual Summary */}
            <div className="bg-slate-100 dark:bg-slate-900/70 p-4 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700/50">
                <div className="flex justify-between items-baseline mb-2">
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t('dashboard.totalAnnual')}</span>
                    <span className="text-2xl font-bold font-mono text-slate-800 dark:text-white">{formatClp(summary.totalAnnualAmountInBase)}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-4">
                    <div className="bg-teal-500 h-2.5 rounded-full" style={{ width: `${summary.paidPercentage}%` }}></div>
                </div>
                <div className="flex justify-between text-sm">
                    <div>
                        <div className="text-slate-500 dark:text-slate-400">{t('dashboard.paid')}</div>
                        <div className="font-mono text-green-600 dark:text-green-400">{formatClp(summary.totalPaidAmountInBase)}</div>
                    </div>
                     <div className="text-right">
                        <div className="text-slate-500 dark:text-slate-400">{t('dashboard.pending')}</div>
                        <div className="font-mono text-amber-600 dark:text-amber-500">{formatClp(summary.totalPendingAmountInBase)}</div>
                    </div>
                </div>
            </div>


            {/* Category Breakdown */}
            <div className="mt-6">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">{t('dashboard.byCategory')}</h3>
                    <button 
                        onClick={onOpenCategoryManager}
                        className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800"
                        aria-label={t('dashboard.manageCategories')}
                    >
                        <Cog6ToothIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('dashboard.manageCategories')}</span>
                    </button>
                </div>
                <div className="space-y-4 max-h-[calc(100vh-500px)] overflow-y-auto pr-2">
                    {summary.categories.length > 0 ? summary.categories.map(cat => (
                        <div key={cat.name} className="text-sm group">
                            <div className="flex justify-between items-center mb-1.5">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                    {getCategoryIcon(cat.name)}
                                    <span>{cat.name}</span>
                                </div>
                                <span className="font-mono text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{formatClp(cat.totalInBase)}</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: stringToHslColor(cat.name, 60, 50) }}></div>
                            </div>
                        </div>
                    )) : (
                        <p className="text-slate-500 dark:text-slate-500 text-center py-4 text-sm">{t('grid.noMatch')}</p>
                    )}
                </div>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 bg-black bg-opacity-60 z-40 transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
                aria-hidden="true"
            ></div>
            <aside className={`fixed top-0 left-0 h-full bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl border-r border-slate-200 dark:border-slate-700/50 w-72 p-4 text-slate-800 dark:text-slate-200 z-50 transition-transform lg:static lg:bg-transparent lg:dark:bg-slate-950/70 lg:translate-x-0 lg:w-80 lg:shrink-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {dashboardContent}
            </aside>
        </>
    );
};

export default Dashboard;
