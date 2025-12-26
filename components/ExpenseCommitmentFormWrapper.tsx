/**
 * ExpenseCommitmentFormWrapper
 * 
 * Smart wrapper that renders either:
 * - ExpenseForm (v1) when v2 is disabled
 * - CommitmentForm.v2 when v2 is enabled
 * 
 * Handles data conversion between v1 and v2 formats
 */

import React from 'react';
import { useFeature } from '../context/FeatureFlagsContext';
import ExpenseForm from './ExpenseForm';
import { CommitmentFormV2 } from './CommitmentForm.v2';
import { CategoryService, CommitmentService, TermService, getCurrentUserId } from '../services/dataService.v2';
import type { Category, CommitmentFormData, TermFormData, CommitmentWithTerm } from '../types.v2';
import type { Expense } from '../types';

interface ExpenseCommitmentFormWrapperProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (expense: Omit<Expense, 'id' | 'createdAt'> & { id?: string }) => void;
    expenseToEdit: Expense | null;
    commitmentToEdit?: CommitmentWithTerm | null; // v2 commitment to edit
    categories: string[]; // v1 categories (string array)
    expenses: Expense[]; // v1 expenses
    onRefresh?: () => void; // Callback to refresh data after v2 save
}

export const ExpenseCommitmentFormWrapper: React.FC<ExpenseCommitmentFormWrapperProps> = (props) => {
    const useV2 = useFeature('useV2Commitments');
    const [v2Categories, setV2Categories] = React.useState<Category[]>([]);
    const [loading, setLoading] = React.useState(false);

    // Load v2 categories when v2 is enabled
    React.useEffect(() => {
        if (useV2) {
            loadV2Categories();
        }
    }, [useV2]);

    const loadV2Categories = async () => {
        try {
            const userId = await getCurrentUserId();
            if (!userId) return;

            const cats = await CategoryService.getCategories(userId);
            setV2Categories(cats);
        } catch (error) {
            console.error('Error loading v2 categories:', error);
        }
    };

    const handleV2Save = async (commitment: CommitmentFormData, term: TermFormData) => {
        setLoading(true);
        try {
            const userId = await getCurrentUserId();
            if (!userId) {
                throw new Error('User not authenticated');
            }

            if (props.commitmentToEdit) {
                // Update existing commitment
                await CommitmentService.updateCommitment(props.commitmentToEdit.id, commitment);

                // Determine the action based on term state
                const activeTerm = props.commitmentToEdit.active_term;
                const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
                const originalEffectiveUntil = activeTerm?.effective_until;

                // Term was ENDED = had an effective_until in the past
                const wasTermEnded = originalEffectiveUntil && originalEffectiveUntil < today;

                // New term starts today or future, AND has no end date (or future end date)
                const isCreatingNewActiveTerm =
                    term.effective_from >= today &&
                    (!term.effective_until || term.effective_until >= today);

                // REACTIVATION = term was ended AND we're creating a new active term
                const isReactivation = wasTermEnded && isCreatingNewActiveTerm;

                console.log('Action check:', {
                    originalEffectiveUntil,
                    newEffectiveFrom: term.effective_from,
                    newEffectiveUntil: term.effective_until,
                    today,
                    wasTermEnded,
                    isCreatingNewActiveTerm,
                    isReactivation
                });

                if (isReactivation) {
                    // Create a NEW term for the reactivated commitment
                    console.log('Creating NEW term for reactivation');
                    await TermService.createTerm(props.commitmentToEdit.id, term);
                } else if (activeTerm) {
                    // Normal update of existing term (includes pausing)
                    console.log('Updating existing term');
                    await TermService.updateTerm(activeTerm.id, term);
                }
            } else {
                // Create new commitment
                const newCommitment = await CommitmentService.createCommitment(userId, commitment);
                if (!newCommitment) {
                    throw new Error('Failed to create commitment');
                }
                // Create initial term
                await TermService.createTerm(newCommitment.id, term);
            }

            // Notify parent to refresh data
            if (props.onRefresh) {
                props.onRefresh();
            }

            props.onClose();
        } catch (error) {
            console.error('Error saving v2 commitment:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    // Use v2 when flag is enabled
    if (useV2) {
        return (
            <CommitmentFormV2
                isOpen={props.isOpen}
                onClose={props.onClose}
                onSave={handleV2Save}
                categories={v2Categories}
                commitmentToEdit={props.commitmentToEdit ?? null}
            />
        );
    }

    // Fall back to v1 form
    return (
        <ExpenseForm
            isOpen={props.isOpen}
            onClose={props.onClose}
            onSave={props.onSave}
            expenseToEdit={props.expenseToEdit}
            categories={props.categories}
            expenses={props.expenses}
        />
    );
};
