import { Expense } from '../types';
import { ExpenseVersioningService } from '../services/dataService';

/**
 * Utility functions for handling expense versioning
 * Allows creating new versions of recurring expenses without losing historical data
 * Updated to use the new ExpenseVersioningService
 */

/**
 * Extract the base ID from an expense (original expense ID)
 * @param expense - The expense object
 * @returns The base ID (parentId if it exists, otherwise the expense's own ID)
 */
export function getBaseExpenseId(expenseId: string): string {
    // For backward compatibility, we'll need the full expense object
    // This function is kept for compatibility but should be used with caution
    return expenseId;
}

/**
 * Extract the base ID from an expense object
 * @param expense - The expense object
 * @returns The base ID (parentId if it exists, otherwise the expense's own ID)
 */
export function getBaseExpenseIdFromObject(expense: Expense): string {
    return expense.parentId || expense.id;
}

/**
 * Check if an expense is a versioned expense
 * @param expense - The expense object to check
 * @returns True if it's a versioned expense (has parentId)
 */
export function isVersionedExpense(expense: Expense): boolean {
    return !!expense.parentId;
}

/**
 * Check if an expense ID is a versioned ID (legacy function for backward compatibility)
 * @param expenseId - The expense ID to check
 * @returns True if it's a versioned ID
 */
export function isVersionedExpenseId(expenseId: string): boolean {
    // This is kept for backward compatibility
    // In the new system, we need the expense object to determine versioning
    return expenseId.includes('_v');
}

/**
 * Generate a new version ID for an expense
 * @param baseId - The base expense ID
 * @returns A new versioned ID
 */
export function generateVersionId(baseId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `${baseId}_v${timestamp}_${random}`;
}

/**
 * Get all versions of an expense (including the base)
 * @param expenses - Array of all expenses
 * @param baseId - The base expense ID
 * @returns Array of all versions of the expense, sorted by version date
 */
export function getAllExpenseVersions(expenses: Expense[], baseId: string): Expense[] {
    return ExpenseVersioningService.getExpenseVersions(expenses, baseId);
}

/**
 * Get the active version of an expense for a specific date
 * @param expenses - Array of all expenses
 * @param baseId - The base expense ID
 * @param targetYear - Target year
 * @param targetMonth - Target month (0-based)
 * @returns The expense version that should be active for that date, or null if none
 */
export function getActiveExpenseVersion(
    expenses: Expense[], 
    baseId: string, 
    targetYear: number, 
    targetMonth: number
): Expense | null {
    const targetDate = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
    return ExpenseVersioningService.getActiveVersionForDate(expenses, baseId, targetDate);
}

/**
 * Create a new version of a recurring expense
 * @param originalExpense - The original expense to version
 * @param newData - The new data for the version
 * @param effectiveFromYear - Year when the new version becomes effective
 * @param effectiveFromMonth - Month when the new version becomes effective (0-based)
 * @returns The new versioned expense
 */
export function createExpenseVersion(
    originalExpense: Expense,
    newData: Partial<Expense>,
    effectiveFromYear: number,
    effectiveFromMonth: number
): Expense {
    const effectiveDate = `${effectiveFromYear}-${String(effectiveFromMonth + 1).padStart(2, '0')}-01`;
    return ExpenseVersioningService.createExpenseVersion(originalExpense, newData, effectiveDate);
}

/**
 * Check if an expense has multiple versions
 * @param expenses - Array of all expenses
 * @param expenseId - The expense ID to check
 * @returns True if the expense has multiple versions
 */
export function hasMultipleVersions(expenses: Expense[], expenseId: string): boolean {
    const versions = ExpenseVersioningService.getExpenseVersions(expenses, expenseId);
    return versions.length > 1;
}
