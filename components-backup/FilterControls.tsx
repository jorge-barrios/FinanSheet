import React from 'react';
import { ExpenseType } from '../types';
import { useLocalization } from '../hooks/useLocalization';
import { SearchIcon } from './icons';

interface FilterControlsProps {
    searchTerm: string;
    onSearchTermChange: (value: string) => void;
    filterType: 'all' | ExpenseType;
    onFilterTypeChange: (value: 'all' | ExpenseType) => void;
    filterImportance: 'all' | 'important';
    onFilterImportanceChange: (value: 'all' | 'important') => void;
}

const FilterControls: React.FC<FilterControlsProps> = ({
    searchTerm,
    onSearchTermChange,
    filterType,
    onFilterTypeChange,
    filterImportance,
    onFilterImportanceChange
}) => {
    const { t } = useLocalization();

    const FilterButton = ({ label, value, activeValue, onClick }: any) => {
        const isActive = value === activeValue;
        return (
            <button
                onClick={() => onClick(value)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${isActive ? 'bg-teal-600 text-white font-semibold' : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
            >
                {label}
            </button>
        );
    };

    return (
        <div className="mb-4 flex flex-col md:flex-row gap-4 items-center p-3">
            <div className="relative w-full md:w-auto md:flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon className="text-slate-400" />
                </div>
                <input
                    type="text"
                    placeholder={t('filter.search')}
                    value={searchTerm}
                    onChange={(e) => onSearchTermChange(e.target.value)}
                    className="w-full bg-slate-200 dark:bg-slate-800 border-transparent text-slate-800 dark:text-white rounded-lg p-2 pl-10 focus:ring-2 focus:ring-teal-500 transition"
                />
            </div>

            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('filter.type')}:</span>
                <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg">
                    <FilterButton label={t('filter.all')} value="all" activeValue={filterType} onClick={onFilterTypeChange} />
                    <FilterButton label={t('form.type.fixed')} value={ExpenseType.FIXED} activeValue={filterType} onClick={onFilterTypeChange} />
                    <FilterButton label={t('form.type.variable')} value={ExpenseType.VARIABLE} activeValue={filterType} onClick={onFilterTypeChange} />
                </div>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('filter.importance')}:</span>
                 <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg">
                    <FilterButton label={t('filter.all')} value="all" activeValue={filterImportance} onClick={onFilterImportanceChange} />
                    <FilterButton label={t('filter.important')} value="important" activeValue={filterImportance} onClick={onFilterImportanceChange} />
                </div>
            </div>
        </div>
    );
};

export default FilterControls;