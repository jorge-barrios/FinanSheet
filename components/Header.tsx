import React, { useEffect, useRef, useState } from 'react';
import { DownloadIcon, MenuIcon, LanguageIcon, ChevronDownIcon, SunIcon, MoonIcon, PlusIcon, TagIcon, ArrowRightOnRectangleIcon, ArrowPathIcon } from './icons';
import { useLocalization } from '../hooks/useLocalization';
import ViewSwitcher from './ViewSwitcher';
import { View } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFeatureFlags } from '../context/FeatureFlagsContext';
import { FeatureFlagsSettings } from './FeatureFlagsSettings';

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
    const { signOut, user } = useAuth();
    const { showToast } = useToast();
    const { flags } = useFeatureFlags();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isFeatureFlagsOpen, setIsFeatureFlagsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    const handleLogout = async () => {
        const { error } = await signOut();
        if (error) {
            showToast(t('header.logoutError', 'Error al cerrar sesión'), 'error');
        } else {
            showToast(t('header.logoutSuccess', 'Sesión cerrada exitosamente'), 'success');
        }
        setIsMenuOpen(false);
    };

    const handleThemeToggle = () => {
        onThemeChange(theme === 'dark' ? 'light' : 'dark');
    };

    // Close menu on Escape and click outside
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsMenuOpen(false);
            }
        };
        const onDocClick = (e: MouseEvent) => {
            const t = e.target as Node;
            if (isMenuOpen && menuRef.current && !menuRef.current.contains(t)) setIsMenuOpen(false);
        };
        window.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDocClick);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDocClick);
        };
    }, [isMenuOpen]);

    return (
        <header className="px-3 py-2 bg-white/80 dark:bg-slate-900/75 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-200 dark:border-slate-700/60 shadow-sm" data-app-header>
            <div className="w-full mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                    <button onClick={onToggleSidebar} className="lg:hidden p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Open menu">
                        <MenuIcon />
                    </button>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight hidden md:block">FinanSheet</h1>
                    <div className="block">
                        <ViewSwitcher currentView={view} onViewChange={onViewChange} />
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Menú unificado */}
                    <div className="relative" ref={menuRef}>
                        <button
                            className="flex items-center gap-1 px-2 sm:px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-300/60 dark:border-slate-600/60"
                            aria-haspopup="menu"
                            aria-expanded={isMenuOpen}
                            aria-label={t('header.settings') || 'Abrir menú'}
                            title={t('header.settings') || 'Abrir menú'}
                            onClick={() => setIsMenuOpen(o => !o)}
                        >
                            <span className="hidden sm:inline">{t('header.settings') || 'Menú'}</span>
                            <span className="sm:hidden">
                                <MenuIcon className="w-5 h-5" />
                            </span>
                            <ChevronDownIcon className="w-4 h-4 hidden sm:block" />
                        </button>
                        {isMenuOpen && (
                            <div
                                role="menu"
                                aria-label="Menú"
                                className="absolute right-0 mt-2 w-64 rounded-md bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black/10 dark:ring-white/10 p-2 z-50"
                            >
                                {/* Sección: Configuración */}
                                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    Configuración
                                </div>

                                {/* Idioma */}
                                <div className="relative px-2 pb-2">
                                    <LanguageIcon className="w-4 h-4 absolute left-3 pointer-events-none text-slate-400 dark:text-slate-400 top-1/2 -translate-y-1/2" />
                                    <select
                                        value={language}
                                        onChange={(e) => { setLanguage(e.target.value as 'en' | 'es'); setIsMenuOpen(false); }}
                                        className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-md py-1.5 pl-8 pr-7 text-sm appearance-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                                        aria-label={t('header.language') || 'Idioma'}
                                    >
                                        <option value="en">{t('header.english')}</option>
                                        <option value="es">{t('header.spanish')}</option>
                                    </select>
                                    <ChevronDownIcon className="w-4 h-4 absolute right-3 pointer-events-none text-slate-400 dark:text-slate-400 top-1/2 -translate-y-1/2" />
                                </div>

                                {/* Tema */}
                                <button
                                    role="menuitem"
                                    onClick={() => { handleThemeToggle(); setIsMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200 transition-colors"
                                >
                                    {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                                    <span>{t(theme === 'dark' ? 'header.lightMode' : 'header.darkMode')}</span>
                                </button>

                                {/* Actualizar tasas */}
                                <button
                                    role="menuitem"
                                    onClick={() => { refresh(); }}
                                    disabled={currencyLoading}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ArrowPathIcon className={`w-5 h-5 ${currencyLoading ? 'animate-spin' : ''}`} />
                                    <div className="flex flex-col items-start flex-1">
                                        <span>{t('header.refreshRates', 'Actualizar tasas')}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {currencyLoading
                                                ? t('header.updating', 'Actualizando...')
                                                : lastUpdated
                                                    ? lastUpdated.toLocaleString(language === 'es' ? 'es-CL' : 'en-US', {
                                                        dateStyle: 'short',
                                                        timeStyle: 'short'
                                                    })
                                                    : t('header.never', 'Nunca')
                                            }
                                        </span>
                                    </div>
                                </button>

                                {/* Divisor */}
                                <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>

                                {/* Sección: Gestión */}
                                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    Gestión
                                </div>

                                {/* Categorías */}
                                <button
                                    role="menuitem"
                                    onClick={() => { onOpenCategoryManager(); setIsMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200 transition-colors"
                                >
                                    <TagIcon className="w-5 h-5" />
                                    <span>Categorías</span>
                                </button>

                                {/* Feature Flags (v2) */}
                                <button
                                    role="menuitem"
                                    onClick={() => { setIsFeatureFlagsOpen(true); setIsMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200 transition-colors"
                                >
                                    <span className="text-lg">🚀</span>
                                    <div className="flex flex-col items-start flex-1">
                                        <span>Feature Flags</span>
                                        {flags.useV2UI && (
                                            <span className="text-xs text-sky-600 dark:text-sky-400">
                                                v2 enabled
                                            </span>
                                        )}
                                    </div>
                                </button>

                                {/* Exportar */}
                                <button
                                    role="menuitem"
                                    onClick={() => { onExport(); setIsMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200 transition-colors"
                                >
                                    <DownloadIcon className="w-5 h-5" />
                                    <span>{t('header.export')}</span>
                                </button>

                                {/* User section */}
                                {user && (
                                    <>
                                        <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>

                                        {/* Sección: Cuenta */}
                                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                            Cuenta
                                        </div>

                                        <div className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-md mb-1">
                                            {user.email}
                                        </div>

                                        <button
                                            role="menuitem"
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 dark:text-red-400 transition-colors"
                                        >
                                            <ArrowRightOnRectangleIcon className="w-5 h-5" />
                                            <span>{t('header.logout', 'Cerrar sesión')}</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* CTA principal */}
                    <button
                        onClick={onAddExpense}
                        className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 dark:hover:bg-sky-400 transition-colors text-sm font-medium text-white shadow-lg shadow-sky-500/20"
                        title={t('header.addExpense') || 'Añadir gasto'}
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">{t('header.addExpense')}</span>
                    </button>
                </div>
            </div>

            {/* Feature Flags Modal */}
            <FeatureFlagsSettings
                isOpen={isFeatureFlagsOpen}
                onClose={() => setIsFeatureFlagsOpen(false)}
            />
        </header>
    );
};

export default Header;
