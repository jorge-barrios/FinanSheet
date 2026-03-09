import React, { useEffect, useRef, useState } from 'react';
import { DownloadIcon, MenuIcon, LanguageIcon, ChevronDownIcon, SunIcon, MoonIcon, PlusIcon, TagIcon, ArrowRightOnRectangleIcon, ArrowPathIcon, SearchIcon } from './icons';
import { useLocalization } from '../hooks/useLocalization';
import ViewSwitcher from './ViewSwitcher';
import { View } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFeatureFlags } from '../context/FeatureFlagsContext';
import { FeatureFlagsSettings } from './FeatureFlagsSettings';
import { ProfileSettingsModal } from './ProfileSettingsModal';

interface HeaderProps {
    onAddExpense: () => void;
    onExport: () => void;
    theme: 'light' | 'dark';
    onThemeChange: (theme: 'light' | 'dark') => void;
    view: View;
    onViewChange: (view: View) => void;
    onOpenCategoryManager: () => void;
    onToggleMobileFilters?: () => void;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onAddExpense, onExport, theme, onThemeChange, view, onViewChange, onOpenCategoryManager, onToggleMobileFilters, searchQuery = '', onSearchChange }) => {
    const { language, setLanguage, t } = useLocalization();
    const { lastUpdated, refresh, loading: currencyLoading } = useCurrency();
    const { signOut, user } = useAuth();
    const { showToast } = useToast();
    const { flags } = useFeatureFlags();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isFeatureFlagsOpen, setIsFeatureFlagsOpen] = useState(false);
    const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
    // Color theme state (Ocean Teal is now default)
    const [colorTheme, setColorTheme] = useState<'identidad' | 'ocean-teal'>('ocean-teal');

    // Load color theme from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const html = document.documentElement;
            const saved = localStorage.getItem('finansheet-color-theme') as 'identidad' | 'ocean-teal' | null;
            const themeToApply = saved || 'ocean-teal';
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
    const userMenuRef = useRef<HTMLDivElement | null>(null);

    const handleLogout = async () => {
        const { error } = await signOut();
        if (error) {
            showToast(t('header.logoutError', 'Error al cerrar sesión'), 'error');
        } else {
            showToast(t('header.logoutSuccess', 'Sesión cerrada exitosamente'), 'success');
        }
        setIsMenuOpen(false);
        setIsUserMenuOpen(false);
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
            if (isUserMenuOpen && userMenuRef.current && !userMenuRef.current.contains(t)) setIsUserMenuOpen(false);
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
            className="px-3 py-2 bg-white/80 dark:bg-slate-900/75 backdrop-blur-xl sticky top-0 z-[110] border-b border-slate-200 dark:border-slate-700/60 shadow-sm"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
            data-app-header
        >
            <div className="w-full mx-auto flex items-center justify-between relative">
                {/* LEFT ZONE: Utility (Search, Theme Toggle, Settings Menu) */}
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    {/* Search Bar (Replaces Logo) */}
                    <div className="relative w-full max-w-xs transition-all duration-300 group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                            className="block w-full pl-9 pr-3 py-1.5 md:py-2 border border-transparent rounded-full leading-5 bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 sm:text-sm transition-all"
                            placeholder={t('header.search', 'Buscar compromisos...')}
                        />
                    </div>

                    {/* Theme Toggle (Quick Access) */}
                    <button
                        onClick={handleThemeToggle}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                        aria-label={t(theme === 'dark' ? 'header.lightMode' : 'header.darkMode')}
                    >
                        {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                    </button>

                    {/* Menú unificado - Icon only for cleaner header */}
                    <div className="relative" ref={menuRef}>
                        <button
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                            aria-haspopup="menu"
                            aria-expanded={isMenuOpen}
                            aria-label={t('header.settings') || 'Abrir menú'}
                            title={t('header.settings') || 'Menú'}
                            onClick={() => setIsMenuOpen(o => !o)}
                        >
                            <MenuIcon className="w-5 h-5" />
                        </button>
                        {isMenuOpen && (
                            <div
                                role="menu"
                                aria-label="Menú"
                                className="absolute left-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 shadow-xl ring-1 ring-slate-200 dark:ring-slate-800 p-2 z-[100] animate-in fade-in zoom-in-95 duration-100"
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

                                {/* User section removed from here - moved to avatar menu */}
                            </div>
                        )}
                    </div>
                </div>

                {/* SEPARATOR: Left to Center */}
                <div className="hidden md:block w-px h-6 bg-slate-200 dark:bg-slate-700/50" aria-hidden="true" />

                {/* CENTER ZONE: Focus (ViewSwitcher absolutely centered) */}
                <div className="absolute left-1/2 transform -translate-x-1/2 hidden sm:block">
                    <ViewSwitcher currentView={view} onViewChange={onViewChange} />
                </div>

                {/* SEPARATOR: Center to Right */}
                <div className="hidden md:block w-px h-6 bg-slate-200 dark:bg-slate-700/50" aria-hidden="true" />

                {/* RIGHT ZONE: Actions (Add Button + User Avatar) */}
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Add Filter Button - Mobile Only (Trigger for onToggleMobileFilters) */}
                    {onToggleMobileFilters && (
                        <button
                            onClick={onToggleMobileFilters}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors md:hidden"
                            title={t('grid.filter') || 'Filtrar'}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                            </svg>
                        </button>
                    )}

                    {/* CTA principal - Desktop only (FAB used on mobile) */}
                    <button
                        onClick={onAddExpense}
                        className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm font-bold text-white shadow-md shadow-sky-600/20"
                        title={t('header.addExpense') || 'Añadir gasto'}
                    >
                        <PlusIcon className="w-5 h-5 stroke-[2.5]" />
                        <span>{t('header.addExpense')}</span>
                    </button>

                    {/* User Avatar */}
                    {user && (
                        <div className="relative" ref={userMenuRef}>
                            <button
                                onClick={() => setIsUserMenuOpen(o => !o)}
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-white text-xs font-bold uppercase shadow-sm hover:shadow-md transition-shadow"
                                title={user.email || 'Usuario'}
                                aria-label="Cuenta de usuario"
                            >
                                {user.email?.charAt(0) || 'U'}
                            </button>
                            {isUserMenuOpen && (
                                <div
                                    role="menu"
                                    aria-label="Menú de usuario"
                                    className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 shadow-xl ring-1 ring-slate-200 dark:ring-slate-800 p-2 z-[100] animate-in fade-in zoom-in-95 duration-100 origin-top-right"
                                >
                                    {/* Sección: Cuenta */}
                                    <div className="px-2 py-1.5 text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                        Cuenta
                                    </div>

                                    <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg mx-2 mb-1 truncate">
                                        {user.email}
                                    </div>

                                    <button
                                        role="menuitem"
                                        onClick={() => { setIsProfileSettingsOpen(true); setIsUserMenuOpen(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors group"
                                    >
                                        <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-900/20 text-sky-500 group-hover:bg-sky-100 dark:group-hover:bg-sky-900/40 transition-colors">
                                            {/* Gear icon inline */}
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                            </svg>
                                        </div>
                                        <span>Preferencias</span>
                                    </button>

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
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Feature Flags Modal */}
            <FeatureFlagsSettings
                isOpen={isFeatureFlagsOpen}
                onClose={() => setIsFeatureFlagsOpen(false)}
            />

            {/* Profile Settings Modal */}
            <ProfileSettingsModal
                isOpen={isProfileSettingsOpen}
                onClose={() => setIsProfileSettingsOpen(false)}
            />
        </header>
    );
};

export default Header;
