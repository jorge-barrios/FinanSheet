import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, MenuIcon, PlusIcon, HomeIcon, MagnifyingGlassIcon } from './icons';
import { View } from '../types';

interface MobileControlBarProps {
    view: View;
    focusedDate: Date;
    onDateChange: (date: Date) => void;
    onMenuOpen: () => void;
    onAddExpense: () => void;
    onSearch?: (term: string) => void;
    searchTerm?: string;
}

const MobileControlBar: React.FC<MobileControlBarProps> = ({
    view,
    focusedDate,
    onDateChange,
    onMenuOpen,
    onAddExpense,
    onSearch,
    searchTerm = ''
}) => {
    // Current Month Label
    const monthLabel = focusedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const capitalizedLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

    const handlePrevMonth = () => {
        const d = new Date(focusedDate);
        d.setMonth(d.getMonth() - 1);
        onDateChange(d);
    };

    const handleNextMonth = () => {
        const d = new Date(focusedDate);
        d.setMonth(d.getMonth() + 1);
        onDateChange(d);
    };

    const handleCurrentMonth = () => {
        onDateChange(new Date());
    };

    return (
        <div className="lg:hidden px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 sticky top-[57px] z-40 shadow-sm transition-all duration-300">
            {/* Left: Menu Button */}
            <button
                onClick={onMenuOpen}
                className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-colors"
                aria-label="Menú"
            >
                <MenuIcon className="w-6 h-6" />
            </button>

            {/* Center: Context (Date Picker or Search) */}
            <div className="flex-1 flex justify-center max-w-[240px] mx-auto">
                {view === 'inventory' ? (
                    /* Inventory Mode: Search Input */
                    <div className="relative w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => onSearch && onSearch(e.target.value)}
                            placeholder="Filtrar..."
                            className="block w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all"
                        />
                    </div>
                ) : (
                    /* Dashboard/Table Mode: Date Picker */
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                        <button
                            onClick={handleCurrentMonth}
                            className={`p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-700 transition-all ${focusedDate.getMonth() === new Date().getMonth() && focusedDate.getFullYear() === new Date().getFullYear()
                                    ? 'text-indigo-500 bg-white dark:bg-slate-700 shadow-sm'
                                    : ''
                                }`}
                        >
                            <HomeIcon className="w-4 h-4" />
                        </button>

                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                        <button
                            onClick={handlePrevMonth}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                        </button>

                        <span className="mx-2 text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[80px] text-center capitalize truncate">
                            {capitalizedLabel}
                        </span>

                        <button
                            onClick={handleNextMonth}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                        >
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Right: Add Button */}
            <button
                onClick={onAddExpense}
                className="p-2 -mr-2 text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                aria-label="Agregar"
            >
                <PlusIcon className="w-6 h-6" />
            </button>
        </div>
    );
};

export default MobileControlBar;
