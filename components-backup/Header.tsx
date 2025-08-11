

import React, { useMemo } from 'react';
import { PlusIcon, MinusIcon, DownloadIcon, MenuIcon, LanguageIcon, ChevronDownIcon, SunIcon, MoonIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { useLocalization } from '../hooks/useLocalization';

interface HeaderProps {
    focusedDate: Date;
    onDateChange: (date: Date) => void;
    onAddExpense: () => void;
    onExport: () => void;
    onToggleSidebar: () => void;
    theme: 'light' | 'dark';
    onThemeChange: (theme: 'light' | 'dark') => void;
    visibleMonthsCount: number;
    onVisibleMonthsCountChange: React.Dispatch<React.SetStateAction<number>>;
}

const Header: React.FC<HeaderProps> = ({ focusedDate, onDateChange, onAddExpense, onExport, onToggleSidebar, theme, onThemeChange, visibleMonthsCount, onVisibleMonthsCountChange }) => {
    const { language, setLanguage, t, getLocalizedMonths } = useLocalization();
    
    const handleThemeToggle = () => {
        onThemeChange(theme === 'dark' ? 'light' : 'dark');
    };

    const monthOptions = useMemo(() => getLocalizedMonths('long'), [getLocalizedMonths]);
    const currentYear = new Date().getFullYear();
    const yearOptions = useMemo(() => Array.from({ length: 21 }, (_, i) => currentYear - 10 + i), [currentYear]);

    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newDate = new Date(focusedDate);
        newDate.setDate(1); // Set to the 1st to avoid month-end issues
        newDate.setFullYear(parseInt(e.target.value, 10));
        onDateChange(newDate);
    };

    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newDate = new Date(focusedDate);
        newDate.setDate(1); // Set to the 1st to avoid month-end issues
        newDate.setMonth(parseInt(e.target.value, 10));
        onDateChange(newDate);
    };
    
    const handleMonthStep = (offset: number) => {
        const newDate = new Date(focusedDate);
        newDate.setDate(1); // Set to the 1st to avoid month-end issues
        newDate.setMonth(newDate.getMonth() + offset);
        onDateChange(newDate);
    };

    const handleYearStep = (offset: number) => {
        const newDate = new Date(focusedDate);
        newDate.setDate(1); // Set to the 1st to avoid month-end issues
        newDate.setFullYear(newDate.getFullYear() + offset);
        onDateChange(newDate);
    };

    const handleVisibleMonthsChange = (increment: number) => {
        onVisibleMonthsCountChange(prev => {
            const newValue = prev + increment;
            return Math.max(1, Math.min(newValue, 25)); // Clamp between 1 and 25
        });
    };

    return (
        <header className="p-3 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl sticky top-0 z-20 border-b border-slate-200 dark:border-slate-700/50">
            <div className="w-full mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                     <button onClick={onToggleSidebar} className="lg:hidden p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Open menu">
                        <MenuIcon />
                    </button>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight hidden sm:block">FinanSheet</h1>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button 
                            onClick={() => onDateChange(new Date())}
                            className="px-3 py-1 text-sm font-medium rounded-md transition-colors bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
                        >
                            {t('header.today')}
                        </button>
                        <div className="flex items-center">
                            <button onClick={() => handleMonthStep(-1)} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700" aria-label={t('header.prevMonth')}><ChevronLeftIcon className="w-4 h-4" /></button>
                            <select
                                value={focusedDate.getMonth()}
                                onChange={handleMonthChange}
                                className="bg-transparent dark:bg-slate-800 border-none text-slate-800 dark:text-white rounded-md font-semibold focus:ring-0 appearance-none text-center"
                                aria-label="Month selector"
                            >
                                {monthOptions.map((m, i) => <option key={i} value={i} className="font-medium bg-white dark:bg-slate-900">{m}</option>)}
                            </select>
                            <button onClick={() => handleMonthStep(1)} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700" aria-label={t('header.nextMonth')}><ChevronRightIcon className="w-4 h-4" /></button>
                        </div>
                        <div className="flex items-center">
                             <button onClick={() => handleYearStep(-1)} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700" aria-label={t('header.prevYear')}><ChevronLeftIcon className="w-4 h-4" /></button>
                             <select
                                value={focusedDate.getFullYear()}
                                onChange={handleYearChange}
                                className="bg-transparent dark:bg-slate-800 border-none text-slate-800 dark:text-white rounded-md font-semibold focus:ring-0 appearance-none text-center"
                                aria-label="Year selector"
                            >
                                {yearOptions.map(y => <option key={y} value={y} className="font-medium bg-white dark:bg-slate-900">{y}</option>)}
                            </select>
                            <button onClick={() => handleYearStep(1)} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700" aria-label={t('header.nextYear')}><ChevronRightIcon className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <div className="hidden md:flex items-center gap-3 text-sm">
                        <div className="relative">
                            <label className="sr-only">{t('header.viewMonths')}</label>
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg">
                                <button 
                                    onClick={() => handleVisibleMonthsChange(-1)} 
                                    disabled={visibleMonthsCount <= 1}
                                    className="px-2.5 py-2.5 text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-l-lg hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none transition-colors"
                                    aria-label={t('header.decreaseMonths')}
                                >
                                     <MinusIcon className="w-4 h-4" />
                                </button>
                                <div 
                                    className="px-3 py-1.5 text-center font-semibold text-sm text-slate-800 dark:text-white border-x border-slate-200 dark:border-slate-700/50"
                                    style={{ minWidth: '100px' }}
                                    aria-live="polite"
                                >
                                    {t('header.months_count', { count: visibleMonthsCount })}
                                </div>
                                <button 
                                    onClick={() => handleVisibleMonthsChange(1)}
                                    disabled={visibleMonthsCount >= 25}
                                    className="px-2.5 py-2.5 text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-r-lg hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none transition-colors"
                                    aria-label={t('header.increaseMonths')}
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="relative">
                            <label htmlFor="language-select" className="sr-only">{t('header.language')}</label>
                            <LanguageIcon className="w-5 h-5 absolute left-2 pointer-events-none text-slate-400 dark:text-slate-400 top-1/2 -translate-y-1/2"/>
                            <select 
                                id="language-select"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value as 'en' | 'es')}
                                className="bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white rounded-md py-1 pl-8 pr-8 appearance-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                            >
                                <option value="en">{t('header.english')}</option>
                                <option value="es">{t('header.spanish')}</option>
                            </select>
                            <ChevronDownIcon className="w-4 h-4 absolute right-2 pointer-events-none text-slate-400 dark:text-slate-400 top-1/2 -translate-y-1/2"/>
                        </div>

                         <button
                            onClick={handleThemeToggle}
                            className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-slate-600 dark:text-slate-300"
                            aria-label={t(theme === 'dark' ? 'header.lightMode' : 'header.darkMode')}
                        >
                            {theme === 'dark' ? <SunIcon className="w-5 h-5"/> : <MoonIcon className="w-5 h-5"/>}
                        </button>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            onClick={onExport}
                            className="flex items-center gap-2 px-2 sm:px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">{t('header.export')}</span>
                        </button>
                        <button
                            onClick={onAddExpense}
                            className="flex items-center gap-2 px-2 sm:px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 dark:hover:bg-teal-400 transition-colors text-sm font-medium text-white shadow-lg shadow-teal-500/20"
                        >
                            <PlusIcon className="w-5 h-5" />
                             <span className="hidden sm:inline">{t('header.addExpense')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;