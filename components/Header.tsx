import React, { useEffect, useRef, useState } from 'react';
import { DownloadIcon, MenuIcon, LanguageIcon, ChevronDownIcon, SunIcon, MoonIcon, PlusIcon } from './icons';
import { useLocalization } from '../hooks/useLocalization';
import ViewSwitcher from './ViewSwitcher';
import { View } from '../types';
import { useCurrency } from '../hooks/useCurrency';

interface HeaderProps {
    onAddExpense: () => void;
    onExport: () => void;
    onToggleSidebar: () => void;
    theme: 'light' | 'dark';
    onThemeChange: (theme: 'light' | 'dark') => void;
    view: View;
    onViewChange: (view: View) => void;
    onOpenCategoryManager: () => void;
}

const Header: React.FC<HeaderProps> = ({ onAddExpense, onExport, onToggleSidebar, theme, onThemeChange, view, onViewChange, onOpenCategoryManager }) => {
    const { language, setLanguage, t } = useLocalization();
    const { lastUpdated, refresh, loading: currencyLoading } = useCurrency();
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isActionsOpen, setIsActionsOpen] = useState(false);
    const configRef = useRef<HTMLDivElement | null>(null);
    const actionsRef = useRef<HTMLDivElement | null>(null);

    const handleThemeToggle = () => {
        onThemeChange(theme === 'dark' ? 'light' : 'dark');
    };

    // Close menus on Escape and click outside
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsConfigOpen(false);
                setIsActionsOpen(false);
            }
        };
        const onDocClick = (e: MouseEvent) => {
            const t = e.target as Node;
            if (isConfigOpen && configRef.current && !configRef.current.contains(t)) setIsConfigOpen(false);
            if (isActionsOpen && actionsRef.current && !actionsRef.current.contains(t)) setIsActionsOpen(false);
        };
        window.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDocClick);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDocClick);
        };
    }, [isConfigOpen, isActionsOpen]);

    // Date/month navigation moved to grid header

    return (
        <header className="px-3 py-2 bg-white/80 dark:bg-slate-900/75 backdrop-blur-xl sticky top-0 z-30 border-b border-slate-200 dark:border-slate-700/60 shadow-sm" data-app-header>
            <div className="w-full mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                     <button onClick={onToggleSidebar} className="lg:hidden p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Open menu">
                        <MenuIcon />
                    </button>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight hidden sm:block">FinanSheet</h1>
                    <div className="block">
                        <ViewSwitcher currentView={view} onViewChange={onViewChange} />
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Currency last updated + refresh */}
                    <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                        <span>
                            {lastUpdated
                                ? `Tasas: ${lastUpdated.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })} ${lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
                                : 'Tasas: —'}
                        </span>
                        <button
                            onClick={() => refresh()}
                            className="ml-1 px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
                            title="Actualizar tasas"
                            disabled={currencyLoading}
                        >
                            {currencyLoading ? 'Actualizando…' : 'Actualizar'}
                        </button>
                    </div>
                    {/* Menú Configuración */}
                    <div className="relative" ref={configRef}>
                        <button
                            className="flex items-center gap-1 px-2 sm:px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-300/60 dark:border-slate-600/60"
                            aria-haspopup="menu"
                            aria-expanded={isConfigOpen}
                            title={t('header.settings') || 'Abrir menú de configuración'}
                            onClick={() => setIsConfigOpen(o => !o)}
                        >
                            {t('header.settings') || 'Configuración'}
                            <ChevronDownIcon className="w-4 h-4" />
                        </button>
                        {isConfigOpen && (
                            <div
                                role="menu"
                                aria-label="Configuración"
                                className="absolute right-0 mt-2 w-64 rounded-md bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black/10 dark:ring-white/10 p-2 z-40"
                            >
                                {/* Idioma */}
                                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{t('header.language') || 'Idioma'}</div>
                                <div className="relative px-2 pb-2">
                                    <LanguageIcon className="w-4 h-4 absolute left-3 pointer-events-none text-slate-400 dark:text-slate-400 top-1/2 -translate-y-1/2"/>
                                    <select
                                        value={language}
                                        onChange={(e) => { setLanguage(e.target.value as 'en' | 'es'); setIsConfigOpen(false); }}
                                        className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-md py-1 pl-8 pr-7 appearance-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                                    >
                                        <option value="en">{t('header.english')}</option>
                                        <option value="es">{t('header.spanish')}</option>
                                    </select>
                                    <ChevronDownIcon className="w-4 h-4 absolute right-3 pointer-events-none text-slate-400 dark:text-slate-400 top-1/2 -translate-y-1/2"/>
                                </div>
                                {/* Tema */}
                                <button
                                    role="menuitem"
                                    onClick={() => { handleThemeToggle(); setIsConfigOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200"
                                >
                                    {theme === 'dark' ? <SunIcon className="w-5 h-5"/> : <MoonIcon className="w-5 h-5"/>}
                                    <span>{t(theme === 'dark' ? 'header.lightMode' : 'header.darkMode')}</span>
                                </button>
                                {/* Categorías */}
                                <button
                                    role="menuitem"
                                    onClick={() => { onOpenCategoryManager(); setIsConfigOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200"
                                >
                                    <span>Categorías</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Menú Acciones */}
                    <div className="relative" ref={actionsRef}>
                        <button
                            className="flex items-center gap-1 px-2 sm:px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-300/60 dark:border-slate-600/60"
                            aria-haspopup="menu"
                            aria-expanded={isActionsOpen}
                            title={t('header.actions') || 'Abrir menú de acciones'}
                            onClick={() => setIsActionsOpen(o => !o)}
                        >
                            {t('header.actions') || 'Acciones'}
                            <ChevronDownIcon className="w-4 h-4" />
                        </button>
                        {isActionsOpen && (
                            <div
                                role="menu"
                                aria-label="Acciones"
                                className="absolute right-0 mt-2 w-56 rounded-md bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black/10 dark:ring-white/10 p-2 z-40"
                            >
                                <button
                                    role="menuitem"
                                    onClick={() => { onExport(); setIsActionsOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200"
                                >
                                    <DownloadIcon className="w-5 h-5" />
                                    <span>{t('header.export')}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* CTA principal */}
                    <button
                        onClick={onAddExpense}
                        className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 dark:hover:bg-teal-400 transition-colors text-sm font-medium text-white shadow-lg shadow-teal-500/20"
                        title={t('header.addExpense') || 'Añadir gasto'}
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">{t('header.addExpense')}</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;