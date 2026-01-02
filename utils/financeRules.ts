import { Goal } from '../types.v2';

/**
 * Result of the 50/30/20 calculation
 */
export interface BudgetAllocation {
    needs: number;   // 50%
    wants: number;   // 30%
    savings: number; // 20%
}

/**
 * Calculates the recommended budget split based on the 50/30/20 rule.
 * @param income - The total income amount
 * @returns BudgetAllocation object with calculated amounts
 */
export const calculate50_30_20 = (income: number): BudgetAllocation => {
    return {
        needs: income * 0.50,
        wants: income * 0.30,
        savings: income * 0.20
    };
};

/**
 * Suggests how to distribute the savings amount across active goals.
 * Current logic: Equal split among all non-archived goals.
 * Future logic: Weighted by priority or deadline.
 * 
 * @param savingsAmount - The total amount available for savings (e.g., the 20%)
 * @param goals - List of user's goals
 * @returns Map of goal_id -> amount to allocate
 */
export const suggestGoalAllocations = (savingsAmount: number, goals: Goal[]): Record<string, number> => {
    const activeGoals = goals.filter(g => !g.is_archived);

    if (activeGoals.length === 0) {
        return {};
    }

    const amountPerGoal = savingsAmount / activeGoals.length;
    // Round down to 2 decimals to avoid floating point issues, rest can be added to first goal manually if needed
    // For simplicity here, we just use the raw division, but in a real app dealing with money, 
    // we might want to use a currency library or integer math.

    const allocations: Record<string, number> = {};
    activeGoals.forEach(goal => {
        allocations[goal.id] = amountPerGoal;
    });

    return allocations;
};
