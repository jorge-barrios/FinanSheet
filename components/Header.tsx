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
    theme: 'light' | 'dark';
    onThemeChange: (theme: 'light' | 'dark') => void;
    view: View;
    onViewChange: (view: View) => void;
    onOpenCategoryManager: () => void;
}

const Header: React.FC<HeaderProps> = ({ onAddExpense, onExport, theme, onThemeChange, view, onViewChange, onOpenCategoryManager }) => {
    const { language, setLanguage, t } = useLocalization();
    const { lastUpdated, refresh, loading: currencyLoading } = useCurrency();
    const { signOut, user } = useAuth();
    const { showToast } = useToast();
    const { flags } = useFeatureFlags();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isFeatureFlagsOpen, setIsFeatureFlagsOpen] = useState(false);
    // Color theme state (Claridad Celestial vs Ocean Teal)
    const [colorTheme, setColorTheme] = useState<'identidad' | 'ocean-teal'>('identidad');

    // Load color theme from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const html = document.documentElement;
            const saved = localStorage.getItem('finansheet-color-theme') as 'identidad' | 'ocean-teal' | null;
            const themeToApply = saved || 'identidad';
            setColorTheme(themeToApply);

            // Apply the theme class
            html.classList.remove('theme-identidad', 'theme-ocean-teal');
            html.classList.add(`theme-${themeToApply}`);
        }
    }, []);

    const handleColorThemeToggle = () => {
        const newTheme = colorTheme === 'identidad' ? 'ocean-teal' : 'identidad';
        setColorTheme(newTheme);
        const html = document.documentElement;
        html.classList.remove('theme-identidad', 'theme-ocean-teal');
        html.classList.add(`theme-${newTheme}`);
        localStorage.setItem('finansheet-color-theme', newTheme);
    };

    // Legacy state removed
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
        <header
            className="px-3 py-2 bg-white/80 dark:bg-slate-900/75 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-200 dark:border-slate-700/60 shadow-sm"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
            data-app-header
        >
            <div className="w-full mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight hidden md:block">FinanSheet</h1>
                    <div className="block">
                        <ViewSwitcher currentView={view} onViewChange={onViewChange} />
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Menú unificado */}
                    <div className="relative" ref={menuRef}>
                        <button
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm"
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
                            <ChevronDownIcon className="w-4 h-4 hidden sm:block opacity-50" />
                        </button>
                        {isMenuOpen && (
                            <div
                                role="menu"
                                aria-label="Menú"
                                className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 shadow-xl ring-1 ring-slate-200 dark:ring-slate-800 p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                            >
                                {/* Sección: Configuración */}
                                <div className="px-2 py-1.5 text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    Configuración
                                </div>

                                {/* Idioma */}
                                <div className="relative px-2 pb-2">
                                    <LanguageIcon className="w-4 h-4 absolute left-3 pointer-events-none text-slate-400 dark:text-slate-400 top-1/2 -translate-y-1/2" />
                                    <select
                                        value={language}
                                        onChange={(e) => { setLanguage(e.target.value as 'en' | 'es'); setIsMenuOpen(false); }}
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-200 rounded-xl py-2 pl-9 pr-8 text-sm font-medium appearance-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none"
                                        aria-label={t('header.language') || 'Idioma'}
                                    >
                                        <option value="en">{t('header.english')}</option>
                                        <option value="es">{t('header.spanish')}</option>
                                    </select>
                                    <ChevronDownIcon className="w-4 h-4 absolute right-3 pointer-events-none text-slate-400 dark:text-slate-400 top-1/2 -translate-y-1/2" />
                                </div>

                                {/* Tema claro/oscuro */}
                                <button
                                    role="menuitem"
                                    onClick={() => { handleThemeToggle(); setIsMenuOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
                                >
                                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                        {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
                                    </div>
                                    <span>{t(theme === 'dark' ? 'header.lightMode' : 'header.darkMode')}</span>
                                </button>

                                {/* Selector de tema de color */}
                                <div className="px-2 py-1.5 text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    Tema de Color
                                </div>
                                <button
                                    role="menuitem"
                                    onClick={() => { if (colorTheme !== 'identidad') handleColorThemeToggle(); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${colorTheme === 'identidad' ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${colorTheme === 'identidad' ? 'border-sky-500 bg-sky-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                        {colorTheme === 'identidad' && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                    </div>
                                    <span>Claridad Celestial</span>
                                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">Sky Blue</span>
                                </button>
                                <button
                                    role="menuitem"
                                    onClick={() => { if (colorTheme !== 'ocean-teal') handleColorThemeToggle(); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${colorTheme === 'ocean-teal' ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${colorTheme === 'ocean-teal' ? 'border-teal-500 bg-teal-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                        {colorTheme === 'ocean-teal' && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                    </div>
                                    <span>Ocean Teal</span>
                                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">Teal</span>
                                </button>



                                {/* Actualizar tasas */}
                                <button
                                    role="menuitem"
                                    onClick={() => { refresh(); }}
                                    disabled={currencyLoading}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-emerald-500 transition-colors">
                                        <ArrowPathIcon className={`w-4 h-4 ${currencyLoading ? 'animate-spin' : ''}`} />
                                    </div>
                                    <div className="flex flex-col items-start flex-1">
                                        <span className="leading-tight">{t('header.refreshRates', 'Actualizar tasas')}</span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
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
                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2"></div>

                                {/* Sección: Gestión */}
                                <div className="px-2 py-1.5 text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    Gestión
                                </div>

                                {/* Categorías */}
                                <button
                                    role="menuitem"
                                    onClick={() => { onOpenCategoryManager(); setIsMenuOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors group"
                                >
                                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors">
                                        <TagIcon className="w-4 h-4" />
                                    </div>
                                    <span>Categorías</span>
                                </button>

                                {/* Feature Flags (v2) */}
                                <button
                                    role="menuitem"
                                    onClick={() => { setIsFeatureFlagsOpen(true); setIsMenuOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
                                >
                                    <div className="flex items-center justify-center w-7 h-7 text-lg">🚀</div>
                                    <div className="flex flex-col items-start flex-1">
                                        <span className="leading-tight">Feature Flags</span>
                                        {flags.useV2UI && (
                                            <span className="text-[10px] font-bold text-sky-500 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 px-1.5 py-0.5 rounded-full mt-0.5">
                                                v2 enabled
                                            </span>
                                        )}
                                    </div>
                                </button>

                                {/* Exportar */}
                                <button
                                    role="menuitem"
                                    onClick={() => { onExport(); setIsMenuOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors group"
                                >
                                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 transition-colors">
                                        <DownloadIcon className="w-4 h-4" />
                                    </div>
                                    <span>{t('header.export')}</span>
                                </button>

                                {/* User section */}
                                {user && (
                                    <>
                                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2"></div>

                                        {/* Sección: Cuenta */}
                                        <div className="px-2 py-1.5 text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                            Cuenta
                                        </div>

                                        <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg mx-2 mb-1 truncate">
                                            {user.email}
                                        </div>

                                        <button
                                            role="menuitem"
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/10 text-sm font-bold text-rose-600 dark:text-rose-400 transition-colors group"
                                        >
                                            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/30 transition-colors">
                                                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                                            </div>
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
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm font-bold text-white shadow-md shadow-sky-600/20"
                        title={t('header.addExpense') || 'Añadir gasto'}
                    >
                        <PlusIcon className="w-5 h-5 stroke-[2.5]" />
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
