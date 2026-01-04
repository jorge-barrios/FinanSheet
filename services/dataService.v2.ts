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
    Goal,
    CommitmentWithTerm,
    PaymentWithDetails,
    Period,
    CommitmentFormData,
    TermFormData,
    PaymentFormData,
    PaymentAdjustment,
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
    async getCommitmentsWithTerms(userId: string): Promise<CommitmentWithTerm[]> {
        if (!supabase) throw new Error('Supabase not configured');

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

        // Process each commitment to find its active term
        // FIX: Use highest version term as active (most recent), not date-based filtering
        // This prevents showing old closed terms when a newer term exists
        const result: CommitmentWithTerm[] = (commitments || []).map((commitment: any) => {
            const terms = commitment.terms || [];

            // Simply use the term with the highest version (most recent)
            const activeTerm = terms.length > 0
                ? terms.sort((a: any, b: any) => b.version - a.version)[0]
                : null;

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
     * Get a single term by ID
     */
    async getTerm(termId: string): Promise<Term | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('terms')
            .select('*')
            .eq('id', termId)
            .single();

        if (error) {
            console.error('Error fetching term:', error);
            return null;
        }

        return data;
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

        console.log('[TermService.updateTerm] Updating term:', id, 'with:', updates);

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

        console.log('[TermService.updateTerm] Result:', data);
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

        console.log('[pauseCommitment] Starting pause for commitment:', commitmentId, 'lastMonth:', lastMonth);

        // Get all terms to find the active one
        const terms = await this.getTerms(commitmentId);
        console.log('[pauseCommitment] Found terms:', terms.length, terms.map(t => ({ id: t.id, effective_until: t.effective_until })));

        const activeTerm = terms.find(t =>
            t.effective_until === null || t.effective_until >= lastMonth
        );

        if (!activeTerm) {
            console.error('[pauseCommitment] No active term found to pause');
            return null;
        }

        console.log('[pauseCommitment] Active term found:', activeTerm.id);

        // Calculate last day of the month
        const [year, month] = lastMonth.split('-').map(Number);
        const lastDayOfMonth = new Date(year, month, 0).getDate();
        const effectiveUntil = `${lastMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;

        console.log('[pauseCommitment] Setting effective_until to:', effectiveUntil);

        // Update the term
        const result = await this.updateTerm(activeTerm.id, {
            effective_until: effectiveUntil,
        } as Partial<TermFormData>);

        console.log('[pauseCommitment] Update result:', result);
        return result;
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
     * Check if a term has any payments
     */
    async hasPaymentsForTerm(termId: string): Promise<boolean> {
        if (!supabase) throw new Error('Supabase not configured');

        const { count, error } = await supabase
            .from('payments')
            .select('*', { count: 'exact', head: true })
            .eq('term_id', termId);

        if (error) {
            console.error('Error checking payments for term:', error);
            return false;
        }

        return (count ?? 0) > 0;
    },

    /**
     * Check if a commitment has any payments (across all terms)
     */
    async hasPaymentsForCommitment(commitmentId: string): Promise<boolean> {
        if (!supabase) throw new Error('Supabase not configured');

        const { count, error } = await supabase
            .from('payments')
            .select('*', { count: 'exact', head: true })
            .eq('commitment_id', commitmentId);

        if (error) {
            console.error('Error checking payments for commitment:', error);
            return false;
        }

        return (count ?? 0) > 0;
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
            .maybeSingle();

        if (error) {
            console.error('Error fetching payment:', error);
            return null;
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

    /**
     * Get all payments for a term
     */
    async getPaymentsForTerm(termId: string): Promise<Payment[]> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('term_id', termId)
            .order('period_date');

        if (error) {
            console.error('Error fetching payments for term:', error);
            return [];
        }

        return data || [];
    },

    /**
     * Reassign payments from old term to new term with shifted period dates
     * Used when user changes effective_from date on a commitment
     * Records audit trail in payment_adjustments table
     *
     * @param paymentsToReassign - Array of payments to reassign (pass all commitment payments)
     * @param newTermId - The new term's ID
     * @param oldEffectiveFrom - Original term's effective_from (YYYY-MM-DD)
     * @param newEffectiveFrom - New term's effective_from (YYYY-MM-DD)
     * @param userId - Optional user ID for audit trail
     * @returns Number of payments reassigned
     */
    async reassignPaymentsToNewTerm(
        paymentsToReassign: Payment[],
        newTermId: string,
        oldEffectiveFrom: string,
        newEffectiveFrom: string,
        userId?: string
    ): Promise<number> {
        if (!supabase) throw new Error('Supabase not configured');

        // Use provided payments array directly (all commitment payments, not just from one term)
        const payments = paymentsToReassign;
        if (payments.length === 0) return 0;

        // Calculate the shift in months
        const [oldYear, oldMonth] = oldEffectiveFrom.split('-').map(Number);
        const [newYear, newMonth] = newEffectiveFrom.split('-').map(Number);
        const monthShift = (newYear - oldYear) * 12 + (newMonth - oldMonth);

        console.log('[PaymentService.reassignPaymentsToNewTerm]', {
            newTermId,
            oldEffectiveFrom,
            newEffectiveFrom,
            monthShift,
            paymentsToReassign: payments.length,
            paymentTerms: [...new Set(payments.map(p => p.term_id))] // Unique term IDs
        });

        // Sort payments by period_date to avoid unique constraint violations
        // When shifting forward (+monthShift), process from latest to earliest
        // When shifting backward (-monthShift), process from earliest to latest
        const sortedPayments = [...payments].sort((a, b) => {
            const dateA = new Date(a.period_date).getTime();
            const dateB = new Date(b.period_date).getTime();
            return monthShift > 0 ? dateB - dateA : dateA - dateB;
        });

        console.log('Processing payments in order:', sortedPayments.map(p => p.period_date));

        // Update each payment with new term_id and shifted period_date
        let reassignedCount = 0;
        for (const payment of sortedPayments) {
            // Parse old period_date and shift it
            const [pYear, pMonth, pDay] = payment.period_date.split('-').map(Number);
            const newPeriodDate = new Date(pYear, pMonth - 1 + monthShift, pDay);
            const newPeriodDateStr = `${newPeriodDate.getFullYear()}-${String(newPeriodDate.getMonth() + 1).padStart(2, '0')}-${String(newPeriodDate.getDate()).padStart(2, '0')}`;

            // Record audit trail BEFORE updating the payment
            // Use the payment's actual current term_id as original_term_id
            const { error: auditError } = await supabase
                .from('payment_adjustments')
                .insert({
                    payment_id: payment.id,
                    original_period_date: payment.period_date,
                    new_period_date: newPeriodDateStr,
                    original_term_id: payment.term_id, // Use the payment's actual term
                    new_term_id: newTermId,
                    reason: 'term_effective_from_change',
                    adjusted_by: userId || null
                });

            if (auditError) {
                console.warn('Failed to record payment adjustment audit:', payment.id, auditError);
                // Continue anyway - audit failure shouldn't block the operation
            }

            // Update the payment
            const { error } = await supabase
                .from('payments')
                .update({
                    term_id: newTermId,
                    period_date: newPeriodDateStr
                })
                .eq('id', payment.id);

            if (error) {
                console.error('Error reassigning payment:', payment.id, error);
            } else {
                reassignedCount++;
                console.log(`  Reassigned payment ${payment.id}: ${payment.period_date} -> ${newPeriodDateStr}`);
            }
        }

        return reassignedCount;
    },

    /**
     * Get adjustment history for a payment
     */
    async getPaymentAdjustments(paymentId: string): Promise<PaymentAdjustment[]> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('payment_adjustments')
            .select('*')
            .eq('payment_id', paymentId)
            .order('adjusted_at', { ascending: false });

        if (error) {
            console.error('Error fetching payment adjustments:', error);
            return [];
        }

        return data || [];
    },
};

// ============================================================================
// GOAL SERVICE
// ============================================================================

/**
 * Form data for creating/editing a goal
 */
export interface GoalFormData {
    name: string;
    target_amount: number | null;
    current_amount?: number;
    target_date: string | null;
    priority: number;
    icon: string | null;
    color: string | null;
}

export const GoalService = {
    /**
     * Get all goals for a user
     */
    async getGoals(userId: string, includeArchived: boolean = false): Promise<Goal[]> {
        if (!supabase) throw new Error('Supabase not configured');

        let query = supabase
            .from('goals')
            .select('*')
            .eq('user_id', userId)
            .order('priority', { ascending: false });

        if (!includeArchived) {
            query = query.eq('is_archived', false);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching goals:', error);
            return [];
        }

        return data || [];
    },

    /**
     * Get a single goal by ID
     */
    async getGoal(id: string): Promise<Goal | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('goals')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching goal:', error);
            return null;
        }

        return data;
    },

    /**
     * Create a new goal
     */
    async createGoal(userId: string, goalData: GoalFormData): Promise<Goal | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('goals')
            .insert({
                user_id: userId,
                ...goalData,
                current_amount: goalData.current_amount ?? 0,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating goal:', error);
            throw error;
        }

        return data;
    },

    /**
     * Update a goal
     */
    async updateGoal(id: string, updates: Partial<GoalFormData>): Promise<Goal | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('goals')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating goal:', error);
            throw error;
        }

        return data;
    },

    /**
     * Add funds to a goal
     */
    async addFunds(id: string, amount: number): Promise<Goal | null> {
        if (!supabase) throw new Error('Supabase not configured');

        // First get current amount
        const goal = await this.getGoal(id);
        if (!goal) throw new Error('Goal not found');

        const newAmount = goal.current_amount + amount;

        return this.updateGoal(id, { current_amount: newAmount } as Partial<GoalFormData>);
    },

    /**
     * Withdraw funds from a goal
     */
    async withdrawFunds(id: string, amount: number): Promise<Goal | null> {
        if (!supabase) throw new Error('Supabase not configured');

        const goal = await this.getGoal(id);
        if (!goal) throw new Error('Goal not found');

        const newAmount = Math.max(0, goal.current_amount - amount);

        return this.updateGoal(id, { current_amount: newAmount } as Partial<GoalFormData>);
    },

    /**
     * Archive a goal
     */
    async archiveGoal(id: string): Promise<boolean> {
        if (!supabase) throw new Error('Supabase not configured');

        const { error } = await supabase
            .from('goals')
            .update({ is_archived: true })
            .eq('id', id);

        if (error) {
            console.error('Error archiving goal:', error);
            return false;
        }

        return true;
    },

    /**
     * Unarchive a goal
     */
    async unarchiveGoal(id: string): Promise<boolean> {
        if (!supabase) throw new Error('Supabase not configured');

        const { error } = await supabase
            .from('goals')
            .update({ is_archived: false })
            .eq('id', id);

        if (error) {
            console.error('Error unarchiving goal:', error);
            return false;
        }

        return true;
    },

    /**
     * Delete a goal
     */
    async deleteGoal(id: string): Promise<boolean> {
        if (!supabase) throw new Error('Supabase not configured');

        const { error } = await supabase
            .from('goals')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting goal:', error);
            return false;
        }

        return true;
    },

    /**
     * Get total savings across all active goals
     */
    async getTotalSavings(userId: string): Promise<number> {
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase
            .from('goals')
            .select('current_amount')
            .eq('user_id', userId)
            .eq('is_archived', false);

        if (error) {
            console.error('Error fetching total savings:', error);
            return 0;
        }

        return (data || []).reduce((sum, g) => sum + (g.current_amount || 0), 0);
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
