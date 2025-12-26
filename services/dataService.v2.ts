/**
 * FinanSheet v2 Service Layer
 * 
 * Data access layer for v2 database entities.
 * Provides CRUD operations and business logic for commitments, terms, and payments.
 */

import { supabase } from './supabaseClient';
import { periodToDate } from '../types.v2';
import type {
    Commitment,
    Term,
    Payment,
    Category,
    Profile,
    CommitmentWithTerm,
    PaymentWithDetails,
    Period,
    CommitmentFormData,
    TermFormData,
    PaymentFormData,
} from '../types.v2';

// ============================================================================
// PROFILE SERVICE
// ============================================================================

export const ProfileService = {
    /**
     * Get current user's profile
     */
    async getProfile(userId: string): Promise<Profile | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }

        return data;
    },

    /**
     * Create or update user profile
     */
    async upsertProfile(userId: string, profile: Partial<Profile>): Promise<Profile | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('profiles')
            .upsert({
                user_id: userId,
                ...profile,
            })
            .select()
            .single();

        if (error) {
            console.error('Error upserting profile:', error);
            throw error;
        }

        return data;
    },
};

// ============================================================================
// CATEGORY SERVICE
// ============================================================================

export const CategoryService = {
    /**
     * Get all categories for user (including global)
     */
    async getCategories(userId: string): Promise<Category[]> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('categories_v2')
            .select('*')
            .or(`user_id.eq.${userId},is_global.eq.true`)
            .order('name');

        if (error) {
            console.error('Error fetching categories:', error);
            return [];
        }

        return data || [];
    },

    /**
     * Create a new category
     */
    async createCategory(name: string, userId: string): Promise<Category | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('categories_v2')
            .insert({
                name,
                user_id: userId,
                is_global: false,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating category:', error);
            throw error;
        }

        return data;
    },
};

// ============================================================================
// COMMITMENT SERVICE
// ============================================================================

export const CommitmentService = {
    /**
     * Get all commitments for user
     */
    async getCommitments(userId: string): Promise<Commitment[]> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('commitments')
            .select('*')
            .eq('user_id', userId)
            .order('name');

        if (error) {
            console.error('Error fetching commitments:', error);
            return [];
        }

        return data || [];
    },

    /**
     * Get commitments with their active terms (optimized: single query + JS filtering)
     */
    async getCommitmentsWithTerms(userId: string, periodDate?: string): Promise<CommitmentWithTerm[]> {
        if (!supabase) throw new Error('Supabase not configured');

        const targetDate = periodDate || new Date().toISOString().split('T')[0];

        // Fetch all commitments with ALL their terms in ONE query
        const { data: commitments, error: commitmentsError } = await supabase
            .from('commitments')
            .select(`
                *,
                category:categories_v2(*),
                terms(*)
            `)
            .eq('user_id', userId);

        if (commitmentsError) {
            console.error('Error fetching commitments:', commitmentsError);
            return [];
        }

        // Process each commitment to find its active term (filter in JavaScript)
        const result: CommitmentWithTerm[] = (commitments || []).map((commitment: any) => {
            const terms = commitment.terms || [];

            // First: try to find active term for targetDate
            // active term: effective_from <= targetDate AND (effective_until is null OR >= targetDate)
            let activeTerm = terms
                .filter((t: any) =>
                    t.effective_from <= targetDate &&
                    (t.effective_until === null || t.effective_until >= targetDate)
                )
                .sort((a: any, b: any) => b.version - a.version)[0] || null;

            // Fallback: if no active term for today, prefer:
            // 1. Future terms (e.g., reactivated commitment starting tomorrow) - order by version desc
            // 2. If no future terms, use the most recent term (by version)
            if (!activeTerm && terms.length > 0) {
                // Try future terms first (effective_from > today, no effective_until or future effective_until)
                const futureTerm = terms
                    .filter((t: any) =>
                        t.effective_from > targetDate &&
                        (t.effective_until === null || t.effective_until > targetDate)
                    )
                    .sort((a: any, b: any) => b.version - a.version)[0];

                if (futureTerm) {
                    activeTerm = futureTerm;
                } else {
                    // Fall back to most recent term by version
                    activeTerm = terms.sort((a: any, b: any) => b.version - a.version)[0];
                }
            }

            return {
                ...commitment,
                active_term: activeTerm,
                all_terms: terms,  // Include all terms for grid multi-term display
                category: commitment.category,
                terms: undefined, // Remove raw nested terms from Supabase
            };
        });

        return result;
    },

    /**
     * Get single commitment by ID
     */
    async getCommitment(id: string): Promise<Commitment | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('commitments')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching commitment:', error);
            return null;
        }

        return data;
    },

    /**
     * Create a new commitment
     */
    async createCommitment(
        userId: string,
        commitmentData: CommitmentFormData
    ): Promise<Commitment | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('commitments')
            .insert({
                user_id: userId,
                ...commitmentData,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating commitment:', error);
            throw error;
        }

        return data;
    },

    /**
     * Update a commitment
     */
    async updateCommitment(
        id: string,
        updates: Partial<CommitmentFormData>
    ): Promise<Commitment | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('commitments')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating commitment:', error);
            throw error;
        }

        return data;
    },

    /**
     * Delete a commitment
     */
    async deleteCommitment(id: string): Promise<boolean> {
        if (!supabase) throw new Error('Supabase not configured');

        // Delete associated payments first
        const { error: paymentsError } = await supabase
            .from('payments')
            .delete()
            .eq('commitment_id', id);

        if (paymentsError) {
            console.error('Error deleting associated payments:', paymentsError);
            // Continue anyway - might not have payments
        }

        // Delete associated terms
        const { error: termsError } = await supabase
            .from('terms')
            .delete()
            .eq('commitment_id', id);

        if (termsError) {
            console.error('Error deleting associated terms:', termsError);
            // Continue anyway - might not have terms
        }

        // Finally delete the commitment
        const { error } = await supabase
            .from('commitments')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting commitment:', error);
            return false;
        }

        return true;
    },
};

// ============================================================================
// TERM SERVICE
// ============================================================================

export const TermService = {
    /**
     * Get all terms for a commitment
     */
    async getTerms(commitmentId: string): Promise<Term[]> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('terms')
            .select('*')
            .eq('commitment_id', commitmentId)
            .order('version', { ascending: false });

        if (error) {
            console.error('Error fetching terms:', error);
            return [];
        }

        return data || [];
    },

    /**
     * Get active term for a commitment at a specific date
     */
    async getActiveTerm(commitmentId: string, date: string): Promise<Term | null> {
        if (!supabase) throw new Error('Supabase not configured');

        // Query terms and filter in code to avoid complex or() issues with Supabase
        const { data, error } = await supabase
            .from('terms')
            .select('*')
            .eq('commitment_id', commitmentId)
            .lte('effective_from', date)
            .order('version', { ascending: false });

        if (error || !data || data.length === 0) {
            return null;
        }

        // Filter for active term (effective_until is null OR >= date)
        const activeTerm = data.find(t =>
            t.effective_until === null || t.effective_until >= date
        );

        return activeTerm || null;
    },

    /**
     * Create a new term (version)
     */
    async createTerm(commitmentId: string, termData: TermFormData): Promise<Term | null> {
        if (!supabase) throw new Error('Supabase not configured');

        // Get next version number
        const { data: existingTerms } = await supabase
            .from('terms')
            .select('version')
            .eq('commitment_id', commitmentId)
            .order('version', { ascending: false })
            .limit(1);

        const nextVersion = (existingTerms?.[0]?.version || 0) + 1;

        const { data, error } = await supabase
            .from('terms')
            .insert({
                commitment_id: commitmentId,
                version: nextVersion,
                ...termData,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating term:', error);
            throw error;
        }

        return data;
    },

    /**
     * Update a term
     */
    async updateTerm(id: string, updates: Partial<TermFormData>): Promise<Term | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('terms')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating term:', error);
            throw error;
        }

        return data;
    },

    /**
     * Check if there are payments in a date range for a commitment
     * Used for autodetection when changing dates
     */
    async checkPaymentsInRange(commitmentId: string, startDate: string, endDate: string): Promise<boolean> {
        if (!supabase) throw new Error('Supabase not configured');

        const { count, error } = await supabase
            .from('payments')
            .select('*', { count: 'exact', head: true })
            .eq('commitment_id', commitmentId)
            .gte('period_date', startDate)
            .lte('period_date', endDate);

        if (error) {
            console.error('Error checking payments in range:', error);
            return false;
        }

        return (count || 0) > 0;
    },

    /**
     * Check if there are payments after a specific date for a commitment
     * Used to validate before pausing
     */
    async getPaymentsAfterDate(commitmentId: string, date: string): Promise<Payment[]> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('commitment_id', commitmentId)
            .gt('period_date', date)
            .order('period_date');

        if (error) {
            console.error('Error getting payments after date:', error);
            return [];
        }

        return data || [];
    },

    /**
     * Pause a commitment by setting effective_until on the active term
     * @returns The updated term or null if failed
     */
    async pauseCommitment(commitmentId: string, lastMonth: string): Promise<Term | null> {
        if (!supabase) throw new Error('Supabase not configured');

        // Get all terms to find the active one
        const terms = await this.getTerms(commitmentId);
        const activeTerm = terms.find(t =>
            t.effective_until === null || t.effective_until >= lastMonth
        );

        if (!activeTerm) {
            console.error('No active term found to pause');
            return null;
        }

        // Calculate last day of the month
        const [year, month] = lastMonth.split('-').map(Number);
        const lastDayOfMonth = new Date(year, month, 0).getDate();
        const effectiveUntil = `${lastMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;

        // Update the term
        return await this.updateTerm(activeTerm.id, {
            effective_until: effectiveUntil,
        } as Partial<TermFormData>);
    },

    /**
     * Resume a commitment by creating a new term
     * @returns The new term or null if failed
     */
    async resumeCommitment(
        commitmentId: string,
        termData: TermFormData
    ): Promise<Term | null> {
        if (!supabase) throw new Error('Supabase not configured');

        // Verify the new effective_from is after the last term's effective_until
        const terms = await this.getTerms(commitmentId);
        if (terms.length > 0) {
            const lastTerm = terms[0]; // Already sorted by version DESC
            if (lastTerm.effective_until && termData.effective_from <= lastTerm.effective_until) {
                throw new Error(`La fecha de inicio debe ser posterior a ${lastTerm.effective_until}`);
            }
        }

        // Create new term
        return await this.createTerm(commitmentId, termData);
    },

    /**
     * Check if there are terms in a date range for a commitment
     * Used for autodetection when extending dates backwards
     */
    async checkTermsInRange(commitmentId: string, startDate: string, endDate: string): Promise<boolean> {
        if (!supabase) throw new Error('Supabase not configured');

        // Get all terms and check in JS for complex date logic
        const terms = await this.getTerms(commitmentId);

        return terms.some(t => {
            // A term overlaps if:
            // - its effective_from is within the range, OR
            // - its effective_until (if set) is within the range, OR
            // - the range is entirely within the term's period
            const termStart = t.effective_from;
            const termEnd = t.effective_until || '9999-12-31';

            return (
                (termStart >= startDate && termStart <= endDate) ||
                (termEnd >= startDate && termEnd <= endDate) ||
                (termStart <= startDate && termEnd >= endDate)
            );
        });
    },

    /**
     * Count total payments for a commitment (for delete warning)
     */
    async countPaymentsForCommitment(commitmentId: string): Promise<{ count: number; total: number }> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('payments')
            .select('amount_in_base')
            .eq('commitment_id', commitmentId);

        if (error || !data) {
            return { count: 0, total: 0 };
        }

        const total = data.reduce((sum, p) => sum + (p.amount_in_base || 0), 0);
        return { count: data.length, total };
    },
};

// ============================================================================
// PAYMENT SERVICE
// ============================================================================

export const PaymentService = {
    /**
     * Get all payments for a commitment
     */
    async getPayments(commitmentId: string): Promise<Payment[]> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('commitment_id', commitmentId)
            .order('period_date', { ascending: false });

        if (error) {
            console.error('Error fetching payments:', error);
            return [];
        }

        return data || [];
    },

    /**
     * Get all payments for a user within a date range (optimized for grid loading)
     */
    async getPaymentsByDateRange(userId: string, startDate: string, endDate: string): Promise<Payment[]> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('payments')
            .select(`
                *,
                commitment:commitments!inner(user_id)
            `)
            .eq('commitment.user_id', userId)
            .gte('period_date', startDate)
            .lt('period_date', endDate)
            .order('period_date');

        if (error) {
            console.error('Error fetching payments by date range:', error);
            return [];
        }

        return data || [];
    },

    /**
     * Get payments for a specific period
     */
    async getPaymentsByPeriod(userId: string, period: Period): Promise<PaymentWithDetails[]> {
        if (!supabase) throw new Error('Supabase not configured');

        const periodDate = periodToDate(period);

        // Calculate next month for end range
        const nextMonthDate = new Date(period.year, period.month, 1); // month is 1-indexed in Period, so period.month gives us next month
        const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

        const { data, error } = await supabase
            .from('payments')
            .select(`
        *,
        commitment:commitments(*,category:categories_v2(*)),
        term:terms(*)
      `)
            .eq('commitment.user_id', userId)
            .gte('period_date', periodDate)
            .lt('period_date', nextMonthStr)
            .order('period_date');

        if (error) {
            console.error('Error fetching payments by period:', error);
            return [];
        }

        return (data || []).map((p: any) => ({
            ...p,
            commitment: p.commitment,
            term: p.term,
            category: p.commitment?.category,
        }));
    },

    /**
     * Get payment for specific commitment and period
     */
    async getPayment(commitmentId: string, periodDate: string): Promise<Payment | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('commitment_id', commitmentId)
            .eq('period_date', periodDate)
            .single();

        if (error) {
            return null; // Not found is OK
        }

        return data;
    },

    /**
     * Record a payment
     */
    async recordPayment(
        commitmentId: string,
        termId: string,
        paymentData: PaymentFormData
    ): Promise<Payment | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('payments')
            .insert({
                commitment_id: commitmentId,
                term_id: termId,
                ...paymentData,
            })
            .select()
            .single();

        if (error) {
            console.error('Error recording payment:', error);
            throw error;
        }

        return data;
    },

    /**
     * Update a payment
     */
    async updatePayment(id: string, updates: Partial<PaymentFormData>): Promise<Payment | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('payments')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating payment:', error);
            throw error;
        }

        return data;
    },

    /**
     * Delete a payment
     */
    async deletePayment(id: string): Promise<boolean> {
        if (!supabase) throw new Error('Supabase not configured');

        const { error } = await supabase
            .from('payments')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting payment:', error);
            return false;
        }

        return true;
    },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get current user's ID from Supabase auth
 */
export async function getCurrentUserId(): Promise<string | null> {
    if (!supabase) return null;

    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
}

/**
 * Calculate expected amount for a period based on term
 */
export function calculateExpectedAmount(term: Term): number {
    // If amount_in_base is calculated, use it
    if (term.amount_in_base !== null) {
        return term.amount_in_base;
    }

    // Otherwise calculate from original amount and FX rate
    return term.amount_original * term.fx_rate_to_base;
}
