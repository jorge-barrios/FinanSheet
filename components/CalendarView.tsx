import React from 'react';
import { CalendarIcon } from './icons';
import { useLocalization } from '../hooks/useLocalization';
import { Expense, PaymentStatus } from '../types';

interface CalendarViewProps {
    expenses: Expense[];
    paymentStatus: PaymentStatus;
    displayYear: number;
}

const CalendarView: React.FC<CalendarViewProps> = () => {
    const { t } = useLocalization();

    return (
        <div className="px-4 py-16 flex flex-col items-center justify-center text-center h-full">
             <div className="p-6 bg-slate-200 dark:bg-slate-800/50 rounded-full mb-6 ring-1 ring-slate-300 dark:ring-slate-700">
                <CalendarIcon className="w-16 h-16 text-teal-500 dark:text-teal-400/80" />
            </div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">{t('viewSwitcher.calendar')}</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">A monthly calendar view of your due dates is in the works. Keep an eye out for this feature to better visualize your payment schedule!</p>
        </div>
    );
};

export default CalendarView;