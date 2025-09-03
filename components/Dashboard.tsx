 import React, { useMemo, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import { Expense, PaymentStatus, ExpenseType } from '../types';
import { useLocalization } from '../hooks/useLocalization';
import { isInstallmentInMonth, isInstallmentInMonthWithVersioning, getInstallmentAmount, getInstallmentAmountForMonth } from '../utils/expenseCalculations';
import { XMarkIcon, CalendarIcon, ChevronDownIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from './icons';
import { toSpanishCanonical } from '../utils/categories';
import usePersistentState from '../hooks/usePersistentState';
import CurrencyService from '../services/currencyService';

Chart.register(...registerables);



interface DashboardProps {
    expenses: Expense[];
    paymentStatus: PaymentStatus;
    displayYear: number;
    displayMonth?: number; // 0-11 opcional; si no viene, usamos el mes actual
    isOpen: boolean;
    onClose: () => void;
}

interface DashboardBodyProps {
    expenses: Expense[];
    paymentStatus: PaymentStatus;
    displayYear: number;
    displayMonth?: number;
    onOpenCellEditor?: (expenseId: string, year: number, month: number) => void;
    onSelectMonth?: (monthIndex: number) => void;
    onRequestGoToTable?: (monthIndex: number) => void;
    // Controlled includeIncomes (optional)
    includeIncomes?: boolean;
    onChangeIncludeIncomes?: (value: boolean) => void;
}

// Removed stringToHslColor (unused)


export const DashboardBody: React.FC<DashboardBodyProps> = ({ expenses, paymentStatus, displayYear, displayMonth, onOpenCellEditor, onSelectMonth, onRequestGoToTable, includeIncomes: includeIncomesProp, onChangeIncludeIncomes }) => {
    const { t, formatClp } = useLocalization();
    const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    // Selected category for detail view
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    // Toggle to include incomes (negative amounts) in category chart (persisted so Sidebar can control it)
    const [includeIncomesLocal, setIncludeIncomesLocal] = usePersistentState<boolean>('finansheet-include-incomes', true);
    const includeIncomes = includeIncomesProp ?? includeIncomesLocal;
    const setIncludeIncomes = onChangeIncludeIncomes ?? setIncludeIncomesLocal;
    // Toggle: Net balance based on paid-only vs paid+pending
    const [balanceUsesPending, setBalanceUsesPending] = useState<boolean>(true);
    // Toggle: Split expenses bars into Paid vs Pending side-by-side
    const [splitExpenses, setSplitExpenses] = useState<boolean>(false);
    // Toggle: Show 3-month moving average over Net Balance
    const [showMovingAvg, setShowMovingAvg] = useState<boolean>(false);
    // Quick filters (persisted): include paid/pending expenses in aggregations
    const [includePaid] = usePersistentState<boolean>('finansheet-filter-include-paid', true); // setter unused here; controlled from Sidebar
    const [includePending] = usePersistentState<boolean>('finansheet-filter-include-pending', true);
    // Category filters (persisted)
    const [selectedCategories] = usePersistentState<string[]>('finansheet-filter-categories', []); // controlled from Sidebar
    const [, setAvailableCategories] = usePersistentState<string[]>('finansheet-available-categories', []);
    // Toggle for showing full list vs Top 5 in detail
    const [showAllCatItems, setShowAllCatItems] = useState<boolean>(false);
    const totalMonthlyLabel = React.useMemo(() => {
        const label = t('dashboard.totalMonthly');
        return label === 'dashboard.totalMonthly' ? 'Total mensual' : label;
    }, [t]);

    // Helper: compute amount for a given expense and month, applying overrides and current-rate recalc for future unpaid foreign-currency expenses
    const computeAmountForMonth = React.useCallback((expense: Expense, year: number, m: number) => {
        const ymKey = `${year}-${m}`;
        const details = paymentStatus[expense.id]?.[ymKey];
        const isPaid = !!details?.paid;
        const base = getInstallmentAmountForMonth(expenses, expense, year, m);
        // If there is an explicit overridden amount, prefer it
        if (typeof details?.overriddenAmount === 'number') {
            return { amount: details.overriddenAmount as number, isPaid };
        }
        // If future month, unpaid, and expense defined in foreign unit, recalc from original using current rate
        const now = new Date();
        const isFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && m > now.getMonth());
        if (!isPaid && isFutureMonth && (expense as any).originalCurrency && (expense as any).originalCurrency !== 'CLP' && typeof (expense as any).originalAmount === 'number') {
            const unit = (expense as any).originalCurrency as any;
            const perPaymentOriginal = (expense.type === ExpenseType.INSTALLMENT && (expense.installments || 0) > 0)
                ? ((expense as any).originalAmount as number) / (expense.installments as number)
                : ((expense as any).originalAmount as number);
            const converted = CurrencyService.fromUnit(perPaymentOriginal, unit);
            const safe = (Number.isFinite(converted) ? converted : 0);
            return { amount: safe, isPaid };
        }
        // Default fallback to base schedule amount
        return { amount: (Number.isFinite(base) ? base : 0), isPaid };
    }, [expenses, paymentStatus]);

    // Active month index used across interactions (keyboard, charts, badges)
    const activeMonthIndex = typeof displayMonth === 'number' ? displayMonth : new Date().getMonth();
    // Removed unused currentMonthIndex

    // Month selector dropdown state and helpers (placed inside component)
    const [isMonthPickerOpen, setIsMonthPickerOpen] = React.useState<boolean>(false);
    const monthButtonRef = React.useRef<HTMLButtonElement | null>(null);
    const monthMenuRef = React.useRef<HTMLDivElement | null>(null);
    React.useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            const t = e.target as Node;
            if (isMonthPickerOpen) {
                if (monthButtonRef.current?.contains(t)) return;
                if (monthMenuRef.current?.contains(t)) return;
                setIsMonthPickerOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            // If any modal dialog is open, do not handle dashboard shortcuts
            const modalOpen = !!document.querySelector('[role="dialog"][aria-modal="true"]');
            if (modalOpen) return;

            // Close month picker
            if (e.key === 'Escape') {
                if (isMonthPickerOpen) setIsMonthPickerOpen(false);
                return;
            }
            // Quick toggle month picker with "m"
            if (e.key.toLowerCase() === 'm') {
                e.preventDefault();
                setIsMonthPickerOpen(o => !o);
                return;
            }
            // Month navigation with arrows
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const prev = ((activeMonthIndex - 1) + 12) % 12;
                onSelectMonth && onSelectMonth(prev);
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const next = (activeMonthIndex + 1) % 12;
                onSelectMonth && onSelectMonth(next);
                return;
            }
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [isMonthPickerOpen, activeMonthIndex, onSelectMonth]);
    const selectMonth = (m: number) => {
        if (onSelectMonth) onSelectMonth(m);
        setIsMonthPickerOpen(false);
    };

    // Lightweight tooltip rendered in a portal to avoid clipping inside scroll containers
    const [tooltipState, setTooltipState] = React.useState<{ visible: boolean; text: string; x: number; y: number; cls: string }>({ visible: false, text: '', x: 0, y: 0, cls: '' });
    const showTooltip = (text: string, x: number, y: number, cls: string = '') => setTooltipState({ visible: true, text, x, y, cls });
    const moveTooltip = (x: number, y: number) => setTooltipState((s) => (s.visible ? { ...s, x, y } : s));
    const hideTooltip = () => setTooltipState((s) => ({ ...s, visible: false }));

    const monthlySummary = useMemo(() => {
        const mi = typeof displayMonth === 'number' ? displayMonth : new Date().getMonth();
        let total = 0;
        let paid = 0;
        const catTotals: Record<string, number> = {};

        expenses.forEach(expense => {
            const category = toSpanishCanonical(expense.category || t('grid.uncategorized'));
            if (selectedCategories.length > 0 && expense.amountInClp > 0) {
                // Only constrain expenses by category; incomes are not category-filtered
                if (!selectedCategories.includes(category)) return;
            }
            const inMonth = expense.type === ExpenseType.RECURRING
                ? isInstallmentInMonthWithVersioning(expenses, expense, displayYear, mi)
                : isInstallmentInMonth(expense, displayYear, mi);
            if (inMonth) {
                const { amount: amountInBase, isPaid } = computeAmountForMonth(expense, displayYear, mi);
                total += amountInBase;
                if (amountInBase > 0) {
                    if (!catTotals[category]) catTotals[category] = 0;
                    catTotals[category] += amountInBase;
                }
                if (isPaid) {
                    if (includePaid) paid += amountInBase; else {/* excluded */}
                } else {
                    if (!includePending) {
                        // If pending is excluded, remove its contribution from total and categories
                        total -= amountInBase;
                        if (amountInBase > 0) {
                            catTotals[category] -= amountInBase;
                            if (catTotals[category] <= 0) delete catTotals[category];
                        }
                    }
                }
            }
        });
        const catSorted = Object.entries(catTotals)
            .filter(([, sum]) => sum > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([name, totalInBase]) => ({ name, totalInBase, percentage: total > 0 ? (totalInBase / total) * 100 : 0 }));
        return {
            monthIndex: mi,
            total,
            paid,
            pending: total - paid,
            paidPercentage: total > 0 ? (paid / total) * 100 : 0,
            categories: catSorted,
        };
    }, [expenses, paymentStatus, displayYear, displayMonth, t, includePaid, includePending, selectedCategories]);

    // Monthly totals removed (no longer used)

    // Split totals into: income (positive upward), and expense paid/pending (plotted downward)
    const { monthlyIncome, monthlyExpensesPaid, monthlyExpensesPending } = useMemo(() => {
        const income = new Array(12).fill(0);
        const expPaid = new Array(12).fill(0);
        const expPending = new Array(12).fill(0);
        for (let m = 0; m < 12; m++) {
            expenses.forEach(expense => {
                const category = toSpanishCanonical(expense.category || t('grid.uncategorized'));
                if (selectedCategories.length > 0 && expense.amountInClp > 0) {
                    if (!selectedCategories.includes(category)) return;
                }
                const inMonth = expense.type === ExpenseType.RECURRING
                    ? isInstallmentInMonthWithVersioning(expenses, expense, displayYear, m)
                    : isInstallmentInMonth(expense, displayYear, m);
                if (!inMonth) return;
                const { amount, isPaid } = computeAmountForMonth(expense, displayYear, m); // incomes are negative by data model
                if (amount < 0) {
                    income[m] += Math.abs(amount);
                } else if (amount > 0) {
                    if (isPaid) {
                        if (includePaid) expPaid[m] += amount;
                    } else {
                        if (includePending) expPending[m] += amount;
                    }
                }
            });
        }
        return { monthlyIncome: income, monthlyExpensesPaid: expPaid, monthlyExpensesPending: expPending };
    }, [expenses, paymentStatus, displayYear, includePaid, includePending, selectedCategories, t, computeAmountForMonth]);

    // Net balance per month according to current balance toggle
    const netMonthly = useMemo(() => {
        const arr: number[] = new Array(12).fill(0);
        for (let i = 0; i < 12; i++) {
            const expensesTotal = (monthlyExpensesPaid[i] || 0) + (balanceUsesPending ? (monthlyExpensesPending[i] || 0) : 0);
            arr[i] = (monthlyIncome[i] || 0) - expensesTotal;
        }
        return arr;
    }, [monthlyIncome, monthlyExpensesPaid, monthlyExpensesPending, balanceUsesPending]);

    // Derive available categories from expenses and persist for Sidebar UI
    React.useEffect(() => {
        const set = new Set<string>();
        expenses.forEach(e => {
            if (e.amountInClp > 0) {
                set.add(toSpanishCanonical(e.category || t('grid.uncategorized')));
            }
        });
        const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
        setAvailableCategories(arr);
    }, [expenses, t, setAvailableCategories]);

    // Trailing 3-month moving average of net
    const movingAvg3m = useMemo(() => {
        const avg: number[] = new Array(12).fill(0);
        for (let i = 0; i < 12; i++) {
            let sum = 0; let count = 0;
            for (let k = Math.max(0, i - 2); k <= i; k++) { sum += netMonthly[k]; count++; }
            avg[i] = count > 0 ? (sum / count) : 0;
        }
        return avg;
    }, [netMonthly]);
    
    const barData = useMemo(() => {
        const datasets: any[] = [];
        // Ingresos (upwards)
        datasets.push({
            label: 'Ingresos',
            data: monthlyIncome.map(v => Math.max(0, v)),
            backgroundColor: 'rgba(34,197,94,0.45)',
            borderColor: 'rgba(16,185,129,0.85)',
            borderWidth: 1,
            borderRadius: 6,
            hoverBackgroundColor: 'rgba(34,197,94,0.65)'
        });

        if (splitExpenses) {
            // Gastos Pagados
            datasets.push({
                label: 'Gastos Pagados',
                data: monthlyExpensesPaid.map(v => Math.max(0, v)),
                backgroundColor: 'rgba(100,116,139,0.35)', // slate-500-ish
                borderColor: 'rgba(100,116,139,0.85)',
                borderWidth: 1,
                borderRadius: 6,
                hoverBackgroundColor: 'rgba(100,116,139,0.55)'
            });
            // Gastos Pendientes
            datasets.push({
                label: 'Gastos Pendientes',
                data: monthlyExpensesPending.map(v => Math.max(0, v)),
                backgroundColor: 'rgba(245,158,11,0.30)', // amber-500-ish
                borderColor: 'rgba(245,158,11,0.85)',
                borderWidth: 1,
                borderRadius: 6,
                hoverBackgroundColor: 'rgba(245,158,11,0.50)'
            });
        } else {
            // Gastos combinados (pagado + pendiente opcional para balance visual)
            datasets.push({
                label: 'Gastos',
                data: (function(){
                    const arr: number[] = [];
                    for (let i = 0; i < 12; i++) {
                        const v = (monthlyExpensesPaid[i] || 0) + (balanceUsesPending ? (monthlyExpensesPending[i] || 0) : 0);
                        arr.push(Math.max(0, v));
                    }
                    return arr;
                })(),
                backgroundColor: 'rgba(148,163,184,0.35)',
                borderColor: 'rgba(148,163,184,0.85)',
                borderWidth: 1,
                borderRadius: 6,
                hoverBackgroundColor: 'rgba(148,163,184,0.55)'
            });
        }

        // Balance line (usa el toggle balanceUsesPending)
        datasets.push({
            type: 'line' as const,
            label: 'Balance',
            data: netMonthly,
            borderColor: 'rgba(249,115,22,0.95)',
            borderWidth: 2.5,
            backgroundColor: 'rgba(249,115,22,0.2)',
            pointRadius: 4,
            pointBackgroundColor: 'rgba(249,115,22,0.95)',
            pointHoverRadius: 6,
            tension: 0.25,
            yAxisID: 'y'
        });

        // Moving average 3M (optional)
        if (showMovingAvg) {
            datasets.push({
                type: 'line' as const,
                label: 'Media móvil 3M',
                data: movingAvg3m,
                borderColor: 'rgba(59,130,246,0.9)', // blue-500
                backgroundColor: 'rgba(59,130,246,0.15)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 0,
                tension: 0.25,
                yAxisID: 'y',
                borderDash: [6, 6]
            });
        }

        return {
            labels: MONTHS_ES,
            datasets
        };
    }, [MONTHS_ES, monthlyIncome, monthlyExpensesPaid, monthlyExpensesPending, balanceUsesPending, splitExpenses, netMonthly, showMovingAvg, movingAvg3m]);

    // Abreviador compacto para ejes (K/M)
    const formatAbbrev = (n: number) => {
        const abs = Math.abs(n);
        if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
        if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (abs >= 1e3) return (n / 1e3).toFixed(0) + 'K';
        return String(n);
    };

    // (doughnutData) eliminado: ya no usamos gráfico de dona

    // Build labels + single dataset: when includeIncomes, use NET (expenses - incomes) per category
    const catBarData = useMemo(() => {
        const mi = monthlySummary.monthIndex;
        let labels: string[] = [];
        let data: number[] = [];
        if (!includeIncomes) {
            labels = monthlySummary.categories.map(c => c.name);
            data = monthlySummary.categories.map(c => c.totalInBase);
        } else {
            const totals: Record<string, number> = {};
            expenses.forEach(expense => {
                const inMonth = expense.type === ExpenseType.RECURRING
                    ? isInstallmentInMonthWithVersioning(expenses, expense, displayYear, mi)
                    : isInstallmentInMonth(expense, displayYear, mi);
                if (!inMonth) return;
                const cat = toSpanishCanonical(expense.category || t('grid.uncategorized'));
                const { amount } = computeAmountForMonth(expense, displayYear, mi); // positive for expenses, negative for incomes
                totals[cat] = (totals[cat] || 0) + amount;
            });
            const entries = Object.entries(totals)
                .filter(([, v]) => v !== 0)
                .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
            labels = entries.map(([k]) => k);
            data = entries.map(([, v]) => v);
        }
        const hues = labels.map((_, i) => (i * 37) % 360);
        return {
            labels,
            datasets: [
                {
                    label: t('dashboard.byCategory') || 'Por Categoría',
                    data,
                    backgroundColor: (ctx: any) => {
                        const i = ctx.dataIndex ?? 0;
                        const h = hues[i] ?? 180;
                        const lbl = labels[i];
                        const isSel = selectedCategory && lbl === selectedCategory;
                        const alpha = selectedCategory ? (isSel ? 0.95 : 0.35) : 0.85;
                        return `hsla(${h}, 70%, 55%, ${alpha})`;
                    },
                    borderColor: (ctx: any) => {
                        const i = ctx.dataIndex ?? 0;
                        const lbl = labels[i];
                        const isSel = selectedCategory && lbl === selectedCategory;
                        return isSel ? 'rgba(15, 118, 110, 0.9)' : 'rgba(100,116,139,0.28)';
                    },
                    borderWidth: (ctx: any) => {
                        const i = ctx.dataIndex ?? 0;
                        const lbl = labels[i];
                        const isSel = selectedCategory && lbl === selectedCategory;
                        return isSel ? 2 : 1;
                    },
                    borderRadius: 6,
                    maxBarThickness: 18,
                }
            ]
        };
    }, [monthlySummary, includeIncomes, expenses, paymentStatus, displayYear, t, selectedCategory]);

    // Build details for selected category (current month)
    const selectedCatDetails = useMemo(() => {
        if (!selectedCategory) return null;
        const mi = monthlySummary.monthIndex;
        const items = expenses
            .filter(e => {
                const inMonth = e.type === ExpenseType.RECURRING
                    ? isInstallmentInMonthWithVersioning(expenses, e, displayYear, mi)
                    : isInstallmentInMonth(e, displayYear, mi);
                if (!inMonth) return false;
                const expCat = toSpanishCanonical((e.category && e.category.trim()) ? e.category : (t('grid.uncategorized')));
                return expCat === selectedCategory;
            })
            .map(e => {
                const { amount } = computeAmountForMonth(e, displayYear, mi);
                return { id: e.id, name: e.name, amount };
            })
            .filter(it => includeIncomes ? (it.amount || 0) !== 0 : (it.amount || 0) > 0)
            .sort((a, b) => b.amount - a.amount);
        const total = items.reduce((s, it) => s + it.amount, 0);
        const pct = monthlySummary.total > 0 ? (total / monthlySummary.total) * 100 : 0;
        return { items, total, pct };
    }, [selectedCategory, includeIncomes, expenses, paymentStatus, displayYear, monthlySummary, t]);

    // Removed stacked bar total labels plugin (not applicable for superposed bars)

    // Chart interactions: click selects month; double-click requests navigation to Table
    const barRef = React.useRef<any>(null);
    const handleBarDoubleClick = (evt: React.MouseEvent<HTMLDivElement>) => {
        const chart = barRef.current;
        if (!chart || !chart.getElementsAtEventForMode) return;
        // Try to get nearest element under the double-click position
        // react synthetic event stores the nativeEvent
        // Chart.js expects a native event
        // @ts-ignore
        const native = (evt as any).nativeEvent || evt;
        const items = chart.getElementsAtEventForMode(native, 'nearest', { intersect: true }, true) || [];
        const idx = items[0]?.index;
        if (typeof idx === 'number') {
            onSelectMonth && onSelectMonth(idx);
            onRequestGoToTable && onRequestGoToTable(idx);
        }
    };

    // KPIs: unpaid count (Pendiente) y variación mensual
    const unpaidCount = useMemo(() => {
        let count = 0;
        expenses.forEach(expense => {
            if (isInstallmentInMonth(expense, displayYear, monthlySummary.monthIndex)) {
                const details = paymentStatus[expense.id]?.[`${displayYear}-${monthlySummary.monthIndex}`];
                if (!details?.paid) count += 1;
            }
        });
        return count;
    }, [expenses, paymentStatus, displayYear, monthlySummary.monthIndex]);
    const prevMonthIndex = ((monthlySummary.monthIndex - 1) + 12) % 12;
    const prevMonthTotal = (monthlyExpensesPaid[prevMonthIndex] || 0) + (monthlyExpensesPending[prevMonthIndex] || 0);
    const deltaAmount = monthlySummary.total - prevMonthTotal;
    const momChange = prevMonthTotal > 0 ? (deltaAmount / prevMonthTotal) * 100 : 0;

    // Upcoming and overdue payments (current and next month unpaid)
    const upcomingList = useMemo(() => {
        type Item = { expenseId: string; name: string; amount: number; monthIndex: number; day: number; isOverdue: boolean; isDueSoon: boolean; isDueVerySoon: boolean; dueDate: Date; diffDays: number };
        const items: Item[] = [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const msPerDay = 24 * 60 * 60 * 1000;
        const nowM = monthlySummary.monthIndex;
        const nextM = (nowM + 1) % 12;
        const months = [nowM, nextM];
        months.forEach(m => {
            expenses.forEach(expense => {
                if (isInstallmentInMonth(expense, displayYear, m)) {
                    const details = paymentStatus[expense.id]?.[`${displayYear}-${m}`];
                    const paid = details?.paid;
                    if (!paid) {
                        const base = getInstallmentAmount(expense);
                        const amount = details?.overriddenAmount ?? base;
                        // Determine due day priority: overriddenDueDate > expense.dueDate > day from startDate
                        const overriddenDue = (details && typeof details.overriddenDueDate === 'number') ? details.overriddenDueDate : undefined;
                        // Expense typing has startDate: YYYY-MM-DD and dueDate: number
                        const expAny: any = expense as any;
                        const expenseDue: number | undefined = typeof expAny.dueDate === 'number' ? expAny.dueDate : undefined;
                        let startStr: string | undefined = typeof expAny.startDate === 'string' ? expAny.startDate : undefined;
                        let dayFromStart = 1;
                        if (startStr) {
                            const parts = startStr.split('-');
                            const d = parseInt(parts[2] || '1', 10);
                            if (!Number.isNaN(d) && d >= 1 && d <= 31) dayFromStart = d;
                        }
                        const lastDayOfMonth = new Date(displayYear, m + 1, 0).getDate();
                        const baseDue = overriddenDue ?? expenseDue ?? dayFromStart;
                        const dueDay = Math.min(Math.max(baseDue, 1), lastDayOfMonth);
                        const dueDate = new Date(displayYear, m, dueDay);
                        const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / msPerDay);
                        const isOverdue = diffDays < 0;
                        const isDueVerySoon = diffDays >= 0 && diffDays <= 3;
                        const isDueSoon = !isDueVerySoon && diffDays >= 0 && diffDays <= 7;
                        items.push({ expenseId: expense.id, name: expense.name || t('grid.uncategorized'), amount, monthIndex: m, day: dueDay, isOverdue, isDueSoon, isDueVerySoon, dueDate, diffDays });
                    }
                }
            });
        });
        return items
            .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
            .slice(0, 10);
    }, [expenses, paymentStatus, displayYear, monthlySummary.monthIndex, t]);

    return (
        <div className="h-full min-h-0 flex flex-col">
            {/* Unified grid wrapper */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:[grid-template-rows:auto_auto_minmax(0,1fr)] flex-1 min-h-0 gap-3 pt-2 mb-2 lg:mb-0">
                {/* Card: Month selector (Row 1, Col 1) */}
                <div className="order-1 lg:col-start-1 lg:row-start-1 bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700/50 rounded-lg p-0 relative self-start">
                    <button
                        ref={monthButtonRef}
                        type="button"
                        className="w-full h-11 md:h-12 flex items-center justify-center gap-2 px-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 text-slate-900 dark:text-white"
                        onClick={() => setIsMonthPickerOpen(o => !o)}
                        aria-haspopup="listbox"
                        aria-expanded={isMonthPickerOpen}
                        aria-label="Seleccionar mes"
                    >
                        {(() => {
                            const monthName = new Date(displayYear, monthlySummary.monthIndex, 1).toLocaleString('es-CL', { month: 'long' });
                            const title = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${displayYear}`;
                            return (
                                <>
                                    <CalendarIcon className="w-[1em] h-[1em] opacity-80" />
                                    <span className="font-semibold tracking-tight text-[1rem] sm:text-[1.15rem] md:text-[1.3rem] leading-none whitespace-nowrap overflow-hidden text-ellipsis">
                                        {title}
                                    </span>
                                    <ChevronDownIcon className="w-[1em] h-[1em] opacity-70" />
                                </>
                            );
                        })()}
                    </button>
                    {isMonthPickerOpen && (
                                <div
                                    ref={monthMenuRef}
                                    role="listbox"
                                    aria-label="Seleccionar mes"
                                    className="absolute right-0 top-full mt-2 w-56 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-lg shadow-xl p-2 grid grid-cols-3 gap-2"
                                >
                                    {MONTHS_ES.map((m, idx) => (
                                        <button
                                            key={idx}
                                            role="option"
                                            aria-selected={idx === activeMonthIndex}
                                            className={`text-xs px-2 py-1.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 text-slate-700 dark:text-slate-200 ${idx === activeMonthIndex ? 'bg-teal-600 text-white hover:bg-teal-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                            onClick={() => selectMonth(idx)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectMonth(idx); } }}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            )}
                </div>

                {/* Total mensual - standardized 2x3 layout (Row 1, Col 2) */}
                <div className="order-2 lg:col-start-2 lg:row-start-1 bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700/50 rounded-lg p-4 md:p-5">
                    <div className="grid grid-rows-[auto_auto] grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 items-baseline">
                        <div className="row-start-1 col-start-1 col-span-2 text-xs text-slate-500 dark:text-slate-400">{totalMonthlyLabel}</div>
                        <div className="row-start-1 col-start-3 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 text-right truncate">{MONTHS_ES[monthlySummary.monthIndex]} {displayYear}</div>
                        <div className="row-start-2 col-start-1 col-span-3 text-center min-w-0 mt-1.5">
                            <div className="font-semibold tabular-nums text-[1.1rem] sm:text-[1.3rem] md:text-[1.5rem] tracking-tight text-slate-900 dark:text-white leading-none whitespace-nowrap overflow-hidden text-ellipsis">{formatClp(monthlySummary.total)}</div>
                        </div>
                    </div>
                </div>

                {/* Pagos por vencer - Row 2, Col 1 */}
                <div className="order-8 lg:col-start-1 lg:row-start-2 bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700/50 rounded-lg p-4 md:p-5 h-full flex flex-col min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('dashboard.upcoming') === 'dashboard.upcoming' ? 'Pagos por vencer' : t('dashboard.upcoming')}</div>
                        <div className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">{MONTHS_ES[monthlySummary.monthIndex]} / {MONTHS_ES[(monthlySummary.monthIndex+1)%12]}</div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto">
                        <ul className="divide-y divide-slate-200/60 dark:divide-slate-700/40">
                            {upcomingList.map((it, idx) => {
                                const mName = MONTHS_ES[it.monthIndex];
                                const dayStr = String(it.day).padStart(2,'0');
                                const dateLabel = `${mName} ${dayStr}`;
                                const isCurrentMonth = it.monthIndex === monthlySummary.monthIndex;
                                const tooltipText = it.isOverdue
                                    ? `Venció hace ${Math.abs(it.diffDays)} días`
                                    : it.diffDays === 0
                                        ? 'Vence hoy'
                                        : `Vence en ${it.diffDays} días`;
                                return (
                                    <li key={idx} className="py-1.5 px-0">
                                        <button
                                            onClick={() => onOpenCellEditor && onOpenCellEditor(it.expenseId, displayYear, it.monthIndex)}
                                            onMouseEnter={(e) => showTooltip(`${dateLabel} ${tooltipText}`, e.clientX + 12, e.clientY + 12)}
                                            onMouseMove={(e) => moveTooltip(e.clientX + 12, e.clientY + 12)}
                                            onMouseLeave={hideTooltip}
                                            className={`w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded px-2 py-1.5 transition ${it.isOverdue
                                                ? 'ring-1 ring-rose-300/50 dark:ring-rose-500/30 bg-rose-50/40 dark:bg-rose-900/10'
                                                : isCurrentMonth
                                                    ? 'ring-1 ring-amber-300/50 dark:ring-amber-500/40 bg-amber-50/40 dark:bg-amber-900/10'
                                                    : it.isDueVerySoon
                                                        ? 'ring-1 ring-amber-300/40 dark:ring-amber-500/30 bg-amber-50/30 dark:bg-amber-900/10'
                                                        : it.isDueSoon
                                                            ? 'bg-slate-50/40 dark:bg-slate-800/40'
                                                            : ''}`}
                                        >
                                            <span className={`inline-flex items-center justify-center h-5 px-2 rounded-full text-[10px] font-medium justify-self-start ${it.isOverdue
                                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                                                : isCurrentMonth
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                                                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>{dateLabel}</span>
                                            <span className="truncate text-sm text-slate-700 dark:text-slate-200">{it.name}</span>
                                            <span className="justify-self-end text-[13px] sm:text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{formatClp(it.amount)}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/50 text-[11px] text-slate-500 dark:text-slate-400 select-none" aria-hidden>
                        Consejo: haz clic en un pago para abrir la ventana de pago
                    </div>
                </div>
                {/* KPI Group 1 removido: Total mensual ahora está en la card 'Selecciona mes' */}
                {/* KPI Group 2: Variación mensual (Col 3, Row 1) */}
                <div 
                    className="order-3 lg:col-start-3 lg:row-start-1 bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700/50 rounded-lg p-4 md:p-5 min-h-[68px] sm:min-h-[76px]"
                    aria-label={`Variación mensual respecto al mes anterior`}
                >
                    <div className="grid grid-rows-[auto_auto] grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 items-baseline">
                        <div className="row-start-1 col-start-1 col-span-2 text-xs text-slate-500 dark:text-slate-400">{(t('dashboard.momChange') === 'dashboard.momChange' ? 'Variación mensual' : t('dashboard.momChange'))}</div>
                        <div className="row-start-1 col-start-3 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 text-right truncate">{(deltaAmount >= 0 ? '+' : '−')}{formatClp(Math.abs(deltaAmount))}</div>
                        <div className="row-start-2 col-start-1 col-span-3 flex items-center justify-center gap-2 min-w-0 mt-1.5">
                            {momChange > 0 ? (
                                <ArrowTrendingUpIcon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            ) : momChange < 0 ? (
                                <ArrowTrendingDownIcon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                            ) : (
                                <ArrowTrendingUpIcon className="w-4 h-4 text-slate-500 dark:text-slate-400 rotate-90" />
                            )}
                            <div className={`font-semibold tabular-nums tracking-tight text-[1.1rem] sm:text-[1.3rem] md:text-[1.5rem] leading-none whitespace-nowrap overflow-hidden text-ellipsis ${momChange > 0 ? 'text-rose-600 dark:text-rose-400' : momChange < 0 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>{Math.abs(momChange).toFixed(0)}%</div>
                        </div>
                    </div>
                </div>

                {/* KPI Group 3: Pagado (Col 4, Row 1) */}
                <div 
                    className="order-4 lg:col-start-4 lg:row-start-1 bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700/50 rounded-lg p-4 md:p-5 min-h-[68px] sm:min-h-[76px]"
                    aria-label={`% Pagado y monto pagado`}
                >
                    <div className="grid grid-rows-[auto_auto] grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 items-baseline">
                        <div className="row-start-1 col-start-1 text-xs text-slate-500 dark:text-slate-400">{(t('dashboard.paid') === 'dashboard.paid' ? 'Pagado' : t('dashboard.paid'))}</div>
                        <div className="row-start-1 col-start-2 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 text-right truncate">{formatClp(monthlySummary.paid)}</div>
                        <div className="row-start-2 col-start-1 col-span-2 text-center min-w-0 mt-1.5">
                            <div className="font-semibold tabular-nums tracking-tight text-[1.1rem] sm:text-[1.3rem] md:text-[1.5rem] text-teal-600 dark:text-teal-400 leading-none whitespace-nowrap overflow-hidden text-ellipsis">{monthlySummary.paidPercentage.toFixed(0)}%</div>
                        </div>
                    </div>
                </div>

                {/* KPI Group 4: Pendiente (Col 5, Row 1) */}
                <div 
                    className="order-5 lg:col-start-5 lg:row-start-1 bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700/50 rounded-lg p-4 md:p-5 min-h-[68px] sm:min-h-[76px]"
                    aria-label={`Pagos pendientes y monto`}
                >
                    <div className="grid grid-rows-[auto_auto] grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 items-baseline">
                        <div className="row-start-1 col-start-1 text-xs text-slate-500 dark:text-slate-400">{(t('dashboard.pending') === 'dashboard.pending' ? 'Pendiente' : t('dashboard.pending'))}</div>
                        <div className="row-start-1 col-start-2 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 text-right truncate">{formatClp(monthlySummary.pending)}</div>
                        <div className="row-start-2 col-start-1 col-span-2 text-center min-w-0 mt-1.5">
                            <div className="font-semibold tabular-nums tracking-tight text-[1.1rem] sm:text-[1.3rem] md:text-[1.5rem] text-amber-600 dark:text-amber-500 leading-none whitespace-nowrap overflow-hidden text-ellipsis">{unpaidCount}</div>
                        </div>
                    </div>
                </div>

            {/* Doughnut/List (tabs): Col 5 Row 2 */}
            <div className="order-7 lg:col-start-5 lg:row-start-2 bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700/50 rounded-lg p-4 md:p-5 h-full flex flex-col min-h-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('dashboard.byCategory')}</div>
                    <div className="h-6 flex items-center gap-3">
                        <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300" title="Incluir ingresos en el gráfico">
                            <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-teal-600"
                                checked={includeIncomes}
                                onChange={(e) => setIncludeIncomes(e.target.checked)}
                            />
                            <span>Incluir ingresos</span>
                        </label>
                        {selectedCategory ? (
                            <button
                                className="h-6 leading-none text-[11px] px-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-700/60 hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                                onClick={() => setSelectedCategory(null)}
                                title="Limpiar selección"
                            >
                                Limpiar
                            </button>
                        ) : (
                            <div className="h-6" aria-hidden />
                        )}
                    </div>
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="h-1/2 min-h-0 flex flex-col">
                        <div className="flex-1 min-h-0">
                            {monthlySummary.categories.length > 0 ? (
                                <Bar
                                    data={catBarData}
                                    options={{
                                        indexAxis: 'y',
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        animation: { duration: 500 },
                                        onClick: (_evt, elements, chart) => {
                                            const el = (elements && (elements as any)[0]) as any;
                                            const idx = el?.index;
                                            if (typeof idx === 'number') {
                                                const lbl = (chart?.data?.labels?.[idx] as string) || monthlySummary.categories[idx]?.name;
                                                if (lbl) setSelectedCategory(lbl);
                                            }
                                        },
                                    scales: {
                                        x: {
                                            grid: { color: 'rgba(148,163,184,0.15)' },
                                            ticks: {
                                                color: '#94a3b8',
                                                callback: (v) => typeof v === 'number' ? formatAbbrev(v as number) : `${v}`
                                            }
                                        },
                                        y: {
                                            grid: { display: false },
                                            ticks: { color: '#94a3b8', autoSkip: false }
                                        }
                                    },
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: { enabled: false }
                                    }
                                    }}
                                />
                            ) : (
                                <div className="text-xs text-slate-500 dark:text-slate-400 p-2">Sin datos de categorías</div>
                            )}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Consejo: haz clic en una barra para ver el detalle</div>
                    </div>
                    <div className="h-1/2 min-h-0 overflow-auto mt-3 border-t border-slate-200 dark:border-slate-700/50 pt-2">
                        {selectedCategory && selectedCatDetails ? (
                            <>
                                <div className="flex items-center justify-between mb-2 gap-2">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{selectedCategory}</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">{formatClp(selectedCatDetails.total)} {selectedCatDetails.pct.toFixed(1)}%</div>
                                </div>
                                {selectedCatDetails.items.length > 0 ? (
                                    <>
                                        <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                                            {(showAllCatItems ? selectedCatDetails.items : selectedCatDetails.items.slice(0,5)).map(it => (
                                                <li key={it.id} className="flex items-center justify-between">
                                                    <button
                                                        className="truncate mr-2 text-left hover:underline"
                                                        onClick={() => onOpenCellEditor && onOpenCellEditor(it.id, displayYear, monthlySummary.monthIndex)}
                                                    >
                                                        {it.name}
                                                    </button>
                                                    <span className="tabular-nums">{formatClp(it.amount)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        {selectedCatDetails.items.length > 5 && (
                                            <div className="mt-2">
                                                <button
                                                    className="text-[11px] px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-700/60 hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                                                    onClick={() => setShowAllCatItems(s => !s)}
                                                >
                                                    {showAllCatItems ? 'Ver menos' : 'Ver todo'}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Sin gastos en esta categoría este mes</div>
                                )}
                            </>
                        ) : (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">Haz clic en una categoría para ver el detalle</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 2: Bar chart spanning Col 2-4 */}
            <div className="order-6 lg:row-start-2 lg:col-start-2 lg:col-span-3 bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700/50 rounded-lg p-3 overflow-visible h-full flex flex-col min-h-0">
                <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{(t('dashboard.monthlySpending') === 'dashboard.monthlySpending' ? 'Gasto mensual del año' : t('dashboard.monthlySpending')) + ' ' + displayYear}</div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                            <input
                                type="checkbox"
                                className="rounded border-slate-300 dark:border-slate-600"
                                checked={showMovingAvg}
                                onChange={(e) => setShowMovingAvg(e.target.checked)}
                            />
                            <span>Media móvil 3M</span>
                        </label>
                        <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                            <input
                                type="checkbox"
                                className="rounded border-slate-300 dark:border-slate-600"
                                checked={splitExpenses}
                                onChange={(e) => setSplitExpenses(e.target.checked)}
                            />
                            <span>Gastos: {splitExpenses ? 'Pagado vs Pendiente' : 'Combinados'}</span>
                        </label>
                        <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                            <input
                                type="checkbox"
                                className="rounded border-slate-300 dark:border-slate-600"
                                checked={balanceUsesPending}
                                onChange={(e) => setBalanceUsesPending(e.target.checked)}
                            />
                            <span>Balance: {balanceUsesPending ? 'Pagado + Pendiente' : 'Solo Pagado'}</span>
                        </label>
                    </div>
                </div>
                <div className="flex-1 min-h-0 min-h-[280px] md:min-h-[300px]" onDoubleClick={handleBarDoubleClick}>
                    <Bar ref={barRef} data={barData as any} options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { top: 6 } },
                    animation: { duration: 600, easing: 'easeOutQuart' },
                    datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.85, maxBarThickness: 36 } },
                    onClick: (_evt, elements, _chart) => {
                        const el = (elements && elements[0]) as any;
                        const idx = el?.index;
                        if (typeof idx === 'number') {
                            onSelectMonth && onSelectMonth(idx);
                        }
                    },
                        plugins: { 
                            legend: { 
                                display: true, 
                                position: 'top', 
                                labels: { boxWidth: 10, color: '#94a3b8' },
                                onHover: (e) => {
                                    const el = e?.native?.target as (HTMLElement | undefined);
                                    if (el) el.style.cursor = 'pointer';
                                },
                                onLeave: (e) => {
                                    const el = e?.native?.target as (HTMLElement | undefined);
                                    if (el) el.style.cursor = 'default';
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    title: (items) => {
                                        const idx = items?.[0]?.dataIndex ?? 0;
                                        return `${MONTHS_ES[idx]} ${displayYear}`;
                                    },
                                    label: (ctx) => {
                                        const val = ctx.parsed.y ?? 0;
                                        return `${ctx.dataset.label || ''}: ${formatClp(val)}`;
                                    },
                                    afterBody: (items) => {
                                        const idx = items?.[0]?.dataIndex ?? 0;
                                        const income = monthlyIncome[idx] || 0;
                                        const paid = monthlyExpensesPaid[idx] || 0;
                                        const pending = monthlyExpensesPending[idx] || 0;
                                        const visualExpenses = splitExpenses ? (paid + pending) : ((monthlyExpensesPaid[idx] || 0) + (balanceUsesPending ? (monthlyExpensesPending[idx] || 0) : 0));
                                        const net = income - (paid + (balanceUsesPending ? pending : 0));
                                        const lines = [
                                            `Ingresos: ${formatClp(income)}`,
                                            `Pagado: ${formatClp(paid)}`,
                                            `Pendiente: ${formatClp(pending)}`,
                                            `Gastos (visual): ${formatClp(visualExpenses)}`,
                                            `Balance: ${formatClp(net)}`
                                        ];
                                        if (showMovingAvg) {
                                            lines.push(`Media móvil 3M: ${formatClp(movingAvg3m[idx] || 0)}`);
                                        }
                                        return lines;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                stacked: false,
                                grid: { display: false },
                                ticks: { color: '#94a3b8' }
                            },
                            y: {
                                stacked: false,
                                grid: { color: 'rgba(148,163,184,0.15)' },
                                border: { display: false },
                                ticks: {
                                    callback: (v) => typeof v === 'number' ? formatAbbrev(v) : `${v}`,
                                    color: '#94a3b8'
                                },
                                beginAtZero: true,
                                // allow negative if balance line dips below 0
                            }
                        }
                        }} />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Consejo: doble clic en una barra para ir a la tabla</div>
                </div>

                
            </div>

            {/* End unified grid */}

            {/* Compact footer (sin consejos) */}
            <footer className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-end px-1 select-none">
                <span className="opacity-70 ml-2 whitespace-nowrap">Dashboard • {MONTHS_ES[monthlySummary.monthIndex]} {displayYear}</span>
            </footer>
            {tooltipState.visible && ReactDOM.createPortal(
                <div
                    style={{ position: 'fixed', top: tooltipState.y, left: tooltipState.x, opacity: 1, transform: 'translateY(-2px)', transition: 'opacity 120ms ease, transform 120ms ease' }}
                    className={`z-50 pointer-events-none px-2.5 py-1.5 text-[11px] leading-4 rounded-md bg-slate-900/95 text-white shadow-lg border ${tooltipState.cls}`}
                >
                    {tooltipState.text}
                </div>,
                document.body
            )}
        </div>
    );
};

// Sidebar summary (compact panel content for the left sidebar)
export const SidebarSummaryBody: React.FC = () => {
    const { t, formatClp } = useLocalization();
    // Shared with DashboardBody via the same persistent key
    const [includeIncomes, setIncludeIncomes] = usePersistentState<boolean>('finansheet-include-incomes', true);
    const [includePaid, setIncludePaid] = usePersistentState<boolean>('finansheet-filter-include-paid', true);
    const [includePending, setIncludePending] = usePersistentState<boolean>('finansheet-filter-include-pending', true);
    const [selectedCategories, setSelectedCategories] = usePersistentState<string[]>('finansheet-filter-categories', []);
    const [availableCategories] = usePersistentState<string[]>('finansheet-available-categories', []);
    // Current rates snapshot
    const [rates, setRates] = useState(CurrencyService.getSnapshot()?.rates);
    const [updatedAt, setUpdatedAt] = useState<Date | undefined>(CurrencyService.lastUpdated());
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        let unsub: (() => void) | undefined;
        (async () => {
            try {
                const snap = await CurrencyService.init();
                setRates(snap.rates);
                setUpdatedAt(new Date(snap.updatedAt));
            } catch {
                // ignore; UI will show placeholders
            }
            unsub = CurrencyService.subscribe((snap) => {
                setRates(snap.rates);
                setUpdatedAt(new Date(snap.updatedAt));
            });
        })();
        return () => { if (unsub) unsub(); };
    }, []);

    const onRefreshRates = async () => {
        try {
            setRefreshing(true);
            const snap = await CurrencyService.refresh();
            setRates(snap.rates);
            setUpdatedAt(new Date(snap.updatedAt));
        } finally {
            setRefreshing(false);
        }
    };
    return (
        <div className="bg-slate-100 dark:bg-slate-900/70 p-4 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{t('dashboard.sidebar') || 'Panel'}</h3>
            <div className="flex flex-col gap-3">
                {/* Filtro de categorías */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Filtrar por categorías</h4>
                        {selectedCategories.length > 0 && (
                            <button
                                onClick={() => setSelectedCategories([])}
                                className="text-xs text-teal-700 dark:text-teal-400 hover:underline"
                                title="Quitar filtro de categorías"
                            >
                                Quitar filtro
                            </button>
                        )}
                    </div>
                    <div className="max-h-40 overflow-auto rounded-md border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700 bg-white/50 dark:bg-slate-800/50">
                        {availableCategories.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-500">Sin categorías</div>
                        ) : (
                            availableCategories.map(cat => {
                                const checked = selectedCategories.includes(cat);
                                return (
                                    <label key={cat} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 dark:border-slate-600"
                                            checked={checked}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedCategories([...selectedCategories, cat]);
                                                else setSelectedCategories(selectedCategories.filter(c => c !== cat));
                                            }}
                                        />
                                        <span>{cat}</span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                    {selectedCategories.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {selectedCategories.map(cat => (
                                <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-teal-100 text-teal-800 dark:bg-teal-800/40 dark:text-teal-100">
                                    {cat}
                                    <button
                                        onClick={() => setSelectedCategories(selectedCategories.filter(c => c !== cat))}
                                        className="ml-1 text-[10px] hover:opacity-80"
                                        title={`Quitar ${cat}`}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-slate-600"
                        checked={includeIncomes}
                        onChange={(e) => setIncludeIncomes(e.target.checked)}
                    />
                    <span>Incluir ingresos en categorías</span>
                </label>
                <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <input
                            type="checkbox"
                            className="rounded border-slate-300 dark:border-slate-600"
                            checked={includePaid}
                            onChange={(e) => setIncludePaid(e.target.checked)}
                        />
                        <span>Incluir Pagado</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <input
                            type="checkbox"
                            className="rounded border-slate-300 dark:border-slate-600"
                            checked={includePending}
                            onChange={(e) => setIncludePending(e.target.checked)}
                        />
                        <span>Incluir Pendiente</span>
                    </label>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                    {`Usa el chip "Mes" en "Total mensual" para cambiar el mes. En el gráfico: clic = seleccionar mes, doble clic = ir a tabla.`}
                </p>
                {/* Current Rates widget */}
                <div className="mt-3 p-3 rounded-md bg-white/60 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tasas actuales</div>
                        <button
                            className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-600/70 disabled:opacity-60"
                            onClick={onRefreshRates}
                            disabled={refreshing}
                            title="Actualizar tasas"
                        >{refreshing ? 'Actualizando…' : 'Actualizar'}</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 dark:text-slate-200">
                        <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-50 dark:bg-slate-900/40">
                            <span className="font-medium">USD</span>
                            <span className="tabular-nums">{rates?.USD ? formatClp(rates.USD) : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-50 dark:bg-slate-900/40">
                            <span className="font-medium">EUR</span>
                            <span className="tabular-nums">{rates?.EUR ? formatClp(rates.EUR) : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-50 dark:bg-slate-900/40">
                            <span className="font-medium">UF</span>
                            <span className="tabular-nums">{rates?.UF ? formatClp(rates.UF) : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-50 dark:bg-slate-900/40">
                            <span className="font-medium">UTM</span>
                            <span className="tabular-nums">{rates?.UTM ? formatClp(rates.UTM) : '—'}</span>
                        </div>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                        {updatedAt ? `Actualizado: ${updatedAt.toLocaleString('es-CL')}` : 'Actualizado: —'}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ expenses: _expenses, paymentStatus: _paymentStatus, displayYear: _displayYear, displayMonth: _displayMonth, isOpen, onClose }) => {
    const { t } = useLocalization();
    const [isCollapsed, setIsCollapsed] = usePersistentState<boolean>('finansheet-sidebar-collapsed', false);
    // Sidebar resizable state (persisted)
    const [sidebarWidth, setSidebarWidth] = usePersistentState<number>('finansheet-sidebar-width', 320);
    const resizeState = React.useRef<{ startX: number; startW: number; dragging: boolean } | null>(null);
    const minW = 220;
    const maxW = 480;
    const onResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isCollapsed) return;
        resizeState.current = { startX: e.clientX, startW: sidebarWidth, dragging: true };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', onResizeMouseMove);
        window.addEventListener('mouseup', onResizeMouseUp);
    };
    const onResizeMouseMove = (e: MouseEvent) => {
        const st = resizeState.current; if (!st || !st.dragging) return;
        const dx = e.clientX - st.startX;
        const next = Math.min(maxW, Math.max(minW, st.startW + dx));
        setSidebarWidth(next);
    };
    const onResizeMouseUp = () => {
        const st = resizeState.current; if (!st) return;
        resizeState.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onResizeMouseMove);
        window.removeEventListener('mouseup', onResizeMouseUp);
    };
    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 bg-black bg-opacity-60 z-40 transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
                aria-hidden="true"
            ></div>
            <aside
                className={`group relative fixed top-0 left-0 h-full bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl border-r border-slate-200 dark:border-slate-700/50 ${isCollapsed ? 'w-14' : 'w-72'} p-4 text-slate-800 dark:text-slate-200 z-50 transition-transform lg:static lg:bg-transparent lg:dark:bg-slate-950/70 lg:translate-x-0 ${isCollapsed ? 'lg:w-16' : 'lg:w-80'} lg:shrink-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
                style={!isCollapsed ? { width: `${sidebarWidth}px` } : undefined}
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className={`text-xl font-bold text-slate-900 dark:text-white transition-opacity ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>{t('dashboard.title')}</h2>
                    <button onClick={onClose} className="lg:hidden p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white" aria-label={t('mobile.closeMenu')}>
                        <XMarkIcon />
                    </button>
                </div>
                {!isCollapsed && (
                    <SidebarSummaryBody />
                )}
                {/* Floating edge toggle (desktop only), revealed on hover/focus */}
                <button
                    onClick={() => setIsCollapsed(v => !v)}
                    className={`hidden lg:flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-800 text-white shadow ring-1 ring-slate-700/50 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:opacity-100 transition`}
                    aria-label={isCollapsed ? 'Expandir panel' : 'Contraer panel'}
                    title={isCollapsed ? 'Expandir panel' : 'Contraer panel'}
                >
                    {isCollapsed ? '›' : '‹'}
                </button>
                {/* Resize handle (desktop) */}
                {!isCollapsed && (
                    <div
                        role="separator"
                        aria-orientation="vertical"
                        title="Arrastra para redimensionar"
                        onMouseDown={onResizeMouseDown}
                        className="hidden lg:block absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-slate-300/40 dark:hover:bg-slate-600/30"
                        style={{ transform: 'translateX(50%)' }}
                    />
                )}
            </aside>
        </>
    );
};

export default Dashboard;
