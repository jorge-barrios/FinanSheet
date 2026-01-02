/**
 * FinancialHealthWidget
 *
 * Displays the 50/30/20 budget analysis for the current month.
 * Shows actual vs target distribution with visual progress bars and status.
 */

import React, { useMemo } from 'react';
import type { FinancialHealthAnalysis, BudgetDistribution } from '../types.v2';
import { PieChart, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';

interface FinancialHealthWidgetProps {
    analysis: FinancialHealthAnalysis | null;
    loading?: boolean;
    compact?: boolean; // For smaller display in sidebar
}

const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0,
    }).format(amount);
};

const formatPercent = (pct: number): string => {
    return `${Math.round(pct)}%`;
};

// Status badge component
const StatusBadge: React.FC<{ status: 'good' | 'warning' | 'critical' }> = ({ status }) => {
    const config = {
        good: {
            bg: 'bg-emerald-100 dark:bg-emerald-900/30',
            text: 'text-emerald-700 dark:text-emerald-300',
            icon: CheckCircle,
            label: 'Bien'
        },
        warning: {
            bg: 'bg-amber-100 dark:bg-amber-900/30',
            text: 'text-amber-700 dark:text-amber-300',
            icon: AlertTriangle,
            label: 'Atención'
        },
        critical: {
            bg: 'bg-red-100 dark:bg-red-900/30',
            text: 'text-red-700 dark:text-red-300',
            icon: TrendingDown,
            label: 'Crítico'
        }
    };

    const { bg, text, icon: Icon, label } = config[status];

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
            <Icon size={12} />
            {label}
        </span>
    );
};

// Progress bar for a single category
const CategoryBar: React.FC<{
    label: string;
    actual: number;
    target: number;
    actualPct: number;
    targetPct: number;
    color: string;
}> = ({ label, actual, target, actualPct, targetPct, color }) => {
    const isOver = actual > target;
    const barWidth = Math.min(actualPct, 100);

    return (
        <div className="space-y-1">
            <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
                <span className={`text-xs ${isOver ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                    {formatCurrency(actual)} / {formatCurrency(target)}
                </span>
            </div>
            <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                {/* Target marker */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-slate-500 z-10"
                    style={{ left: `${Math.min(targetPct, 100)}%` }}
                />
                {/* Actual bar */}
                <div
                    className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-400' : ''}`}
                    style={{
                        width: `${barWidth}%`,
                        backgroundColor: isOver ? undefined : color
                    }}
                />
            </div>
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{formatPercent(actualPct)} actual</span>
                <span>{formatPercent(targetPct)} objetivo</span>
            </div>
        </div>
    );
};

export const FinancialHealthWidget: React.FC<FinancialHealthWidgetProps> = ({
    analysis,
    loading = false,
    compact = false
}) => {
    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="space-y-2">
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
                                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <PieChart size={20} />
                    <span>No hay datos de análisis disponibles</span>
                </div>
            </div>
        );
    }

    const { income, totalExpenses, actual, target, percentages, diff, suggestion, status } = analysis;

    // Color scheme for categories
    const colors = {
        needs: '#3b82f6',   // Blue
        wants: '#f59e0b',   // Amber
        savings: '#10b981', // Emerald
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-indigo-500" />
                    Análisis 50/30/20
                </h3>
                <StatusBadge status={status} />
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ingresos</p>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(income)}
                    </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Gastos</p>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(totalExpenses)}
                    </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Balance</p>
                    <p className={`text-sm font-semibold ${
                        income - totalExpenses >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                    }`}>
                        {formatCurrency(income - totalExpenses)}
                    </p>
                </div>
            </div>

            {/* Category Breakdown */}
            {!compact && (
                <div className="space-y-4">
                    <CategoryBar
                        label="Necesidades (50%)"
                        actual={actual.needs}
                        target={target.needs}
                        actualPct={percentages.needs}
                        targetPct={50}
                        color={colors.needs}
                    />
                    <CategoryBar
                        label="Deseos (30%)"
                        actual={actual.wants}
                        target={target.wants}
                        actualPct={percentages.wants}
                        targetPct={30}
                        color={colors.wants}
                    />
                    <CategoryBar
                        label="Ahorro (20%)"
                        actual={actual.savings}
                        target={target.savings}
                        actualPct={percentages.savings}
                        targetPct={20}
                        color={colors.savings}
                    />

                    {/* Unclassified warning */}
                    {actual.unclassified > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                            <span>
                                Tienes {formatCurrency(actual.unclassified)} ({formatPercent(percentages.unclassified)}) sin clasificar.
                                Asigna un tipo de presupuesto a las categorías para un análisis más preciso.
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Suggestion */}
            {suggestion && (
                <div className={`rounded-lg p-3 text-sm ${
                    status === 'good'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : status === 'warning'
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}>
                    <div className="flex items-start gap-2">
                        {status === 'good' ? (
                            <TrendingUp size={16} className="flex-shrink-0 mt-0.5" />
                        ) : (
                            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                        )}
                        <span>{suggestion}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialHealthWidget;
