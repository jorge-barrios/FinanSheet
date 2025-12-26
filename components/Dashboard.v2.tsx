/**
 * Dashboard v2 Component
 * 
 * A cleaner Dashboard component that uses the v2 data model
 * (Commitments + Terms + Payments) instead of v1 (Expenses + PaymentDetails).
 * 
 * Design follows the style established in CommitmentForm.v2:
 * - Color-coded expense/income (red/green)
 * - Dynamic theming with colored shadows
 * - Icon-based visual feedback
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import { useLocalization } from '../hooks/useLocalization';
import { CommitmentService, PaymentService, getCurrentUserId } from '../services/dataService.v2';
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, CalendarIcon, StarIcon, XMarkIcon } from './icons';
import type { CommitmentWithTerm, Payment, Period, FlowType, Term } from '../types.v2';
import { periodToString } from '../types.v2';
import { extractYearMonth, getPerPeriodAmount } from '../utils/financialUtils.v2';

Chart.register(...registerables);

// =============================================================================
// TYPES
// =============================================================================

interface DashboardV2Props {
    isOpen: boolean;
    onClose: () => void;
    displayYear: number;
    displayMonth?: number; // 0-11
    refreshTrigger?: number; // Increment to force refetch
}

interface MonthlyData {
    income: number;
    expenses: number;
    balance: number;
}

interface CategorySummary {
    name: string;
    total: number;
    percentage: number;
    flowType: FlowType;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get the active term for a commitment in a specific period (year/month)
 * Supports multi-term commitments (paused/resumed, changed amounts, etc.)
 */
const getTermForPeriod = (commitment: CommitmentWithTerm, year: number, month: number): Term | null => {
    const all_terms = commitment.all_terms || [];
    if (all_terms.length === 0) return commitment.active_term; // Fallback

    // Convert to YYYY-MM-DD (first day of month)
    const periodDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;

    // Find term where:
    // effective_from <= periodDate AND (effective_until is null OR effective_until >= periodDate)
    const term = all_terms.find(t =>
        t.effective_from <= periodDate &&
        (t.effective_until === null || t.effective_until >= periodDate)
    );

    return term || null;
};

// =============================================================================
// COMPONENT
// =============================================================================

export const DashboardV2: React.FC<DashboardV2Props> = ({
    isOpen,
    onClose,
    displayYear,
    displayMonth,
    refreshTrigger = 0
}) => {
    const { formatClp } = useLocalization();
    const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // State
    const [commitments, setCommitments] = useState<CommitmentWithTerm[]>([]);
    const [payments, setPayments] = useState<Map<string, Payment[]>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const activeMonth = displayMonth ?? new Date().getMonth();

    // ==========================================================================
    // DATA FETCHING
    // ==========================================================================

    useEffect(() => {
        if (!isOpen) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                const userId = await getCurrentUserId();
                if (!userId) {
                    setError('No user logged in');
                    return;
                }

                // Fetch commitments with their active terms
                const commitmentsData = await CommitmentService.getCommitmentsWithTerms(userId);
                setCommitments(commitmentsData);

                // Fetch payments for the display year (all 12 months)
                const paymentsByCommitment = new Map<string, Payment[]>();
                for (let month = 0; month < 12; month++) {
                    const period: Period = { year: displayYear, month: month + 1 };
                    const periodPayments = await PaymentService.getPaymentsByPeriod(userId, period);

                    periodPayments.forEach(p => {
                        const existing = paymentsByCommitment.get(p.commitment_id) || [];
                        // Check if this payment already exists (avoid duplicates)
                        if (!existing.find(ep => ep.id === p.id)) {
                            paymentsByCommitment.set(p.commitment_id, [...existing, p]);
                        }
                    });
                }
                setPayments(paymentsByCommitment);

            } catch (err) {
                console.error('Dashboard v2 fetch error:', err);
                setError(err instanceof Error ? err.message : 'Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isOpen, displayYear, refreshTrigger]);

    // ==========================================================================
    // CALCULATIONS
    // ==========================================================================

    // Calculate monthly data for all 12 months
    const monthlyData = useMemo<MonthlyData[]>(() => {
        const data: MonthlyData[] = Array.from({ length: 12 }, () => ({
            income: 0, expenses: 0, balance: 0
        }));

        commitments.forEach(commitment => {
            for (let month = 0; month < 12; month++) {
                // Get term for THIS specific month (supports multi-term)
                const term = getTermForPeriod(commitment, displayYear, month);
                if (!term) continue; // Skip months with no term (gap)

                // Check which months this commitment applies to - use extractYearMonth for timezone safety
                const { year: startYear, month: startMonth } = extractYearMonth(term.effective_from);
                const startDate = new Date(startYear, startMonth - 1, 1);
                const endDate = term.effective_until
                    ? (() => {
                        const { year: endYear, month: endMonth } = extractYearMonth(term.effective_until);
                        return new Date(endYear, endMonth - 1, 1);
                    })()
                    : null;

                const periodStart = new Date(displayYear, month, 1);
                const periodEnd = new Date(displayYear, month + 1, 0);

                // Check if term is active in this period
                if (startDate > periodEnd) continue;
                if (endDate && endDate < periodStart) continue;

                // Check frequency
                const shouldInclude = checkFrequencyForMonth(term.frequency, startDate, periodStart);
                if (!shouldInclude) continue;

                // Get amount (check if there's a payment, otherwise use per-period amount)
                const commitmentPayments = payments.get(commitment.id) || [];
                const periodStr = periodToString({ year: displayYear, month: month + 1 });
                const paymentForPeriod = commitmentPayments.find(p => {
                    const pPeriod = p.period_date.substring(0, 7); // YYYY-MM
                    return pPeriod === periodStr;
                });

                // Use payment amount if exists, otherwise calculate per-period amount from term
                const amount = paymentForPeriod?.amount_in_base ?? getPerPeriodAmount(term, true);

                if (commitment.flow_type === 'INCOME') {
                    data[month].income += amount;
                } else {
                    data[month].expenses += amount;
                }
            }
        });

        // Calculate balance
        data.forEach(d => {
            d.balance = d.income - d.expenses;
        });

        return data;
    }, [commitments, payments, displayYear]);

    // Current month summary
    const currentMonthSummary = useMemo(() => {
        const d = monthlyData[activeMonth];
        return {
            income: d.income,
            expenses: d.expenses,
            balance: d.balance,
            savingsRate: d.income > 0 ? ((d.income - d.expenses) / d.income) * 100 : 0
        };
    }, [monthlyData, activeMonth]);

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
            // Get term for the active month
            const term = getTermForPeriod(commitment, displayYear, activeMonth);
            if (!term) return; // Skip if no term for this month (gap)

            // Use extractYearMonth to avoid timezone issues
            const { year: startYear, month: startMonth } = extractYearMonth(term.effective_from);
            const startDate = new Date(startYear, startMonth - 1, 1);
            const periodStart = new Date(displayYear, activeMonth, 1);
            const periodEnd = new Date(displayYear, activeMonth + 1, 0);

            if (startDate > periodEnd) return;
            const endDate = term.effective_until
                ? (() => {
                    const { year: endYear, month: endMonth } = extractYearMonth(term.effective_until);
                    return new Date(endYear, endMonth - 1, 1);
                })()
                : null;
            if (endDate && endDate < periodStart) return;

            const shouldInclude = checkFrequencyForMonth(term.frequency, startDate, periodStart);
            if (!shouldInclude) return;

            const categoryName = commitment.category?.name || 'Sin categoría';
            const amount = getPerPeriodAmount(term, true);

            const existing = categoryTotals.get(categoryName);
            if (existing) {
                existing.total += amount;
            } else {
                categoryTotals.set(categoryName, { total: amount, flowType: commitment.flow_type as FlowType });
            }
        });

        const totalExpenses = monthlyData[activeMonth].expenses;
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
    }, [commitments, monthlyData, activeMonth, displayYear]);

    // ==========================================================================
    // CHART DATA
    // ==========================================================================

    const chartData = useMemo(() => ({
        labels: MONTHS_ES,
        datasets: [
            {
                label: 'Ingresos',
                data: monthlyData.map(d => d.income),
                backgroundColor: 'rgba(34, 197, 94, 0.6)',
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 1,
                borderRadius: 6,
            },
            {
                label: 'Gastos',
                data: monthlyData.map(d => d.expenses),
                backgroundColor: 'rgba(239, 68, 68, 0.6)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 1,
                borderRadius: 6,
            },
            {
                type: 'line' as const,
                label: 'Balance',
                data: monthlyData.map(d => d.balance),
                borderColor: 'rgba(99, 102, 241, 1)',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderWidth: 2.5,
                pointRadius: 4,
                tension: 0.3,
            }
        ]
    }), [monthlyData, MONTHS_ES]);

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
        }
    }), [formatClp]);

    // ==========================================================================
    // RENDER
    // ==========================================================================

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                            Dashboard
                        </h2>
                        <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
                            v2
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-sm">
                            {displayYear} · {MONTHS_ES[activeMonth]}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-red-500">{error}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {/* Income Card */}
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ArrowTrendingUpIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                                        <span className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide">
                                            Ingresos
                                        </span>
                                    </div>
                                    <p className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-300">
                                        {formatClp(currentMonthSummary.income)}
                                    </p>
                                </div>

                                {/* Expenses Card */}
                                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ArrowTrendingDownIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                                        <span className="text-xs font-medium text-red-700 dark:text-red-300 uppercase tracking-wide">
                                            Gastos
                                        </span>
                                    </div>
                                    <p className="text-xl sm:text-2xl font-bold text-red-700 dark:text-red-300">
                                        {formatClp(currentMonthSummary.expenses)}
                                    </p>
                                </div>

                                {/* Balance Card */}
                                <div className={`rounded-xl p-4 border ${currentMonthSummary.balance >= 0
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
                                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                                    }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <CalendarIcon className={`w-4 h-4 ${currentMonthSummary.balance >= 0
                                            ? 'text-indigo-600 dark:text-indigo-400'
                                            : 'text-amber-600 dark:text-amber-400'
                                            }`} />
                                        <span className={`text-xs font-medium uppercase tracking-wide ${currentMonthSummary.balance >= 0
                                            ? 'text-indigo-700 dark:text-indigo-300'
                                            : 'text-amber-700 dark:text-amber-300'
                                            }`}>
                                            Balance
                                        </span>
                                    </div>
                                    <p className={`text-xl sm:text-2xl font-bold ${currentMonthSummary.balance >= 0
                                        ? 'text-indigo-700 dark:text-indigo-300'
                                        : 'text-amber-700 dark:text-amber-300'
                                        }`}>
                                        {formatClp(currentMonthSummary.balance)}
                                    </p>
                                </div>

                                {/* Savings Rate Card */}
                                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <StarIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                            Tasa Ahorro
                                        </span>
                                    </div>
                                    <p className="text-xl sm:text-2xl font-bold text-slate-700 dark:text-slate-300">
                                        {currentMonthSummary.savingsRate.toFixed(1)}%
                                    </p>
                                </div>
                            </div>

                            {/* Annual Summary */}
                            <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700/30 dark:to-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
                                    Resumen Anual {displayYear}
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Total Ingresos</p>
                                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                            {formatClp(annualTotals.income)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Total Gastos</p>
                                        <p className="text-lg font-bold text-red-600 dark:text-red-400">
                                            {formatClp(annualTotals.expenses)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Balance Anual</p>
                                        <p className={`text-lg font-bold ${annualTotals.balance >= 0
                                            ? 'text-indigo-600 dark:text-indigo-400'
                                            : 'text-amber-600 dark:text-amber-400'
                                            }`}>
                                            {formatClp(annualTotals.balance)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4">
                                    Evolución Mensual
                                </h3>
                                <div className="h-72">
                                    <Bar data={chartData} options={chartOptions} />
                                </div>
                            </div>

                            {/* Categories */}
                            {categoriesSummary.length > 0 && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4">
                                        Por Categoría ({MONTHS_ES[activeMonth]})
                                    </h3>
                                    <div className="space-y-2">
                                        {categoriesSummary.slice(0, 8).map((cat) => (
                                            <div key={cat.name} className="flex items-center gap-3">
                                                <div className="w-24 text-sm text-slate-600 dark:text-slate-400 truncate">
                                                    {cat.name}
                                                </div>
                                                <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${cat.flowType === 'INCOME'
                                                            ? 'bg-green-500'
                                                            : 'bg-red-400'
                                                            }`}
                                                        style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                                                    />
                                                </div>
                                                <div className="w-24 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    {formatClp(cat.total)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

// =============================================================================
// HELPERS
// =============================================================================

function checkFrequencyForMonth(
    frequency: string,
    startDate: Date,
    periodStart: Date
): boolean {
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const periodYear = periodStart.getFullYear();
    const periodMonth = periodStart.getMonth();

    const monthsDiff = (periodYear - startYear) * 12 + (periodMonth - startMonth);
    if (monthsDiff < 0) return false;

    switch (frequency) {
        case 'ONCE':
            return monthsDiff === 0;
        case 'MONTHLY':
            return true;
        case 'BIMONTHLY':
            return monthsDiff % 2 === 0;
        case 'QUARTERLY':
            return monthsDiff % 3 === 0;
        case 'SEMIANNUALLY':
            return monthsDiff % 6 === 0;
        case 'ANNUALLY':
            return monthsDiff % 12 === 0;
        default:
            return true;
    }
}

export default DashboardV2;
