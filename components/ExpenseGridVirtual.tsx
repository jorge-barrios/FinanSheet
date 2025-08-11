import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Expense, PaymentStatus } from '../types';
import { useLocalization } from '../hooks/useLocalization';
import ExpenseCard from './ExpenseCard';
import { EditIcon, TrashIcon } from './icons';
import { getInstallmentAmount, getInstallmentNumber, isInstallmentInMonth } from '../utils/expenseCalculations';

interface ExpenseGridVirtualProps {
    expenses: Expense[];
    paymentStatus: PaymentStatus;
    focusedDate: Date;
    visibleMonthsCount: number;
    onEditExpense: (expense: Expense) => void;
    onDeleteExpense: (expenseId: string) => void;
    onOpenCellEditor: (expenseId: string, year: number, month: number) => void;
    onFocusedDateChange?: (date: Date) => void;
}

const ExpenseGridVirtual: React.FC<ExpenseGridVirtualProps> = ({
    expenses,
    paymentStatus,
    focusedDate,
    visibleMonthsCount,
    onEditExpense,
    onDeleteExpense,
    onOpenCellEditor
}) => {
    const { t } = useLocalization();

    // Category normalization: merge English/Spanish variants under one canonical id and Spanish label
    const stripAccents = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const norm = (s: string) => stripAccents((s || '').toLowerCase().trim());
    const CATEGORY_LABELS_ES: Record<string, string> = {
        housing: 'Vivienda',
        food: 'Alimentación',
        transport: 'Transporte',
        utilities: 'Servicios',
        subscriptions: 'Suscripciones',
        entertainment: 'Entretenimiento',
        health: 'Salud',
        education: 'Educación',
        insurance: 'Seguros',
        savings: 'Ahorro',
        taxes: 'Impuestos',
        shopping: 'Compras',
        other: 'Otros',
    };
    const CATEGORY_SYNONYMS: Record<string, string> = {
        // Vivienda / Housing
        'vivienda': 'housing', 'arriendo': 'housing', 'renta': 'housing', 'alquiler': 'housing', 'mortgage': 'housing', 'rent': 'housing', 'housing': 'housing',
        // Alimentación / Food
        'alimentacion': 'food', 'comida': 'food', 'supermercado': 'food', 'food': 'food', 'groceries': 'food',
        // Transporte / Transport
        'transporte': 'transport', 'transport': 'transport', 'gasolina': 'transport', 'combustible': 'transport', 'fuel': 'transport', 'parking': 'transport', 'estacionamiento': 'transport',
        // Servicios / Utilities
        'servicios': 'utilities', 'utilities': 'utilities', 'luz': 'utilities', 'electricidad': 'utilities', 'agua': 'utilities', 'internet': 'utilities', 'gas': 'utilities',
        // Suscripciones / Subscriptions
        'suscripciones': 'subscriptions', 'suscripcion': 'subscriptions', 'subscription': 'subscriptions', 'subscriptions': 'subscriptions',
        // Entretenimiento / Entertainment
        'entretenimiento': 'entertainment', 'entertainment': 'entertainment', 'netflix': 'entertainment', 'spotify': 'entertainment',
        // Salud / Health
        'salud': 'health', 'health': 'health', 'medico': 'health', 'isapre': 'health', 'seguro medico': 'health',
        // Educación / Education
        'educacion': 'education', 'education': 'education', 'colegio': 'education', 'universidad': 'education',
        // Seguros / Insurance
        'seguros': 'insurance', 'seguro': 'insurance', 'insurance': 'insurance',
        // Ahorro / Savings
        'ahorro': 'savings', 'savings': 'savings',
        // Impuestos / Taxes
        'impuestos': 'taxes', 'taxes': 'taxes', 'tax': 'taxes',
        // Compras / Shopping
        'compras': 'shopping', 'shopping': 'shopping',
        // Otros / Other
        'otros': 'other', 'otro': 'other', 'misc': 'other', 'otros gastos': 'other', 'other': 'other',
    };
    const getCategoryId = (raw: string) => {
        const n = norm(raw);
        return CATEGORY_SYNONYMS[n] || (n || 'other');
    };
    const getCategoryLabel = (raw: string) => CATEGORY_LABELS_ES[getCategoryId(raw)] || (raw || 'Otros');

    // Generar meses visibles centrados en focusedDate según visibleMonthsCount
    const visibleMonths = useMemo(() => {
        const count = Math.max(1, Math.min(visibleMonthsCount ?? 5, 25));
        const months: Date[] = [];
        const center = new Date(focusedDate);
        center.setDate(1);
        // Distribución centrada (sesgo leve al futuro cuando es par)
        const before = Math.floor((count - 1) / 2);
        const start = new Date(center);
        start.setMonth(center.getMonth() - before);
        for (let i = 0; i < count; i++) {
            const d = new Date(start);
            d.setMonth(start.getMonth() + i);
            months.push(d);
        }
        return months;
    }, [focusedDate, visibleMonthsCount]);

    // Agrupar gastos por categoría
    const groupedExpenses = useMemo(() => {
        const groups: { [id: string]: { label: string; items: Expense[] } } = {};
        expenses.forEach(expense => {
            const id = getCategoryId(expense.category);
            if (!groups[id]) groups[id] = { label: getCategoryLabel(expense.category), items: [] };
            groups[id].items.push(expense);
        });
        // Stable order: by label asc
        return Object.entries(groups)
            .sort((a, b) => a[1].label.localeCompare(b[1].label, 'es'))
            .map(([, g]) => ({ category: g.label, expenses: g.items }));
    }, [expenses]);

    const formatClp = (amount: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const isCurrentMonth = (date: Date) => {
        const today = new Date();
        return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    };

    // Dynamic height for desktop grid: measure element position and fit to viewport
    const scrollAreaRef = useRef<HTMLDivElement | null>(null);
    const [availableHeight, setAvailableHeight] = useState<number>(380);
    const [headerHeight, setHeaderHeight] = useState<number>(64);
    const footerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const calcFixedBottomOverlays = (containerRect: DOMRect) => {
            const vh = window.innerHeight || document.documentElement.clientHeight;
            let total = 0;
            // Specific known overlay
            const preview = document.getElementById('windsurf-browser-preview-root') as HTMLElement | null;
            if (preview) {
                const ps = getComputedStyle(preview);
                const r = preview.getBoundingClientRect();
                const overlapsH = r.right > containerRect.left && r.left < containerRect.right;
                if (ps.position === 'fixed' && overlapsH && r.bottom > vh - 1 && r.top < vh) total += r.height;
            }
            // Another known overlay
            const info = document.getElementById('element-info-banner') as HTMLElement | null;
            if (info) {
                const ps2 = getComputedStyle(info);
                const r2 = info.getBoundingClientRect();
                const overlapsH2 = r2.right > containerRect.left && r2.left < containerRect.right;
                if (ps2.position === 'fixed' && overlapsH2 && r2.bottom > vh - 1 && r2.top < vh) total += r2.height;
            }
            // Generic scan for fixed bottom elements overlapping viewport bottom
            const nodes = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
            let counted = 0;
            for (const n of nodes) {
                if (counted > 300) break; // safety
                counted++;
                const cs = getComputedStyle(n);
                if (cs.position !== 'fixed') continue;
                const rect = n.getBoundingClientRect();
                if (rect.height === 0) continue;
                // overlaps with viewport bottom stripe
                const overlapsH3 = rect.right > containerRect.left && rect.left < containerRect.right;
                if (overlapsH3 && rect.bottom > vh - 1 && rect.top < vh) {
                    total += rect.height;
                }
            }
            return total;
        };

        const recalc = () => {
            const el = scrollAreaRef.current;
            if (!el) return;
            // Measure sticky header height dynamically (thead)
            const thead = el.querySelector('thead') as HTMLElement | null;
            if (thead) {
                const h = thead.offsetHeight || 0;
                if (h && Math.abs(h - headerHeight) > 1) setHeaderHeight(h);
            }
            const rect = el.getBoundingClientRect();
            const top = rect.top;
            const vh = window.innerHeight || document.documentElement.clientHeight;
            // account for parent bottom padding and footer height to avoid pushing layout
            const parent = el.parentElement as HTMLElement | null;
            const parentPad = parent ? parseFloat(getComputedStyle(parent).paddingBottom || '0') : 0;
            const footerH = footerRef.current ? footerRef.current.offsetHeight : 0;
            // account for fixed bottom overlays (e.g., preview tool) and any other fixed bottom elements
            let fixedBottomOverlay = calcFixedBottomOverlays(rect);
            const bottomMargin = 16 + parentPad + footerH + fixedBottomOverlay; // breathing room + parent padding + footer + overlays

            // Detect a fixed/sticky header to subtract its height explicitly (supports div-based headers)
            const candidates = [
                '[data-app-header]',
                '[data-header]',
                'header[role="banner"]',
                '[role="banner"]',
                'header.app-header',
                'div.app-header',
                '.sticky-header',
                '#root > div > div.flex-1.flex.flex-col.min-w-0.bg-slate-100\\/50.dark\\:bg-slate-900 > header',
                'header',
            ];
            let headerH = 0;
            // Check candidate selectors
            for (const sel of candidates) {
                const hdr = document.querySelector(sel) as HTMLElement | null;
                if (hdr) {
                    const cs = getComputedStyle(hdr);
                    const pos = cs.position;
                    if ((pos === 'fixed' || pos === 'sticky')) {
                        headerH = Math.max(headerH, hdr.offsetHeight);
                    }
                }
            }
            // Special-case: #windsurf-browser-preview-root acting as a top header (rare but possible in tools)
            const previewAsHeader = document.getElementById('windsurf-browser-preview-root') as HTMLElement | null;
            if (previewAsHeader) {
                const csP = getComputedStyle(previewAsHeader);
                if (csP.position === 'fixed') {
                    const rP = previewAsHeader.getBoundingClientRect();
                    // Only treat as header if it overlaps the top edge region
                    if (rP.top <= 0 && rP.bottom > 0) {
                        headerH = Math.max(headerH, previewAsHeader.offsetHeight);
                    }
                }
            }
            // Fallback: scan common top-level containers for fixed/sticky at top
            if (headerH === 0) {
                const all = Array.from(document.querySelectorAll('header, [role="banner"], [data-app-header], [data-header], .app-header, .sticky-header')) as HTMLElement[];
                for (const el2 of all) {
                    const cs2 = getComputedStyle(el2);
                    if ((cs2.position === 'fixed' || cs2.position === 'sticky')) {
                        const r2 = el2.getBoundingClientRect();
                        if (r2.top <= 0 && r2.bottom > 0) {
                            headerH = Math.max(headerH, el2.offsetHeight);
                        }
                    }
                }
            }

            // Only subtract header height if the grid starts under an overlaid header (top very close to 0)
            const effectiveHeader = top <= headerH + 1 ? headerH : 0;
            // Account for element borders and horizontal scrollbar thickness to avoid 1px overflow
            const csEl = getComputedStyle(el);
            const borderY = parseFloat(csEl.borderTopWidth || '0') + parseFloat(csEl.borderBottomWidth || '0');
            const hScrollThickness = Math.max(0, el.offsetHeight - el.clientHeight);
            const fudge = 4; // prevent off-by-one overflow and rounding differences
            const h = Math.max(240, vh - top - bottomMargin - effectiveHeader - borderY - hScrollThickness - fudge);
            // Debug info to verify overflow sources
            if (process.env.NODE_ENV !== 'production') {
                console.debug('[Grid Height Calc]', {
                    vh,
                    top,
                    parentPad,
                    footerH,
                    fixedBottomOverlay,
                    headerH,
                    effectiveHeader,
                    borderY,
                    hScrollThickness,
                    fudge,
                    computedHeight: h,
                });
            }
            setAvailableHeight(h);
        };

        recalc();
        window.addEventListener('resize', recalc);
        window.addEventListener('orientationchange', recalc as any);

        // Observe layout changes affecting position/size
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => recalc()) : null;
        if (ro) {
            ro.observe(document.body);
        }
        // Observe DOM changes that could add/remove overlays
        const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => recalc()) : null;
        if (mo) {
            mo.observe(document.body, { childList: true, subtree: true, attributes: true });
        }
        // Lock page vertical scroll on desktop to avoid double scroll
        const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
        let prevOverflow = '';
        let prevBodyOverflow = '';
        let prevHtmlHeight = '';
        let prevBodyHeight = '';
        if (isDesktop()) {
            prevOverflow = document.documentElement.style.overflow;
            document.documentElement.style.overflow = 'hidden';
            prevBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            // Lock heights to avoid layout growth triggering page scroll
            prevHtmlHeight = document.documentElement.style.height;
            prevBodyHeight = document.body.style.height;
            document.documentElement.style.height = '100%';
            document.body.style.height = '100%';
        }
        return () => {
            window.removeEventListener('resize', recalc);
            window.removeEventListener('orientationchange', recalc as any);
            if (ro) ro.disconnect();
            if (mo) mo.disconnect();
            if (isDesktop()) {
                document.documentElement.style.overflow = prevOverflow;
                document.body.style.overflow = prevBodyOverflow;
                document.documentElement.style.height = prevHtmlHeight;
                document.body.style.height = prevBodyHeight;
            }
        };
    }, []);

    return (
        <div className="px-4 pb-6 lg:pb-0 lg:overflow-hidden" style={{ overscrollBehaviorY: 'none' as any }}>
            {/* Vista móvil */}
            <div className="lg:hidden space-y-4">
                {expenses.length > 0 ? expenses.map(expense => (
                    <ExpenseCard
                        key={expense.id}
                        expense={expense}
                        paymentStatus={paymentStatus}
                        currentYear={new Date().getFullYear()}
                        onEditExpense={onEditExpense}
                        onDeleteExpense={onDeleteExpense}
                        onOpenCellEditor={onOpenCellEditor}
                    />
                )) : (
                    <div className="text-center py-16 text-slate-500">
                        <p className="text-lg">{t('grid.noMatch')}</p>
                    </div>
                )}
            </div>

            {/* Vista desktop simplificada - SIN navegación duplicada */}
            <div className="hidden lg:block">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden">
                    {/* Header simple sin navegación */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Grilla de Gastos
                            </h2>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                Vista centrada en mes actual • 5 meses
                            </div>
                        </div>
                    </div>
                    
                    {/* Grilla con altura optimizada */}
                    <div className="relative">
                        <div 
                            ref={scrollAreaRef}
                            className="relative overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent pr-1 box-border m-0"
                            style={{
                                height: `${availableHeight}px`,
                                overscrollBehavior: 'contain' as any,
                                scrollbarGutter: 'stable both-edges' as any,
                                // No autosnap; keep natural scroll without added top gap
                                scrollSnapType: 'none',
                                scrollBehavior: 'smooth',
                                paddingTop: 0,
                                paddingBottom: '6px'
                            }}
                            onScroll={undefined}
                        >
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 z-30 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        {/* Columna de categorías sticky */}
                                        <th className="sticky left-0 z-40 bg-slate-50 dark:bg-slate-800 text-left p-4 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 min-w-[200px]">
                                            Categoría / Gasto
                                        </th>
                                        
                                        {/* Headers de meses */}
                                        {visibleMonths.map((month, index) => (
                                            <th 
                                                key={index}
                                                className={`text-center p-4 font-semibold border-r border-slate-200 dark:border-slate-700 last:border-r-0 min-w-[160px] ${
                                                    isCurrentMonth(month) 
                                                        ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-l-4 border-l-teal-500' 
                                                        : 'text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                <div className="space-y-1">
                                                    <div className="text-sm font-medium capitalize">
                                                        {month.toLocaleDateString('es-ES', { month: 'long' })}
                                                    </div>
                                                    <div className="text-xs opacity-75">
                                                        {month.getFullYear()}
                                                    </div>
                                                    {isCurrentMonth(month) && (
                                                        <div className="text-xs font-bold text-teal-600 dark:text-teal-400">
                                                            Actual
                                                        </div>
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedExpenses.map(({ category, expenses: categoryExpenses }) => (
                                        <React.Fragment key={category}>
                                            {/* Fila de categoría */}
                                            <tr className="bg-slate-100 dark:bg-slate-800/50" data-row="category" style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' as any }}>
                                                <td 
                                                    colSpan={visibleMonths.length + 1}
                                                    className="sticky left-0 z-30 bg-slate-100 dark:bg-slate-800/50 p-3 font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700"
                                                >
                                                    {category}
                                                </td>
                                            </tr>
                                            
                                            {/* Filas de gastos */}
                                            {categoryExpenses.map(expense => (
                                                <tr
                                                    key={expense.id}
                                                    className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                                    data-row="expense"
                                                    style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' as any }}
                                                >
                                                    {/* Nombre del gasto */}
                                                    <td className="sticky left-0 z-20 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/30 p-4 border-r border-slate-200 dark:border-slate-700">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <div className="font-medium text-slate-900 dark:text-white">
                                                                    {expense.name}
                                                                </div>
                                                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                                                    {expense.type === 'RECURRING' && '🔄 Recurrente'}
                                                                    {expense.type === 'INSTALLMENT' && '📅 Cuotas'}
                                                                    {expense.type === 'VARIABLE' && '📊 Variable'}
                                                                </div>
                                                            </div>
                                                            <div className="shrink-0 flex items-center gap-1 opacity-80 hover:opacity-100">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); onEditExpense(expense); }}
                                                                    aria-label={`Editar ${expense.name}`}
                                                                    className="text-slate-500 dark:text-slate-400 hover:text-teal-500 dark:hover:text-teal-400 p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50"
                                                                >
                                                                    <EditIcon />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); onDeleteExpense(expense.id); }}
                                                                    aria-label={`Eliminar ${expense.name}`}
                                                                    className="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50"
                                                                >
                                                                    <TrashIcon />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Columnas de meses */}
                                                    {visibleMonths.map((month, monthIndex) => {
                                                        const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
                                                        const paymentDetails = paymentStatus[expense.id]?.[monthKey];

                                                        // Compute amount: prefer overridden amount, else base installment amount
                                                        const baseAmount = getInstallmentAmount(expense);
                                                        const displayAmount = paymentDetails?.overriddenAmount ?? baseAmount;
                                                        const installmentNumber = expense.type === 'INSTALLMENT' 
                                                            ? getInstallmentNumber(expense, month.getFullYear(), month.getMonth()) 
                                                            : null;

                                                        // Desktop status text aligned with mobile card
                                                        const isPaid = paymentDetails?.paid ?? false;
                                                        const dueDay = paymentDetails?.overriddenDueDate ?? expense.dueDate;
                                                        const dueDateForMonth = new Date(month.getFullYear(), month.getMonth(), (dueDay || 1));
                                                        const today = new Date();
                                                        today.setHours(0, 0, 0, 0);
                                                        const isCurrent = today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth();

                                                        // Determine if expense applies in this month to avoid showing invented months
                                                        let isActiveThisMonth = true;
                                                        if (expense.type === 'INSTALLMENT') {
                                                            isActiveThisMonth = isInstallmentInMonth(expense, month.getFullYear(), month.getMonth());
                                                        } else if (expense.type === 'RECURRING') {
                                                            if (expense.startDate) {
                                                                // Parse YYYY-MM-DD manually to avoid timezone shifts with new Date(string)
                                                                const [yStr, mStr] = expense.startDate.split('-');
                                                                const sYear = Number(yStr);
                                                                const sMonth0 = Number(mStr) - 1; // 0-based
                                                                const startYm = new Date(sYear, sMonth0, 1).getTime();
                                                                const ym = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
                                                                isActiveThisMonth = ym >= startYm;
                                                            }
                                                        } else if (expense.type === 'VARIABLE') {
                                                            // Only active if there is data for that month; allow + only on current month
                                                            isActiveThisMonth = !!paymentDetails || isCurrent;
                                                        }

                                                        type StatusKind = 'paid' | 'overdue' | 'pending' | null;
                                                        let status: StatusKind = null;
                                                        let statusText: string | null = null;
                                                        let showStar = false;

                                                        if (isActiveThisMonth && isPaid && paymentDetails?.paymentDate) {
                                                            status = 'paid';
                                                            const paymentDate = new Date(paymentDetails.paymentDate);
                                                            showStar = paymentDate <= dueDateForMonth; // paid on time
                                                            const formattedDate = paymentDate.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                                            statusText = `Pagado ${formattedDate}`;
                                                        } else if (isActiveThisMonth && dueDateForMonth < today) {
                                                            // Past months (or current before due) without paid -> overdue
                                                            status = 'overdue';
                                                            const daysOverdue = Math.floor((today.getTime() - dueDateForMonth.getTime()) / (1000 * 60 * 60 * 24));
                                                            statusText = `Atrasado (${daysOverdue} día${daysOverdue !== 1 ? 's' : ''})`;
                                                        } else if (isActiveThisMonth && isCurrent) {
                                                            // Current month and not overdue yet -> pending
                                                            status = 'pending';
                                                            const daysUntilDue = Math.floor((dueDateForMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                                            statusText = `Pendiente (${daysUntilDue} día${daysUntilDue !== 1 ? 's' : ''} restantes)`;
                                                        } else {
                                                            status = null; // no badge for non-current months without a payment
                                                            statusText = null;
                                                        }

                                                        return (
                                                            <td 
                                                                key={monthIndex}
                                                                className="p-4 text-right border-r border-slate-200 dark:border-slate-700 last:border-r-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                                                                role="button"
                                                                tabIndex={0}
                                                                aria-label={`Editar ${expense.name} - ${month.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}`}
                                                                onClick={() => onOpenCellEditor(expense.id, month.getFullYear(), month.getMonth())}
                                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenCellEditor(expense.id, month.getFullYear(), month.getMonth()); }}
                                                            >
                                                                {isActiveThisMonth && (paymentDetails || status) ? (
                                                                    <div className="space-y-1">
                                                                        <div className="font-semibold font-mono tabular-nums text-right text-slate-900 dark:text-white">
                                                                            {formatClp(displayAmount)}
                                                                        </div>
                                                                        {installmentNumber && (
                                                                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                                Cuota {installmentNumber}/{expense.installments}
                                                                            </div>
                                                                        )}
                                                                        {status && (
                                                                            <div className={`text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full select-none ${
                                                                                status === 'paid'
                                                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                                                    : status === 'overdue'
                                                                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                                                                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                                                            }`}>
                                                                                <span>{statusText}</span>
                                                                                {showStar && <span className="text-yellow-500" title="Pagado a tiempo">⭐</span>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : isActiveThisMonth ? (
                                                                    <div className="space-y-2">
                                                                        <div className="font-mono tabular-nums text-right text-slate-400 dark:text-slate-500">
                                                                            {formatClp(displayAmount)}
                                                                        </div>
                                                                        {installmentNumber && (
                                                                            <div className="text-[11px] text-right text-slate-400 dark:text-slate-500">
                                                                                Cuota {installmentNumber}/{expense.installments}
                                                                            </div>
                                                                        )}
                                                                        <div className="text-slate-400 dark:text-slate-500">
                                                                            {isCurrent && (
                                                                                <button 
                                                                                    onClick={(e) => { e.stopPropagation(); onOpenCellEditor(expense.id, month.getFullYear(), month.getMonth()); }}
                                                                                    className="w-8 h-8 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-teal-500 dark:hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors flex items-center justify-center text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
                                                                                >
                                                                                    +
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-right text-slate-300 dark:text-slate-600 select-none">—</div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                            {/* Sin spacer: eliminamos espacios al inicio y final */}
                        </div>
                    </div>
                    
                    {/* Footer simplificado */}
                    <div ref={footerRef} className="p-3 text-center text-sm text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
                        <div className="text-xs">
                            Navegación controlada desde el header principal
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpenseGridVirtual;
