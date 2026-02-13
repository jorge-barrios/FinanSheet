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
    selectedStatus: StatusFilter;
    setSelectedStatus: (status: StatusFilter) => void;
    availableCategories: string[];
    setShowKPISelector: (show: boolean) => void;
    formatClp: (amount: number) => string;
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
    selectedStatus,
    setSelectedStatus,
    availableCategories,
    setShowKPISelector,
    formatClp,
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
                                onClick={() => setViewMode('monthly')}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'monthly' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Mes
                            </button>
                            <button
                                onClick={() => setViewMode('inventory')}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'inventory' ? 'bg-sky-500 shadow-sm text-white' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Todos
                            </button>
                        </div>

                        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

                        {/* Important Toggle */}
                        <button
                            onClick={() => {
                                if (selectedCategory === 'FILTER_IMPORTANT') {
                                    setSelectedCategory('all');
                                } else {
                                    setSelectedCategory('FILTER_IMPORTANT');
                                    setSelectedStatus('all');
                                }
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
                                    setSelectedCategory(e.target.value);
                                    setSelectedStatus('all');
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
                    amount={totals.pendiente}
                    isActive={currentKPI === 'pendiente'}
                    onClick={() => handleKPIChange(currentKPI === 'pendiente' ? 'comprometido' : 'pendiente')}
                    formatClp={formatClp}
                />
                <KPIBentoCard
                    type="vencido"
                    label={t('kpi.vencido')}
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
