/**
 * DashboardFull.v2.tsx
 *
 * Full-page Dashboard component using v2 data model (Commitments + Terms + Payments).
 * Uses CommitmentsContext for shared data - no duplicate fetching.
 *
 * Design: Finance Noir - sophisticated, modern, with personality.
 * Features:
 * - Timeline-based "Pagos por Vencer" sidebar
 * - Hero Balance KPI with hierarchical cards
 * - Monthly evolution chart with gradients
 * - Category breakdown with progress bars
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import { useLocalization } from '../hooks/useLocalization';
import { useCommitments } from '../context/CommitmentsContext';
import { es as esTranslations } from '../locales/es';
import { en as enTranslations } from '../locales/en';
import {
    ArrowTrendingDownIcon, ArrowTrendingUpIcon, CalendarIcon, StarIcon,
    ExclamationTriangleIcon, ClockIcon, CheckCircleIcon
} from './icons';
import { FlowType, periodToString } from '../types.v2';
import { getPerPeriodAmount } from '../utils/financialUtils.v2';

Chart.register(...registerables);

// =============================================================================
// TYPES
// =============================================================================

interface TrendIndicatorProps {
    change: number | null;
    invertColors?: boolean; // For expenses, down is good
    size?: 'sm' | 'md';
}

const TrendIndicator: React.FC<TrendIndicatorProps> = ({ change, invertColors = false }) => {
    if (change === null) return null;

    const isPositive = change > 0;
    const isNeutral = Math.abs(change) < 0.5;

    // For expenses: negative change (decrease) is good
    // For income/balance: positive change (increase) is good
    const isGood = invertColors ? !isPositive : isPositive;

    if (isNeutral) {
        return (
            <span className="kpi-trend kpi-trend--neutral">
                <span>~0%</span>
            </span>
        );
    }

    return (
        <span className={`kpi-trend ${isGood ? 'kpi-trend--up' : 'kpi-trend--down'}`}>
            {isPositive ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
            ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            )}
            <span>{Math.abs(change).toFixed(0)}%</span>
        </span>
    );
};

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

type CategoryTab = 'expenses' | 'income';

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
    const { formatClp, language } = useLocalization();
    const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Use shared context data
    const {
        commitments,
        payments,
        loading,
        error,
        setDisplayYear,
        setDisplayMonth,
        getUpcomingPayments,
        getMonthlyData
    } = useCommitments();

    const [chartReady, setChartReady] = useState(false);
    const [categoryTab, setCategoryTab] = useState<CategoryTab>('expenses');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

    // Current month summary (index 8 in rolling window = current month)
    const currentMonthSummary = useMemo(() => {
        const currentIdx = 8; // Current month is at index 8 in 12-month rolling window
        const prevIdx = 7;    // Previous month is at index 7

        const current = monthlyData[currentIdx];
        const prev = monthlyData[prevIdx];

        const calcChange = (curr: number, previous: number): number | null => {
            if (previous === 0) return curr > 0 ? 100 : null;
            return ((curr - previous) / previous) * 100;
        };

        return {
            income: current.income,
            expenses: current.expenses,
            balance: current.balance,
            savingsRate: current.income > 0 ? ((current.income - current.expenses) / current.income) * 100 : 0,
            // Trend data
            incomeChange: calcChange(current.income, prev.income),
            expensesChange: calcChange(current.expenses, prev.expenses),
            balanceChange: calcChange(current.balance, prev.balance),
            prevSavingsRate: prev.income > 0 ? ((prev.income - prev.expenses) / prev.income) * 100 : 0,
        };
    }, [monthlyData]);

    // Annual totals
    const annualTotals = useMemo(() => {
        return monthlyData.reduce((acc, d) => ({
            income: acc.income + d.income,
            expenses: acc.expenses + d.expenses,
            balance: acc.balance + d.balance
        }), { income: 0, expenses: 0, balance: 0 });
    }, [monthlyData]);

    // Categories summary for current month (both expenses and income)
    // Uses actual payment amounts when available, falls back to projected amounts
    // Calculates NET for linked commitments (PRIMARY - SECONDARY)
    const { expenseCategories, incomeCategories } = useMemo(() => {
        const expenseTotals = new Map<string, number>();
        const incomeTotals = new Map<string, number>();
        const currentIdx = 8; // Current month in rolling window

        // Calculate the actual year/month for the current slot in rolling window
        const centerDate = new Date(displayYear, displayMonth, 1);
        const slotDate = new Date(centerDate);
        slotDate.setMonth(slotDate.getMonth() - 8 + currentIdx);
        const slotYear = slotDate.getFullYear();
        const slotMonth = slotDate.getMonth(); // 0-indexed

        // Use translations based on current language
        const translations = language === 'es' ? esTranslations : enTranslations;

        // Build a map of commitment IDs for quick lookup
        const commitmentMap = new Map(commitments.map(c => [c.id, c]));

        // Track processed pairs to avoid double-counting linked commitments
        const processedPairs = new Set<string>();
        const getPairKey = (id1: string, id2: string) => [id1, id2].sort().join('|');

        // Helper to get amount for a commitment in the current period
        const getAmountForCommitment = (c: typeof commitments[0]): number => {
            const t = c.active_term;
            if (!t) return 0;
            const cPayments = payments.get(c.id) || [];
            const pStr = periodToString({ year: slotYear, month: slotMonth + 1 });
            const pForPeriod = cPayments.find(p => p.period_date.substring(0, 7) === pStr);
            return pForPeriod?.amount_in_base ?? getPerPeriodAmount(t, true);
        };

        // Helper to check if a term is active for the current month
        const isActiveThisMonth = (c: typeof commitments[0]): boolean => {
            const t = c.active_term;
            if (!t) return false;

            const { year: startYear, month: startMonth } = {
                year: parseInt(t.effective_from.split('-')[0]),
                month: parseInt(t.effective_from.split('-')[1])
            };
            const startDate = new Date(startYear, startMonth - 1, 1);
            const monthStart = new Date(slotYear, slotMonth, 1);
            const monthEnd = new Date(slotYear, slotMonth + 1, 0);

            if (startDate > monthEnd) return false;

            if (t.effective_until) {
                const { year: endYear, month: endMonth } = {
                    year: parseInt(t.effective_until.split('-')[0]),
                    month: parseInt(t.effective_until.split('-')[1])
                };
                const endDate = new Date(endYear, endMonth - 1, 1);
                if (endDate < monthStart) return false;
            }

            return true;
        };

        commitments.forEach(commitment => {
            const term = commitment.active_term;
            if (!term) return;

            // Check if commitment is active this month
            if (!isActiveThisMonth(commitment)) return;

            // Check if this commitment is part of a linked pair
            const linkedId = commitment.linked_commitment_id;
            const linkedCommitment = linkedId ? commitmentMap.get(linkedId) : null;

            // For linked pairs, only process once and determine which side shows NET
            if (linkedCommitment) {
                const pairKey = getPairKey(commitment.id, linkedId!);

                if (processedPairs.has(pairKey)) {
                    return; // Already processed this pair
                }
                processedPairs.add(pairKey);
            }

            // Translate category name using base_category_key
            const category = commitment.category as any;
            let categoryName: string;
            if (category?.base_category_key) {
                const key = `category.${category.base_category_key}` as keyof typeof translations;
                categoryName = translations[key] || category.name || 'Sin categoría';
            } else {
                categoryName = category?.name || translations['grid.uncategorized'] || 'Sin categoría';
            }

            // Get this commitment's amount
            let amount = getAmountForCommitment(commitment);
            let flowType = commitment.flow_type;

            // If linked, calculate NET and determine which side gets it
            if (linkedCommitment && isActiveThisMonth(linkedCommitment)) {
                const linkedAmount = getAmountForCommitment(linkedCommitment);
                const netAmount = Math.abs(amount - linkedAmount);

                // Larger amount determines which flow type gets the NET
                if (amount >= linkedAmount) {
                    amount = netAmount;
                    // flowType stays as commitment.flow_type
                } else {
                    amount = netAmount;
                    flowType = linkedCommitment.flow_type;
                    // Use linked commitment's category for the NET
                    const linkedCategory = linkedCommitment.category as any;
                    if (linkedCategory?.base_category_key) {
                        const key = `category.${linkedCategory.base_category_key}` as keyof typeof translations;
                        categoryName = translations[key] || linkedCategory.name || 'Sin categoría';
                    } else {
                        categoryName = linkedCategory?.name || translations['grid.uncategorized'] || 'Sin categoría';
                    }
                }
            }

            if (flowType === 'EXPENSE') {
                const existing = expenseTotals.get(categoryName) || 0;
                expenseTotals.set(categoryName, existing + amount);
            } else if (flowType === 'INCOME') {
                const existing = incomeTotals.get(categoryName) || 0;
                incomeTotals.set(categoryName, existing + amount);
            }
        });

        const totalExpenses = monthlyData[currentIdx].expenses;
        const totalIncome = monthlyData[currentIdx].income;

        const expenseCategories: CategorySummary[] = [];
        expenseTotals.forEach((total, name) => {
            expenseCategories.push({
                name,
                total,
                percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
                flowType: FlowType.EXPENSE
            });
        });

        const incomeCategories: CategorySummary[] = [];
        incomeTotals.forEach((total, name) => {
            incomeCategories.push({
                name,
                total,
                percentage: totalIncome > 0 ? (total / totalIncome) * 100 : 0,
                flowType: FlowType.INCOME
            });
        });

        return {
            expenseCategories: expenseCategories.sort((a, b) => b.total - a.total),
            incomeCategories: incomeCategories.sort((a, b) => b.total - a.total)
        };
    }, [commitments, payments, monthlyData, language, displayYear, displayMonth]);

    // Get current categories based on selected tab
    const currentCategories = categoryTab === 'expenses' ? expenseCategories : incomeCategories;

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
            // Mark current month with bullet point
            labels.push(i === 8 ? `● ${MONTHS_ES[monthIndex]}` : MONTHS_ES[monthIndex]);
        }

        return labels;
    }, [displayYear, displayMonth, MONTHS_ES]);

    // Current month index in rolling window (index 8 = current month)
    const currentMonthIdx = 8;

    // Create gradient for chart bars
    const createGradient = useCallback((ctx: CanvasRenderingContext2D, chartArea: any, colorStart: string, colorEnd: string) => {
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);
        return gradient;
    }, []);

    const chartData = useMemo(() => ({
        labels: rollingLabels,
        datasets: [
            {
                label: 'Ingresos',
                data: monthlyData.map(d => d.income),
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return 'rgba(16, 185, 129, 0.6)';

                    const dataIndex = context.dataIndex;
                    const hasData = monthlyData[dataIndex]?.hasIncomeData;
                    const isCurrent = dataIndex === currentMonthIdx;

                    if (!hasData) return 'rgba(148, 163, 184, 0.15)';

                    // Gradient from teal to emerald
                    return isCurrent
                        ? createGradient(ctx, chartArea, 'rgba(16, 185, 129, 0.95)', 'rgba(52, 211, 153, 0.95)')
                        : createGradient(ctx, chartArea, 'rgba(16, 185, 129, 0.5)', 'rgba(52, 211, 153, 0.7)');
                },
                borderColor: monthlyData.map((d, i) =>
                    d.hasIncomeData
                        ? i === currentMonthIdx
                            ? 'rgba(16, 185, 129, 1)'
                            : 'rgba(16, 185, 129, 0.8)'
                        : 'rgba(148, 163, 184, 0.3)'
                ),
                borderWidth: monthlyData.map((_, i) => i === currentMonthIdx ? 2 : 1),
                borderRadius: 8,
                borderSkipped: false,
                hoverBackgroundColor: 'rgba(16, 185, 129, 0.9)',
                hoverBorderColor: 'rgba(16, 185, 129, 1)',
                hoverBorderWidth: 2,
                order: 2,
            },
            {
                label: 'Gastos',
                data: monthlyData.map(d => d.expenses),
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return 'rgba(239, 68, 68, 0.6)';

                    const dataIndex = context.dataIndex;
                    const hasData = monthlyData[dataIndex]?.hasExpenseData;
                    const isCurrent = dataIndex === currentMonthIdx;

                    if (!hasData) return 'rgba(148, 163, 184, 0.15)';

                    // Gradient from red to orange
                    return isCurrent
                        ? createGradient(ctx, chartArea, 'rgba(239, 68, 68, 0.95)', 'rgba(251, 146, 60, 0.95)')
                        : createGradient(ctx, chartArea, 'rgba(239, 68, 68, 0.5)', 'rgba(251, 146, 60, 0.7)');
                },
                borderColor: monthlyData.map((d, i) =>
                    d.hasExpenseData
                        ? i === currentMonthIdx
                            ? 'rgba(239, 68, 68, 1)'
                            : 'rgba(239, 68, 68, 0.8)'
                        : 'rgba(148, 163, 184, 0.3)'
                ),
                borderWidth: monthlyData.map((_, i) => i === currentMonthIdx ? 2 : 1),
                borderRadius: 8,
                borderSkipped: false,
                hoverBackgroundColor: 'rgba(239, 68, 68, 0.9)',
                hoverBorderColor: 'rgba(239, 68, 68, 1)',
                hoverBorderWidth: 2,
                order: 2,
            },
            {
                type: 'line' as const,
                label: 'Balance',
                data: monthlyData.map(d =>
                    (d.hasIncomeData || d.hasExpenseData) ? d.balance : null
                ),
                borderColor: 'rgba(13, 148, 136, 1)', // Teal accent
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return 'rgba(13, 148, 136, 0.1)';

                    // Gradient fill under line
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, 'rgba(13, 148, 136, 0)');
                    gradient.addColorStop(0.5, 'rgba(13, 148, 136, 0.1)');
                    gradient.addColorStop(1, 'rgba(13, 148, 136, 0.25)');
                    return gradient;
                },
                fill: true,
                borderWidth: 3,
                pointRadius: monthlyData.map((d, i) =>
                    (d.hasIncomeData || d.hasExpenseData)
                        ? (i === currentMonthIdx ? 8 : 4)
                        : 0
                ),
                pointBackgroundColor: monthlyData.map((_, i) =>
                    i === currentMonthIdx ? 'rgba(13, 148, 136, 1)' : 'rgba(13, 148, 136, 0.8)'
                ),
                pointBorderColor: monthlyData.map((_, i) =>
                    i === currentMonthIdx ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.6)'
                ),
                pointBorderWidth: monthlyData.map((_, i) => i === currentMonthIdx ? 3 : 1.5),
                pointHoverRadius: 10,
                pointHoverBorderWidth: 3,
                pointHoverBackgroundColor: 'rgba(13, 148, 136, 1)',
                pointHoverBorderColor: 'rgba(255, 255, 255, 1)',
                tension: 0.4,
                spanGaps: false,
                order: 0,
            }
        ]
    }), [monthlyData, rollingLabels, createGradient]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top' as const,
                align: 'end' as const,
                labels: {
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 20,
                    font: {
                        family: "'Geist', system-ui, sans-serif",
                        size: 12,
                        weight: 'normal' as const,
                    },
                    color: 'rgb(100, 116, 139)', // slate-500
                    boxWidth: 8,
                    boxHeight: 8,
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)', // slate-900
                titleColor: 'rgb(241, 245, 249)', // slate-100
                bodyColor: 'rgb(203, 213, 225)', // slate-300
                borderColor: 'rgba(45, 212, 191, 0.3)', // teal-400
                borderWidth: 1,
                cornerRadius: 10,
                padding: 14,
                displayColors: true,
                boxPadding: 6,
                titleFont: {
                    family: "'Geist', system-ui, sans-serif",
                    size: 13,
                    weight: 'bold' as const,
                },
                bodyFont: {
                    family: "'Geist', system-ui, sans-serif",
                    size: 12,
                },
                callbacks: {
                    title: (items: any[]) => {
                        if (!items.length) return '';
                        const idx = items[0].dataIndex;
                        const centerDate = new Date(displayYear, displayMonth, 1);
                        const itemDate = new Date(centerDate);
                        itemDate.setMonth(itemDate.getMonth() - 8 + idx);
                        return `${MONTHS_FULL[itemDate.getMonth()]} ${itemDate.getFullYear()}`;
                    },
                    label: (ctx: any) => {
                        const value = ctx.raw as number;
                        if (value === null || value === undefined) return '';
                        const icon = ctx.dataset.label === 'Ingresos' ? '↑' :
                                     ctx.dataset.label === 'Gastos' ? '↓' : '◆';
                        return `${icon} ${ctx.dataset.label}: ${formatClp(value)}`;
                    },
                    labelTextColor: (ctx: any) => {
                        if (ctx.dataset.label === 'Ingresos') return 'rgb(52, 211, 153)'; // emerald-400
                        if (ctx.dataset.label === 'Gastos') return 'rgb(248, 113, 113)'; // red-400
                        return 'rgb(45, 212, 191)'; // teal-400
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                border: {
                    display: false,
                },
                ticks: {
                    font: {
                        family: "'Geist', system-ui, sans-serif",
                        size: 11,
                        weight: 'normal' as const,
                    },
                    color: (context: any) => {
                        return context.index === currentMonthIdx
                            ? 'rgb(13, 148, 136)' // teal-600 for current
                            : 'rgb(148, 163, 184)'; // slate-400
                    },
                    padding: 8,
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(148, 163, 184, 0.1)', // Very subtle grid
                    lineWidth: 1,
                },
                border: {
                    display: false,
                    dash: [4, 4],
                },
                ticks: {
                    font: {
                        family: "'Geist Mono', monospace",
                        size: 11,
                    },
                    color: 'rgb(148, 163, 184)', // slate-400
                    padding: 12,
                    callback: (value: number | string) => {
                        const num = typeof value === 'number' ? value : parseFloat(value);
                        if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
                        if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(0)}K`;
                        return `$${num}`;
                    }
                }
            }
        },
        animation: {
            duration: 600,
            easing: 'easeOutQuart' as const,
        },
        onClick: (_: any, elements: any[]) => {
            if (elements.length > 0 && onMonthChange && onYearChange) {
                const barIndex = elements[0].index;
                const centerDate = new Date(displayYear, displayMonth, 1);
                const clickedDate = new Date(centerDate);
                clickedDate.setMonth(clickedDate.getMonth() - 8 + barIndex);

                onYearChange(clickedDate.getFullYear());
                onMonthChange(clickedDate.getMonth());
            }
        }
    }), [formatClp, onMonthChange, onYearChange, displayYear, displayMonth, MONTHS_FULL]);

    // ==========================================================================
    // RENDER
    // ==========================================================================

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--dashboard-accent)]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-[var(--dashboard-negative)]">{error}</p>
            </div>
        );
    }

    return (
        <div className="dashboard-container h-full flex gap-4 p-4">
            {/* Sidebar: Pagos por Vencer - Timeline Design */}
            <div className={`sidebar-upcoming flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-14' : 'w-80'}`}>
                {/* Sidebar Header */}
                <div className="sidebar-header">
                    <div className="flex items-center justify-between">
                        {!sidebarCollapsed ? (
                            <>
                                <div className="sidebar-title">
                                    <ClockIcon className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                                    Pagos por Vencer
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-xs font-bold rounded-full"
                                        style={{ background: 'var(--dashboard-warning-light)', color: 'var(--dashboard-warning)' }}>
                                        {upcomingPayments.length}
                                    </span>
                                    <button
                                        onClick={() => setSidebarCollapsed(true)}
                                        className="p-1 rounded transition-colors hover:opacity-70"
                                        title="Colapsar"
                                    >
                                        <svg className="w-4 h-4" style={{ color: 'var(--dashboard-text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                        </svg>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <button
                                onClick={() => setSidebarCollapsed(false)}
                                className="w-full flex flex-col items-center gap-1 py-1"
                                title="Expandir Pagos por Vencer"
                            >
                                <ClockIcon className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                                <span className="px-1.5 py-0.5 text-xs font-bold rounded-full"
                                    style={{ background: 'var(--dashboard-warning-light)', color: 'var(--dashboard-warning)' }}>
                                    {upcomingPayments.length}
                                </span>
                                <svg className="w-4 h-4 mt-1" style={{ color: 'var(--dashboard-text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {!sidebarCollapsed && (
                        <>
                            <div className="sidebar-total tabular-nums">
                                {formatClp(upcomingTotal)}
                            </div>
                            <div className="sidebar-subtitle">
                                {MONTHS_FULL[displayMonth]} {displayYear}
                            </div>
                        </>
                    )}
                </div>

                {/* Sidebar Timeline List - Grouped by Urgency */}
                <div className={`timeline-list thin-scrollbar ${sidebarCollapsed ? 'hidden' : ''}`}>
                    {upcomingPayments.length === 0 ? (
                        <div className="empty-state">
                            <CheckCircleIcon className="empty-state-icon" />
                            <p className="empty-state-text">¡Todo al día!</p>
                        </div>
                    ) : (
                        <>
                            {/* Overdue Group */}
                            {upcomingPayments.some(p => p.urgencyGroup === 'overdue') && (
                                <div className="timeline-group">
                                    <div className="timeline-group-label timeline-group-label--overdue">
                                        <ExclamationTriangleIcon className="w-3 h-3" />
                                        Vencidos
                                    </div>
                                    {upcomingPayments
                                        .filter(p => p.urgencyGroup === 'overdue')
                                        .map((item, idx) => (
                                            <div
                                                key={`${item.commitmentId}-${item.dueMonth}-${idx}`}
                                                onClick={() => {
                                                    onOpenPaymentRecorder?.(item.commitmentId, item.dueYear, item.dueMonth);
                                                }}
                                                className="timeline-item timeline-item--overdue"
                                            >
                                                <div className="timeline-date">
                                                    {MONTHS_ES[item.dueMonth]} {item.dueDay.toString().padStart(2, '0')}, {item.dueYear}
                                                </div>
                                                <div className="timeline-name">
                                                    {item.commitmentName}
                                                </div>
                                                {item.cuotaNumber && item.totalCuotas && (
                                                    <div className="timeline-meta">
                                                        Cuota {item.cuotaNumber}/{item.totalCuotas}
                                                    </div>
                                                )}
                                                <div className="timeline-amount">
                                                    {formatClp(item.amount)}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}

                            {/* Next 7 Days Group */}
                            {upcomingPayments.some(p => p.urgencyGroup === 'next7days') && (
                                <div className="timeline-group">
                                    <div className="timeline-group-label timeline-group-label--soon">
                                        <ClockIcon className="w-3 h-3" />
                                        Próximos 7 días
                                    </div>
                                    {upcomingPayments
                                        .filter(p => p.urgencyGroup === 'next7days')
                                        .map((item, idx) => (
                                            <div
                                                key={`${item.commitmentId}-${item.dueMonth}-${idx}`}
                                                onClick={() => {
                                                    onOpenPaymentRecorder?.(item.commitmentId, item.dueYear, item.dueMonth);
                                                }}
                                                className="timeline-item timeline-item--upcoming"
                                            >
                                                <div className="timeline-date">
                                                    {MONTHS_ES[item.dueMonth]} {item.dueDay.toString().padStart(2, '0')}
                                                    <span className="timeline-days-badge">
                                                        {item.daysUntilDue === 0 ? 'Hoy' : item.daysUntilDue === 1 ? 'Mañana' : `${item.daysUntilDue}d`}
                                                    </span>
                                                </div>
                                                <div className="timeline-name">
                                                    {item.commitmentName}
                                                </div>
                                                {item.cuotaNumber && item.totalCuotas && (
                                                    <div className="timeline-meta">
                                                        Cuota {item.cuotaNumber}/{item.totalCuotas}
                                                    </div>
                                                )}
                                                <div className="timeline-amount">
                                                    {formatClp(item.amount)}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}

                            {/* Rest of Month Group */}
                            {upcomingPayments.some(p => p.urgencyGroup === 'restOfMonth') && (
                                <div className="timeline-group">
                                    <div className="timeline-group-label">
                                        <CalendarIcon className="w-3 h-3" />
                                        Resto del mes
                                    </div>
                                    {upcomingPayments
                                        .filter(p => p.urgencyGroup === 'restOfMonth')
                                        .map((item, idx) => (
                                            <div
                                                key={`${item.commitmentId}-${item.dueMonth}-${idx}`}
                                                onClick={() => {
                                                    onOpenPaymentRecorder?.(item.commitmentId, item.dueYear, item.dueMonth);
                                                }}
                                                className="timeline-item"
                                            >
                                                <div className="timeline-date">
                                                    {MONTHS_ES[item.dueMonth]} {item.dueDay.toString().padStart(2, '0')}
                                                </div>
                                                <div className="timeline-name">
                                                    {item.commitmentName}
                                                </div>
                                                {item.cuotaNumber && item.totalCuotas && (
                                                    <div className="timeline-meta">
                                                        Cuota {item.cuotaNumber}/{item.totalCuotas}
                                                    </div>
                                                )}
                                                <div className="timeline-amount">
                                                    {formatClp(item.amount)}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
                {/* Month Navigator + KPIs Row */}
                <div className="flex gap-4 items-stretch">
                    {/* Month/Year Navigator */}
                    <div className="month-navigator">
                        <CalendarIcon className="w-5 h-5 text-slate-400 dark:text-slate-500" />

                        <button
                            onClick={handlePrevMonth}
                            className="month-navigator-btn"
                            aria-label="Mes anterior"
                            title="Mes anterior"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <div className="month-navigator-display">
                            {MONTHS_FULL[displayMonth]} {displayYear}
                        </div>

                        <button
                            onClick={handleNextMonth}
                            className="month-navigator-btn"
                            aria-label="Mes siguiente"
                            title="Mes siguiente"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        <div className="h-6 w-px mx-1" style={{ background: 'var(--dashboard-border)' }}></div>

                        <button
                            onClick={handleToday}
                            className="month-navigator-today"
                            title="Ir al mes actual"
                        >
                            Hoy
                        </button>
                    </div>

                    {/* KPI Cards - Hero Balance Layout with Enhanced Design */}
                    <div className="flex-1 kpi-grid">
                        {/* Balance - Hero Card */}
                        <div className="kpi-card kpi-card--hero kpi-card-hero-glow animate-fade-in-up group">
                            <div className="flex items-center justify-between mb-3">
                                <span className="kpi-label mb-0">Balance Mensual</span>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-teal-500 to-cyan-600 transition-transform duration-300 group-hover:scale-110">
                                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <p className={`kpi-value tabular-nums ${currentMonthSummary.balance >= 0 ? 'kpi-value--accent' : 'kpi-value--negative'}`}>
                                {formatClp(currentMonthSummary.balance)}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--dashboard-text-muted)' }}>Flujo neto del mes</p>
                            <TrendIndicator change={currentMonthSummary.balanceChange} />
                        </div>

                        {/* Income */}
                        <div className="kpi-card kpi-card--positive animate-fade-in-up stagger-1 group">
                            <div className="flex items-center justify-between mb-3">
                                <span className="kpi-label mb-0">Ingresos</span>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/15 dark:bg-emerald-400/15 transition-transform duration-300 group-hover:scale-110">
                                    <ArrowTrendingUpIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                            </div>
                            <p className="kpi-value kpi-value--positive tabular-nums">
                                {formatClp(currentMonthSummary.income)}
                            </p>
                            <TrendIndicator change={currentMonthSummary.incomeChange} />
                        </div>

                        {/* Expenses */}
                        <div className="kpi-card kpi-card--negative animate-fade-in-up stagger-2 group">
                            <div className="flex items-center justify-between mb-3">
                                <span className="kpi-label mb-0">Gastos</span>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 dark:bg-red-400/15 transition-transform duration-300 group-hover:scale-110">
                                    <ArrowTrendingDownIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                                </div>
                            </div>
                            <p className="kpi-value kpi-value--negative tabular-nums">
                                {formatClp(currentMonthSummary.expenses)}
                            </p>
                            <TrendIndicator change={currentMonthSummary.expensesChange} invertColors />
                        </div>

                        {/* Pending Payments - Warning Style */}
                        <div className="kpi-card kpi-card--neutral animate-fade-in-up stagger-3 group" style={{ borderColor: upcomingPayments.length > 0 ? 'var(--dashboard-warning)' : undefined }}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="kpi-label mb-0">Por Pagar</span>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/15 dark:bg-amber-400/15 transition-transform duration-300 group-hover:scale-110">
                                    <ClockIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                </div>
                            </div>
                            <p className="kpi-value tabular-nums" style={{ color: upcomingPayments.length > 0 ? 'var(--dashboard-warning)' : 'var(--dashboard-text-primary)' }}>
                                {formatClp(upcomingTotal)}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--dashboard-text-muted)' }}>
                                {upcomingPayments.length} pagos pendientes
                            </p>
                        </div>
                    </div>
                </div>

                {/* Chart and Categories Row */}
                <div className="flex-1 flex gap-4 min-h-0">
                    {/* Chart */}
                    <div className="chart-panel flex-1 min-w-0">
                        <h3 className="chart-title">
                            {(() => {
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
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2" style={{ borderColor: 'var(--dashboard-accent)' }} />
                                        <p className="text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>Cargando gráfico...</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Info note for months with no data */}
                        {monthlyData.some(d => !d.hasIncomeData || !d.hasExpenseData) && (
                            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--dashboard-border)' }}>
                                <p className="text-xs flex items-start gap-2" style={{ color: 'var(--dashboard-text-muted)' }}>
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

                    {/* Categories Panel */}
                    <div className="category-panel w-72">
                        {/* Tab Header with Counters */}
                        <div className="category-header">
                            <h3 className="category-title">Por Categoría</h3>
                            <div className="category-tabs">
                                <button
                                    onClick={() => setCategoryTab('expenses')}
                                    className={`category-tab category-tab--expenses ${categoryTab === 'expenses' ? 'category-tab--active' : ''}`}
                                >
                                    <span>Gastos</span>
                                    {expenseCategories.length > 0 && (
                                        <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full transition-colors ${
                                            categoryTab === 'expenses'
                                                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                        }`}>
                                            {expenseCategories.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setCategoryTab('income')}
                                    className={`category-tab category-tab--income ${categoryTab === 'income' ? 'category-tab--active' : ''}`}
                                >
                                    <span>Ingresos</span>
                                    {incomeCategories.length > 0 && (
                                        <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full transition-colors ${
                                            categoryTab === 'income'
                                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                        }`}>
                                            {incomeCategories.length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Category List */}
                        <div className="category-list thin-scrollbar">
                            {currentCategories.length === 0 ? (
                                <p className="text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
                                    {categoryTab === 'expenses' ? 'Sin gastos este mes' : 'Sin ingresos este mes'}
                                </p>
                            ) : (
                                currentCategories.slice(0, 8).map((cat, idx) => (
                                    <div key={cat.name} className="category-item animate-fade-in-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                                        <div className="category-item-header">
                                            <span className="category-item-name">{cat.name}</span>
                                            <span className="category-item-value tabular-nums">
                                                {formatClp(cat.total)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="category-progress flex-1">
                                                <div
                                                    className={`category-progress-bar ${categoryTab === 'expenses' ? 'category-progress-bar--expense' : 'category-progress-bar--income'}`}
                                                    style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-medium tabular-nums" style={{ color: 'var(--dashboard-text-muted)', minWidth: '32px', textAlign: 'right' }}>
                                                {cat.percentage.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Annual Summary */}
                        <div className="annual-summary">
                            <h4 className="annual-summary-title">
                                Acumulado {displayYear}
                            </h4>
                            <div className="annual-summary-grid">
                                <div>
                                    <p className="annual-summary-item-label">Ingresos</p>
                                    <p className="annual-summary-item-value annual-summary-item-value--positive tabular-nums">
                                        {formatClp(annualTotals.income)}
                                    </p>
                                </div>
                                <div>
                                    <p className="annual-summary-item-label">Gastos</p>
                                    <p className="annual-summary-item-value annual-summary-item-value--negative tabular-nums">
                                        {formatClp(annualTotals.expenses)}
                                    </p>
                                </div>
                            </div>
                            {/* Balance anual */}
                            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--dashboard-border)' }}>
                                <div className="flex justify-between items-baseline">
                                    <span className="annual-summary-item-label">Balance</span>
                                    <span className={`annual-summary-item-value tabular-nums ${annualTotals.balance >= 0 ? 'annual-summary-item-value--positive' : 'annual-summary-item-value--negative'}`}>
                                        {formatClp(annualTotals.balance)}
                                    </span>
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
