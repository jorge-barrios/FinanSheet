
import React from 'react';
import { View } from '../types';
import { useLocalization } from '../hooks/useLocalization';
import { useFeatureFlags } from '../context/FeatureFlagsContext';
import { CalendarIcon, ChartBarIcon, IconProps } from './icons';

interface ViewSwitcherProps {
    currentView: View;
    onViewChange: (view: View) => void;
}

const TableIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125V5.625c0-.621.504-1.125 1.125-1.125h17.25c.621 0 1.125.504 1.125 1.125v12.75c0 .621-.504 1.125-1.125 1.125m-17.25 0h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm3 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm3 6h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm3 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm3 6h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Z" />
    </svg>
);


const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ currentView, onViewChange }) => {
    const { t } = useLocalization();
    const { flags } = useFeatureFlags();

    const dashboardLabel = (() => {
        const k = t('viewSwitcher.dashboard');
        return k === 'viewSwitcher.dashboard' ? 'Dashboard' : k;
    })();

    const allViews: { id: View; label: string, icon: React.FC<IconProps> }[] = [
        { id: 'table', label: t('viewSwitcher.table'), icon: TableIcon },
        { id: 'graph', label: dashboardLabel, icon: ChartBarIcon },
        { id: 'calendar', label: t('viewSwitcher.calendar'), icon: CalendarIcon },
    ];

    // Hide calendar when v2 dashboard is enabled
    const views = flags.useV2Dashboard
        ? allViews.filter(v => v.id !== 'calendar')
        : allViews;

    return (
        <div>
            <div className="inline-flex items-center bg-slate-200/70 dark:bg-slate-800/70 rounded-lg p-1 space-x-1 ring-1 ring-slate-300/60 dark:ring-slate-700/60">
                {views.map(view => {
                    const isActive = view.id === currentView;
                    const IconComponent = view.icon;
                    return (
                        <button
                            key={view.id}
                            onClick={() => onViewChange(view.id)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-200 dark:focus-visible:ring-offset-slate-800 ${isActive
                                    ? 'bg-sky-600 text-white shadow'
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