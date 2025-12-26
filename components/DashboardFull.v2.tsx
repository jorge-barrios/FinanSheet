/**
 * DashboardFull.v2.tsx
 * 
 * Full-page Dashboard component using v2 data model (Commitments + Terms + Payments).
 * Uses CommitmentsContext for shared data - no duplicate fetching.
 * 
 * Includes:
 * - Pagos por Vencer sidebar
 * - KPI cards
 * - Monthly evolution chart
 * - Category breakdown
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import { useLocalization } from '../hooks/useLocalization';
import { useCommitments } from '../context/CommitmentsContext';
import {
    ArrowTrendingDownIcon, ArrowTrendingUpIcon, CalendarIcon, StarIcon,
    ExclamationTriangleIcon, ClockIcon, CheckCircleIcon
} from './icons';
import type { FlowType } from '../types.v2';
import { getPerPeriodAmount } from '../utils/financialUtils.v2';

Chart.register(...registerables);

// =============================================================================
// TYPES
// =============================================================================

interface DashboardFullV2Props {
    displayYear: number;
    displayMonth: number; // 0-indexed
    onMonthChange?: (month: number) => void;
    onYearChange?: (year: number) => void;
    onOpenPaymentRecorder?: (commitmentId: string, year: number, month: number) => void;
}

interface CategorySummary {
    name: string;
    total: number;
    percentage: number;
    flowType: FlowType;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const DashboardFullV2: React.FC<DashboardFullV2Props> = ({
    displayYear,
    displayMonth,
    onMonthChange,
    onYearChange,
    onOpenPaymentRecorder,
}) => {
    const { formatClp } = useLocalization();
    const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Use shared context data
    const {
        commitments,
        loading,
        error,
        setDisplayYear,
        setDisplayMonth,
        getUpcomingPayments,
        getMonthlyData
    } = useCommitments();

    const [chartReady, setChartReady] = useState(false);

    // Sync displayYear and displayMonth with context
    useEffect(() => {
        setDisplayYear(displayYear);
        setDisplayMonth(displayMonth);
    }, [displayYear, displayMonth, setDisplayYear, setDisplayMonth]);

    // Delayed chart render for progressive loading
    useEffect(() => {
        if (!loading) {
            const timer = setTimeout(() => setChartReady(true), 50);
            return () => clearTimeout(timer);
        } else {
            setChartReady(false);
        }
    }, [loading]);

    // ==========================================================================
    // NAVIGATION HANDLERS
    // ==========================================================================

    const handlePrevMonth = useCallback(() => {
        if (displayMonth === 0) {
            onYearChange?.(displayYear - 1);
            onMonthChange?.(11); // December of previous year
        } else {
            onMonthChange?.(displayMonth - 1);
        }
    }, [displayMonth, displayYear, onMonthChange, onYearChange]);

    const handleNextMonth = useCallback(() => {
        if (displayMonth === 11) {
            onYearChange?.(displayYear + 1);
            onMonthChange?.(0); // January of next year
        } else {
            onMonthChange?.(displayMonth + 1);
        }
    }, [displayMonth, displayYear, onMonthChange, onYearChange]);

    const handleToday = useCallback(() => {
        const today = new Date();
        onYearChange?.(today.getFullYear());
        onMonthChange?.(today.getMonth());
    }, [onMonthChange, onYearChange]);

    // ==========================================================================
    // DERIVED DATA (from context)
    // ==========================================================================

    // Get upcoming payments for current and next month
    const upcomingPayments = useMemo(() => {
        return getUpcomingPayments(displayMonth);
    }, [getUpcomingPayments, displayMonth]);

    // Monthly data for chart
    const monthlyData = useMemo(() => {
        return getMonthlyData();
    }, [getMonthlyData, displayYear]); // Force recalc when year changes

    // Current month summary
    const currentMonthSummary = useMemo(() => {
        const d = monthlyData[displayMonth];
        return {
            income: d.income,
            expenses: d.expenses,
            balance: d.balance,
            savingsRate: d.income > 0 ? ((d.income - d.expenses) / d.income) * 100 : 0
        };
    }, [monthlyData, displayMonth]);

    // Annual totals
    const annualTotals = useMemo(() => {
        return monthlyData.reduce((acc, d) => ({
            income: acc.income + d.income,
            expenses: acc.expenses + d.expenses,
            balance: acc.balance + d.balance
        }), { income: 0, expenses: 0, balance: 0 });
    }, [monthlyData]);

    // Categories summary for current month
    const categoriesSummary = useMemo<CategorySummary[]>(() => {
        const categoryTotals = new Map<string, { total: number; flowType: FlowType }>();

        commitments.forEach(commitment => {
            const term = commitment.active_term;
            if (!term) return;

            const categoryName = commitment.category?.name || 'Sin categoría';
            const amount = getPerPeriodAmount(term, true);

            if (commitment.flow_type === 'EXPENSE') {
                const existing = categoryTotals.get(categoryName);
                if (existing) {
                    existing.total += amount;
                } else {
                    categoryTotals.set(categoryName, { total: amount, flowType: commitment.flow_type as FlowType });
                }
            }
        });

        const totalExpenses = monthlyData[displayMonth].expenses;
        const result: CategorySummary[] = [];

        categoryTotals.forEach((value, name) => {
            result.push({
                name,
                total: value.total,
                percentage: totalExpenses > 0 ? (value.total / totalExpenses) * 100 : 0,
                flowType: value.flowType
            });
        });

        return result.sort((a, b) => b.total - a.total);
    }, [commitments, monthlyData, displayMonth]);

    // Upcoming totals
    const upcomingTotal = useMemo(() => {
        return upcomingPayments.reduce((sum, p) => sum + p.amount, 0);
    }, [upcomingPayments]);

    // ==========================================================================
    // CHART DATA
    // ==========================================================================

    // Generate rolling window labels (12 months: 8 back + current + 3 forward)
    const rollingLabels = useMemo(() => {
        const labels: string[] = [];
        const centerDate = new Date(displayYear, displayMonth, 1);

        for (let i = 0; i < 12; i++) {
            const labelDate = new Date(centerDate);
            labelDate.setMonth(labelDate.getMonth() - 8 + i); // Start 8 months before
            const monthIndex = labelDate.getMonth();
            labels.push(MONTHS_ES[monthIndex]);
        }

        return labels;
    }, [displayYear, displayMonth, MONTHS_ES]);

    const chartData = useMemo(() => ({
        labels: rollingLabels,
        datasets: [
            {
                label: 'Ingresos',
                data: monthlyData.map(d => d.income),
                backgroundColor: monthlyData.map(d =>
                    d.hasIncomeData
                        ? 'rgba(34, 197, 94, 0.6)'  // Green - has data
                        : 'rgba(203, 213, 225, 0.3)' // Light gray - no data
                ),
                borderColor: monthlyData.map(d =>
                    d.hasIncomeData
                        ? 'rgba(34, 197, 94, 1)'
                        : 'rgba(203, 213, 225, 0.5)'
                ),
                borderWidth: 1,
                borderRadius: 6,
            },
            {
                label: 'Gastos',
                data: monthlyData.map(d => d.expenses),
                backgroundColor: monthlyData.map(d =>
                    d.hasExpenseData
                        ? 'rgba(239, 68, 68, 0.6)'  // Red - has data
                        : 'rgba(203, 213, 225, 0.3)' // Light gray - no data
                ),
                borderColor: monthlyData.map(d =>
                    d.hasExpenseData
                        ? 'rgba(239, 68, 68, 1)'
                        : 'rgba(203, 213, 225, 0.5)'
                ),
                borderWidth: 1,
                borderRadius: 6,
            },
            {
                type: 'line' as const,
                label: 'Balance',
                data: monthlyData.map(d =>
                    // Only show balance if there's actual data (income or expenses)
                    (d.hasIncomeData || d.hasExpenseData) ? d.balance : null
                ),
                borderColor: 'rgba(249, 115, 22, 1)',
                backgroundColor: 'rgba(249, 115, 22, 0.2)',
                borderWidth: 2.5,
                pointRadius: 4,
                tension: 0.3,
                spanGaps: false, // Don't connect across null values
            }
        ]
    }), [monthlyData, rollingLabels]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    usePointStyle: true,
                    padding: 15,
                }
            },
            tooltip: {
                callbacks: {
                    label: (ctx: any) => {
                        const value = ctx.raw as number;
                        return `${ctx.dataset.label}: ${formatClp(value)}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value: number | string) => {
                        const num = typeof value === 'number' ? value : parseFloat(value);
                        if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
                        if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
                        return String(num);
                    }
                }
            }
        },
        onClick: (_: any, elements: any[]) => {
            if (elements.length > 0 && onMonthChange && onYearChange) {
                const barIndex = elements[0].index; // 0-11 in the rolling window

                // Calculate the actual month/year from the rolling window (8 back + 3 forward)
                const centerDate = new Date(displayYear, displayMonth, 1);
                const clickedDate = new Date(centerDate);
                clickedDate.setMonth(clickedDate.getMonth() - 8 + barIndex);

                const clickedYear = clickedDate.getFullYear();
                const clickedMonth = clickedDate.getMonth(); // 0-indexed

                // Update both year and month
                onYearChange(clickedYear);
                onMonthChange(clickedMonth);
            }
        }
    }), [formatClp, onMonthChange, onYearChange, displayYear, displayMonth]);

    // ==========================================================================
    // RENDER
    // ==========================================================================

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-red-500">{error}</p>
            </div>
        );
    }

    return (
        <div className="h-full flex gap-4 p-4">
            {/* Sidebar: Pagos por Vencer */}
            <div className="w-80 flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                {/* Sidebar Header */}
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <ClockIcon className="w-4 h-4 text-amber-500" />
                            Pagos por Vencer
                        </h3>
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                            {upcomingPayments.length}
                        </span>
                    </div>
                    <div className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">
                        {formatClp(upcomingTotal)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        {MONTHS_FULL[displayMonth]} - {MONTHS_FULL[(displayMonth + 1) % 12]}
                    </div>
                </div>

                {/* Sidebar List */}
                <div className="flex-1 overflow-y-auto">
                    {upcomingPayments.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                            <CheckCircleIcon className="w-8 h-8 mx-auto mb-2 text-green-500" />
                            <p className="text-sm">¡Todo al día!</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {upcomingPayments.map((item, idx) => (
                                <div
                                    key={`${item.commitmentId}-${item.dueMonth}-${idx}`}
                                    onClick={() => {
                                        onOpenPaymentRecorder?.(item.commitmentId, item.dueYear, item.dueMonth);
                                    }}
                                    className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${item.isOverdue ? 'bg-red-50 dark:bg-red-900/20' : ''
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${item.isOverdue
                                                    ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                                    }`}>
                                                    {MONTHS_ES[item.dueMonth]} {item.dueDay.toString().padStart(2, '0')}, {item.dueYear}
                                                </span>
                                                {item.isOverdue && (
                                                    <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-500" />
                                                )}
                                            </div>
                                            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white truncate">
                                                {item.commitmentName}
                                            </p>
                                            {item.cuotaNumber && item.totalCuotas && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Cuota {item.cuotaNumber}/{item.totalCuotas}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {formatClp(item.amount)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
                {/* Month/Year Selector + KPIs Row */}
                <div className="flex gap-4">
                    {/* Month/Year Navigator */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
                        <CalendarIcon className="w-5 h-5 text-slate-500" />

                        {/* Previous Month Button */}
                        <button
                            onClick={handlePrevMonth}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                            aria-label="Mes anterior"
                            title="Mes anterior"
                        >
                            <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        {/* Current Month/Year Display */}
                        <div className="font-semibold text-slate-900 dark:text-white min-w-[140px] text-center">
                            {MONTHS_FULL[displayMonth]} {displayYear}
                        </div>

                        {/* Next Month Button */}
                        <button
                            onClick={handleNextMonth}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                            aria-label="Mes siguiente"
                            title="Mes siguiente"
                        >
                            <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        {/* Divider */}
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

                        {/* Today Button */}
                        <button
                            onClick={handleToday}
                            className="px-3 py-1 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded transition-colors"
                            title="Ir al mes actual"
                        >
                            Hoy
                        </button>
                    </div>

                    {/* KPI Cards */}
                    <div className="flex-1 grid grid-cols-4 gap-3">
                        {/* Income */}
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-1.5 mb-1">
                                <ArrowTrendingUpIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                                <span className="text-xs font-medium text-green-700 dark:text-green-300 uppercase">Ingresos</span>
                            </div>
                            <p className="text-lg font-bold text-green-700 dark:text-green-300">
                                {formatClp(currentMonthSummary.income)}
                            </p>
                        </div>

                        {/* Expenses */}
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-800">
                            <div className="flex items-center gap-1.5 mb-1">
                                <ArrowTrendingDownIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                                <span className="text-xs font-medium text-red-700 dark:text-red-300 uppercase">Gastos</span>
                            </div>
                            <p className="text-lg font-bold text-red-700 dark:text-red-300">
                                {formatClp(currentMonthSummary.expenses)}
                            </p>
                        </div>

                        {/* Balance */}
                        <div className={`rounded-xl p-3 border ${currentMonthSummary.balance >= 0
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
                            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                            }`}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <CalendarIcon className={`w-4 h-4 ${currentMonthSummary.balance >= 0
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                    }`} />
                                <span className={`text-xs font-medium uppercase ${currentMonthSummary.balance >= 0
                                    ? 'text-indigo-700 dark:text-indigo-300'
                                    : 'text-amber-700 dark:text-amber-300'
                                    }`}>Balance</span>
                            </div>
                            <p className={`text-lg font-bold ${currentMonthSummary.balance >= 0
                                ? 'text-indigo-700 dark:text-indigo-300'
                                : 'text-amber-700 dark:text-amber-300'
                                }`}>
                                {formatClp(currentMonthSummary.balance)}
                            </p>
                        </div>

                        {/* Savings Rate */}
                        <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-1.5 mb-1">
                                <StarIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 uppercase">Tasa Ahorro</span>
                            </div>
                            <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
                                {currentMonthSummary.savingsRate.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>

                {/* Chart and Categories Row */}
                <div className="flex-1 flex gap-4 min-h-0">
                    {/* Chart */}
                    <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col min-w-0">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
                            {(() => {
                                // Calculate first and last month of rolling window (8 back + 3 forward)
                                const centerDate = new Date(displayYear, displayMonth, 1);
                                const firstDate = new Date(centerDate);
                                firstDate.setMonth(firstDate.getMonth() - 8);
                                const lastDate = new Date(centerDate);
                                lastDate.setMonth(lastDate.getMonth() + 3);

                                const firstMonth = MONTHS_ES[firstDate.getMonth()];
                                const firstYear = firstDate.getFullYear();
                                const lastMonth = MONTHS_ES[lastDate.getMonth()];
                                const lastYear = lastDate.getFullYear();

                                return `Evolución ${firstMonth} ${firstYear} - ${lastMonth} ${lastYear}`;
                            })()}
                        </h3>
                        <div className="flex-1 min-h-[250px]">
                            {chartReady ? (
                                <Bar data={chartData as any} options={chartOptions} />
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2" />
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando gráfico...</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Info note for months with no data */}
                        {monthlyData.some(d => !d.hasIncomeData || !d.hasExpenseData) && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    <span>
                                        Las barras en gris claro indican meses sin registros de commitments activos.
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Categories */}
                    <div className="w-72 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
                            Por Categoría ({MONTHS_ES[displayMonth]})
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {categoriesSummary.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400">Sin gastos este mes</p>
                            ) : (
                                categoriesSummary.slice(0, 8).map((cat) => (
                                    <div key={cat.name} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600 dark:text-slate-400 truncate">{cat.name}</span>
                                            <span className="font-medium text-slate-900 dark:text-white ml-2">
                                                {formatClp(cat.total)}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-red-400 rounded-full transition-all"
                                                style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Annual Summary */}
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">
                                Anual {displayYear}
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <p className="text-xs text-slate-500">Ingresos</p>
                                    <p className="font-semibold text-green-600 dark:text-green-400">
                                        {formatClp(annualTotals.income)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Gastos</p>
                                    <p className="font-semibold text-red-600 dark:text-red-400">
                                        {formatClp(annualTotals.expenses)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardFullV2;
