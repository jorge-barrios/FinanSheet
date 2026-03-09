/**
 * HeaderToolbar.tsx
 *
 * Unified header toolbar for ExpenseGrid.
 * Contains: view mode toggle, filters, KPI bar, density selector, mobile KPI carousel.
 */

import React from 'react';
import { Minus, ChevronDown, Star, Menu, Pause as PauseLucide } from 'lucide-react';
import { MobileKPICarousel } from './MobileKPICarousel';
import { KPIBentoCard } from './KPIBentoCard';
import { useLocalization } from '../../hooks/useLocalization';
import type { MonthTotals } from '../../types.v2';
import type { KPIType } from './KPISelectorModal';
import type { Density, StatusFilter, ViewMode } from '../../hooks/useExpenseGridLogic';

export interface HeaderToolbarProps {
    focusedDate: Date;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    density: Density;
    setDensity: (d: Density) => void;
    currentKPI: KPIType;
    handleKPIChange: (kpi: KPIType) => void;
    totals: MonthTotals;
    selectedCategory: string;
    setSelectedCategory: (cat: string) => void;
    setSelectedStatus: (status: StatusFilter) => void;
    availableCategories: string[];
    setShowKPISelector: (show: boolean) => void;
    formatClp: (amount: number) => string;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
}

export const HeaderToolbar: React.FC<HeaderToolbarProps> = ({
    viewMode,
    setViewMode,
    density,
    setDensity,
    currentKPI,
    handleKPIChange,
    totals,
    selectedCategory,
    setSelectedCategory,
    setSelectedStatus,
    availableCategories,
    setShowKPISelector,
    formatClp,
    searchQuery = '',
    onSearchChange,
}) => {
    const { t } = useLocalization();

    return (
        <div className="sticky top-0 z-50 flex flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm transition-all duration-300">

            {/* ═══════════════════════════════════════════════════════════════════
                ROW 1: FILTERS + DENSITY (Funnel UI: Navigation layer)
            ═══════════════════════════════════════════════════════════════════ */}
            <div className="w-full flex items-center justify-between gap-4 py-2.5 px-4">

                {/* [Left] Filter Capsule */}
                <div className="hidden lg:flex items-center">
                    <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-1 gap-1">
                        {/* View Mode Toggle */}
                        <div className="flex bg-slate-100 dark:bg-slate-900/50 rounded-lg p-0.5">
                            <button
                                onClick={() => React.startTransition(() => setViewMode('monthly'))}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'monthly' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Mes
                            </button>
                            <button
                                onClick={() => React.startTransition(() => setViewMode('inventory'))}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'inventory' ? 'bg-sky-500 shadow-sm text-white' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Todos
                            </button>
                        </div>

                        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

                        {/* Important Toggle */}
                        <button
                            onClick={() => {
                                React.startTransition(() => {
                                    if (selectedCategory === 'FILTER_IMPORTANT') {
                                        setSelectedCategory('all');
                                    } else {
                                        setSelectedCategory('FILTER_IMPORTANT');
                                        setSelectedStatus('all');
                                    }
                                });
                            }}
                            className={`h-7 px-2 flex items-center justify-center rounded-lg text-xs font-medium transition-all gap-1.5 ${selectedCategory === 'FILTER_IMPORTANT'
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'
                                }`}
                            title="Filtrar importantes"
                        >
                            <Star className="w-3.5 h-3.5" fill={selectedCategory === 'FILTER_IMPORTANT' ? "currentColor" : "none"} />
                            <span>Importantes</span>
                        </button>

                        {/* Category Select */}
                        <div className="relative">
                            <select
                                value={selectedCategory === 'FILTER_IMPORTANT' ? 'all' : selectedCategory}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    React.startTransition(() => {
                                        setSelectedCategory(value);
                                        setSelectedStatus('all');
                                    });
                                }}
                                className="h-7 w-[160px] appearance-none bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-medium pl-2 pr-8 rounded-lg cursor-pointer outline-none transition-colors border-none focus:ring-0"
                            >
                                <option value="all">Todas las categorías</option>
                                {availableCategories.filter(c => c !== 'all' && c !== 'FILTER_IMPORTANT').map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* DESKTOP SEARCH BAR */}
                    <div className="hidden lg:flex relative w-64 max-w-sm transition-all duration-300 group ml-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-slate-400 group-focus-within:text-sky-500 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                            className="block w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-slate-700/50 rounded-xl leading-5 bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 text-xs transition-all shadow-sm"
                            placeholder={t('header.search', 'Buscar compromisos...')}
                        />
                    </div>
                </div>

                {/* [Right] Density Control */}
                <div className="hidden lg:flex items-center">
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 ring-1 ring-slate-200 dark:ring-slate-700">
                        {(['minimal', 'compact', 'detailed'] as const).map((d) => (
                            <button
                                key={d}
                                onClick={() => setDensity(d)}
                                className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${density === d
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                                    }`}
                                title={`Vista ${d}`}
                            >
                                <span className="flex items-center gap-1.5">
                                    {d === 'minimal' && <Minus className="w-3.5 h-3.5" />}
                                    {d === 'compact' && <PauseLucide className="w-3.5 h-3.5 rotate-90" />}
                                    {d === 'detailed' && <Menu className="w-3.5 h-3.5" />}
                                    {d.charAt(0).toUpperCase() + d.slice(1)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>


            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                ROW 2: KPI BENTO CARDS (Desktop only - Funnel UI: Metrics layer)
            ═══════════════════════════════════════════════════════════════════ */}
            <div className="hidden lg:flex items-center gap-2 px-4 pb-1">
                <KPIBentoCard
                    type="ingresos"
                    label={t('kpi.ingresos')}
                    amount={totals.ingresos}
                    isActive={currentKPI === 'ingresos'}
                    onClick={() => handleKPIChange(currentKPI === 'ingresos' ? 'comprometido' : 'ingresos')}
                    formatClp={formatClp}
                />
                <KPIBentoCard
                    type="pagado"
                    label={t('kpi.pagado')}
                    amount={totals.pagado}
                    isActive={currentKPI === 'pagado'}
                    onClick={() => handleKPIChange(currentKPI === 'pagado' ? 'comprometido' : 'pagado')}
                    formatClp={formatClp}
                />
                <KPIBentoCard
                    type="pendiente"
                    label={t('kpi.porPagar')}
                    subLabel={totals.hasLinkedPending ? '(neto)' : undefined}
                    amount={totals.pendiente}
                    isActive={currentKPI === 'pendiente'}
                    onClick={() => handleKPIChange(currentKPI === 'pendiente' ? 'comprometido' : 'pendiente')}
                    formatClp={formatClp}
                />
                <KPIBentoCard
                    type="vencido"
                    label={t('kpi.vencido')}
                    subLabel={totals.hasLinkedOverdue ? '(neto)' : undefined}
                    amount={totals.vencido}
                    isActive={currentKPI === 'vencido'}
                    hasAlert={totals.vencido > 0}
                    onClick={() => handleKPIChange(currentKPI === 'vencido' ? 'comprometido' : 'vencido')}
                    formatClp={formatClp}
                />
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                ROW 2 MOBILE: Carousel
            ═══════════════════════════════════════════════════════════════════ */}
            <div className="lg:hidden w-full pt-3 pb-2 px-2">
                <MobileKPICarousel
                    totals={totals}
                    currentKPI={currentKPI}
                    onKPIChange={handleKPIChange}
                    onSelectorOpen={() => setShowKPISelector(true)}
                />
            </div>
        </div>
    );
};
