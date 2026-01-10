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
import { useLocalization } from '../hooks/useLocalization';
import { useCommitments } from '../context/CommitmentsContext';
import { useToast } from '../context/ToastContext';
import ExpenseForm from './ExpenseForm';
import { CommitmentFormV2 } from './CommitmentForm.v2';
import { CommitmentService, TermService, PaymentService, getCurrentUserId } from '../services/dataService.v2';
import { getUserCategories } from '../services/categoryService.v2';
import type { Category } from '../services/categoryService.v2';
import type { CommitmentFormData, TermFormData, CommitmentWithTerm } from '../types.v2';
import type { Expense } from '../types';

/**
 * Options passed from CommitmentForm.v2 to control save behavior
 */
interface SaveOptions {
    skipTermProcessing?: boolean; // When true, wrapper should only update commitment metadata
    currentActiveTermId?: string; // The actual current active term ID (may differ from props)
}

interface ExpenseCommitmentFormWrapperProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (expense: Omit<Expense, 'id' | 'createdAt'> & { id?: string }) => void;
    expenseToEdit: Expense | null;
    commitmentToEdit?: CommitmentWithTerm | null; // v2 commitment to edit
    categories: string[] | Category[]; // v1 categories (string array) or v2 Category[]
    expenses: Expense[]; // v1 expenses
    onRefresh?: () => void; // Callback to refresh data after v2 save
    openWithPauseForm?: boolean; // When true, opens with pause form expanded in TermsListView
    openWithResumeForm?: boolean; // When true, opens with resume (new term) form expanded in TermsListView
    onPaymentClick?: (commitment: CommitmentWithTerm, periodDate: string) => void;
}

export const ExpenseCommitmentFormWrapper: React.FC<ExpenseCommitmentFormWrapperProps> = (props) => {
    const useV2 = useFeature('useV2Commitments');
    const { t, language } = useLocalization(); // Need t and language for category translation
    const { commitments: existingCommitments } = useCommitments(); // Get existing commitments for linking
    const { showToast } = useToast();
    const [v2Categories, setV2Categories] = React.useState<Category[]>([]);

    // Load v2 categories when v2 is enabled OR when form opens
    React.useEffect(() => {
        if (useV2 && props.isOpen) {
            loadV2Categories();
        }
    }, [useV2, props.isOpen]);

    const loadV2Categories = async () => {
        try {
            const userId = await getCurrentUserId();
            if (!userId) return;

            const cats = await getUserCategories(userId, t, language);
            setV2Categories(cats);
        } catch (error) {
            console.error('Error loading v2 categories:', error);
        }
    };

    // Handle bidirectional linking updates
    const handleBidirectionalLinking = async (
        commitmentId: string,
        linkingInfo: { newLinkedId: string | null; previousLinkedFromId: string | null; isUnlinking: boolean }
    ) => {
        const { newLinkedId, previousLinkedFromId, isUnlinking } = linkingInfo;

        // Case 1: Unlinking - need to clear the other commitment's link
        if (isUnlinking && previousLinkedFromId) {
            console.log('Unlinking: clearing link from', previousLinkedFromId);
            await CommitmentService.updateCommitment(previousLinkedFromId, {
                linked_commitment_id: null,
                link_role: null,
            });
        }

        // Case 2: Creating a new link - update the other commitment to link back
        if (newLinkedId) {
            console.log('Bidirectional linking: updating', newLinkedId, 'to link to', commitmentId);
            await CommitmentService.updateCommitment(newLinkedId, {
                linked_commitment_id: commitmentId,
                link_role: null, // No longer used
            });

            // If the new linked commitment was previously linked to something else, clear that
            const linkedCommitment = existingCommitments.find(c => c.id === newLinkedId);
            if (linkedCommitment?.linked_commitment_id && linkedCommitment.linked_commitment_id !== commitmentId) {
                console.log('Clearing previous link from', linkedCommitment.linked_commitment_id);
                await CommitmentService.updateCommitment(linkedCommitment.linked_commitment_id, {
                    linked_commitment_id: null,
                    link_role: null,
                });
            }
        }
    };

    const handleV2Save = async (commitment: CommitmentFormData, term: TermFormData, options?: SaveOptions) => {
        try {
            console.log('[handleV2Save] Called with options:', options);

            const userId = await getCurrentUserId();
            if (!userId) {
                throw new Error('User not authenticated');
            }

            if (props.commitmentToEdit) {
                // FAST PATH: If skipTermProcessing is true, terms were already handled by TermsListView
                // Just update commitment metadata and exit
                if (options?.skipTermProcessing) {
                    console.log('[handleV2Save] skipTermProcessing=true - updating commitment metadata only');

                    // Extract linking info for bidirectional updates
                    const linkingInfo = (commitment as any).__linkingInfo;
                    delete (commitment as any).__linkingInfo;

                    await CommitmentService.updateCommitment(props.commitmentToEdit.id, commitment);

                    // Handle bidirectional linking
                    if (linkingInfo) {
                        await handleBidirectionalLinking(props.commitmentToEdit.id, linkingInfo);
                    }

                    if (props.onRefresh) {
                        props.onRefresh();
                    }
                    showToast(t('save.commitmentSuccess', 'Compromiso guardado exitosamente'), 'success');
                    props.onClose();
                    return;
                }

                // Update existing commitment
                const activeTerm = props.commitmentToEdit.active_term;
                const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
                const originalEffectiveUntil = activeTerm?.effective_until;

                // Term was ENDED = had an effective_until in the past
                const wasTermEnded = originalEffectiveUntil && originalEffectiveUntil < today;

                // Extract year-month from dates for comparison (ignore day)
                const todayYearMonth = today.substring(0, 7); // "2026-01"
                const newEffectiveFromYearMonth = term.effective_from.substring(0, 7);

                // New term starts in current month or future, AND has no end date (or future end date)
                // Use year-month comparison to allow starting on day 1 of current month
                const isCreatingNewActiveTerm =
                    newEffectiveFromYearMonth >= todayYearMonth &&
                    (!term.effective_until || term.effective_until >= today);

                // REACTIVATION = term was ended AND we're creating a new active term
                const isReactivation = wasTermEnded && isCreatingNewActiveTerm;

                // Check if commitment has ANY payments (across all terms, not just activeTerm)
                const hasPayments = await PaymentService.hasPaymentsForCommitment(props.commitmentToEdit.id);

                // Get all payments to find which term they belong to
                const allPayments = hasPayments
                    ? await PaymentService.getPayments(props.commitmentToEdit.id)
                    : [];

                // IMPORTANT: Only consider payments from the ACTIVE term
                // Payments in closed terms (from pauses/previous edits) are history - don't touch them
                const activeTermPayments = allPayments.filter(p => p.term_id === activeTerm?.id);

                // DEBUG: Log payment information to diagnose term creation issues
                console.log('[handleV2Save] Payment analysis:', {
                    hasPayments,
                    totalPayments: allPayments.length,
                    activeTermId: activeTerm?.id,
                    activeTermPaymentsCount: activeTermPayments.length,
                    allPaymentTermIds: allPayments.map(p => ({ period: p.period_date, term_id: p.term_id })),
                });

                // Check if effective_from changed relative to the ACTIVE term
                const effectiveFromChanged = activeTerm && activeTerm.effective_from !== term.effective_from;

                // Check for closed terms (terms with effective_until that are NOT the active term)
                // These act as "barriers" - we can't overlap with them
                const allTerms = await TermService.getTerms(props.commitmentToEdit.id);
                const closedTerms = allTerms.filter(t => t.id !== activeTerm?.id && t.effective_until);
                const hasClosedTerms = closedTerms.length > 0;

                // VALIDATION: "Pausa como Barrera" - prevent term overlap
                // If there are closed terms, new effective_from must be > most recent closed term's effective_until
                if (hasClosedTerms && effectiveFromChanged) {
                    // Get the most recent closed term (highest version)
                    const sortedClosedTerms = [...closedTerms].sort((a, b) => b.version - a.version);
                    const mostRecentClosed = sortedClosedTerms[0];

                    if (mostRecentClosed.effective_until && term.effective_from <= mostRecentClosed.effective_until) {
                        // Format the date for error message
                        const [year, month] = mostRecentClosed.effective_until.split('-').map(Number);
                        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                        const formattedDate = `${monthNames[month - 1]} ${year}`;

                        showToast(
                            `La fecha de inicio no puede ser anterior o igual a ${formattedDate}. Existe un término cerrado (pausa) hasta esa fecha.`,
                            'error'
                        );
                        return;
                    }
                }

                // NEW SIMPLIFIED LOGIC: No modal for date changes
                // - Backward (Mar→Ene): Simply extend the existing term's effective_from
                // - Forward (Ene→Mar): Close current term, create new term
                // - Payments NEVER change period - they stay where they are

                console.log('Action check:', {
                    originalEffectiveUntil,
                    newEffectiveFrom: term.effective_from,
                    newEffectiveUntil: term.effective_until,
                    today,
                    todayYearMonth,
                    newEffectiveFromYearMonth,
                    'wasTermEnded (effectiveUntil < today)': wasTermEnded,
                    'isCreatingNewActiveTerm (newYM >= todayYM && no end)': isCreatingNewActiveTerm,
                    '>>> isReactivation': isReactivation,
                    hasPayments,
                    allPaymentsCount: allPayments.length,
                    activeTermPaymentsCount: activeTermPayments.length,
                    effectiveFromChanged,
                    activeTermId: activeTerm?.id,
                    activeTermEffectiveFrom: activeTerm?.effective_from,
                    hasClosedTerms,
                    closedTermsCount: closedTerms.length,
                });

                // Extract linking info for bidirectional updates
                const linkingInfo = (commitment as any).__linkingInfo;
                delete (commitment as any).__linkingInfo;

                if (isReactivation) {
                    // Create a NEW term for the reactivated commitment
                    console.log('Creating NEW term for reactivation');
                    await CommitmentService.updateCommitment(props.commitmentToEdit.id, commitment);
                    await TermService.createTerm(props.commitmentToEdit.id, term);

                    // Handle bidirectional linking
                    if (linkingInfo) {
                        await handleBidirectionalLinking(props.commitmentToEdit.id, linkingInfo);
                    }

                    // Notify parent to refresh data
                    if (props.onRefresh) {
                        props.onRefresh();
                    }
                    showToast(t('save.commitmentReactivated', 'Compromiso reactivado exitosamente'), 'success');
                    props.onClose();
                } else if (effectiveFromChanged && activeTerm && activeTermPayments.length > 0) {
                    // Date changed AND there are payments in the active term
                    // Need to handle carefully to preserve payment history
                    const oldEffectiveFrom = activeTerm.effective_from;
                    const newEffectiveFrom = term.effective_from;
                    const isMovingBackward = newEffectiveFrom < oldEffectiveFrom;

                    console.log('Date change detected WITH payments:', {
                        direction: isMovingBackward ? 'BACKWARD' : 'FORWARD',
                        oldEffectiveFrom,
                        newEffectiveFrom,
                        activeTermPaymentsCount: activeTermPayments.length
                    });

                    // Update commitment first
                    await CommitmentService.updateCommitment(props.commitmentToEdit.id, commitment);

                    if (isMovingBackward) {
                        // BACKWARD (Mar→Ene): Simply extend the term's effective_from
                        // Payments stay valid because the extended range now covers them
                        console.log('Moving backward: extending term effective_from');
                        await TermService.updateTerm(activeTerm.id, term);
                    } else {
                        // FORWARD (Ene→Mar): Close current term, create new term
                        // Payments stay with closed term (their original periods)
                        // IMPORTANT: Close at the last day of the PREVIOUS month to avoid overlap
                        // Validation compares at month level, so closing on Mar 14 when new starts Mar 15
                        // would still be considered March = overlap
                        const [year, month] = newEffectiveFrom.split('-').map(Number);
                        // Get last day of previous month (month-1 in JS is previous month, day 0 gives last day)
                        const lastDayPrevMonth = new Date(year, month - 1, 0);
                        const closeDate = `${lastDayPrevMonth.getFullYear()}-${String(lastDayPrevMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayPrevMonth.getDate()).padStart(2, '0')}`;

                        console.log('Moving forward: closing term at', closeDate, '(last day of prev month), creating new from', newEffectiveFrom);

                        // Close current term
                        await TermService.updateTerm(activeTerm.id, {
                            effective_until: closeDate
                        });

                        // Create new term with updated values
                        await TermService.createTerm(props.commitmentToEdit.id, term);
                    }

                    // Handle bidirectional linking
                    if (linkingInfo) {
                        await handleBidirectionalLinking(props.commitmentToEdit.id, linkingInfo);
                    }

                    // Notify parent to refresh data
                    if (props.onRefresh) {
                        props.onRefresh();
                    }
                    showToast(t('save.commitmentSuccess', 'Compromiso guardado exitosamente'), 'success');
                    props.onClose();
                } else if (activeTermPayments.length > 0 && activeTerm) {
                    // Term has payments but effective_from didn't change
                    // Just update the term in place (other fields changed)
                    console.log('Term has payments but effective_from unchanged - updating term');
                    await CommitmentService.updateCommitment(props.commitmentToEdit.id, commitment);
                    await TermService.updateTerm(activeTerm.id, term);

                    // Handle bidirectional linking
                    if (linkingInfo) {
                        await handleBidirectionalLinking(props.commitmentToEdit.id, linkingInfo);
                    }

                    if (props.onRefresh) {
                        props.onRefresh();
                    }
                    showToast(t('save.commitmentSuccess', 'Compromiso guardado exitosamente'), 'success');
                    props.onClose();
                } else if (effectiveFromChanged && activeTerm) {
                    // Date changed but NO payments in active term
                    // Still need to handle forward/backward differently to maintain history
                    const oldEffectiveFrom = activeTerm.effective_from;
                    const newEffectiveFrom = term.effective_from;
                    const isMovingBackward = newEffectiveFrom < oldEffectiveFrom;

                    console.log('Date change detected WITHOUT payments:', {
                        direction: isMovingBackward ? 'BACKWARD' : 'FORWARD',
                        oldEffectiveFrom,
                        newEffectiveFrom
                    });

                    await CommitmentService.updateCommitment(props.commitmentToEdit.id, commitment);

                    if (isMovingBackward) {
                        // BACKWARD: Simply extend term's effective_from (no history needed)
                        console.log('Moving backward (no payments): extending term');
                        await TermService.updateTerm(activeTerm.id, term);
                    } else {
                        // FORWARD: Close current term, create new term (maintain history)
                        // IMPORTANT: Close at the last day of the PREVIOUS month to avoid overlap
                        const [year, month] = newEffectiveFrom.split('-').map(Number);
                        const lastDayPrevMonth = new Date(year, month - 1, 0);
                        const closeDate = `${lastDayPrevMonth.getFullYear()}-${String(lastDayPrevMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayPrevMonth.getDate()).padStart(2, '0')}`;

                        console.log('Moving forward (no payments): closing term at', closeDate, '(last day of prev month), creating new from', newEffectiveFrom);

                        // Close current term
                        await TermService.updateTerm(activeTerm.id, {
                            effective_until: closeDate
                        });

                        // Create new term
                        await TermService.createTerm(props.commitmentToEdit.id, term);
                    }

                    // Handle bidirectional linking
                    if (linkingInfo) {
                        await handleBidirectionalLinking(props.commitmentToEdit.id, linkingInfo);
                    }

                    if (props.onRefresh) {
                        props.onRefresh();
                    }
                    showToast(t('save.commitmentSuccess', 'Compromiso guardado exitosamente'), 'success');
                    props.onClose();
                } else if (activeTerm) {
                    // No date change, no payments - just update term in place
                    console.log('Updating existing term (no date change, no payments):', {
                        termId: activeTerm.id,
                        due_day_of_month: term.due_day_of_month,
                        effective_from: term.effective_from,
                        fullTerm: term
                    });
                    await CommitmentService.updateCommitment(props.commitmentToEdit.id, commitment);
                    await TermService.updateTerm(activeTerm.id, term);

                    // Handle bidirectional linking
                    if (linkingInfo) {
                        await handleBidirectionalLinking(props.commitmentToEdit.id, linkingInfo);
                    }

                    if (props.onRefresh) {
                        props.onRefresh();
                    }
                    showToast(t('save.commitmentSuccess', 'Compromiso guardado exitosamente'), 'success');
                    props.onClose();
                } else {
                    // No active term - all terms are closed
                    // Just update commitment metadata
                    console.log('No active term found - updating commitment only');
                    await CommitmentService.updateCommitment(props.commitmentToEdit.id, commitment);

                    // Handle bidirectional linking
                    if (linkingInfo) {
                        await handleBidirectionalLinking(props.commitmentToEdit.id, linkingInfo);
                    }

                    if (props.onRefresh) {
                        props.onRefresh();
                    }
                    showToast(t('save.commitmentSuccess', 'Compromiso guardado exitosamente'), 'success');
                    props.onClose();
                }
            } else {
                // Create new commitment
                // Extract linking info for bidirectional updates
                const linkingInfo = (commitment as any).__linkingInfo;
                delete (commitment as any).__linkingInfo;

                const newCommitment = await CommitmentService.createCommitment(userId, commitment);
                if (!newCommitment) {
                    throw new Error('Failed to create commitment');
                }
                // Create initial term
                await TermService.createTerm(newCommitment.id, term);

                // Handle bidirectional linking for new commitment
                if (linkingInfo) {
                    await handleBidirectionalLinking(newCommitment.id, linkingInfo);
                }

                // Notify parent to refresh data
                if (props.onRefresh) {
                    props.onRefresh();
                }
                showToast(t('save.commitmentCreated', 'Compromiso creado exitosamente'), 'success');
                props.onClose();
            }
        } catch (error) {
            console.error('Error saving v2 commitment:', error);
            showToast(t('save.commitmentError', 'Error al guardar el compromiso'), 'error');
            throw error;
        }
    };

    // Use v2 when flag is enabled
    if (useV2) {
        return (
            <>
                <CommitmentFormV2
                    isOpen={props.isOpen}
                    onClose={props.onClose}
                    onSave={handleV2Save}
                    categories={v2Categories}
                    commitmentToEdit={props.commitmentToEdit ?? null}
                    existingCommitments={existingCommitments}
                    onCategoriesChange={loadV2Categories}
                    openWithPauseForm={props.openWithPauseForm}
                    openWithResumeForm={props.openWithResumeForm}
                    onCommitmentUpdated={props.onRefresh}
                    onPaymentClick={props.onPaymentClick}
                />
            </>
        );
    }

    // Fall back to v1 form
    return (
        <ExpenseForm
            isOpen={props.isOpen}
            onClose={props.onClose}
            onSave={props.onSave}
            expenseToEdit={props.expenseToEdit}
            categories={props.categories.map(c => typeof c === 'string' ? c : c.name)}
            expenses={props.expenses}
        />
    );
};
