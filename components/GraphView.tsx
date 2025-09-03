import React from 'react';
import { ChartBarIcon } from './icons';
import { useLocalization } from '../hooks/useLocalization';
import { Expense, PaymentStatus } from '../types';

interface GraphViewProps {
    expenses: Expense[];
    paymentStatus: PaymentStatus;
    displayYear: number;
}

const GraphView: React.FC<GraphViewProps> = () => {
    const { t } = useLocalization();

    return (
        <div className="px-4 py-16 flex flex-col items-center justify-center text-center h-full">
            <div className="p-6 bg-slate-200 dark:bg-slate-800/50 rounded-full mb-6 ring-1 ring-slate-300 dark:ring-slate-700">
                <ChartBarIcon className="w-16 h-16 text-teal-500 dark:text-teal-400/80" />
            </div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">{t('viewSwitcher.graph')}</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">A dynamic graphical representation of your expenses is under development. Stay tuned for insightful charts and visualizations!</p>
        </div>
    );
};

export default GraphView;