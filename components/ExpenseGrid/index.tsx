/**
 * ExpenseGridVirtual.v2.tsx
 *
 * V2 version of the expense grid that uses Commitments + Terms data model
 * instead of the v1 Expense model. Fetches data directly from v2 services.
 *
 * Design matches the v2 style guide:
 * - Color-coded expense/income (red/green)
 * - Dynamic theming
 * - Icon-based feedback
 */

import React, { useEffect, useRef, useState, forwardRef } from 'react';

import { useExpenseGridLogic } from '../../hooks/useExpenseGridLogic';
import {
    EditIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon,
    CheckCircleIcon, ExclamationTriangleIcon, ClockIcon,
    CalendarIcon, HomeIcon, TransportIcon, DebtIcon, HealthIcon,
    SubscriptionIcon, MiscIcon, CategoryIcon,
    IconProps, PauseIcon, PlusIcon, MoreVertical, Link2,
    HashIcon
} from '../icons';
import type { CommitmentWithTerm, Payment } from '../../types.v2';
import { parseDateString, getPerPeriodAmount } from '../../utils/financialUtils.v2';


import { CommitmentCard } from '../CommitmentCard';
import { Sparkles, Minus, RefreshCw, TrendingUp, Eye, ChevronDown, Filter as FilterIcon, Star } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { KPISelectorModal } from './KPISelectorModal';
import { MobileKPICarousel } from './MobileKPICarousel';


// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================
// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const DateCustomInput = forwardRef<HTMLButtonElement, any>(({ value, onClick }, ref) => (
    <button
        className="h-full flex items-center justify-center px-3 sm:px-4 text-center min-w-[100px] sm:min-w-[140px] text-sm font-semibold text-slate-900 dark:text-white capitalize hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-full outline-none border-x border-slate-200 dark:border-slate-700"
        onClick={onClick}
        ref={ref}
    >
        {value}
    </button>
));
DateCustomInput.displayName = 'DateCustomInput';

const CompactTooltip = ({ children, content, triggerClassName, sideOffset = 5 }: { children: React.ReactNode, content: React.ReactNode, triggerClassName?: string, sideOffset?: number }) => (
    <Tooltip.Provider delayDuration={500} skipDelayDuration={0}>
        <Tooltip.Root disableHoverableContent={true}>
            <Tooltip.Trigger asChild>
                {/* Wrap in span to ensure ref passing if child is composite */}
                <span className={`h-full w-full block outline-none ${triggerClassName || ''}`}>{children}</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content
                    className="z-50 rounded-lg bg-white dark:bg-slate-800 px-3 py-2 text-sm shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in-0 zoom-in-95 duration-200 pointer-events-none"
                    sideOffset={sideOffset}
                >
                    {content}
                    <Tooltip.Arrow className="fill-white dark:fill-slate-800 border-t border-l border-slate-200" />
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    </Tooltip.Provider>
);

// =============================================================================
// TYPES
// =============================================================================

interface ExpenseGridV2Props {
    focusedDate: Date;
    onEditCommitment: (commitment: CommitmentWithTerm) => void;
    onDetailCommitment?: (commitment: CommitmentWithTerm) => void;  // NEW: Opens detail modal
    onDeleteCommitment: (commitmentId: string) => void;
    onPauseCommitment: (commitment: CommitmentWithTerm) => void;
    onResumeCommitment: (commitment: CommitmentWithTerm) => void;
    onRecordPayment: (commitmentId: string, periodDate: string) => void; // periodDate: YYYY-MM-DD
    onFocusedDateChange?: (date: Date) => void;
    visibleMonthsCount?: number;
    onVisibleMonthsCountChange?: (count: number) => void;
    // Optional preloaded data from App.tsx for instant rendering
    preloadedCommitments?: CommitmentWithTerm[];
    preloadedPayments?: Map<string, Payment[]>;
    // Optional pre-calculated totals from dashboard (avoids duplicate logic)
    monthlyTotals?: { expenses: number; income: number };
}

// =============================================================================
// ICON MAPPING
// =============================================================================

export const categoryIconsMap: Record<string, React.ReactElement<IconProps>> = {
    'Hogar': <HomeIcon />,
    'Vivienda': <HomeIcon />,
    'Transporte': <TransportIcon />,
    'Deudas': <DebtIcon />,
    'Salud': <HealthIcon />,
    'Suscripciones': <SubscriptionIcon />,
    'Varios': <MiscIcon />,
};

export const getCategoryIcon = (category: string) => {
    const icon = categoryIconsMap[category] || <CategoryIcon />;
    return React.cloneElement(icon, { className: 'w-5 h-5' });
};

// Helper to convert Date to periodDate string (YYYY-MM-DD, first day of month)
const dateToPeriod = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
};


// =============================================================================
// COMPONENT
// =============================================================================

const ExpenseGridVirtual2: React.FC<ExpenseGridV2Props> = ({
    focusedDate,
    onEditCommitment,
    onDetailCommitment,
    onDeleteCommitment,
    onPauseCommitment,
    onResumeCommitment,
    onRecordPayment,
    onFocusedDateChange,
}) => {
    // Logic extracted to custom hook
    const {
        loading, error, density, setDensity,
        selectedCategory, setSelectedCategory,
        selectedStatus, setSelectedStatus,
        viewMode, setViewMode,
        currentKPI, handleKPIChange,
        showKPISelector, setShowKPISelector,
        commitments, payments, groupedCommitments, availableCategories, visibleMonths,
        getPaymentStatus, performSmartSort, isActiveInMonth, getTranslatedCategoryName,
        formatClp, getTermForPeriod, getTerminationReason, isCommitmentTerminated,
        t, getMonthTotals, effectiveMonthCount
    } = useExpenseGridLogic({ focusedDate, onFocusedDateChange });

    // UI State & Layout
    const scrollAreaRef = useRef<HTMLDivElement | null>(null);
    const [availableHeight, setAvailableHeight] = useState<number>(400);
    const footerRef = useRef<HTMLDivElement | null>(null);
    const pad = density === 'minimal' ? 'p-0.5' : density === 'compact' ? 'p-1' : 'p-3';

    // Helper: Is Current Month
    const isCurrentMonth = (date: Date) => {
        const today = new Date();
        return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    };

    // Auto-scroll to current month
    useEffect(() => {
        if (!scrollAreaRef.current) return;
        const today = new Date();
        const currentMonthIndex = visibleMonths.findIndex(m => m.getMonth() === today.getMonth() && m.getFullYear() === today.getFullYear());

        if (currentMonthIndex !== -1) {
            setTimeout(() => {
                const headerEl = document.getElementById(`month-header-${currentMonthIndex}`);
                if (headerEl && scrollAreaRef.current) {
                    const containerWidth = scrollAreaRef.current.clientWidth;
                    const headerLeft = headerEl.offsetLeft;
                    const headerWidth = headerEl.clientWidth;
                    const offset = headerLeft - (containerWidth / 2) + (headerWidth / 2);
                    scrollAreaRef.current.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
                }
            }, 100);
        }
    }, [density, visibleMonths]);

    // Height Calculation
    useEffect(() => {
        const recalc = () => {
            const el = scrollAreaRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const vh = window.innerHeight || document.documentElement.clientHeight;
            const footerH = footerRef.current ? footerRef.current.offsetHeight : 48;
            const bottomMargin = footerH + 16;
            const h = Math.max(200, vh - rect.top - bottomMargin);
            setAvailableHeight(h);
        };
        recalc();
        const timer = setTimeout(recalc, 100);
        window.addEventListener('resize', recalc);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', recalc);
        };
    }, []);


    // ==========================================================================
    // RENDER
    // ==========================================================================

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-red-500">{error}</p>
            </div>
        );
    }

    return (
        <div>
            {/* Header Toolbar - Unified for Mobile + Desktop */}
            {/* ===========================================================================
                UNIFIED HEADER (Nav + Filters + KPIs + Density)
                Focus Strategy: Maximize vertical space, keep everything reachable
               =========================================================================== */}
            <div className="sticky top-0 z-50 flex flex-col items-center border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm transition-all duration-300">

                {/* Row 1: Unified Controls (Desktop: Single Row | Mobile: Flex Wrap) */}
                <div className="w-full flex flex-wrap lg:flex-nowrap items-center justify-between gap-6 py-3 px-6">

                    {/* [Left] Navigation */}
                    <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
                        {/* Month Selector moved to Table Header per user request */}
                    </div>

                    {/* [Center] Unified Filter Capsule */}
                    <div className="hidden lg:flex items-center justify-center flex-1">
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

                            <div className="w-px h-5 bg-slate-100 dark:bg-slate-700 mx-1" />

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
                                    ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-500/20'
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

                    {/* [Right] KPIs & Density */}
                    <div className="hidden lg:flex items-center gap-6">
                        {/* KPI Group */}
                        {(() => {
                            const totals = getMonthTotals(focusedDate.getFullYear(), focusedDate.getMonth());
                            return (
                                <div className="flex items-center gap-2">
                                    {/* Comprometido (Implicit/Total) */}
                                    <div className="flex flex-col items-end mr-2">
                                        <span className="text-[9px] uppercase tracking-wider text-slate-400">Total</span>
                                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                            {formatClp(totals.comprometido)}
                                        </span>
                                    </div>

                                    {/* Ingresos (Green) */}
                                    <button
                                        onClick={() => handleKPIChange(currentKPI === 'ingresos' ? 'comprometido' : 'ingresos')}
                                        className={`h-8 pl-1.5 pr-3 rounded-lg flex items-center gap-2 border transition-all ${currentKPI === 'ingresos'
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 ring-1 ring-emerald-500/20'
                                            : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                        title="Filtrar Ingresos"
                                    >
                                        <div className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                            <TrendingUp className="w-3 h-3" />
                                        </div>
                                        <span className={`text-xs font-mono font-bold ${currentKPI === 'ingresos' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {formatClp(totals.ingresos)}
                                        </span>
                                    </button>

                                    {/* Pagado (Teal/Emerald) */}
                                    <button
                                        onClick={() => handleKPIChange(currentKPI === 'pagado' ? 'comprometido' : 'pagado')}
                                        className={`h-8 pl-1.5 pr-3 rounded-lg flex items-center gap-2 border transition-all ${currentKPI === 'pagado'
                                            ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 ring-1 ring-teal-500/20'
                                            : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                        title="Filtrar Pagados"
                                    >
                                        <div className="w-5 h-5 rounded-md bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
                                            <CheckCircleIcon className="w-3 h-3" />
                                        </div>
                                        <span className={`text-xs font-mono font-bold ${currentKPI === 'pagado' ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {formatClp(totals.pagado)}
                                        </span>
                                    </button>

                                    {/* Pendiente (Amber) */}
                                    <button
                                        onClick={() => handleKPIChange(currentKPI === 'pendiente' ? 'comprometido' : 'pendiente')}
                                        className={`h-8 pl-1.5 pr-3 rounded-lg flex items-center gap-2 border transition-all ${currentKPI === 'pendiente'
                                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 ring-1 ring-amber-500/20'
                                            : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                        title="Filtrar Pendientes"
                                    >
                                        <div className="w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                            <ClockIcon className="w-3 h-3" />
                                        </div>
                                        <span className={`text-xs font-mono font-bold ${currentKPI === 'pendiente' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {formatClp(totals.pendiente)}
                                        </span>
                                    </button>
                                </div>
                            );
                        })()}

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

                        {/* Density Control (Segmented) */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 ring-1 ring-slate-200 dark:ring-slate-700">
                            {(['minimal', 'compact', 'detailed'] as const).map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setDensity(d)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${density === d
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                                        }`}
                                    title={`Vista ${d}`}
                                >
                                    {d.charAt(0).toUpperCase() + d.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mobile: Filter Toggle */}
                    <button className="lg:hidden p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        <FilterIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* [Row 2 Mobile] KPI Carousel (Visible only on Mobile) */}
                <div className="lg:hidden w-full pb-2 px-2">
                    <MobileKPICarousel
                        totals={getMonthTotals(focusedDate.getFullYear(), focusedDate.getMonth())}
                        currentKPI={currentKPI}
                        onKPIChange={handleKPIChange}
                        onSelectorOpen={() => setShowKPISelector(true)}
                    />
                </div>
            </div>


            {/* Mobile View - Compact Cards */}
            <div className="lg:hidden p-3 space-y-2 pb-28">
                {(() => {
                    const filteredCommitments = commitments.filter(c => {
                        // In inventory mode, show ALL commitments (including terminated)
                        if (viewMode === 'inventory') return true;

                        // 1. Siempre mostrar si "Ver terminados" está activo


                        // 2. Verificar si hay un registro de pago en el mes enfocado
                        // Use robust getPaymentStatus to check for payment record
                        const activeTerm = getTermForPeriod(c, focusedDate);
                        const dueDay = activeTerm?.due_day_of_month ?? 1;
                        const { hasPaymentRecord } = getPaymentStatus(c.id, focusedDate, dueDay);

                        if (hasPaymentRecord) return true;

                        // 3. Verificar si está activo según su término en el mes enfocado
                        return isActiveInMonth(c, focusedDate);
                    }).filter(c => {
                        // Aplicar filtro de categoría
                        if (selectedCategory === 'all') return true;
                        if (selectedCategory === 'FILTER_IMPORTANT') return c.is_important;
                        return getTranslatedCategoryName(c) === selectedCategory;
                    }).filter(c => {
                        // Aplicar filtro de status (pendiente/pagado)
                        if (selectedStatus === 'all') return true;

                        const activeTerm = getTermForPeriod(c, focusedDate);
                        const dueDay = activeTerm?.due_day_of_month ?? 1;
                        const { isPaid } = getPaymentStatus(c.id, focusedDate, dueDay);

                        if (selectedStatus === 'pagado') return isPaid;
                        if (selectedStatus === 'pendiente') return !isPaid;
                        return true;
                    }).sort(performSmartSort);

                    return filteredCommitments.length > 0 ? filteredCommitments.map(c => {
                        // Sync logic with desktop cells
                        const monthDate = focusedDate;
                        const term = getTermForPeriod(c, monthDate);

                        // Strict validation: Ensure term covers the current month
                        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
                        const termEnds = term?.effective_until ? new Date(term.effective_until) : null;
                        // Check if term exists AND (no end date OR end date is after start of this month)
                        const isTermActiveInMonth = !!term && (!termEnds || termEnds >= monthStart);

                        const dueDay = term?.due_day_of_month ?? 1;
                        const { isPaid, payment: currentPayment } = getPaymentStatus(c.id, monthDate, dueDay);

                        // Note: amount calculations are handled by CommitmentCard via payments prop

                        const today = new Date();
                        const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
                        // Validation: Must have active term to be overdue
                        const isOverdue = isTermActiveInMonth && !isPaid && dueDate < today && monthDate <= today;

                        // Cálculos consistentes con tooltip desktop
                        const daysOverdue = isOverdue
                            ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                            : 0;

                        // Note: cuotaNumber, terminated, terminationReason are handled by CommitmentCard


                        // Prepare monthly info for CommitmentCard
                        const monthlyInfo = {
                            isPaid,
                            paymentDate: currentPayment?.payment_date
                                ? parseDateString(currentPayment.payment_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
                                : undefined,
                            dueDate: !isPaid && isTermActiveInMonth
                                ? `Vence: ${dueDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
                                : undefined,
                            daysOverdue: daysOverdue > 0 ? daysOverdue : undefined
                        };

                        return (
                            <CommitmentCard
                                key={c.id}
                                commitment={c}
                                payments={payments.get(c.id) || []}
                                mode={viewMode === 'inventory' ? 'inventory' : 'monthly'}
                                viewDate={monthDate}
                                monthlyInfo={monthlyInfo}
                                categoryName={getTranslatedCategoryName(c)}
                                formatAmount={formatClp}
                                onClick={() => {
                                    // Contextual Intelligent Flow (see Identidad.md recommendations)
                                    if (viewMode === 'inventory') {
                                        // Inventory: Always show full detail/history
                                        if (onDetailCommitment) {
                                            onDetailCommitment(c);
                                        } else {
                                            onEditCommitment(c);
                                        }
                                    } else {
                                        // Monthly View: Context-aware action
                                        if (isTermActiveInMonth && !isPaid) {
                                            // CASE 1: Pending/Overdue → Quick payment (most common action)
                                            onRecordPayment(c.id, dateToPeriod(monthDate));
                                        } else if (isPaid && onDetailCommitment) {
                                            // CASE 2: Paid → View payment details/receipt
                                            onDetailCommitment(c);
                                        } else if (onDetailCommitment) {
                                            // CASE 3: Other states (paused, future) → View detail
                                            onDetailCommitment(c);
                                        } else {
                                            // FALLBACK: Edit (if detail modal not available)
                                            onEditCommitment(c);
                                        }
                                    }
                                }}
                                onEdit={() => onEditCommitment(c)}
                                onDetail={onDetailCommitment ? () => onDetailCommitment(c) : undefined}
                                onPause={() => onPauseCommitment(c)}
                                onResume={() => onResumeCommitment(c)}
                                onDelete={() => onDeleteCommitment(c.id)}
                                translateFrequency={(freq) => t(`frequency.${freq}`) || freq}
                            />
                        );
                    }) : (
                        <div className="text-center py-20 px-6 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            {commitments.length === 0 ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mb-2">
                                        <Sparkles className="w-8 h-8 text-sky-500 dark:text-sky-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                            ¡Bienvenido a FinanSheet!
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6">
                                            Aún no tienes compromisos registrados. Comienza agregando tus ingresos y gastos fijos.
                                        </p>
                                        <p className="text-sm font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 py-2 px-4 rounded-full inline-block">
                                            ✨ Tip: Usa el botón "+" arriba a la derecha
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                                        No hay compromisos en esta categoría
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                        Intenta seleccionar otra categoría en el filtro
                                    </p>
                                </div>
                            )}
                        </div>
                    )
                })()}
            </div >

            {/* Desktop View Content */}
            < div className="hidden lg:block px-4" >
                <div className="mt-4">


                    {/* Grid */}
                    <div className="relative mb-2">
                        {/* Scroll Indicator - Right Edge Gradient */}
                        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/80 dark:from-slate-900/80 to-transparent pointer-events-none z-30" />

                        <div
                            ref={scrollAreaRef}
                            className="relative overflow-x-auto overflow-y-auto scrollbar-thin pr-1"
                            style={{ height: `${availableHeight}px` }}
                        >
                            <table className="w-full border-separate border-spacing-0">
                                <thead className="sticky top-0 z-40">
                                    {/* Month Header - Card Style (Separated) */}
                                    <tr className="bg-slate-50 dark:bg-slate-900"> {/* Mask Background */}
                                        {/* COMPROMISO - Left end (Card Style) */}
                                        <th className={`sticky left-0 z-50 min-w-[220px] max-w-[240px] w-[220px] p-1 bg-slate-50 dark:bg-slate-900 align-middle`}>
                                            <div className="h-full w-full flex flex-col justify-center">
                                                {/* Embedded Month Selector: Premium Glass Capsule */}
                                                <div className={`
                                                    flex items-center gap-1 w-full rounded-xl transition-all border shadow-sm group/selector px-1
                                                    bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600/50 hover:border-slate-300 dark:hover:border-slate-500
                                                    ${density === 'minimal' ? 'min-h-[48px] py-1' : density === 'compact' ? 'min-h-[64px] py-1.5' : 'min-h-[80px] py-2'}
                                                `}>
                                                    {/* Home/Today Action - Stable (Left) */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onFocusedDateChange && onFocusedDateChange(new Date());
                                                        }}
                                                        disabled={isCurrentMonth(focusedDate)}
                                                        className={`
                                                            w-7 h-7 flex items-center justify-center rounded-lg transition-all active:scale-95
                                                            ${isCurrentMonth(focusedDate)
                                                                ? 'text-slate-300 dark:text-slate-700 opacity-50 cursor-default'
                                                                : 'text-sky-500 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 cursor-pointer'}
                                                        `}
                                                        title="Volver a Hoy"
                                                    >
                                                        <CalendarIcon className="w-4 h-4" />
                                                    </button>

                                                    {/* Divider */}
                                                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

                                                    {/* Navigation Group */}
                                                    <div className="flex-1 flex items-center justify-between">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const d = new Date(focusedDate);
                                                                d.setMonth(d.getMonth() - 1);
                                                                onFocusedDateChange && onFocusedDateChange(d);
                                                            }}
                                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95"
                                                        >
                                                            <ChevronLeftIcon className="w-4 h-4" />
                                                        </button>

                                                        <div className="flex flex-col items-center justify-center">
                                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                                                                {focusedDate.toLocaleDateString('es-Cl', { month: 'short' }).replace('.', '')}
                                                            </span>
                                                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                                                                {focusedDate.getFullYear()}
                                                            </span>
                                                        </div>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const d = new Date(focusedDate);
                                                                d.setMonth(d.getMonth() + 1);
                                                                onFocusedDateChange && onFocusedDateChange(d);
                                                            }}
                                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95"
                                                        >
                                                            <ChevronRightIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </th>
                                        {/* Month cells (Card Style) */}
                                        {visibleMonths.map((month, i) => (
                                            <th
                                                key={i}
                                                id={`month-header-${i}`}
                                                className={`relative min-w-[85px] w-auto py-2 px-1 text-center align-middle bg-slate-50 dark:bg-slate-900`}
                                            >
                                                {/* Inner Card - 3 states: Current, Focused, Normal */}
                                                {(() => {
                                                    const isFocused = month.getFullYear() === focusedDate.getFullYear() && month.getMonth() === focusedDate.getMonth();
                                                    const isCurrent = isCurrentMonth(month);

                                                    let cardStyle = 'bg-white dark:bg-slate-700/60 border-slate-200 dark:border-slate-600/50 hover:border-slate-300 dark:hover:border-slate-500'; // Normal

                                                    if (isCurrent || isFocused) {
                                                        cardStyle = 'bg-slate-100 dark:bg-slate-800/60 border-2 border-slate-500/50'; // Active (current or focused)
                                                    }

                                                    return (
                                                        <div className={`h-full w-full rounded-xl border transition-all duration-300 overflow-hidden ${cardStyle}`}>
                                                            {/* Month content - ENHANCED with KPI metrics */}
                                                            {(() => {
                                                                const monthTotals = getMonthTotals(month.getFullYear(), month.getMonth());
                                                                return (
                                                                    <div className={`
                                                            flex flex-col items-center justify-center px-1 transition-all duration-200 cursor-pointer
                                                            hover:bg-slate-50 dark:hover:bg-slate-700/50
                                                            ${density === 'minimal' ? 'py-1 min-h-[48px]' :
                                                                            density === 'compact' ? 'py-1.5 min-h-[64px]' :
                                                                                'py-2 min-h-[80px]'}
                                                        `}
                                                                        onClick={() => onFocusedDateChange && onFocusedDateChange(month)}
                                                                        title={`${month.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}\nComprometido: ${formatClp(monthTotals.comprometido)}\nPagado: ${formatClp(monthTotals.pagado)}\nPendiente: ${formatClp(monthTotals.pendiente)}`}
                                                                    >
                                                                        {/* Month name - Protagonist */}
                                                                        <span className={`tracking-wide ${density === 'minimal' ? 'text-xs' : 'text-sm'
                                                                            } ${isCurrentMonth(month)
                                                                                ? 'font-bold text-sky-400'
                                                                                : 'font-semibold text-slate-200'
                                                                            }`}>
                                                                            {month.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '').charAt(0).toUpperCase() + month.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '').slice(1)}
                                                                            {' '}
                                                                            {(month.getFullYear() !== focusedDate.getFullYear() || month.getMonth() === 0) && (
                                                                                <span className={`text-[10px] font-normal ${isCurrentMonth(month) ? 'text-sky-500/80' : 'text-slate-500'}`}>
                                                                                    {month.getFullYear()}
                                                                                </span>
                                                                            )}
                                                                        </span>

                                                                        {/* Metrics Row - TEMPORARILY HIDDEN */}
                                                                        {/* 
                                                                <div className={`font-mono font-medium tabular-nums mt-0.5 ${isCurrentMonth(month) ? 'text-sky-100' : 'text-slate-400'
                                                                    } ${density === 'minimal' ? 'text-[9px]' : 'text-[10px]'}`}>
                                                                    {formatClp(monthTotals.comprometido)}
                                                                </div>

                                                                {density !== 'minimal' && (
                                                                    <div className="flex items-center gap-1 mt-0.5 text-[9px] font-mono tabular-nums">
                                                                        <span className={`${monthTotals.pagado > 0
                                                                            ? 'text-emerald-400'
                                                                            : 'text-slate-600'
                                                                            }`}>
                                                                            {formatClp(monthTotals.pagado).replace('$', '')}
                                                                        </span>
                                                                        <span className="text-slate-700 dark:text-slate-600">/</span>
                                                                        <span className={`${monthTotals.pendiente > 0
                                                                            ? 'text-amber-500'
                                                                            : 'text-slate-600'
                                                                            }`}>
                                                                            {formatClp(monthTotals.pendiente).replace('$', '')}
                                                                        </span>
                                                                    </div>
                                                                )} 
                                                                */}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    );
                                                })()}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-transparent">

                                    {groupedCommitments.map(({ category, commitments: catCommitments }) => (
                                        <React.Fragment key={category}>
                                            {/* Category badge is now inside each commitment card - no separator needed */}
                                            {/* Commitment rows */}
                                            {catCommitments.map((commitment) => {
                                                const monthDate = focusedDate; // En vista compacta, solo vemos el mes enfocado

                                                const isGloballyTerminated = isCommitmentTerminated(commitment);

                                                // Necesitamos saber si está pagado en este mes para decidir el tachado
                                                const termForMonth = getTermForPeriod(commitment, monthDate);
                                                const dueDay = termForMonth?.due_day_of_month ?? 1;
                                                const { isPaid } = getPaymentStatus(commitment.id, monthDate, dueDay);

                                                // Solo tachar si: está terminado globalmente, ESTABA activo en este mes, Y YA FUE PAGADO
                                                const wasActiveInMonth = termForMonth !== null;
                                                const terminated = isGloballyTerminated && wasActiveInMonth && isPaid;
                                                const terminationReason = getTerminationReason(commitment);
                                                return (
                                                    <tr
                                                        key={commitment.id}
                                                        className={`
                                                            group
                                                            transition-all duration-200 ease-out
                                                            ${terminated ? 'opacity-60 grayscale-[0.5]' : ''}
                                                        `}
                                                    >
                                                        {/* Name cell - Bento Card Style */}
                                                        <td
                                                            onClick={() => onDetailCommitment ? onDetailCommitment(commitment) : onEditCommitment(commitment)}
                                                            className={`
                                                            relative sticky left-0 z-30 p-1 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.1)]
                                                            bg-transparent dark:bg-slate-900
                                                            min-w-[220px] max-w-[240px] w-[220px]
                                                            h-[1px]
                                                        `}>
                                                            {/* Inner Content - Card style matching data cells */}
                                                            <div className={`
                                                                relative cursor-pointer group/card h-full rounded-xl
                                                                ${density === 'minimal' ? 'min-h-[46px] px-2 py-1' : density === 'compact' ? 'min-h-[62px] px-2.5 py-1.5' : 'min-h-[78px] px-3 py-2'}
                                                                bg-slate-50 dark:bg-slate-700/60 border border-slate-200/50 dark:border-slate-700/50
                                                                hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:border-slate-300 dark:hover:border-slate-500
                                                                transition-all duration-200
                                                                ${terminated ? 'opacity-70' : ''}
                                                            `}>
                                                                {/* Flow Type Indicator - Interior left edge bar */}
                                                                <div className={`absolute left-1.5 top-1.5 bottom-1.5 w-1 rounded-full ${commitment.flow_type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                                                                {/* Content Container - Different layouts for minimal/compact/detailed */}
                                                                {density === 'minimal' ? (
                                                                    /* === MINIMAL: Single line with tooltip === */
                                                                    <div
                                                                        className="flex items-center justify-between h-full pl-5 pr-3"
                                                                        title={`${commitment.name} · ${getTranslatedCategoryName(commitment)} · ${formatClp(Math.round(commitment.active_term ? getPerPeriodAmount(commitment.active_term, true) : 0))}`}
                                                                    >
                                                                        <span className={`font-semibold truncate text-sm ${terminated ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                                                            {commitment.name}
                                                                        </span>
                                                                        <div className="flex items-center gap-1 shrink-0 ml-1">
                                                                            {commitment.is_important && <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />}
                                                                            {commitment.linked_commitment_id && <Link2 className="w-2.5 h-2.5 text-sky-500" />}
                                                                            {/* Frequency indicator */}
                                                                            {commitment.active_term?.installments_count && commitment.active_term.installments_count > 1 ? (
                                                                                <span className="text-[9px] text-sky-400">#{commitment.active_term.installments_count}</span>
                                                                            ) : commitment.active_term?.effective_until ? (
                                                                                <CalendarIcon className="w-2.5 h-2.5 text-slate-500" />
                                                                            ) : commitment.active_term ? (
                                                                                <RefreshCw className="w-2.5 h-2.5 text-slate-500" />
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                ) : density === 'compact' ? (
                                                                    /* === COMPACT: 2 rows === */
                                                                    <div className="flex flex-col justify-center h-full pl-5 pr-3">
                                                                        {/* Row 1: Name (left) + Icons right-aligned (fav, linked, frequency) */}
                                                                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                                                                            <span className={`font-semibold truncate text-sm ${terminated ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`} title={commitment.name}>
                                                                                {commitment.name}
                                                                            </span>
                                                                            <div className="flex items-center gap-1 shrink-0">
                                                                                {commitment.is_important && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                                                                {commitment.linked_commitment_id && <Link2 className="w-3 h-3 text-sky-500" />}
                                                                                {/* Frequency indicator */}
                                                                                {commitment.active_term?.installments_count && commitment.active_term.installments_count > 1 ? (
                                                                                    <span className="text-[10px] text-sky-400" title={`${commitment.active_term.installments_count} cuotas`}>
                                                                                        #{commitment.active_term.installments_count}
                                                                                    </span>
                                                                                ) : commitment.active_term?.effective_until ? (
                                                                                    <span title="Fecha de término"><CalendarIcon className="w-3 h-3 text-slate-500" /></span>
                                                                                ) : commitment.active_term ? (
                                                                                    <span title="Mensual indefinido"><RefreshCw className="w-3 h-3 text-slate-500" /></span>
                                                                                ) : null}
                                                                            </div>
                                                                        </div>
                                                                        {/* Row 2: Category Badge (left) + Amount (rightmost) */}
                                                                        <div className="flex items-center justify-between gap-2 mt-1">
                                                                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                                                                                {getTranslatedCategoryName(commitment)}
                                                                            </span>
                                                                            <span className="font-mono font-semibold text-sm tabular-nums text-slate-700 dark:text-slate-200 shrink-0">
                                                                                {formatClp(Math.round(commitment.active_term ? getPerPeriodAmount(commitment.active_term, true) : 0))}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    /* === DETAILED: 4 rows to match payment cells === */
                                                                    <div className="flex flex-col justify-between h-full pl-5 pr-3 py-2 gap-1">
                                                                        {/* Row 1: Name + Icons */}
                                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                                            <span className={`font-bold truncate text-base ${terminated ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`} title={commitment.name}>
                                                                                {commitment.name}
                                                                            </span>
                                                                            {commitment.is_important && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                                                                            {commitment.linked_commitment_id && <Link2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                                                                        </div>

                                                                        {/* Row 2: Category badge */}
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                                {getTranslatedCategoryName(commitment)}
                                                                            </span>
                                                                            {/* Removed loose frequency icons in favor of badges below */}
                                                                        </div>

                                                                        {/* Row 3: Amount (protagonista) */}
                                                                        <div className="font-mono font-bold text-xl tabular-nums text-slate-900 dark:text-white tracking-tight">
                                                                            {formatClp(Math.round(commitment.active_term ? getPerPeriodAmount(commitment.active_term, true) : 0))}
                                                                        </div>

                                                                        {/* Row 4: Term info - Ghost style (no bg/border) */}
                                                                        <div className="flex items-center justify-between">
                                                                            {/* Recurrence/Term info - minimal */}
                                                                            {/* Tech Badge for Term/Recurrence */}
                                                                            {commitment.active_term?.effective_until ? (
                                                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 ring-1 ring-sky-500/10">
                                                                                    {commitment.active_term.installments_count && commitment.active_term.installments_count > 1 ? (
                                                                                        <>
                                                                                            <HashIcon className="w-3 h-3 text-sky-500" />
                                                                                            {commitment.active_term.installments_count} Cuotas
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <CalendarIcon className="w-3 h-3 text-sky-500" />
                                                                                            {(() => {
                                                                                                const [y, m] = commitment.active_term!.effective_until.substring(0, 7).split('-');
                                                                                                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                                                                                return `${months[parseInt(m) - 1]} ${y}`;
                                                                                            })()}
                                                                                        </>
                                                                                    )}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                                    <RefreshCw className="w-3 h-3 text-slate-400" /> Mensual
                                                                                </span>
                                                                            )}
                                                                            {/* Status icons - solo cuando hay estado especial */}
                                                                            {terminationReason === 'PAUSED' && (
                                                                                <PauseIcon className="w-3.5 h-3.5 text-amber-500" />
                                                                            )}
                                                                            {terminationReason === 'COMPLETED_INSTALLMENTS' && (
                                                                                <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
                                                                            )}
                                                                            {terminationReason === 'TERMINATED' && (
                                                                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fin</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Actions Menu (Absolute, hover) */}
                                                                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/card:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                                    <DropdownMenu.Root>
                                                                        <DropdownMenu.Trigger asChild>
                                                                            <button className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                                                                <MoreVertical className="w-4 h-4" />
                                                                            </button>
                                                                        </DropdownMenu.Trigger>
                                                                        <DropdownMenu.Portal>
                                                                            <DropdownMenu.Content
                                                                                className="min-w-[160px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 p-1 z-50 animate-in fade-in zoom-in-95 duration-200"
                                                                                sideOffset={5}
                                                                                align="end"
                                                                            >
                                                                                <DropdownMenu.Item
                                                                                    className="flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer outline-none"
                                                                                    onClick={(e) => { e.stopPropagation(); onEditCommitment(commitment); }}
                                                                                >
                                                                                    <EditIcon className="w-3.5 h-3.5 text-blue-500" /> Editar
                                                                                </DropdownMenu.Item>
                                                                                {onDetailCommitment && (
                                                                                    <DropdownMenu.Item
                                                                                        className="flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-sky-600 dark:text-sky-400 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 cursor-pointer outline-none"
                                                                                        onClick={(e) => { e.stopPropagation(); onDetailCommitment(commitment); }}
                                                                                    >
                                                                                        <Eye className="w-3.5 h-3.5" /> Detalle
                                                                                    </DropdownMenu.Item>
                                                                                )}
                                                                                <DropdownMenu.Item
                                                                                    className={`flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer outline-none ${terminationReason === 'COMPLETED_INSTALLMENTS' ? 'opacity-50' : ''}`}
                                                                                    disabled={terminationReason === 'COMPLETED_INSTALLMENTS'}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        const hasEndDate = !!commitment.active_term?.effective_until;
                                                                                        if (hasEndDate || terminationReason === 'PAUSED' || terminationReason === 'TERMINATED') {
                                                                                            onResumeCommitment(commitment);
                                                                                        } else {
                                                                                            onPauseCommitment(commitment);
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <PauseIcon className="w-3.5 h-3.5 text-amber-500" />
                                                                                    {(() => {
                                                                                        const hasEndDate = !!commitment.active_term?.effective_until;
                                                                                        if (terminationReason === 'COMPLETED_INSTALLMENTS') return 'Completado';
                                                                                        if (hasEndDate || terminationReason === 'PAUSED' || terminationReason === 'TERMINATED') return 'Reanudar';
                                                                                        return 'Pausar';
                                                                                    })()}
                                                                                </DropdownMenu.Item>
                                                                                <DropdownMenu.Separator className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                                                                <DropdownMenu.Item
                                                                                    className="flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/10 cursor-pointer outline-none"
                                                                                    onClick={(e) => { e.stopPropagation(); onDeleteCommitment(commitment.id); }}
                                                                                >
                                                                                    <TrashIcon className="w-3.5 h-3.5" /> Eliminar
                                                                                </DropdownMenu.Item>
                                                                            </DropdownMenu.Content>
                                                                        </DropdownMenu.Portal>
                                                                    </DropdownMenu.Root>
                                                                </div>
                                                            </div>{/* Close Inner Bento Card */}
                                                        </td>

                                                        {/* Month cells */}
                                                        {visibleMonths.map((monthDate, mi) => {
                                                            // Get term for THIS specific period (supports multi-term)
                                                            const term = getTermForPeriod(commitment, monthDate);
                                                            const isActive = isActiveInMonth(commitment, monthDate);
                                                            const dueDay = term?.due_day_of_month ?? 1;
                                                            const { isPaid, amount: paidAmount, paidOnTime, payment: currentPayment, hasPaymentRecord } = getPaymentStatus(commitment.id, monthDate, dueDay);

                                                            // Calculate expected per-period amount from term (only used when no payment)
                                                            const totalAmount = term?.amount_in_base ?? term?.amount_original ?? 0;
                                                            const installmentsCount = term?.installments_count ?? null;

                                                            // Solo dividir si is_divided_amount = true (tipo "En cuotas")
                                                            const perPeriodAmount = term?.is_divided_amount && installmentsCount && installmentsCount > 1
                                                                ? totalAmount / installmentsCount
                                                                : totalAmount;

                                                            // Show REAL data: if there's a payment record (even if not marked paid), show that amount
                                                            // Otherwise show expected amount from term
                                                            const displayAmount = (hasPaymentRecord && paidAmount !== null) ? paidAmount : perPeriodAmount;

                                                            // Calculate cuota number if installments
                                                            let cuotaNumber: number | null = null;
                                                            if (term && installmentsCount && installmentsCount > 1) {
                                                                // Parse date parts directly to avoid timezone issues
                                                                const [startYear, startMonth] = term.effective_from.split('-').map(Number);
                                                                const monthsDiff = (monthDate.getFullYear() - startYear) * 12 +
                                                                    (monthDate.getMonth() + 1 - startMonth); // +1 because getMonth() is 0-indexed
                                                                cuotaNumber = monthsDiff + 1;
                                                                if (cuotaNumber < 1 || cuotaNumber > installmentsCount) {
                                                                    cuotaNumber = null; // Out of range
                                                                }
                                                            }

                                                            // Original currency display
                                                            const originalCurrency = term?.currency_original;
                                                            const originalAmount = term?.amount_original ?? 0;
                                                            // Solo dividir si is_divided_amount = true (tipo "En cuotas")
                                                            const perPeriodOriginal = term?.is_divided_amount && installmentsCount && installmentsCount > 1
                                                                ? originalAmount / installmentsCount
                                                                : originalAmount;
                                                            const showOriginalCurrency = originalCurrency && originalCurrency !== 'CLP';

                                                            const today = new Date();
                                                            const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
                                                            const isOverdue = !!term && !isPaid && dueDate < today && monthDate <= today;
                                                            const isPending = !!term && !isPaid && !isOverdue && isCurrentMonth(monthDate);
                                                            const isGap = !term && !isPaid;

                                                            // Check if this is a future month (after current month)
                                                            // BUT don't dim if there's a payment record (pre-registered amount)
                                                            const isFutureMonth = monthDate > today && !isCurrentMonth(monthDate) && !hasPaymentRecord;

                                                            // Days overdue/remaining calculation
                                                            const daysOverdue = isOverdue
                                                                ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                                                                : 0;
                                                            const daysRemaining = !isOverdue
                                                                ? Math.max(0, Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
                                                                : 0;
                                                            const isDisabled = isFutureMonth && !(hasPaymentRecord || (installmentsCount && installmentsCount > 1));

                                                            // === Render Status Badge Helper ===
                                                            const renderStatusBadge = () => {
                                                                if (isPaid) {
                                                                    return (
                                                                        <div className="grid grid-cols-1 items-center justify-items-center group/badge w-full mt-1">
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 group-hover/cell:opacity-0">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 ring-1 ring-emerald-500/10">
                                                                                    {paidOnTime && <Sparkles className="w-3 h-3" />}
                                                                                    <CheckCircleIcon className="w-3.5 h-3.5" />
                                                                                    Pagado
                                                                                </span>
                                                                            </div>
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 opacity-0 group-hover/cell:opacity-100">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 cursor-pointer">
                                                                                    <EditIcon className="w-3.5 h-3.5" />
                                                                                    Editar
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                if (isOverdue) {
                                                                    return (
                                                                        <div className="grid grid-cols-1 items-center justify-items-center group/badge w-full mt-1">
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 group-hover/cell:opacity-0">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800 ring-1 ring-rose-500/10">
                                                                                    <ExclamationTriangleIcon className="w-3.5 h-3.5 animate-pulse" />
                                                                                    -{daysOverdue}d
                                                                                </span>
                                                                            </div>
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 opacity-0 group-hover/cell:opacity-100">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700 cursor-pointer">
                                                                                    <PlusIcon className="w-3.5 h-3.5" />
                                                                                    Pagar
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                if (isPending && (isCurrentMonth(monthDate) || !(daysRemaining > 45))) {
                                                                    return (
                                                                        <div className="grid grid-cols-1 items-center justify-items-center group/badge w-full mt-1">
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 group-hover/cell:opacity-0">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800 ring-1 ring-amber-500/10">
                                                                                    <ClockIcon className="w-3.5 h-3.5" />
                                                                                    {daysRemaining === 0 ? 'Hoy' : `${daysRemaining}d`}
                                                                                </span>
                                                                            </div>
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 opacity-0 group-hover/cell:opacity-100">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700 cursor-pointer">
                                                                                    <PlusIcon className="w-3.5 h-3.5" />
                                                                                    Pagar
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                // Default: Scheduled / Future
                                                                return (
                                                                    <div className="grid grid-cols-1 items-center justify-items-center group/badge w-full mt-1">
                                                                        <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 group-hover/cell:opacity-0">
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                                <CalendarIcon className="w-3.5 h-3.5" />
                                                                                Prog.
                                                                            </span>
                                                                        </div>
                                                                        <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 opacity-0 group-hover/cell:opacity-100">
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 cursor-pointer">
                                                                                <PlusIcon className="w-3.5 h-3.5" />
                                                                                Pagar
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            };
                                                            const isFocused = monthDate.getMonth() === focusedDate.getMonth() && monthDate.getFullYear() === focusedDate.getFullYear();
                                                            const isCurrent = isCurrentMonth(monthDate);

                                                            return (
                                                                <td
                                                                    key={mi}
                                                                    className="p-1 h-[1px]" // Removed background track
                                                                    onClick={() => onRecordPayment(commitment.id, dateToPeriod(monthDate))}
                                                                >
                                                                    {/* Mini Bento Card for payment cell */}
                                                                    <div className={`
                                                                        rounded-xl w-full h-full transition-all duration-200 cursor-pointer
                                                                        flex flex-col items-center justify-center border
                                                                        ${density === 'minimal' ? 'px-1 py-0.5 min-h-[46px]' : density === 'compact' ? 'px-1.5 py-1 min-h-[62px]' : 'px-2 py-2 min-h-[78px]'}
                                                                        ${isFocused || isCurrent
                                                                            ? 'border-slate-400/40 dark:border-slate-500/50 bg-slate-100 dark:bg-slate-800/60 border-2' // Active: Unified structural style
                                                                            : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50' // Default
                                                                        }
                                                                        ${isDisabled ? 'opacity-40 bg-slate-950/30 border-slate-800/40' : ''}
                                                                        ${isGap && !isDisabled ? 'bg-transparent border-dashed border-slate-700/40' : ''}
                                                                    `}>
                                                                        {/* GAP: No term for this period */}
                                                                        {!term && !isPaid ? (
                                                                            <div className="flex items-center justify-center h-full w-full text-slate-400 dark:text-slate-600 select-none" title="Sin término activo en este período">
                                                                                <Minus className="w-5 h-5" />
                                                                            </div>
                                                                        ) : !term && isPaid ? (
                                                                            /* ORPHAN: Payment without term */
                                                                            <div className="space-y-1">
                                                                                <div className="font-bold font-mono tabular-nums text-base text-orange-600 dark:text-orange-500" title="⚠️ Pago registrado sin término activo">
                                                                                    {formatClp(paidAmount!)} ⚠️
                                                                                </div>
                                                                                <div className="text-xs text-orange-500">
                                                                                    Pago huérfano
                                                                                </div>
                                                                            </div>
                                                                        ) : (isActive || isPaid) ? (
                                                                            /* === MINIMAL VIEW: Amount + icon only === */
                                                                            density === 'minimal' ? (
                                                                                <CompactTooltip
                                                                                    triggerClassName="p-0"
                                                                                    sideOffset={8}
                                                                                    content={
                                                                                        <div className="min-w-[130px] text-slate-800 dark:text-slate-100">
                                                                                            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5">
                                                                                                {monthDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                                                                                            </div>
                                                                                            <div className="text-base font-bold font-mono tabular-nums">
                                                                                                {formatClp(displayAmount!)}
                                                                                            </div>
                                                                                            {(cuotaNumber && installmentsCount && installmentsCount > 1) && (
                                                                                                <div className="text-[10px] text-slate-500 mt-1">
                                                                                                    Cuota {cuotaNumber}/{installmentsCount}
                                                                                                </div>
                                                                                            )}
                                                                                            <div className={`text-[10px] font-medium mt-1.5 ${isPaid ? 'text-emerald-600 dark:text-emerald-400' :
                                                                                                isOverdue ? 'text-rose-600 dark:text-rose-400' :
                                                                                                    'text-amber-600 dark:text-amber-400'
                                                                                                }`}>
                                                                                                {isPaid ? '✓ Pagado' : isOverdue ? '⚠ Vencido' : '⏱ Pendiente'}
                                                                                            </div>
                                                                                        </div>
                                                                                    }
                                                                                >
                                                                                    {/* Minimal cell: ONLY status icon (centered, larger for visibility) */}
                                                                                    <div className="flex items-center justify-center h-full w-full">
                                                                                        {isPaid ? (
                                                                                            <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
                                                                                        ) : isOverdue ? (
                                                                                            <ExclamationTriangleIcon className="w-6 h-6 text-rose-500 animate-pulse" />
                                                                                        ) : isPending ? (
                                                                                            <ClockIcon className="w-6 h-6 text-amber-500" />
                                                                                        ) : isDisabled ? (
                                                                                            <CalendarIcon className="w-5 h-5 text-slate-400 dark:text-slate-600" />
                                                                                        ) : (
                                                                                            <CalendarIcon className="w-6 h-6 text-sky-400" />
                                                                                        )}
                                                                                    </div>
                                                                                </CompactTooltip>
                                                                            ) :
                                                                                /* === COMPACT VIEW: Rectangular pill badges === */
                                                                                density === 'compact' ? (
                                                                                    <CompactTooltip
                                                                                        triggerClassName={pad}
                                                                                        sideOffset={14}
                                                                                        content={
                                                                                            <div className="min-w-[140px] text-slate-800 dark:text-slate-100">
                                                                                                {/* --- HEADER: Fecha del período --- */}
                                                                                                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-2">
                                                                                                    {monthDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                                                                                                </div>

                                                                                                {/* --- CONTENT: Monto + Badge en línea --- */}
                                                                                                <div className="flex items-center justify-between gap-3 mb-1">
                                                                                                    {/* Monto - protagonista, siempre neutro */}
                                                                                                    <div className="text-base font-semibold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                                                                                                        {formatClp(displayAmount!)}
                                                                                                    </div>
                                                                                                    {/* Badge de estado compacto */}
                                                                                                    {isPaid ? (
                                                                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-inset ring-emerald-500/20 px-2 py-0.5 rounded-full">
                                                                                                            <CheckCircleIcon className="w-3.5 h-3.5" />
                                                                                                            Pagado
                                                                                                        </span>
                                                                                                    ) : isOverdue ? (
                                                                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 ring-1 ring-inset ring-red-500/20 px-2 py-0.5 rounded-full">
                                                                                                            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                                                                                            Vencido
                                                                                                        </span>
                                                                                                    ) : isDisabled ? (
                                                                                                        <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                                                                                                            <CalendarIcon className="w-3.5 h-3.5" />
                                                                                                            Futuro
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                                                                                                            <ClockIcon className="w-3.5 h-3.5" />
                                                                                                            Pendiente
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>

                                                                                                {/* Original Currency (si aplica) */}
                                                                                                {showOriginalCurrency && (
                                                                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums mb-1">
                                                                                                        {originalCurrency} {perPeriodOriginal?.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                                    </div>
                                                                                                )}

                                                                                                {/* Cuota info (si aplica) */}
                                                                                                {(cuotaNumber && installmentsCount && installmentsCount > 1) ? (
                                                                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                                                        {term?.is_divided_amount ? 'Cuota' : 'Pago'} {cuotaNumber}/{installmentsCount}
                                                                                                    </div>
                                                                                                ) : term && term.effective_from && term.frequency === 'MONTHLY' && (!installmentsCount || installmentsCount <= 1) ? (
                                                                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                                                        Pago {(() => {
                                                                                                            const [startYear, startMonth] = term.effective_from.split('-').map(Number);
                                                                                                            const paymentNumber = (monthDate.getFullYear() - startYear) * 12 +
                                                                                                                (monthDate.getMonth() + 1 - startMonth) + 1;
                                                                                                            return paymentNumber > 0 ? paymentNumber : 1;
                                                                                                        })()}/∞
                                                                                                    </div>
                                                                                                ) : null}

                                                                                                {/* --- FOOTER: Fecha relativa + CTA --- */}
                                                                                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                                                                                                    <span className="text-slate-400 dark:text-slate-500">
                                                                                                        {isPaid && currentPayment?.payment_date ? (
                                                                                                            `Pagado: ${new Date(currentPayment.payment_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
                                                                                                        ) : isOverdue ? (
                                                                                                            `Venció hace ${daysOverdue} ${daysOverdue === 1 ? 'día' : 'días'}`
                                                                                                        ) : daysRemaining === 0 ? (
                                                                                                            'Vence hoy'
                                                                                                        ) : isCurrentMonth(monthDate) ? (
                                                                                                            `Vence en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}`
                                                                                                        ) : (
                                                                                                            `Vence: ${new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
                                                                                                        )}
                                                                                                    </span>
                                                                                                    {!isPaid && !isDisabled && (
                                                                                                        <span className="text-sky-500 dark:text-sky-400 font-medium">
                                                                                                            Click →
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        }
                                                                                    >
                                                                                        <div className="flex items-center justify-between w-full h-full px-1 gap-2">
                                                                                            {/* Left: Status Icon (Sutil) */}
                                                                                            <div className={`opacity-60 transition-opacity group-hover/cell:opacity-100 ${isPaid ? 'text-emerald-600 dark:text-emerald-400' :
                                                                                                isOverdue ? 'text-rose-500 dark:text-rose-400' :
                                                                                                    'text-slate-400 dark:text-slate-500'
                                                                                                }`}>
                                                                                                {isPaid ? <CheckCircleIcon className="w-3.5 h-3.5" /> :
                                                                                                    isOverdue ? <ExclamationTriangleIcon className="w-3.5 h-3.5" /> :
                                                                                                        isPending ? <ClockIcon className="w-3.5 h-3.5" /> :
                                                                                                            (installmentsCount && installmentsCount > 1) ? <CalendarIcon className="w-3.5 h-3.5" /> :
                                                                                                                null}
                                                                                            </div>

                                                                                            {/* Right: Amount + Cuota */}
                                                                                            <div className="flex flex-col items-end leading-none">
                                                                                                <span className={`text-sm font-semibold tabular-nums ${isPaid ? 'text-emerald-800 dark:text-emerald-200' :
                                                                                                    isOverdue ? 'text-rose-700 dark:text-rose-300' :
                                                                                                        'text-slate-700 dark:text-slate-200'
                                                                                                    }`}>
                                                                                                    {formatClp(displayAmount!)}
                                                                                                </span>
                                                                                                {(cuotaNumber && installmentsCount && installmentsCount > 1) && (
                                                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                                                                                        {cuotaNumber}/{installmentsCount}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </CompactTooltip>
                                                                                ) : (
                                                                                    /* === FULL VIEW: Optimized hierarchy === */
                                                                                    <div
                                                                                        className={`${pad} relative h-full flex flex-col justify-between cursor-pointer py-1.5`}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onRecordPayment(commitment.id, dateToPeriod(monthDate));
                                                                                        }}
                                                                                    >
                                                                                        {/* ROW 1: Amount - PROTAGONISTA */}
                                                                                        <div className="text-center">
                                                                                            <span className="font-bold font-mono tabular-nums text-xl text-slate-900 dark:text-white tracking-tight">
                                                                                                {formatClp(displayAmount)}
                                                                                            </span>
                                                                                            {/* Original currency inline */}
                                                                                            {showOriginalCurrency && (
                                                                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums -mt-0.5">
                                                                                                    {originalCurrency} {perPeriodOriginal.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* ROW 2: Metadata compacta - una sola línea */}
                                                                                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                                                                            {/* Fecha */}
                                                                                            <span>
                                                                                                {isPaid && currentPayment?.payment_date
                                                                                                    ? new Date(currentPayment.payment_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
                                                                                                    : `${dueDay} ${monthDate.toLocaleDateString('es-CL', { month: 'short' })}`
                                                                                                }
                                                                                            </span>
                                                                                            {/* Separator + Cuota/Pago */}
                                                                                            {(cuotaNumber && installmentsCount && installmentsCount > 1) ? (
                                                                                                <>
                                                                                                    <span className="text-slate-300 dark:text-slate-600">·</span>
                                                                                                    <span className="font-medium">{cuotaNumber}/{installmentsCount}</span>
                                                                                                </>
                                                                                            ) : term && term.effective_from && term.frequency === 'MONTHLY' && (!installmentsCount || installmentsCount <= 1) ? (
                                                                                                <>
                                                                                                    <span className="text-slate-300 dark:text-slate-600">·</span>
                                                                                                    <span className="font-medium">
                                                                                                        {(() => {
                                                                                                            const [startYear, startMonth] = term.effective_from.split('-').map(Number);
                                                                                                            const paymentNumber = (monthDate.getFullYear() - startYear) * 12 +
                                                                                                                (monthDate.getMonth() + 1 - startMonth) + 1;
                                                                                                            return paymentNumber > 0 ? paymentNumber : 1;
                                                                                                        })()}/∞
                                                                                                    </span>
                                                                                                </>
                                                                                            ) : null}
                                                                                        </div>

                                                                                        {/* ROW 3: Status - icono pequeño + texto corto */}
                                                                                        <div className="flex items-center justify-center">
                                                                                            {/* ROW 3: Status - Rendered via helper to avoid nesting hell */}
                                                                                            <div className="flex items-center justify-center">
                                                                                                {renderStatusBadge()}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )
                                                                        ) : (
                                                                            <div className="text-slate-300 dark:text-slate-600">—</div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div >

                    {/* Grid Footer: Legend + Stats */}
                    <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-900/80">
                        {/* Left: Legend */}
                        <div className="hidden md:flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg px-3 py-1.5">
                            <div className="flex items-center gap-1.5" title="Pagado">
                                <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Pagado</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Pendiente">
                                <ClockIcon className="w-3.5 h-3.5 text-amber-500" />
                                <span>Pendiente</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Vencido">
                                <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-500" />
                                <span>Vencido</span>
                            </div>
                            <div className="w-px h-3 bg-slate-300 dark:bg-slate-600" />
                            <div className="flex items-center gap-1.5" title="Recurrente mensual">
                                <RefreshCw className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                <span>Mensual</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Plazo definido/Cuotas">
                                <CalendarIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                <span>Definido</span>
                            </div>
                        </div>

                        {/* Right: Stats */}
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {groupedCommitments.reduce((sum, g) => sum + g.commitments.length, 0)} compromisos · {effectiveMonthCount} meses
                        </div>
                    </div>

                </div >

                {/* KPI Selector Bottom Sheet (Mobile Only) */}
                {/* KPI Selector Bottom Sheet (Mobile Only) */}
                <KPISelectorModal
                    isOpen={showKPISelector}
                    onClose={() => setShowKPISelector(false)}
                    totals={getMonthTotals(focusedDate.getFullYear(), focusedDate.getMonth())}
                    currentKPI={currentKPI}
                    onSelect={(kpi) => {
                        handleKPIChange(kpi);
                        setShowKPISelector(false);
                    }}
                />

            </div >
        </div >
    );
};

export default ExpenseGridVirtual2;
