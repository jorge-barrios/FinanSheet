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
import { FlowType, periodToString } from '../types.v2';
import { getPerPeriodAmount } from '../utils/financialUtils.v2';
import { getCommitmentSummary } from '../utils/commitmentStatusUtils';
import { PullToRefresh } from './PullToRefresh';
import { DashboardHeadline } from './dashboard/DashboardHeadline';
import { KPICardEnhanced, KPICardData } from './dashboard/KPICardEnhanced';
import { UpcomingPaymentsWidget } from './dashboard/UpcomingPaymentsWidget';
import { CategoryTabs as CategoryTabsNew } from './dashboard/CategoryTabs';
import { DonutChartEnhanced, DonutSegment } from './dashboard/DonutChartEnhanced';

Chart.register(...registerables);

// =============================================================================
// TYPES
// =============================================================================

interface DashboardFullV2Props {
    displayYear: number;
    displayMonth: number; // 0-indexed
    onMonthChange?: (month: number) => void;
    onYearChange?: (year: number) => void;
    onOpenPaymentRecorder?: (commitmentId: string, periodDate: string) => void; // periodDate: YYYY-MM-DD
}

interface CategorySummary {
    name: string;
    total: number;
    percentage: number;
    flowType: FlowType;
}

type CategoryTabType = 'expenses' | 'income';

// Helper to build periodDate string from year and 0-indexed month
const buildPeriodDate = (year: number, month: number): string => {
    return `${year}-${String(month + 1).padStart(2, '0')}-01`;
};

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
        getMonthlyData,
        refresh,
        getMonthTotals
    } = useCommitments();

    const [chartReady, setChartReady] = useState(false);
    const [categoryTab, setCategoryTab] = useState<CategoryTabType>('expenses');

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
    // REFACTORED: Use centralized getCommitmentSummary for logic consistency
    const upcomingPayments = useMemo(() => {
        const today = new Date();
        const currentYear = displayYear;
        const currentMonth = displayMonth; // 0-indexed

        return commitments
            .map(c => {
                const summary = getCommitmentSummary(c, payments.get(c.id) || []);

                // Only interested in OVERDUE or PENDING items
                if (summary.estado !== 'overdue' && summary.estado !== 'pending') {
                    return null;
                }

                // Determine precise due date
                let dueDate: Date;
                let urgencyGroup: 'overdue' | 'next7days' | 'restOfMonth' = 'restOfMonth';
                let daysUntilDue = 0;

                if (summary.estado === 'overdue') {
                    // Use first overdue period
                    dueDate = summary.firstOverduePeriod || new Date(); // Fallback to today if null
                    urgencyGroup = 'overdue';
                    // Days overdue (negative or 0)
                    const diffTime = dueDate.getTime() - today.getTime();
                    daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                } else {
                    // Pending - use next payment date
                    if (!summary.nextPaymentDate) return null;
                    dueDate = summary.nextPaymentDate;

                    // Calculate days difference
                    const diffTime = dueDate.getTime() - today.getTime();
                    daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (daysUntilDue <= 7) urgencyGroup = 'next7days';
                    else urgencyGroup = 'restOfMonth';
                }

                // Filter: Only show items relevant to current view OR significantly overdue
                // Logic: Show all overdue. For pending, show if in current month view.
                if (urgencyGroup !== 'overdue') {
                    if (dueDate.getMonth() !== currentMonth || dueDate.getFullYear() !== currentYear) {
                        // Let's keep it focused: Overdue + Pending in THIS month.
                        if (dueDate.getMonth() !== currentMonth) return null;
                    }
                }

                let mappedUrgency: 'overdue' | 'today' | 'thisWeek' | 'thisMonth' = 'thisMonth';
                if (urgencyGroup === 'overdue') mappedUrgency = 'overdue';
                else if (daysUntilDue === 0) mappedUrgency = 'today';
                else if (urgencyGroup === 'next7days') mappedUrgency = 'thisWeek';

                // Look for an exact saved payment amount for this specific due date period
                // so we don't just use the base term amount if the user manually adjusted it
                const targetPeriodStr = periodToString({ year: dueDate.getFullYear(), month: dueDate.getMonth() + 1 });
                const paymentRecord = (payments.get(c.id) || []).find(p => p.period_date.substring(0, 7) === targetPeriodStr);
                const actualAmount = paymentRecord?.amount_in_base ?? paymentRecord?.amount_original ?? summary.perPeriodAmount ?? 0;

                return {
                    id: c.id,
                    name: c.name,
                    amount: actualAmount,
                    dueDate: dueDate,
                    category: (c.category as any)?.name || 'Varios',
                    urgency: mappedUrgency as 'overdue' | 'today' | 'thisWeek' | 'thisMonth',
                    installment: summary.isInstallmentBased && summary.installmentsCount ? { current: summary.paymentCount + 1, total: summary.installmentsCount } : undefined,
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => {
                const urgencyOrder = { overdue: 0, today: 1, thisWeek: 2, thisMonth: 3 };
                if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
                    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
                }
                return a.dueDate.getTime() - b.dueDate.getTime();
            });
    }, [commitments, payments, displayMonth, displayYear]);

    // Monthly data for chart
    const monthlyData = useMemo(() => {
        return getMonthlyData();
    }, [getMonthlyData, displayYear]); // Force recalc when year changes

    // Get perfectly synced totals using the unified logic
    const currentMonthTotals = useMemo(() => {
        return getMonthTotals(displayYear, displayMonth);
    }, [getMonthTotals, displayYear, displayMonth]);
    
    // Previous month comparison for KPI cards
    const prevMonthTotals = useMemo(() => {
        const prevMonth = displayMonth === 0 ? 11 : displayMonth - 1;
        const prevYear = displayMonth === 0 ? displayYear - 1 : displayYear;
        return getMonthTotals(prevYear, prevMonth);
    }, [getMonthTotals, displayYear, displayMonth]);

    const calcChange = useCallback((curr: number, previous: number): number | null => {
        if (previous === 0) return curr > 0 ? 100 : null;
        return ((curr - previous) / previous) * 100;
    }, []);

    const currentMonthSummary = useMemo(() => {
        return {
            ingresosChange: calcChange(currentMonthTotals.ingresos, prevMonthTotals.ingresos),
            pagadoChange: calcChange(currentMonthTotals.pagado, prevMonthTotals.pagado),
            pendienteChange: calcChange(currentMonthTotals.pendiente, prevMonthTotals.pendiente),
            vencidoChange: calcChange(currentMonthTotals.vencido, prevMonthTotals.vencido)
        };
    }, [currentMonthTotals, prevMonthTotals, calcChange]);

    // Annual totals constraint mapping
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
                borderColor: 'rgba(14, 165, 233, 1)', // Sky Blue accent (#0ea5e9)
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return 'rgba(13, 148, 136, 0.1)';

                    // Gradient fill under line
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, 'rgba(14, 165, 233, 0)');
                    gradient.addColorStop(0.5, 'rgba(14, 165, 233, 0.1)');
                    gradient.addColorStop(1, 'rgba(14, 165, 233, 0.25)');
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
                    i === currentMonthIdx ? 'rgba(14, 165, 233, 1)' : 'rgba(14, 165, 233, 0.8)'
                ),
                pointBorderColor: monthlyData.map((_, i) =>
                    i === currentMonthIdx ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.6)'
                ),
                pointBorderWidth: monthlyData.map((_, i) => i === currentMonthIdx ? 3 : 1.5),
                pointHoverRadius: 10,
                pointHoverBorderWidth: 3,
                pointHoverBackgroundColor: 'rgba(14, 165, 233, 1)',
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

        const kpiCards: KPICardData[] = useMemo(() => [
        {
            id: 'income',
            label: 'Ingresos',
            value: currentMonthTotals.ingresos,
            formattedValue: formatClp(currentMonthTotals.ingresos),
            change: currentMonthSummary.ingresosChange || undefined,
            variant: 'hero', // Made this hero for better layout dominance
            icon: (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            id: 'pagado',
            label: 'Pagado',
            value: currentMonthTotals.pagado,
            formattedValue: formatClp(currentMonthTotals.pagado),
            change: currentMonthSummary.pagadoChange || undefined,
            variant: 'income',
            icon: (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            subtitle: `${currentMonthTotals.paidCount} gastos pagados`,
        },
        {
            id: 'pendiente',
            label: 'Por Pagar',
            value: currentMonthTotals.pendiente,
            formattedValue: formatClp(currentMonthTotals.pendiente),
            change: currentMonthSummary.pendienteChange || undefined,
            variant: 'warning',
            icon: (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            subtitle: currentMonthTotals.hasLinkedPending ? '(neto)' : undefined,
        },
        {
            id: 'vencido',
            label: 'Vencido',
            value: currentMonthTotals.vencido,
            formattedValue: formatClp(currentMonthTotals.vencido),
            change: currentMonthSummary.vencidoChange || undefined,
            variant: 'expense',
            icon: (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            ),
            subtitle: currentMonthTotals.hasLinkedOverdue ? '(neto)' : undefined,
        },
    ], [currentMonthTotals, currentMonthSummary, formatClp]);

    const donutSegments: DonutSegment[] = useMemo(() => {
        const colors = ['#0d9488', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];
        return currentCategories.map((cat, idx) => ({
            label: cat.name,
            value: cat.total,
            percentage: cat.percentage,
            color: colors[idx % colors.length]
        }));
    }, [currentCategories]);

    const categoryTabsData = [
        { id: 'expenses', label: 'Gastos', count: expenseCategories.length },
        { id: 'income', label: 'Ingresos', count: incomeCategories.length },
    ];

    return (
        <PullToRefresh
            onRefresh={async () => { await refresh({ force: true }); }}
            className="h-full bg-slate-50/50 dark:bg-slate-900/50 overflow-y-auto"
        >
            <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8 pb-20 lg:pb-8">
                {/* Header & Navigation */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <DashboardHeadline
                        primary="Control total de tus"
                        accent="finanzas personales"
                        secondary={`Visualizando datos para ${MONTHS_FULL[displayMonth]} ${displayYear}.`}
                    />

                    {/* Month Navigator */}
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm self-start backdrop-blur-sm">
                        <button onClick={handlePrevMonth} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <span className="font-medium text-slate-700 dark:text-slate-300 min-w-[120px] text-center">
                            {MONTHS_FULL[displayMonth]} {displayYear}
                        </span>
                        <button onClick={handleNextMonth} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                        <button onClick={handleToday} className="text-sm font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors px-2">
                            Hoy
                        </button>
                    </div>
                </div>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {kpiCards.map((card, idx) => (
                        <KPICardEnhanced
                            key={card.id}
                            data={card}
                            formatCurrency={formatClp}
                            animationDelay={idx * 50}
                        />
                    ))}
                </div>

                {/* Main Middle Row: Evolution Chart */}
                <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700/50 p-5 shadow-sm">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                        Evolución Mensual
                    </h3>
                    <div className="h-[250px] w-full">
                        {chartReady ? (
                            <Bar data={chartData as any} options={chartOptions} />
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Row: Donut Chart + Categories + Upcoming */}
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                    <div className="xl:col-span-3 space-y-4">
                        <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                            <CategoryTabsNew
                                tabs={categoryTabsData}
                                activeTab={categoryTab}
                                onChange={(id) => setCategoryTab(id as CategoryTabType)}
                                variant={categoryTab === 'expenses' ? 'expense' : 'income'}
                            />
                        </div>
                        {donutSegments.length > 0 ? (
                            <DonutChartEnhanced
                                segments={donutSegments}
                                formatCurrency={formatClp}
                                title={categoryTab === 'expenses' ? 'Gastos por Categoría' : 'Ingresos por Categoría'}
                            />
                        ) : (
                            <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700/50 p-8 text-center">
                                <p className="text-slate-500 dark:text-slate-400">
                                    No hay datos en esta categoría para este mes.
                                </p>
                            </div>
                        )}
                    </div>
                    
                    <div className="xl:col-span-2 space-y-6">
                        <UpcomingPaymentsWidget
                            payments={upcomingPayments}
                            formatCurrency={formatClp}
                            onPaymentClick={(payment) => {
                                onOpenPaymentRecorder?.(payment.id, buildPeriodDate(payment.dueDate.getFullYear(), payment.dueDate.getMonth()));
                            }}
                        />
                        
                        {/* Summary Block */}
                        <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700/50 p-5 shadow-sm">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                                Acumulado {displayYear}
                            </h4>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Ingresos</p>
                                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                        {formatClp(annualTotals.income)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Gastos</p>
                                    <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                                        {formatClp(annualTotals.expenses)}
                                    </p>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Balance Anual</span>
                                <span className={`text-xl font-bold tabular-nums ${annualTotals.balance >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatClp(annualTotals.balance)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PullToRefresh>
    );
};

export default DashboardFullV2;