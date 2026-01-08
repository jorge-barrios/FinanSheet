/**
 * termUtils.ts
 *
 * Utility functions for working with Terms in the V2 data model.
 * These functions help determine which term is active for a given period.
 */

import type { CommitmentWithTerm, Term } from '../types.v2';

/**
 * Find the term that covers a specific period (month).
 *
 * This is critical for correctly associating payments with terms.
 * A payment should always be associated with the term that was active
 * during that period, NOT necessarily the current active_term.
 *
 * Example:
 * - Commitment has V1 (Jan-Jun closed) and V2 (Jul-∞ active)
 * - User wants to pay for April (historical)
 * - This function returns V1, not V2
 *
 * @param commitment - The commitment with all its terms
 * @param monthDate - The target month as a Date object
 * @returns The term that covers that period, or null if none
 */
export function findTermForPeriod(commitment: CommitmentWithTerm, monthDate: Date): Term | null {
    const all_terms = commitment.all_terms || [];
    if (all_terms.length === 0) return commitment.active_term; // Fallback

    // Extract year-month from target period (ignore day)
    const periodYearMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

    // Sort by version DESC to prefer most recent term when multiple match
    const term = all_terms
        .slice() // Don't mutate original
        .sort((a, b) => b.version - a.version) // Most recent first
        .find(t => {
            const termStartYearMonth = t.effective_from.substring(0, 7); // "2025-12"
            const termEndYearMonth = t.effective_until?.substring(0, 7) || null; // "2026-06" or null

            const startMatches = termStartYearMonth <= periodYearMonth;
            const endMatches = termEndYearMonth === null || termEndYearMonth >= periodYearMonth;

            return startMatches && endMatches;
        });

    return term || null;
}

/**
 * Find term for period using string date format.
 *
 * @param commitment - The commitment with all its terms
 * @param periodDate - The period date as "YYYY-MM-DD" string (first day of month)
 * @returns The term that covers that period, or null if none
 */
export function findTermForPeriodString(commitment: CommitmentWithTerm, periodDate: string): Term | null {
    // Extract year and month from the period date string
    const [year, month] = periodDate.split('-').map(Number);
    // Create a Date object for the first day of that month
    const monthDate = new Date(year, month - 1, 1);
    return findTermForPeriod(commitment, monthDate);
}

/**
 * Check if a commitment has an active term for a specific period.
 *
 * Use this to determine if payments can be made for a given month.
 * If false, the month is "paused" and payments should be blocked.
 *
 * @param commitment - The commitment with all its terms
 * @param monthDate - The target month as a Date object
 * @returns true if there's an active term for that period
 */
export function hasActiveTermForPeriod(commitment: CommitmentWithTerm, monthDate: Date): boolean {
    return findTermForPeriod(commitment, monthDate) !== null;
}

/**
 * Check if a commitment has an active term for a specific period (string version).
 *
 * @param commitment - The commitment with all its terms
 * @param periodDate - The period date as "YYYY-MM-DD" string
 * @returns true if there's an active term for that period
 */
export function hasActiveTermForPeriodString(commitment: CommitmentWithTerm, periodDate: string): boolean {
    return findTermForPeriodString(commitment, periodDate) !== null;
}
