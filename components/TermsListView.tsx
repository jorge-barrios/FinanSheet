/**
 * TermsListView.tsx
 *
 * Displays all terms for a commitment with inline editing capability.
 *
 * Design principles:
 * - period_date is IMMUTABLE - payments never change their period
 * - term_id is DERIVED - recalculated when terms change
 * - Terms are fully EDITABLE (dates, amounts, everything)
 * - No term overlap allowed
 * - Gaps (pauses) are allowed
 */

import React, { useState, useMemo } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { generateExpectedPeriods } from '../utils/commitmentStatusUtils';
import { Calendar, DollarSign, Hash, ChevronDown, ChevronUp, Edit2, Check, AlertTriangle, Pause, Clock, Trash2, Plus, X } from 'lucide-react';
import type { Term, CommitmentWithTerm, Payment, Frequency, PaymentWithDetails } from '../types.v2';

interface TermsListViewProps {
    commitment: CommitmentWithTerm;
    payments: Payment[];
    onTermUpdate: (termId: string, updates: Partial<Term>) => Promise<void>;
    onTermCreate?: (termData: Partial<Term>) => Promise<void>; // For creating new terms
    onTermDelete?: (termId: string) => Promise<void>; // Delete term (only if no payments)
    onRefresh?: () => Promise<void>; // Callback to refresh commitment data after changes
    isReadOnly?: boolean;
    openWithPauseForm?: boolean; // When true, auto-opens the pause form
    openWithResumeForm?: boolean; // When true, auto-opens the resume (new term) form
    hideTitle?: boolean; // Hide header title and counter (to avoid duplication when inside accordion)
    isLoading?: boolean;
    useScrollNavigation?: boolean; // If true, filter buttons scroll to section instead of hiding items
    onPaymentClick?: (paymentDate: string) => void; // Callback when a payment row is clicked
}

interface EditingTerm {
    id: string;
    effective_from: string;
    effective_until: string | null;
    amount_original: number;
    due_day_of_month: number | null;
    frequency: Frequency;
    installments_count: number | null;
    is_divided_amount: boolean | null;
}

const formInputClasses = "w-full h-[36px] bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500";

// Interface for new term creation form
interface NewTermForm {
    effective_from: string;
    effective_until: string | null;
    amount_original: number;
    due_day_of_month: number | null;
    frequency: Frequency;
    currency_original: string;
}

export const TermsListView: React.FC<TermsListViewProps> = ({
    commitment,
    payments,
    onTermUpdate,
    onTermCreate,
    onTermDelete,
    onRefresh,
    isReadOnly = false,
    openWithPauseForm = false,
    openWithResumeForm = false,
    hideTitle = false,
    isLoading = false,
    useScrollNavigation = isReadOnly, // Default to true if read-only
    onPaymentClick,
}) => {
    const { t, formatClp } = useLocalization();
    const [expandedTermId, setExpandedTermId] = useState<string | null>(
        // Default to active term if available
        commitment.active_term?.id || null
    );
    const [editingTerm, setEditingTerm] = useState<EditingTerm | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('paid');

    // State for creating new term
    const [showNewTermForm, setShowNewTermForm] = useState(false);
    const [newTerm, setNewTerm] = useState<NewTermForm | null>(null);

    // State for pause form
    const [showPauseForm, setShowPauseForm] = useState(false);
    const [pauseMonth, setPauseMonth] = useState<string>('');

    // Auto-open pause form when openWithPauseForm prop is true
    // Auto-open pause form when openWithPauseForm prop is true
    React.useEffect(() => {
        // Can only auto-open pause form if the active term doesn't have an end date
        const canPause = commitment.active_term && !commitment.active_term.effective_until;

        if (openWithPauseForm && !showPauseForm && canPause) {
            // Initialize pauseMonth with minimum valid month (same logic as handleStartPause)
            const today = new Date();
            const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            // Get minimum month from active term
            const minYM = commitment.active_term?.effective_from?.substring(0, 7) || currentYM;

            // Only set if we haven't already
            if (!pauseMonth) {
                // Default to next month if current month is "paid" or currentYM if not? 
                // For simplicity, just use currentYM or minYM whichever is greater
                setPauseMonth(currentYM > minYM ? currentYM : minYM);
            }
            setShowPauseForm(true);
        }
    }, [openWithPauseForm, commitment.active_term, showPauseForm, pauseMonth]); // Correct dependencies

    // Auto-scroll effect for Paid filter on initial load
    React.useEffect(() => {
        if (useScrollNavigation && expandedTermId && paymentFilter === 'paid') {
            // Tiny timeout to ensure DOM is rendered (heights calculated)
            setTimeout(() => {
                const list = document.getElementById(`payment-list-${expandedTermId}`);
                const firstPaid = list?.querySelector('[data-payment-status="paid"]');
                if (firstPaid && list) {
                    const topPos = (firstPaid as HTMLElement).offsetTop - list.offsetTop;
                    list.scrollTo({ top: topPos, behavior: 'smooth' });
                }
            }, 100);
        }
    }, [expandedTermId, paymentFilter, useScrollNavigation]);


    // Auto-open resume form when openWithResumeForm prop is true
    React.useEffect(() => {
        if (openWithResumeForm && !showNewTermForm && commitment.active_term?.effective_until) {
            const activeTerm = commitment.active_term;

            // Calculate resume date = max(month after term ends, current month)
            const [endY, endM] = activeTerm.effective_until!.substring(0, 7).split('-').map(Number);
            const nextMonthAfterEnd = endM === 12 ? 1 : endM + 1;
            const nextYearAfterEnd = endM === 12 ? endY + 1 : endY;
            const afterEndYM = `${nextYearAfterEnd}-${String(nextMonthAfterEnd).padStart(2, '0')}`;

            const now = new Date();
            const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            const resumeYM = afterEndYM >= currentYM ? afterEndYM : currentYM;
            const resumeFrom = `${resumeYM}-01`;

            // Pre-fill new term form with data from active term
            setEditingTerm(null);
            setShowPauseForm(false);
            setError(null);
            setNewTerm({
                effective_from: resumeFrom,
                effective_until: null,
                amount_original: activeTerm.amount_original || 0,
                due_day_of_month: activeTerm.due_day_of_month || null,
                frequency: activeTerm.frequency || 'MONTHLY',
                currency_original: activeTerm.currency_original || 'CLP',
            });
            setShowNewTermForm(true);
        }
    }, [openWithResumeForm, commitment.active_term]);

    // Clear success message after 3 seconds
    React.useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    // Get all terms sorted by version (highest version = active term)
    // VERSION is the source of truth for determining which term is "active"
    // This matches the backend logic in dataService.v2.ts
    const allTerms = useMemo(() => {
        const terms = commitment.all_terms || [];
        if (terms.length === 0 && commitment.active_term) {
            return [commitment.active_term];
        }
        return [...terms].sort((a, b) => {
            // Sort by version descending (highest version first = active term)
            return b.version - a.version;
        });
    }, [commitment]);

    // Count payments per term
    const paymentsByTerm = useMemo(() => {
        const map: Record<string, Payment[]> = {};
        payments.forEach(p => {
            if (!map[p.term_id]) map[p.term_id] = [];
            map[p.term_id].push(p);
        });
        return map;
    }, [payments]);

    // Count total paid payments (those with payment_date) - used for auto-switching filter
    const paidPaymentsCount = useMemo(() => {
        return payments.filter(p => !!p.payment_date).length;
    }, [payments]);

    // Auto-switch to 'all' filter if no paid payments exist and filter is still 'paid'
    // This runs once on mount to set initial filter appropriately
    React.useEffect(() => {
        if (paymentFilter === 'paid' && paidPaymentsCount === 0) {
            console.log('TermsListView: No paid payments found, switching to "all" filter');
            setPaymentFilter('all');
        }
    }, [paidPaymentsCount]); // Only run when paid count changes, not on every filter change

    // Check if a term is the active term (highest version number)
    // This matches the backend logic - version is the source of truth
    const isTermActive = (term: Term): boolean => {
        // A term is "active" if it has the highest version number
        // Since allTerms is sorted by version DESC, the first term is active
        const highestVersion = allTerms.length > 0 ? allTerms[0].version : 0;
        return term.version === highestVersion;
    };

    // Format date for display (month year)
    const formatMonthYear = (dateStr: string): string => {
        const [year, month] = dateStr.split('-').map(Number);
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${months[month - 1]} ${year}`;
    };

    // Validate term dates don't overlap with other terms
    const validateNoOverlap = (termId: string, effectiveFrom: string, effectiveUntil: string | null): string | null => {
        const otherTerms = allTerms.filter(t => t.id !== termId);

        const newFromYM = effectiveFrom.substring(0, 7);
        const newUntilYM = effectiveUntil?.substring(0, 7) || '9999-12';

        for (const term of otherTerms) {
            const termFromYM = term.effective_from.substring(0, 7);
            const termUntilYM = term.effective_until?.substring(0, 7) || '9999-12';

            // Check for overlap: !(newEnd < termStart || newStart > termEnd)
            const overlaps = !(newUntilYM < termFromYM || newFromYM > termUntilYM);

            if (overlaps) {
                return `Este rango se superpone con V${term.version} (${formatMonthYear(term.effective_from)} - ${term.effective_until ? formatMonthYear(term.effective_until) : '∞'})`;
            }
        }
        return null;
    };

    // Check if editing would orphan payments
    const getOrphanedPayments = (termId: string, effectiveFrom: string, effectiveUntil: string | null): Payment[] => {
        const termPayments = paymentsByTerm[termId] || [];
        return termPayments.filter(p => {
            const periodYM = p.period_date.substring(0, 7);
            const fromYM = effectiveFrom.substring(0, 7);
            const untilYM = effectiveUntil?.substring(0, 7) || '9999-12';
            // Payment is orphaned if its period is outside the new range
            return periodYM < fromYM || periodYM > untilYM;
        });
    };

    const handleStartEdit = (term: Term) => {
        // Close any open new term form first
        setShowNewTermForm(false);
        setNewTerm(null);

        setEditingTerm({
            id: term.id,
            effective_from: term.effective_from,
            effective_until: term.effective_until,
            amount_original: term.amount_original,
            due_day_of_month: term.due_day_of_month,
            frequency: term.frequency as Frequency,
            installments_count: term.installments_count,
            is_divided_amount: term.is_divided_amount,
        });
        setError(null);
        setSuccessMessage(null);
    };

    const handleCancelEdit = () => {
        setEditingTerm(null);
        setError(null);
    };

    const handleSaveEdit = async () => {
        if (!editingTerm) return;

        // CRITICAL: Validate that effective_until >= effective_from (if effective_until is set)
        if (editingTerm.effective_until) {
            const fromYM = editingTerm.effective_from.substring(0, 7);
            const untilYM = editingTerm.effective_until.substring(0, 7);
            if (untilYM < fromYM) {
                setError(`La fecha "Hasta" (${untilYM}) no puede ser anterior a la fecha "Desde" (${fromYM})`);
                return;
            }
        }

        // Validate no overlap
        const overlapError = validateNoOverlap(
            editingTerm.id,
            editingTerm.effective_from,
            editingTerm.effective_until
        );
        if (overlapError) {
            setError(overlapError);
            return;
        }

        // =================================================================
        // CHECK FOR STRUCTURAL CHANGES REQUIRING NEW VERSION
        // =================================================================
        const originalTerm = allTerms.find(t => t.id === editingTerm.id);
        const termPayments = paymentsByTerm[editingTerm.id] || [];
        const hasPaidPayments = termPayments.some(p => !!p.payment_date);

        // Detect structural changes (fields that affect payment meaning)
        const structuralChanges = originalTerm && (
            originalTerm.is_divided_amount !== editingTerm.is_divided_amount ||
            originalTerm.amount_original !== editingTerm.amount_original ||
            originalTerm.frequency !== editingTerm.frequency
        );

        // If term has PAID payments and structural changes, force V+1 creation
        if (hasPaidPayments && structuralChanges) {
            const changesList: string[] = [];
            if (originalTerm?.is_divided_amount !== editingTerm.is_divided_amount) {
                changesList.push(`Tipo: ${originalTerm?.is_divided_amount ? 'Cuotas' : 'Definido/Indefinido'} → ${editingTerm.is_divided_amount ? 'Cuotas' : 'Definido/Indefinido'}`);
            }
            if (originalTerm?.amount_original !== editingTerm.amount_original) {
                changesList.push(`Monto: ${originalTerm?.amount_original} → ${editingTerm.amount_original}`);
            }
            if (originalTerm?.frequency !== editingTerm.frequency) {
                changesList.push(`Frecuencia: ${originalTerm?.frequency} → ${editingTerm.frequency}`);
            }

            const confirmMessage = `⚠️ Este término tiene ${termPayments.filter(p => !!p.payment_date).length} pagos registrados.

Estás cambiando campos estructurales:
${changesList.map(c => `• ${c}`).join('\n')}

Para preservar la integridad contable, esto creará un NUEVO TÉRMINO (V${(originalTerm?.version || 0) + 1}) con las nuevas condiciones, y cerrará el actual al final del mes pasado.

Los pagos existentes permanecerán en el término actual.

¿Continuar?`;

            if (!window.confirm(confirmMessage)) {
                return;
            }

            // Create V+1 instead of editing
            setSaving(true);
            try {
                // 1. Close current term (effective_until = last day of previous month)
                const today = new Date();
                const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                const closeDate = lastDayOfLastMonth.toISOString().split('T')[0];

                await onTermUpdate(editingTerm.id, {
                    effective_until: closeDate
                });

                // 2. Create new term with updated values
                const newTermData = {
                    effective_from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
                    effective_until: editingTerm.effective_until,
                    amount_original: editingTerm.amount_original,
                    due_day_of_month: editingTerm.due_day_of_month,
                    frequency: editingTerm.frequency,
                    installments_count: editingTerm.installments_count,
                    is_divided_amount: editingTerm.is_divided_amount,
                };

                if (onTermCreate) {
                    await onTermCreate(newTermData);
                }

                setEditingTerm(null);
                setError(null);
                setSuccessMessage(`Término anterior cerrado. Nuevo término V${(originalTerm?.version || 0) + 1} creado.`);

                if (onRefresh) {
                    await onRefresh();
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Error al crear nueva versión';
                setError(errorMessage);
                console.error('[TermsListView] Error creating new term version:', err);
            } finally {
                setSaving(false);
            }
            return; // Exit early, don't do the normal update
        }

        // =================================================================
        // NORMAL FLOW: Check for orphaned payments (split by paid/pending)
        // =================================================================
        const orphaned = getOrphanedPayments(
            editingTerm.id,
            editingTerm.effective_from,
            editingTerm.effective_until
        );

        const paidOrphans = orphaned.filter(p => !!p.payment_date);
        const pendingOrphans = orphaned.filter(p => !p.payment_date);

        // 1. BLOCK: Never allow orphaning paid payments
        if (paidOrphans.length > 0) {
            setError(`No se puede acortar el plazo: Quedarían ${paidOrphans.length} pagos YA REALIZADOS fuera del rango. Elimina o mueve esos pagos históricos primero.`);
            return;
        }

        // 2. WARN: If pending payments will be dropped OR date is being shortened
        const originalUntil = allTerms.find(t => t.id === editingTerm.id)?.effective_until;
        const isShortening = editingTerm.effective_until && (
            !originalUntil || // Was indefinite, now defined
            editingTerm.effective_until < originalUntil // Ending sooner
        );

        if (pendingOrphans.length > 0 || isShortening) {
            const message = pendingOrphans.length > 0
                ? `⚠️ Al cambiar la fecha, ${pendingOrphans.length} pagos futuros quedarán fuera del rango y se eliminarán.\n\n¿Estás seguro de que deseas terminar este compromiso anticipadamente?`
                : `Estás a punto de terminar este compromiso.\n\nEsto detendrá la generación de cobros futuros a partir de la fecha seleccionada.\n¿Confirmar término anticipado?`;

            if (!window.confirm(message)) {
                return;
            }
        }

        setSaving(true);
        try {
            await onTermUpdate(editingTerm.id, {
                effective_from: editingTerm.effective_from,
                effective_until: editingTerm.effective_until,
                amount_original: editingTerm.amount_original,
                due_day_of_month: editingTerm.due_day_of_month,
                frequency: editingTerm.frequency,
                installments_count: editingTerm.installments_count,
                is_divided_amount: editingTerm.is_divided_amount,
            });
            setEditingTerm(null);
            setError(null);
            setSuccessMessage('Término actualizado correctamente');

            // Refresh data to show updated term
            if (onRefresh) {
                await onRefresh();
            }
        } catch (err) {
            // Show the actual error message from the backend
            const errorMessage = err instanceof Error ? err.message : 'Error al guardar los cambios';
            setError(errorMessage);
            console.error('[TermsListView] Error saving term:', err);
        } finally {
            setSaving(false);
        }
    };

    const toggleExpand = (termId: string) => {
        setExpandedTermId(prev => prev === termId ? null : termId);
    };

    // Initialize new term form with smart defaults
    const handleStartNewTerm = () => {
        // Close any existing edit first
        setEditingTerm(null);

        // Find the active term to use as template
        const activeTerm = commitment.active_term;

        // Determine suggested start date based on scenario
        const { suggestedStart, scenario } = findBestStartMonth();

        setNewTerm({
            effective_from: suggestedStart,
            effective_until: null,
            amount_original: activeTerm?.amount_original || 0,
            due_day_of_month: activeTerm?.due_day_of_month || 1,
            frequency: (activeTerm?.frequency as Frequency) || 'MONTHLY',
            currency_original: activeTerm?.currency_original || 'CLP',
        });
        setShowNewTermForm(true);

        // Show contextual info based on scenario
        if (scenario === 'will_close_active') {
            setError(`ℹ️ Al crear este término, V${activeTerm?.version} se cerrará automáticamente en el mes anterior.`);
        } else if (scenario === 'filling_gap') {
            setError(null);
        } else {
            setError(null);
        }
        setSuccessMessage(null);
    };

    // Find the best start month for a new term
    const findBestStartMonth = (): { suggestedStart: string; scenario: 'will_close_active' | 'filling_gap' | 'normal' } => {
        const today = new Date();
        const activeTerm = commitment.active_term;

        // SCENARIO 1: Active term is open-ended
        // In this case, we should suggest starting AFTER the active term's start
        // and the active term will be closed automatically
        if (activeTerm && !activeTerm.effective_until) {
            const activeFromYM = activeTerm.effective_from.substring(0, 7);
            const [activeYear, activeMonth] = activeFromYM.split('-').map(Number);

            // Suggest the month after the active term starts (so it can be closed with at least 1 month)
            const nextMonth = new Date(activeYear, activeMonth, 1); // activeMonth is 1-indexed, so this gives next month
            const suggestedYM = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;

            return {
                suggestedStart: `${suggestedYM}-01`,
                scenario: 'will_close_active'
            };
        }

        // SCENARIO 2: All terms are closed - look for gaps
        const coveredMonths = new Set<string>();

        for (const term of allTerms) {
            const fromYM = term.effective_from.substring(0, 7);
            const untilYM = term.effective_until?.substring(0, 7) || null;

            if (!untilYM) continue; // Skip open-ended (handled above)

            // Add all months in range to covered set
            let [year, month] = fromYM.split('-').map(Number);
            const [endYear, endMonth] = untilYM.split('-').map(Number);

            while (year < endYear || (year === endYear && month <= endMonth)) {
                coveredMonths.add(`${year}-${String(month).padStart(2, '0')}`);
                month++;
                if (month > 12) {
                    month = 1;
                    year++;
                }
            }
        }

        // Search for first gap starting from current month
        let searchYear = today.getFullYear();
        let searchMonth = today.getMonth() + 1;

        for (let i = 0; i < 36; i++) {
            const ym = `${searchYear}-${String(searchMonth).padStart(2, '0')}`;
            if (!coveredMonths.has(ym)) {
                return {
                    suggestedStart: `${ym}-01`,
                    scenario: coveredMonths.size > 0 ? 'filling_gap' : 'normal'
                };
            }
            searchMonth++;
            if (searchMonth > 12) {
                searchMonth = 1;
                searchYear++;
            }
        }

        // SCENARIO 3: No gaps found - suggest month after latest closed term
        const latestEnd = allTerms
            .filter(t => t.effective_until)
            .map(t => t.effective_until!)
            .sort()
            .pop();

        if (latestEnd) {
            const [year, month] = latestEnd.split('-').map(Number);
            const nextMonth = new Date(year, month, 1);
            return {
                suggestedStart: nextMonth.toLocaleDateString('en-CA'),
                scenario: 'normal'
            };
        }

        // Ultimate fallback
        return {
            suggestedStart: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
            scenario: 'normal'
        };
    };

    // State for short-term confirmation
    const [pendingShortTermConfirm, setPendingShortTermConfirm] = useState(false);

    // Calculate term duration in months
    const getTermDurationMonths = (from: string, until: string | null): number | null => {
        if (!until) return null; // Indefinite
        const [fromYear, fromMonth] = from.substring(0, 7).split('-').map(Number);
        const [untilYear, untilMonth] = until.substring(0, 7).split('-').map(Number);
        return (untilYear - fromYear) * 12 + (untilMonth - fromMonth) + 1;
    };

    // Handle save new term
    const handleSaveNewTerm = async (skipShortTermWarning = false) => {
        if (!newTerm || !onTermCreate) return;

        // CRITICAL: Validate that effective_until >= effective_from (if effective_until is set)
        if (newTerm.effective_until) {
            const fromYM = newTerm.effective_from.substring(0, 7);
            const untilYM = newTerm.effective_until.substring(0, 7);
            if (untilYM < fromYM) {
                setError(`La fecha "Hasta" (${untilYM}) no puede ser anterior a la fecha "Desde" (${fromYM})`);
                return;
            }
        }

        const activeTerm = commitment.active_term;

        // ============ EXTENSION DETECTION ============
        // If the previous term has effective_until (is paused/terminated),
        // and the new term starts exactly the month after,
        // and all data is the same (amount, frequency, due_day),
        // and the new term is open-ended,
        // then we should EXTEND the previous term instead of creating a new one.
        if (activeTerm?.effective_until && !newTerm.effective_until) {
            const prevEndYM = activeTerm.effective_until.substring(0, 7);
            const [prevEndYear, prevEndMonth] = prevEndYM.split('-').map(Number);

            // Calculate expected next month
            const expectedNextMonth = prevEndMonth === 12 ? 1 : prevEndMonth + 1;
            const expectedNextYear = prevEndMonth === 12 ? prevEndYear + 1 : prevEndYear;
            const expectedNextYM = `${expectedNextYear}-${String(expectedNextMonth).padStart(2, '0')}`;

            const newFromYM = newTerm.effective_from.substring(0, 7);

            // Check if new term starts exactly next month (no gap)
            const startsNextMonth = newFromYM === expectedNextYM;

            // Check if all data is the same
            const sameAmount = newTerm.amount_original === activeTerm.amount_original;
            const sameFrequency = newTerm.frequency === activeTerm.frequency;
            const sameDueDay = newTerm.due_day_of_month === activeTerm.due_day_of_month;
            const sameCurrency = newTerm.currency_original === activeTerm.currency_original;

            const canExtend = startsNextMonth && sameAmount && sameFrequency && sameDueDay && sameCurrency;

            if (canExtend) {
                // EXTEND: Just remove effective_until from previous term
                setSaving(true);
                try {
                    await onTermUpdate(activeTerm.id, {
                        effective_until: null, // Remove the end date = resume/extend
                    });

                    setNewTerm(null);
                    setShowNewTermForm(false);
                    setError(null);
                    setSuccessMessage(`Término V${activeTerm.version} extendido (reanudado).`);

                    if (onRefresh) {
                        await onRefresh();
                    }
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Error al extender el término');
                    console.error(err);
                } finally {
                    setSaving(false);
                }
                return; // Don't continue with normal create flow
            }
        }
        // ============ END EXTENSION DETECTION ============

        // If active term is open-ended, we need to close it first
        const needsToClosePrevious = activeTerm && !activeTerm.effective_until;

        // Calculate the close date for the previous term (last day of month before new term starts)
        let closeDate: string | null = null;
        if (needsToClosePrevious) {
            const [year, month] = newTerm.effective_from.split('-').map(Number);
            const prevMonth = new Date(year, month - 1, 0); // Last day of previous month
            closeDate = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-${String(prevMonth.getDate()).padStart(2, '0')}`;

            // Validate that closeDate >= activeTerm.effective_from
            const closeYM = closeDate.substring(0, 7);
            const activeFromYM = activeTerm.effective_from.substring(0, 7);
            if (closeYM < activeFromYM) {
                setError(`No se puede crear el término: el nuevo inicio (${newTerm.effective_from.substring(0, 7)}) haría que V${activeTerm.version} tenga fechas inválidas.`);
                return;
            }
        }

        // Validate no overlap (excluding the active term if we're going to close it)
        const termsToCheck = needsToClosePrevious
            ? allTerms.filter(t => t.id !== activeTerm?.id)
            : allTerms;

        const newFromYM = newTerm.effective_from.substring(0, 7);
        const newUntilYM = newTerm.effective_until?.substring(0, 7) || '9999-12';

        for (const term of termsToCheck) {
            const termFromYM = term.effective_from.substring(0, 7);
            const termUntilYM = term.effective_until?.substring(0, 7) || '9999-12';
            const overlaps = !(newUntilYM < termFromYM || newFromYM > termUntilYM);

            if (overlaps) {
                setError(`Este rango se superpone con V${term.version} (${formatMonthYear(term.effective_from)} - ${term.effective_until ? formatMonthYear(term.effective_until) : '∞'})`);
                return;
            }
        }

        // Validate amount
        if (newTerm.amount_original <= 0) {
            setError('El monto debe ser mayor a 0');
            return;
        }

        // Check for very short term (1-2 months) and warn user
        if (!skipShortTermWarning && newTerm.effective_until) {
            const duration = getTermDurationMonths(newTerm.effective_from, newTerm.effective_until);
            if (duration !== null && duration <= 2) {
                setPendingShortTermConfirm(true);
                setError(`⚠️ Este término solo cubre ${duration} mes${duration > 1 ? 'es' : ''}. ¿Estás seguro? Quizás querías editar un término existente.`);
                return;
            }
        }

        setPendingShortTermConfirm(false);
        setSaving(true);
        try {
            // First, close the active term if needed
            if (needsToClosePrevious && activeTerm && closeDate) {
                await onTermUpdate(activeTerm.id, {
                    effective_until: closeDate,
                });
            }

            // Then create the new term
            await onTermCreate({
                effective_from: newTerm.effective_from,
                effective_until: newTerm.effective_until,
                amount_original: newTerm.amount_original,
                due_day_of_month: newTerm.due_day_of_month,
                frequency: newTerm.frequency,
                currency_original: newTerm.currency_original,
            });

            setNewTerm(null);
            setShowNewTermForm(false);
            setError(null);
            setSuccessMessage(needsToClosePrevious
                ? `Término creado. V${activeTerm?.version} cerrado en ${closeDate ? formatMonthYear(closeDate) : ''}.`
                : 'Nuevo término creado correctamente'
            );

            // Refresh data to show new term
            if (onRefresh) {
                await onRefresh();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al crear el término');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleCancelNewTerm = () => {
        setNewTerm(null);
        setShowNewTermForm(false);
        setError(null);
        setPendingShortTermConfirm(false);
    };

    // ===== PAUSE FUNCTIONALITY =====

    // Check if the active term can be paused
    // Can pause if: term is open-ended (no effective_until) AND has no installments
    const activeTerm = commitment.active_term;
    const canPause = activeTerm &&
        !activeTerm.effective_until &&
        (!activeTerm.installments_count || activeTerm.installments_count <= 1);

    // Can resume if: term has effective_until (is paused/terminating) AND has no installments
    const canResume = activeTerm &&
        !!activeTerm.effective_until &&
        (!activeTerm.installments_count || activeTerm.installments_count <= 1);

    // Get the minimum valid month for pausing (must be >= effective_from month)
    const getMinPauseMonth = (): string => {
        if (!activeTerm) return '';
        return activeTerm.effective_from.substring(0, 7); // YYYY-MM
    };

    // Initialize pause form
    const handleStartPause = () => {
        setEditingTerm(null);
        setShowNewTermForm(false);
        setNewTerm(null);
        setError(null);

        // Default to current month
        const today = new Date();
        const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const minYM = getMinPauseMonth();

        // Use current month if valid, otherwise use minimum
        setPauseMonth(currentYM >= minYM ? currentYM : minYM);
        setShowPauseForm(true);
    };

    const handleCancelPause = () => {
        setShowPauseForm(false);
        setPauseMonth('');
        setError(null);
    };

    const handleConfirmPause = async () => {
        if (!activeTerm || !pauseMonth) return;

        // Validate month is >= effective_from
        const minYM = getMinPauseMonth();
        if (pauseMonth < minYM) {
            setError(`El mes de pausa debe ser ${formatMonthYear(minYM + '-01')} o posterior`);
            return;
        }

        // Calculate effective_until (last day of selected month)
        const [year, month] = pauseMonth.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        const effectiveUntil = `${pauseMonth}-${String(lastDay).padStart(2, '0')}`;

        setSaving(true);
        try {
            await onTermUpdate(activeTerm.id, {
                effective_until: effectiveUntil,
            });

            setShowPauseForm(false);
            setPauseMonth('');
            setError(null);
            setSuccessMessage(`Compromiso pausado. Último mes activo: ${formatMonthYear(effectiveUntil)}`);

            if (onRefresh) {
                await onRefresh();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al pausar el compromiso');
        } finally {
            setSaving(false);
        }
    };

    // Determine term status for display
    // Three states: active (covers today), scheduled (starts in future), historic (already ended)
    const getTermStatus = (term: Term): 'active' | 'scheduled' | 'historic' => {
        const today = new Date().toLocaleDateString('en-CA');
        const todayYM = today.substring(0, 7);
        const fromYM = term.effective_from.substring(0, 7);

        // 1. If term starts in the future → Programado
        if (fromYM > todayYM) {
            return 'scheduled';
        }

        // 2. If term already ended → Histórico  
        if (term.effective_until) {
            const untilYM = term.effective_until.substring(0, 7);
            if (untilYM < todayYM) {
                return 'historic';
            }
        }

        // 3. Term is currently in effect → Activo
        // (effective_from <= today AND (effective_until >= today OR NULL))
        return 'active';
    };

    if (allTerms.length === 0) {
        return (
            <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                {t('terms.noTerms', 'No hay términos configurados')}
            </div>
        );
    }

    return (
        <div className="space-y-2 relative">
            {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg transition-opacity">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-full shadow-lg">
                        <div className="animate-spin w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full"></div>
                    </div>
                </div>
            )}

            <div className={isLoading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                {/* Title and count row - only if title is shown */}
                {!hideTitle && (
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {t('terms.history', 'Historial Completo')}
                            </h3>
                            <div className="flex gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 tabular-nums">
                                    {Object.values(paymentsByTerm).reduce((acc, list) => acc + list.filter(p => p.payment_date).length, 0)} pagos
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 tabular-nums">
                                    {allTerms.length} término{allTerms.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action buttons row - ALWAYS show when not read-only and conditions are met */}
                {!isReadOnly && (canPause || canResume || onTermCreate) && !showNewTermForm && !showPauseForm && (
                    <div className="flex items-center justify-center gap-3 px-2 py-3 mb-3 bg-slate-100/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/50 dark:border-slate-700/30">
                        {/* Pause Button */}
                        {canPause && (
                            <button
                                type="button"
                                onClick={handleStartPause}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-lg transition-colors shadow-sm"
                            >
                                <Pause className="w-3.5 h-3.5" />
                                {t('terms.pause', 'Pausar')}
                            </button>
                        )}
                        {/* Resume Button */}
                        {canResume && onTermCreate && (
                            <button
                                type="button"
                                onClick={() => {
                                    const endDate = activeTerm?.effective_until;
                                    if (endDate) {
                                        const [endY, endM] = endDate.substring(0, 7).split('-').map(Number);
                                        const nextMonthAfterEnd = endM === 12 ? 1 : endM + 1;
                                        const nextYearAfterEnd = endM === 12 ? endY + 1 : endY;
                                        const afterEndYM = `${nextYearAfterEnd}-${String(nextMonthAfterEnd).padStart(2, '0')}`;
                                        const now = new Date();
                                        const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                                        const resumeYM = afterEndYM >= currentYM ? afterEndYM : currentYM;
                                        const resumeFrom = `${resumeYM}-01`;
                                        setEditingTerm(null);
                                        setShowPauseForm(false);
                                        setError(null);
                                        setNewTerm({
                                            effective_from: resumeFrom,
                                            effective_until: null,
                                            amount_original: activeTerm?.amount_original || 0,
                                            due_day_of_month: activeTerm?.due_day_of_month || null,
                                            frequency: activeTerm?.frequency || 'MONTHLY',
                                            currency_original: activeTerm?.currency_original || 'CLP',
                                        });
                                        setShowNewTermForm(true);
                                    }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 rounded-lg transition-colors shadow-sm"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                {t('terms.resume', 'Reanudar')}
                            </button>
                        )}
                        {/* New Term Button */}
                        {onTermCreate && (
                            <button
                                type="button"
                                onClick={handleStartNewTerm}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/40 hover:bg-sky-200 dark:hover:bg-sky-900/60 rounded-lg transition-colors shadow-sm"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                {t('terms.addNew', 'Nuevo')}
                            </button>
                        )}
                    </div>
                )}

                {/* Success message */}
                {successMessage && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg mb-3">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                            <Check className="w-4 h-4 shrink-0" />
                            <span className="text-sm">{successMessage}</span>
                        </div>
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg mb-3">
                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    </div>
                )}

                {/* Pause Form */}
                {showPauseForm && activeTerm && (
                    <div className="border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl p-3 mb-3 bg-amber-50/50 dark:bg-amber-900/10">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                                <Pause className="w-4 h-4" />
                                Pausar Compromiso
                            </h4>
                            <button
                                type="button"
                                onClick={handleCancelPause}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                Selecciona el <strong>último mes</strong> en que este compromiso estará activo.
                                A partir del mes siguiente, no aparecerá en tus pagos pendientes.
                            </p>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Último mes activo
                                </label>
                                <input
                                    type="month"
                                    value={pauseMonth}
                                    min={getMinPauseMonth()}
                                    onChange={(e) => {
                                        setPauseMonth(e.target.value);
                                        setError(null);
                                    }}
                                    className={formInputClasses}
                                />
                                <p className="text-xs text-slate-400 mt-1">
                                    Mínimo: {formatMonthYear(getMinPauseMonth() + '-01')} (inicio del término)
                                </p>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCancelPause}
                                    className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                    disabled={saving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmPause}
                                    className="px-3 py-1.5 text-sm bg-amber-500 text-white hover:bg-amber-600 rounded-lg transition-colors flex items-center gap-1.5"
                                    disabled={saving || !pauseMonth}
                                >
                                    {saving ? (
                                        <>Pausando...</>
                                    ) : (
                                        <>
                                            <Pause className="w-4 h-4" />
                                            Pausar desde {pauseMonth ? (() => {
                                                const [y, m] = pauseMonth.split('-').map(Number);
                                                const nextMonth = m === 12 ? 1 : m + 1;
                                                const nextYear = m === 12 ? y + 1 : y;
                                                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                                return `${months[nextMonth - 1]} ${nextYear}`;
                                            })() : '...'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* New Term Form */}
                {showNewTermForm && newTerm && (
                    <div className="border-2 border-dashed border-sky-300 dark:border-sky-700 rounded-xl p-3 mb-3 bg-sky-50/50 dark:bg-sky-900/10">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-sky-700 dark:text-sky-300 flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                {t('terms.newTerm', 'Nuevo Término')}
                            </h4>
                            <button
                                type="button"
                                onClick={handleCancelNewTerm}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Effective From */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Desde (mes)
                                </label>
                                <input
                                    type="month"
                                    value={newTerm.effective_from.substring(0, 7)}
                                    onChange={(e) => {
                                        setNewTerm(prev => prev ? { ...prev, effective_from: e.target.value + '-01' } : null);
                                        setPendingShortTermConfirm(false); // Reset confirmation when dates change
                                        setError(null);
                                    }}
                                    className={formInputClasses}
                                />
                            </div>

                            {/* Effective Until */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Hasta (mes)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setNewTerm(prev => prev ? { ...prev, effective_until: prev.effective_until ? null : (new Date().toISOString().slice(0, 7) + '-01') } : null)}
                                        className="text-[10px] font-bold text-sky-500 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer transition-colors"
                                    >
                                        {newTerm.effective_until ? 'Hacer Indefinido' : 'Definir Término'}
                                    </button>
                                </div>

                                {newTerm.effective_until ? (
                                    <input
                                        type="month"
                                        value={newTerm.effective_until.substring(0, 7)}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                const [year, month] = e.target.value.split('-').map(Number);
                                                const lastDay = new Date(year, month, 0).getDate();
                                                setNewTerm(prev => prev ? { ...prev, effective_until: `${e.target.value}-${String(lastDay).padStart(2, '0')}` } : null);
                                            }
                                            setPendingShortTermConfirm(false);
                                            setError(null);
                                        }}
                                        className={formInputClasses}
                                    />
                                ) : (
                                    <div
                                        onClick={() => setNewTerm(prev => prev ? { ...prev, effective_until: (new Date().toISOString().slice(0, 7) + '-01') } : null)}
                                        className="w-full bg-slate-100 dark:bg-slate-700/30 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-md p-2 text-sm text-slate-500 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
                                    >
                                        <span className="flex items-center justify-center gap-1.5">
                                            <span className="text-lg leading-none">∞</span>
                                            <span className="text-xs font-medium">Indefinido (Siempre activo)</span>
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Monto ({newTerm.currency_original})
                                </label>
                                <input
                                    type="number"
                                    value={newTerm.amount_original}
                                    onChange={(e) => setNewTerm(prev => prev ? { ...prev, amount_original: parseFloat(e.target.value) || 0 } : null)}
                                    className={formInputClasses}
                                    min="0"
                                    step="0.01"
                                />
                            </div>

                            {/* Due Day */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Día vencimiento
                                </label>
                                <input
                                    type="number"
                                    value={newTerm.due_day_of_month || ''}
                                    onChange={(e) => setNewTerm(prev => prev ? { ...prev, due_day_of_month: parseInt(e.target.value) || null } : null)}
                                    className={formInputClasses}
                                    min="1"
                                    max="31"
                                    placeholder="1-31"
                                />
                            </div>
                        </div>

                        {/* Save/Cancel buttons */}
                        <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-sky-200 dark:border-sky-800">
                            <button
                                type="button"
                                onClick={handleCancelNewTerm}
                                className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            {pendingShortTermConfirm ? (
                                <button
                                    type="button"
                                    onClick={() => handleSaveNewTerm(true)}
                                    className="px-3 py-1.5 text-sm bg-amber-500 text-white hover:bg-amber-600 rounded-lg transition-colors flex items-center gap-1.5"
                                    disabled={saving}
                                >
                                    <AlertTriangle className="w-4 h-4" />
                                    Sí, crear igual
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => handleSaveNewTerm(false)}
                                    className="px-3 py-1.5 text-sm bg-sky-500 text-white hover:bg-sky-600 rounded-lg transition-colors flex items-center gap-1.5"
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <>Creando...</>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Crear Término
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {allTerms.map((term) => {
                    const isActive = isTermActive(term);
                    const termPayments = paymentsByTerm[term.id] || [];
                    const isExpanded = expandedTermId === term.id;
                    const isEditing = editingTerm?.id === term.id;

                    return (
                        <div
                            key={term.id}
                            className={`
                            border rounded-2xl overflow-hidden transition-all backdrop-blur-sm
                            ${isActive
                                    ? 'border-sky-500/30 bg-sky-950/30'
                                    : 'border-slate-700/50 bg-slate-800/40'
                                }
                            ${isEditing ? 'border-amber-500/50 bg-amber-900/10' : ''}
                        `}
                        >
                            {/* Term Header - Optimized for cleaner look */}
                            <div
                                className={`
                                flex items-center justify-between p-3 cursor-pointer
                                hover:bg-slate-700/30 transition-colors
                            `}
                                onClick={() => !isEditing && toggleExpand(term.id)}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Version badge */}
                                    <div className={`
                                    w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-lg
                                    ${isActive
                                            ? 'bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-sky-500/25'
                                            : 'bg-slate-700 text-slate-400 border border-slate-600/50'
                                        }
                                `}>
                                        V{term.version}
                                    </div>

                                    {/* Date range & Status - Compacted */}
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-white">
                                            <span>{formatMonthYear(term.effective_from)}</span>
                                            <span className="text-sky-500 dark:text-sky-400 mx-1">→</span>
                                            <span>
                                                {term.effective_until
                                                    ? (
                                                        <span>
                                                            {formatMonthYear(term.effective_until)}
                                                            {term.is_divided_amount && term.installments_count && (
                                                                <span className="text-slate-400 text-xs ml-1 font-normal">({term.installments_count} cuotas)</span>
                                                            )}
                                                        </span>
                                                    )
                                                    : (term.installments_count && term.installments_count > 1)
                                                        ? <span className="text-slate-500">{term.installments_count} cuotas</span>
                                                        : <span className="text-sky-500">∞</span>
                                                }
                                            </span>
                                        </div>
                                        {/* Status only, moved payment count to expanded view */}
                                        <div className="text-xs">
                                            {(() => {
                                                const status = getTermStatus(term);

                                                // Check for early termination (Loan cut short)
                                                // Use shared logic for accurate period counting
                                                // We pass [] as payments because we only want the theoretical schedule based on dates
                                                const effectiveInstallments = generateExpectedPeriods(term, commitment, []).length;

                                                const isEarlyTerm = term.installments_count
                                                    ? term.installments_count > effectiveInstallments
                                                    : false;

                                                const EarlyTermBadge = () => (
                                                    <span className="text-rose-500 font-bold text-[10px] uppercase tracking-tight bg-rose-50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded-md border border-rose-100 dark:border-rose-800 ml-1 whitespace-nowrap">
                                                        Término Anticipado ({effectiveInstallments}/{term.installments_count})
                                                    </span>
                                                );

                                                switch (status) {
                                                    case 'active':
                                                        return (
                                                            <div className="flex items-center flex-wrap gap-1">
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                                                    Activo actualmente
                                                                </span>
                                                                {isEarlyTerm && <EarlyTermBadge />}
                                                            </div>
                                                        );
                                                    case 'scheduled':
                                                        return (
                                                            <div className="flex items-center flex-wrap gap-1">
                                                                <span className="text-sky-600 dark:text-sky-400 font-medium">
                                                                    Programado
                                                                </span>
                                                                {isEarlyTerm && <EarlyTermBadge />}
                                                            </div>
                                                        );
                                                    default:
                                                        return (
                                                            <span className="text-slate-400 flex items-center gap-1.5 flex-wrap">
                                                                Inactivo
                                                                {isEarlyTerm && <EarlyTermBadge />}
                                                            </span>
                                                        );
                                                }
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Amount & actions */}
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-white tabular-nums">
                                            {/* Logic: if is_divided_amount, calculated monthly installment. Else, show original amount */}
                                            {(() => {
                                                const amountToShow = (term.is_divided_amount && term.installments_count)
                                                    ? (term.amount_original / term.installments_count)
                                                    : term.amount_original;

                                                return term.currency_original === 'CLP'
                                                    ? formatClp(amountToShow)
                                                    : `${term.currency_original} ${amountToShow.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                                            })()}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-col items-end">
                                            <span>
                                                {term.is_divided_amount
                                                    ? 'mensual'
                                                    : t(`frequency.${term.frequency.toLowerCase()}`, term.frequency)
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    {!isReadOnly && !isEditing && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStartEdit(term);
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {termPayments.length === 0 && allTerms.length > 1 && onTermDelete && (
                                                <button
                                                    type="button"
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        // Confirm before strict delete (only allowed for terms with NO payments)
                                                        if (confirm('¿Eliminar este término histórico?')) onTermDelete(term.id);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {!isEditing && (
                                        <div className="text-slate-400">
                                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Edit Form */}
                            {isEditing && editingTerm && (
                                <div className="px-3 pb-3 border-t border-amber-500/20 dark:border-amber-500/10 pt-3 space-y-4" onClick={e => e.stopPropagation()}>
                                    {/* Dates Row */}
                                    <div className="grid grid-cols-2 gap-6">
                                        {/* Desde */}
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                                Desde
                                            </label>
                                            <input
                                                type="month"
                                                value={editingTerm.effective_from.substring(0, 7)}
                                                onChange={(e) => setEditingTerm(prev => prev ? { ...prev, effective_from: e.target.value + '-01' } : null)}
                                                className={`${formInputClasses} w-full`}
                                            />
                                        </div>

                                        {/* Hasta */}
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                                Hasta
                                            </label>
                                            {editingTerm.effective_until ? (
                                                <input
                                                    type="month"
                                                    value={editingTerm.effective_until.substring(0, 7)}
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            const [y, m] = e.target.value.split('-').map(Number);
                                                            const lastDay = new Date(y, m, 0).getDate();
                                                            setEditingTerm(prev => prev ? { ...prev, effective_until: `${e.target.value}-${String(lastDay).padStart(2, '0')}` } : null);
                                                        }
                                                    }}
                                                    className={`${formInputClasses} w-full`}
                                                />
                                            ) : (
                                                <div className={`${formInputClasses} w-full flex items-center justify-center gap-2 text-slate-400`}>
                                                    <span className="text-lg">∞</span>
                                                    <span className="text-xs">Sin límite</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Toggle for Indefinite - Clean switch below dates */}
                                    <div className="flex items-center justify-between py-2 px-3 bg-slate-100/50 dark:bg-slate-800/30 rounded-lg">
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                            {editingTerm.effective_until ? 'Tiene fecha de término' : 'Sin fecha de término (indefinido)'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setEditingTerm(prev => prev ? {
                                                ...prev,
                                                effective_until: prev.effective_until ? null : (new Date().toISOString().slice(0, 7) + '-01'),
                                                // STRICT: If switching to indefinite (null), MUST clear divided status and quarters
                                                is_divided_amount: prev.effective_until ? false : prev.is_divided_amount,
                                                installments_count: prev.effective_until ? null : prev.installments_count
                                            } : null)}
                                            className={`
                                                relative w-11 h-6 rounded-full transition-colors
                                                ${editingTerm.effective_until
                                                    ? 'bg-slate-300 dark:bg-slate-600'
                                                    : 'bg-sky-500'
                                                }
                                            `}
                                        >
                                            <span className={`
                                                absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform
                                                ${editingTerm.effective_until ? 'left-0.5' : 'left-[22px]'}
                                            `} />
                                        </button>
                                    </div>

                                    {/* Amount and Due Day Row - Always 2 columns */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Monto</label>
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                value={editingTerm.amount_original.toLocaleString('es-CL')}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/\D/g, '');
                                                    setEditingTerm(prev => prev ? { ...prev, amount_original: parseFloat(raw) || 0 } : null);
                                                }}
                                                className={`${formInputClasses} w-full`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Día vencimiento</label>
                                            <input
                                                type="number"
                                                value={editingTerm.due_day_of_month || ''}
                                                onChange={(e) => setEditingTerm(prev => prev ? { ...prev, due_day_of_month: parseInt(e.target.value) || null } : null)}
                                                className={`${formInputClasses} w-full`}
                                                min="1"
                                                max="31"
                                                placeholder="1-31"
                                            />
                                        </div>
                                    </div>

                                    {/* Buttons - Full width on mobile */}
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={handleCancelEdit}
                                            className="w-full px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveEdit}
                                            className="w-full px-3 py-2.5 text-sm font-medium bg-sky-500 text-white hover:bg-sky-600 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            {saving ? 'Guardando...' : <><Check className="w-4 h-4" /> Guardar</>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Expanded Details - OPTIMIZED LAYOUT */}
                            {isExpanded && !isEditing && (
                                <div className="bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-200 dark:border-slate-700">
                                    {/* Info Grid - Bento Style Cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 p-3 bg-slate-100/50 dark:bg-slate-800/30 rounded-xl mx-2 mt-2 border border-slate-200 dark:border-slate-700/50">
                                        {/* Item 1: Moneda */}
                                        <div className="flex flex-col gap-0.5 p-2">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Moneda</span>
                                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-semibold text-sm">
                                                <DollarSign className="w-3.5 h-3.5 text-sky-500" />
                                                <span>{term.currency_original}</span>
                                            </div>
                                        </div>
                                        {/* Item 2: Duración/Cuotas */}
                                        <div className="flex flex-col gap-0.5 p-2 border-l border-slate-200 dark:border-slate-700/50">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Duración</span>
                                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-semibold text-sm">
                                                <Hash className="w-3.5 h-3.5 text-sky-500" />
                                                <span>{(() => {
                                                    // If has installments count, show that
                                                    if (term.installments_count) {
                                                        return `${term.installments_count} ${term.is_divided_amount ? 'cuot.' : 'pagos'}`;
                                                    }
                                                    // If has effective_until, calculate duration in months
                                                    if (term.effective_until) {
                                                        const from = new Date(term.effective_from);
                                                        const until = new Date(term.effective_until);
                                                        const months = (until.getFullYear() - from.getFullYear()) * 12 +
                                                            (until.getMonth() - from.getMonth()) + 1;
                                                        return `${months} meses`;
                                                    }
                                                    // Truly indefinite
                                                    return '∞';
                                                })()}</span>
                                            </div>
                                        </div>
                                        {/* Item 3: Día Vencimiento */}
                                        <div className="flex flex-col gap-0.5 p-2 border-l border-slate-200 dark:border-slate-700/50">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Día Pago</span>
                                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-semibold text-sm">
                                                <Calendar className="w-3.5 h-3.5 text-sky-500" />
                                                <span>Día {term.due_day_of_month || '1'}</span>
                                            </div>
                                        </div>
                                        {/* Item 4: Deuda Total (solo para cuotas) */}
                                        {term.is_divided_amount && term.amount_original && (
                                            <div className="flex flex-col gap-0.5 p-2 border-l border-slate-200 dark:border-slate-700/50">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Deuda Total</span>
                                                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm tabular-nums">
                                                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                                                    {term.currency_original === 'CLP'
                                                        ? formatClp(term.amount_original)
                                                        : `${term.currency_original} ${term.amount_original.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="px-3 py-2">
                                        {(() => {
                                            // 1. Generate ALL expected periods for this term using CENTRALIZED logic
                                            const expectedPeriods: PaymentWithDetails[] = generateExpectedPeriods(
                                                term,
                                                commitment,
                                                termPayments
                                            );



                                            const filteredPayments = expectedPeriods.filter(p => {
                                                // Always respect filter selection (scroll mode only affects UI behavior, not filtering)
                                                if (paymentFilter === 'paid') return !!p.payment_date;
                                                if (paymentFilter === 'pending') return !p.payment_date;
                                                return true;
                                            });

                                            // 3. Sort Descending (Newest date first)
                                            filteredPayments.sort((a, b) => b.period_date.localeCompare(a.period_date));

                                            return (
                                                <>
                                                    <div className="flex flex-wrap items-center justify-between mb-2 px-1 gap-y-2">
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                                                Pagos
                                                                <span className="flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full w-5 h-5 text-xs ml-1">
                                                                    {termPayments.filter(p => p.payment_date).length}
                                                                </span>
                                                            </h4>
                                                            {/* Mini Filters / Navigation Anchors */}
                                                            <div className="flex bg-slate-800/60 backdrop-blur-sm rounded-xl p-0.5 gap-0.5 border border-slate-700/50 overflow-x-auto max-w-full">
                                                                {(['all', 'paid', 'pending'] as const).map((filterType) => {
                                                                    const isActive = paymentFilter === filterType;
                                                                    const labels = { all: 'Todos', paid: 'Pagados', pending: 'Pendientes' };
                                                                    const activeStyles = {
                                                                        all: 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30',
                                                                        paid: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30',
                                                                        pending: 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                                                                    };

                                                                    return (
                                                                        <button
                                                                            key={filterType}
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setPaymentFilter(filterType);
                                                                                if (useScrollNavigation) {
                                                                                    const list = document.getElementById(`payment-list-${term.id}`);
                                                                                    if (filterType === 'paid') {
                                                                                        const firstPaid = list?.querySelector('[data-payment-status="paid"]');
                                                                                        if (firstPaid && list) {
                                                                                            const topPos = (firstPaid as HTMLElement).offsetTop - list.offsetTop;
                                                                                            list.scrollTo({ top: topPos, behavior: 'smooth' });
                                                                                        }
                                                                                    } else {
                                                                                        list?.scrollTo({ top: 0, behavior: 'smooth' });
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className={`
                                                                                relative px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap
                                                                                ${isActive
                                                                                    ? activeStyles[filterType]
                                                                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                                                                }
                                                                            `}
                                                                        >
                                                                            {labels[filterType]}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        {/* Show count only if NOT in scroll navigation mode (as it's redundant there) */}
                                                        {!useScrollNavigation && (
                                                            <span className="text-[10px] text-slate-400">Viendo {filteredPayments.length}</span>
                                                        )}
                                                    </div>

                                                    <div
                                                        id={`payment-list-${term.id}`}
                                                        className="space-y-0.5 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar scroll-smooth"
                                                    >
                                                        {filteredPayments.length > 0 ? (() => {
                                                            // Calculate current month once for all payments
                                                            const today = new Date();
                                                            const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

                                                            return filteredPayments.map(payment => {
                                                                const isPaid = !!payment.payment_date;
                                                                const periodYM = payment.period_date.substring(0, 7);
                                                                // Overdue = not paid AND period is before current month
                                                                const isOverdue = !isPaid && periodYM < currentYM;
                                                                // Status for styling: 'paid' | 'overdue' | 'pending'
                                                                const status = isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending';

                                                                return (
                                                                    <div
                                                                        key={payment.id}
                                                                        data-payment-status={status}
                                                                        onClick={() => onPaymentClick?.(payment.period_date)}
                                                                        className={`relative flex items-center justify-between text-sm py-2 pl-4 pr-3 rounded-lg border shadow-sm transition-all overflow-hidden ${onPaymentClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99]' : ''} ${isPaid
                                                                            ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-emerald-200'
                                                                            : isOverdue
                                                                                ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800/50 hover:border-rose-300'
                                                                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 hover:border-amber-200'
                                                                            }`}
                                                                    >
                                                                        {/* Status accent bar */}
                                                                        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${isPaid ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-amber-400'
                                                                            }`} />
                                                                        <div className="flex items-center gap-3">
                                                                            <span className={`font-medium whitespace-nowrap min-w-[70px] ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
                                                                                {formatMonthYear(payment.period_date)}
                                                                            </span>
                                                                            {isPaid ? (
                                                                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                                                                    <Check className="w-3 h-3" />
                                                                                    <span>
                                                                                        {payment.payment_date?.substring(8, 10)}/
                                                                                        {payment.payment_date?.substring(5, 7)}/
                                                                                        {payment.payment_date?.substring(0, 4)}
                                                                                    </span>
                                                                                </span>
                                                                            ) : isOverdue ? (
                                                                                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                                                                                    <AlertTriangle className="w-3 h-3" />
                                                                                    <span>Vencido</span>
                                                                                </span>
                                                                            ) : (
                                                                                <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
                                                                                    <Clock className="w-3 h-3" />
                                                                                    <span>Pendiente</span>
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className={`font-bold tabular-nums ${isPaid
                                                                            ? 'text-emerald-400'
                                                                            : isOverdue
                                                                                ? 'text-rose-400'
                                                                                : 'text-slate-500 opacity-75'
                                                                            }`}>
                                                                            {payment.currency_original === 'CLP'
                                                                                ? formatClp(payment.amount_original)
                                                                                : `${payment.currency_original} ${payment.amount_original.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                );
                                                            });
                                                        })() : (
                                                            <div className="py-8 text-center text-xs text-slate-400 italic">
                                                                No hay pagos {paymentFilter === 'all' ? '' : paymentFilter} en este período.
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TermsListView;
