/**
 * Budget Analysis Utilities
 *
 * Functions for analyzing financial health using the 50/30/20 rule
 * and generating savings suggestions.
 */

import type {
    CommitmentWithTerm,
    Category,
    BudgetType,
    BudgetDistribution,
    FinancialHealthAnalysis,
    Period,
} from '../types.v2';
import { getPerPeriodAmount } from './financialUtils.v2';

// ============================================================================
// BUDGET RULE CALCULATIONS
// ============================================================================

/**
 * Calculate target distribution based on income and user's budget rule
 */
export function calculateTargetDistribution(
    income: number,
    needsPct: number = 50,
    wantsPct: number = 30,
    savingsPct: number = 20
): BudgetDistribution {
    return {
        needs: income * (needsPct / 100),
        wants: income * (wantsPct / 100),
        savings: income * (savingsPct / 100),
    };
}

/**
 * Get budget type for a category, with fallback logic
 */
export function getCategoryBudgetType(category: Category | null | undefined): BudgetType | null {
    if (!category) return null;
    return category.budget_type ?? null;
}

// ============================================================================
// EXPENSE CLASSIFICATION
// ============================================================================

/**
 * Classify monthly expenses by budget type (NEED/WANT/SAVING)
 * Uses category's budget_type to determine classification
 */
export function classifyExpensesByBudgetType(
    commitments: CommitmentWithTerm[],
    expenseAmounts: Map<string, number> // commitment_id -> monthly amount
): BudgetDistribution & { unclassified: number } {
    let needs = 0;
    let wants = 0;
    let savings = 0;
    let unclassified = 0;

    expenseAmounts.forEach((amount, commitmentId) => {
        const commitment = commitments.find(c => c.id === commitmentId);
        if (!commitment) {
            unclassified += amount;
            return;
        }

        // Only classify EXPENSE type, INCOME doesn't count here
        if (commitment.flow_type !== 'EXPENSE') return;

        const budgetType = commitment.category?.budget_type;

        switch (budgetType) {
            case 'NEED':
                needs += amount;
                break;
            case 'WANT':
                wants += amount;
                break;
            case 'SAVING':
                savings += amount;
                break;
            default:
                unclassified += amount;
        }
    });

    return { needs, wants, savings, unclassified };
}

/**
 * Calculate monthly amounts for all commitments in a given period
 * Returns a map of commitment_id -> amount for that month
 */
export function calculateMonthlyAmounts(
    commitments: CommitmentWithTerm[],
    period: Period,
    payments: Map<string, { amount_in_base: number | null; amount_original: number }[]>
): Map<string, number> {
    const amounts = new Map<string, number>();
    const periodStr = `${period.year}-${String(period.month).padStart(2, '0')}`;

    commitments.forEach(commitment => {
        const term = commitment.active_term;
        if (!term) return;

        // Check if there's a payment for this period
        const commitmentPayments = payments.get(commitment.id) || [];
        const paymentForPeriod = commitmentPayments.find(p =>
            (p as any).period_date?.substring(0, 7) === periodStr
        );

        let amount: number;
        if (paymentForPeriod && paymentForPeriod.amount_in_base) {
            amount = paymentForPeriod.amount_in_base;
        } else {
            amount = getPerPeriodAmount(term, true);
        }

        amounts.set(commitment.id, amount);
    });

    return amounts;
}

// ============================================================================
// FINANCIAL HEALTH ANALYSIS
// ============================================================================

/**
 * Generate a suggestion based on the analysis
 */
function generateSuggestion(
    diff: { needs: number; wants: number; savings: number },
    income: number
): string | null {
    const savingsDeficit = Math.abs(diff.savings);
    const wantsExcess = diff.wants;
    const needsExcess = diff.needs;

    // Format currency for suggestions
    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            maximumFractionDigits: 0,
        }).format(n);

    // No income = no suggestions
    if (income <= 0) {
        return 'Registra tus ingresos para recibir sugerencias de ahorro';
    }

    // Saving more than target
    if (diff.savings > 0) {
        return `Excelente! Estás ahorrando ${formatCurrency(diff.savings)} más de lo planificado`;
    }

    // Not saving enough
    if (savingsDeficit > 10000) {
        if (wantsExcess > 0) {
            return `Podrías ahorrar ${formatCurrency(savingsDeficit)} más reduciendo gastos en "Deseos"`;
        }
        if (needsExcess > 0) {
            return `Tus gastos en "Necesidades" superan lo recomendado. Revisa si puedes optimizar`;
        }
        return `Te falta ahorrar ${formatCurrency(savingsDeficit)} para cumplir tu meta`;
    }

    // Close to target
    if (savingsDeficit > 0 && savingsDeficit <= 10000) {
        return 'Estás muy cerca de tu meta de ahorro. Sigue así!';
    }

    return null;
}

/**
 * Determine overall health status
 */
function determineStatus(
    diff: { needs: number; wants: number; savings: number },
    income: number
): 'good' | 'warning' | 'critical' {
    if (income <= 0) return 'warning';

    const savingsDeficitPct = Math.abs(diff.savings) / income * 100;

    // Saving more than target = good
    if (diff.savings >= 0) return 'good';

    // Missing more than 10% of target savings = critical
    if (savingsDeficitPct > 10) return 'critical';

    // Missing some savings = warning
    if (diff.savings < 0) return 'warning';

    return 'good';
}

/**
 * Analyze financial health for a given period
 * Compares actual spending vs target (50/30/20 rule)
 */
export function analyzeFinancialHealth(
    income: number,
    totalExpenses: number,
    actualDistribution: BudgetDistribution & { unclassified: number },
    userRule: { needsPct: number; wantsPct: number; savingsPct: number },
    period: Period
): FinancialHealthAnalysis {
    // Calculate target based on income
    const target = calculateTargetDistribution(
        income,
        userRule.needsPct,
        userRule.wantsPct,
        userRule.savingsPct
    );

    // Calculate actual savings (income - total expenses)
    const actualSavings = income - totalExpenses;

    // Adjust actual distribution to include real savings
    const adjustedActual = {
        ...actualDistribution,
        savings: actualSavings > 0 ? actualSavings : 0,
    };

    // Calculate differences
    const diff = {
        needs: actualDistribution.needs - target.needs,
        wants: actualDistribution.wants - target.wants,
        savings: actualSavings - target.savings,
    };

    // Calculate percentages (of income)
    const percentages = {
        needs: income > 0 ? (actualDistribution.needs / income) * 100 : 0,
        wants: income > 0 ? (actualDistribution.wants / income) * 100 : 0,
        savings: income > 0 ? (actualSavings / income) * 100 : 0,
        unclassified: income > 0 ? (actualDistribution.unclassified / income) * 100 : 0,
    };

    const suggestion = generateSuggestion(diff, income);
    const status = determineStatus(diff, income);

    return {
        period,
        income,
        totalExpenses,
        actual: adjustedActual,
        target,
        diff,
        percentages,
        suggestion,
        status,
    };
}

// ============================================================================
// GOAL CALCULATIONS
// ============================================================================

/**
 * Calculate progress percentage for a goal
 */
export function calculateGoalProgress(
    currentAmount: number,
    targetAmount: number | null
): number {
    if (!targetAmount || targetAmount <= 0) return 0;
    const progress = (currentAmount / targetAmount) * 100;
    return Math.min(progress, 100); // Cap at 100%
}

/**
 * Calculate how much to save monthly to reach a goal by target date
 */
export function calculateMonthlySavingsNeeded(
    currentAmount: number,
    targetAmount: number,
    targetDate: string | null
): number | null {
    if (!targetDate || !targetAmount) return null;

    const remaining = targetAmount - currentAmount;
    if (remaining <= 0) return 0;

    const today = new Date();
    const target = new Date(targetDate);
    const monthsRemaining = (target.getFullYear() - today.getFullYear()) * 12 +
        (target.getMonth() - today.getMonth());

    if (monthsRemaining <= 0) return remaining; // Need to save it all now

    return remaining / monthsRemaining;
}

/**
 * Distribute savings among goals based on priority
 * Higher priority goals get funded first
 */
export function distributeSavingsToGoals(
    availableSavings: number,
    goals: Array<{
        id: string;
        priority: number;
        target_amount: number | null;
        current_amount: number;
    }>
): Map<string, number> {
    const distribution = new Map<string, number>();

    // Sort by priority (higher first)
    const sortedGoals = [...goals].sort((a, b) => b.priority - a.priority);

    let remaining = availableSavings;

    for (const goal of sortedGoals) {
        if (remaining <= 0) break;

        // Calculate how much this goal needs
        const needed = goal.target_amount
            ? Math.max(0, goal.target_amount - goal.current_amount)
            : remaining; // No limit = can take all remaining

        // Allocate what we can
        const allocation = Math.min(remaining, needed);
        distribution.set(goal.id, allocation);
        remaining -= allocation;
    }

    return distribution;
}
