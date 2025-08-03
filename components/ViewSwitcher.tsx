
import React from 'react';
import { View } from '../types';
import { useLocalization } from '../hooks/useLocalization';
import { CalendarIcon, ChartBarIcon, IconProps } from './icons';

interface ViewSwitcherProps {
    currentView: View;
    onViewChange: (view: View) => void;
}

const TableIcon: React.FC<IconProps> = ({className = "w-5 h-5"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125V5.625c0-.621.504-1.125 1.125-1.125h17.25c.621 0 1.125.504 1.125 1.125v12.75c0 .621-.504 1.125-1.125 1.125m-17.25 0h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm3 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm3 6h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm3 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm3 6h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Z" />
    </svg>
);


const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ currentView, onViewChange }) => {
    const { t } = useLocalization();

    const views: { id: View; label: string, icon: React.FC<IconProps> }[] = [
        { id: 'table', label: t('viewSwitcher.table'), icon: TableIcon },
        { id: 'graph', label: t('viewSwitcher.graph'), icon: ChartBarIcon },
        { id: 'calendar', label: t('viewSwitcher.calendar'), icon: CalendarIcon },
    ];

    return (
        <div className="mb-4">
            <div className="inline-flex items-center bg-slate-200 dark:bg-slate-800 rounded-lg p-1 space-x-1">
                {views.map(view => {
                     const isActive = view.id === currentView;
                     const IconComponent = view.icon;
                     return (
                        <button
                            key={view.id}
                            onClick={() => onViewChange(view.id)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-200 dark:focus-visible:ring-offset-slate-800 ${
                                isActive 
                                ? 'bg-teal-600 text-white shadow' 
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-700/50'
                            }`}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <IconComponent className="w-5 h-5" />
                            {view.label}
                        </button>
                     );
                })}
            </div>
        </div>
    );
};

export default ViewSwitcher;