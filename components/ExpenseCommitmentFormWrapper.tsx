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
import type { CommitmentFormData, TermFormData, CommitmentWithTerm, Payment } from '../types.v2';
import type { Expense } from '../types';
import { AlertTriangle, ArrowRight } from 'lucide-react';

// Modal for confirming payment reassignment
interface ReassignPaymentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reassign: boolean) => void;
    payments: Payment[];
    oldEffectiveFrom: string;
    newEffectiveFrom: string;
}

const ReassignPaymentsModal: React.FC<ReassignPaymentsModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    payments,
    oldEffectiveFrom,
    newEffectiveFrom
}) => {
    if (!isOpen) return null;

    // Calculate month shift
    const [oldYear, oldMonth] = oldEffectiveFrom.split('-').map(Number);
    const [newYear, newMonth] = newEffectiveFrom.split('-').map(Number);
    const monthShift = (newYear - oldYear) * 12 + (newMonth - oldMonth);

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const formatPeriod = (dateStr: string) => {
        const [year, month] = dateStr.split('-').map(Number);
        return `${monthNames[month - 1]} ${year}`;
    };

    const getNewPeriodDate = (oldPeriodDate: string) => {
        const [pYear, pMonth, pDay] = oldPeriodDate.split('-').map(Number);
        const newDate = new Date(pYear, pMonth - 1 + monthShift, pDay);
        return `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md p-6 shadow-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Pagos registrados encontrados
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Este compromiso tiene <strong>{payments.length} pagos</strong> registrados en el término anterior.
                        </p>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 mb-4 max-h-48 overflow-y-auto">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                        Los pagos se reasignarán así:
                    </p>
                    <div className="space-y-1.5">
                        {payments.slice(0, 6).map((payment, idx) => {
                            const oldPeriod = formatPeriod(payment.period_date);
                            const newPeriod = formatPeriod(getNewPeriodDate(payment.period_date));
                            return (
                                <div key={payment.id} className="flex items-center gap-2 text-sm">
                                    <span className="text-slate-600 dark:text-slate-300 font-mono">
                                        Cuota {idx + 1}:
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-400">
                                        {oldPeriod}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        {newPeriod}
                                    </span>
                                </div>
                            );
                        })}
                        {payments.length > 6 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                                ... y {payments.length - 6} pagos más
                            </p>
                        )}
                    </div>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    ¿Deseas reasignar los pagos al nuevo término?
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={() => onConfirm(false)}
                        className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        No, mantener
                    </button>
                    <button
                        onClick={() => onConfirm(true)}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        Sí, reasignar
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ExpenseCommitmentFormWrapperProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (expense: Omit<Expense, 'id' | 'createdAt'> & { id?: string }) => void;
    expenseToEdit: Expense | null;
    commitmentToEdit?: CommitmentWithTerm | null; // v2 commitment to edit
    categories: string[] | Category[]; // v1 categories (string array) or v2 Category[]
    expenses: Expense[]; // v1 expenses
    onRefresh?: () => void; // Callback to refresh data after v2 save
}

// State for pending save operation (when waiting for user confirmation)
interface PendingSaveState {
    commitmentId: string; // Store the commitment ID to avoid depending on props
    commitment: CommitmentFormData;
    term: TermFormData;
    userId: string;
    termWithPayments: CommitmentWithTerm['active_term']; // The term that has the payments (may be closed)
    currentActiveTerm: CommitmentWithTerm['active_term']; // The current active term (may be different)
    payments: Payment[];
    oldEffectiveFrom: string;
    newEffectiveFrom: string;
    linkingInfo?: { newLinkedId: string | null; previousLinkedFromId: string | null; isUnlinking: boolean };
}

export const ExpenseCommitmentFormWrapper: React.FC<ExpenseCommitmentFormWrapperProps> = (props) => {
    const useV2 = useFeature('useV2Commitments');
    const { t, language } = useLocalization(); // Need t and language for category translation
    const { commitments: existingCommitments } = useCommitments(); // Get existing commitments for linking
    const { showToast } = useToast();
    const [v2Categories, setV2Categories] = React.useState<Category[]>([]);
    const [loading, setLoading] = React.useState(false);

    // State for reassignment confirmation modal
    const [showReassignModal, setShowReassignModal] = React.useState(false);
    const [pendingSave, setPendingSave] = React.useState<PendingSaveState | null>(null);

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

    // Complete the save operation (called after user confirms or skips reassignment)
    const completeSave = async (shouldReassign: boolean) => {
        if (!pendingSave) return;

        const { commitmentId, commitment, term, userId, termWithPayments, currentActiveTerm, payments, oldEffectiveFrom, newEffectiveFrom, linkingInfo } = pendingSave;

        setLoading(true);
        try {
            // Update commitment
            await CommitmentService.updateCommitment(commitmentId, commitment);

            // Determine the target term for the update
            // If currentActiveTerm exists and is different from termWithPayments, update it
            // Otherwise, we need to create a new term
            let targetTermId: string;

            if (currentActiveTerm && currentActiveTerm.id !== termWithPayments?.id) {
                // There's already a separate active term (v2) - update it
                console.log('Updating existing active term:', currentActiveTerm.id);
                await TermService.updateTerm(currentActiveTerm.id, term);
                targetTermId = currentActiveTerm.id;
            } else {
                // No separate active term exists, or active term IS the term with payments
                // Close the old term and create a new one
                console.log('Creating new term (closing old term with payments)');

                // Close the old term (set effective_until to day before new term starts)
                const [year, month, day] = newEffectiveFrom.split('-').map(Number);
                const closeDateObj = new Date(year, month - 1, day - 1);
                const closeDate = `${closeDateObj.getFullYear()}-${String(closeDateObj.getMonth() + 1).padStart(2, '0')}-${String(closeDateObj.getDate()).padStart(2, '0')}`;

                if (termWithPayments) {
                    await TermService.updateTerm(termWithPayments.id, {
                        effective_until: closeDate
                    });
                }

                // Create new term with updated values
                const newTerm = await TermService.createTerm(commitmentId, term);
                if (!newTerm) {
                    throw new Error('Failed to create new term');
                }
                targetTermId = newTerm.id;
            }

            // Reassign payments only if user confirmed
            if (shouldReassign && payments.length > 0) {
                // Pass ALL commitment payments to be reassigned (not just from one term)
                const reassignedCount = await PaymentService.reassignPaymentsToNewTerm(
                    payments, // Pass the payments array directly
                    targetTermId,
                    oldEffectiveFrom,
                    newEffectiveFrom,
                    userId
                );
                console.log(`Reassigned ${reassignedCount} payments to term ${targetTermId} (with audit trail)`);
            } else if (!shouldReassign) {
                // User chose not to reassign - payments stay with old term
                console.log('User chose not to reassign payments - keeping original period dates');
            }

            // Handle bidirectional linking
            if (linkingInfo) {
                await handleBidirectionalLinking(commitmentId, linkingInfo);
            }

            // Notify parent to refresh data
            if (props.onRefresh) {
                props.onRefresh();
            }

            showToast(t('save.commitmentSuccess', 'Compromiso guardado exitosamente'), 'success');
            props.onClose();
        } catch (error) {
            console.error('Error completing v2 commitment save:', error);
            showToast(t('save.commitmentError', 'Error al guardar el compromiso'), 'error');
            throw error;
        } finally {
            setLoading(false);
            setPendingSave(null);
            setShowReassignModal(false);
        }
    };

    const handleReassignConfirm = (shouldReassign: boolean) => {
        completeSave(shouldReassign);
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

    const handleV2Save = async (commitment: CommitmentFormData, term: TermFormData) => {
        setLoading(true);
        try {
            const userId = await getCurrentUserId();
            if (!userId) {
                throw new Error('User not authenticated');
            }

            if (props.commitmentToEdit) {
                // Update existing commitment
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

                // Check if commitment has ANY payments (across all terms, not just activeTerm)
                const hasPayments = await PaymentService.hasPaymentsForCommitment(props.commitmentToEdit.id);

                // Get all payments to find which term they belong to
                const allPayments = hasPayments
                    ? await PaymentService.getPayments(props.commitmentToEdit.id)
                    : [];

                // Find the term that has the payments (may differ from activeTerm if user already edited once)
                let termWithPayments = activeTerm;
                if (allPayments.length > 0 && allPayments[0].term_id !== activeTerm?.id) {
                    // Payments are on a different term - get that term's info
                    const foundTerm = await TermService.getTerm(allPayments[0].term_id);
                    if (foundTerm) {
                        termWithPayments = foundTerm;
                    }
                }

                // Check if effective_from changed relative to the term that HAS the payments
                const effectiveFromChanged = termWithPayments && termWithPayments.effective_from !== term.effective_from;

                console.log('Action check:', {
                    originalEffectiveUntil,
                    newEffectiveFrom: term.effective_from,
                    newEffectiveUntil: term.effective_until,
                    today,
                    wasTermEnded,
                    isCreatingNewActiveTerm,
                    isReactivation,
                    hasPayments,
                    effectiveFromChanged,
                    activeTermId: activeTerm?.id,
                    termWithPaymentsId: termWithPayments?.id,
                    termWithPaymentsEffectiveFrom: termWithPayments?.effective_from
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
                } else if (hasPayments && effectiveFromChanged) {
                    // Commitment has payments AND effective_from changed - ask user about reassignment
                    console.log('Commitment has payments and effective_from changed - showing confirmation modal', {
                        oldEffectiveFrom: termWithPayments!.effective_from,
                        newEffectiveFrom: term.effective_from,
                        paymentsCount: allPayments.length
                    });

                    // Store pending save state and show modal
                    setPendingSave({
                        commitmentId: props.commitmentToEdit.id,
                        commitment,
                        term,
                        userId,
                        termWithPayments: termWithPayments, // The term that has payments (may be closed v1)
                        currentActiveTerm: activeTerm, // The current active term (may be v2)
                        payments: allPayments,
                        oldEffectiveFrom: termWithPayments!.effective_from,
                        newEffectiveFrom: term.effective_from,
                        linkingInfo, // Include linking info for bidirectional updates
                    });
                    setShowReassignModal(true);
                    setLoading(false);
                    return; // Don't close yet - wait for user confirmation
                } else if (hasPayments) {
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
                } else if (activeTerm) {
                    // No payments - safe to update existing term
                    console.log('Updating existing term (no payments):', {
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
        } finally {
            setLoading(false);
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
                />
                {/* Reassignment confirmation modal */}
                {pendingSave && (
                    <ReassignPaymentsModal
                        isOpen={showReassignModal}
                        onClose={() => {
                            setShowReassignModal(false);
                            setPendingSave(null);
                        }}
                        onConfirm={handleReassignConfirm}
                        payments={pendingSave.payments}
                        oldEffectiveFrom={pendingSave.oldEffectiveFrom}
                        newEffectiveFrom={pendingSave.newEffectiveFrom}
                    />
                )}
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
