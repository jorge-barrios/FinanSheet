/**
 * CommitmentForm v2
 * 
 * Simplified form for creating/editing commitments and their initial term.
 * Uses v2 data model: Commitment → Term → Payments
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import '../styles/commitmentFormAnimations.css';
import { useLocalization } from '../hooks/useLocalization';
import { useCurrency } from '../hooks/useCurrency';
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, StarIcon } from './icons';
import { Infinity, CalendarCheck, Hash, History, ChevronDown, ChevronUp, Link as LinkIcon } from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { es } from 'date-fns/locale/es';

registerLocale('es', es);
import {
    FlowType,
    Frequency,
} from '../types.v2';
import { TermsListView } from './TermsListView';
import { TermService, PaymentService } from '../services/dataService.v2';
import type { Term, Payment } from '../types.v2';
// import { getPerPeriodAmount } from '../utils/financialUtils.v2';
import type {
    CommitmentFormData,
    TermFormData,
    CommitmentWithTerm
} from '../types.v2';
import type { Category } from '../services/categoryService.v2';

interface SaveOptions {
    skipTermProcessing?: boolean; // When true, wrapper should only update commitment metadata
    currentActiveTermId?: string; // The actual current active term ID (may differ from props)
}

interface CommitmentFormV2Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (commitment: CommitmentFormData, term: TermFormData, options?: SaveOptions) => Promise<void>;
    categories: Category[];
    commitmentToEdit: CommitmentWithTerm | null;
    existingCommitments?: CommitmentWithTerm[];
    onCategoriesChange?: () => void;
    openWithPauseForm?: boolean;
    openWithResumeForm?: boolean;
    onCommitmentUpdated?: () => void;
    onPaymentClick?: (commitment: CommitmentWithTerm, periodDate: string) => void;
}

const formInputClasses = "w-full h-[46px] bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl px-4 py-3 text-[15px] focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all duration-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 backdrop-blur-xl shadow-sm";
const formLabelClasses = "block text-xs font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 ml-1";
const formSelectClasses = `${formInputClasses} appearance-none cursor-pointer pr-10`;

export const CommitmentFormV2: React.FC<CommitmentFormV2Props> = ({
    isOpen,
    onClose,
    onSave,
    categories,
    existingCommitments = [],
    // onCategoriesChange,
    openWithPauseForm,
    openWithResumeForm,
    onCommitmentUpdated,
    onPaymentClick,
    commitmentToEdit
}) => {
    const { t } = useLocalization();
    const { fromUnit, convertAmount } = useCurrency();
    // Use local date (not UTC) to avoid timezone issues
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone

    // Commitment fields
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [flowType, setFlowType] = useState<FlowType>(FlowType.EXPENSE);
    const [isImportant, setIsImportant] = useState(false);
    // Linking
    const [linkedCommitmentId, setLinkedCommitmentId] = useState<string | null>(null);
    const [notes, setNotes] = useState('');

    // Find if another commitment links TO this one (for bidirectional display)
    const linkedFromCommitment = existingCommitments.find(
        c => c.linked_commitment_id === commitmentToEdit?.id
    );
    // The effective linked commitment (either we link to them, or they link to us)
    const effectiveLinkedId = linkedCommitmentId || linkedFromCommitment?.id || null;
    const effectiveLinkedCommitment = effectiveLinkedId
        ? existingCommitments.find(c => c.id === effectiveLinkedId)
        : null;

    // Track which field was last manually edited to prevent auto-calc interference
    const [lastEditedField, setLastEditedField] = useState<'installments' | 'endDate' | null>(null);

    // Term fields
    const [frequency, setFrequency] = useState<Frequency>(Frequency.MONTHLY);
    const [amount, setAmount] = useState('');
    const [displayAmount, setDisplayAmount] = useState(''); // For CLP formatting
    const [currency, setCurrency] = useState<'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM'>('CLP');

    // Base CLP value for accurate conversions (Opción A)
    const [baseCLP, setBaseCLP] = useState<number | null>(null);

    const [dueDay, setDueDay] = useState('1');
    const [startDate, setStartDate] = useState(today);

    // Duration type: 'recurring' (indefinite), 'endsOn' (specific date), 'installments' (N payments)
    type DurationType = 'recurring' | 'endsOn' | 'installments';
    const [durationType, setDurationType] = useState<DurationType>('recurring');
    const [endDate, setEndDate] = useState('');
    const [installments, setInstallments] = useState('');

    // Derived: keep isOngoing for backward compatibility with save logic
    const isOngoing = durationType === 'recurring';

    // Loading state
    const [saving, setSaving] = useState(false);
    const [shakeField, setShakeField] = useState<string | null>(null);
    const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);

    // Terms section state (for editing existing commitments)
    // Auto-expand when editing commitment with multiple terms
    const [showTermsHistory, setShowTermsHistory] = useState(false);

    // Auto-expand terms history when commitment has multiple terms OR is paused OR openWithPauseForm
    // Auto-expand terms history when commitment has multiple terms OR is paused OR openWithPauseForm
    useEffect(() => {
        // Prioritize explicit open flags
        if (openWithPauseForm || openWithResumeForm) {
            setShowTermsHistory(true);
            return;
        }

        if (commitmentToEdit) {
            const hasMultipleTerms = (commitmentToEdit.all_terms?.length || 0) > 1;
            const isPaused = !!commitmentToEdit.active_term?.effective_until;
            if (hasMultipleTerms || isPaused) {
                setShowTermsHistory(true);
            }
        }
    }, [commitmentToEdit, openWithPauseForm, openWithResumeForm]);
    const [termPayments, setTermPayments] = useState<Payment[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(false);

    // Detect if editing a terminated/paused commitment (has effective_until in the past)
    const isTerminated = (() => {
        if (!commitmentToEdit?.active_term?.effective_until) return false;
        const endDateObj = new Date(commitmentToEdit.active_term.effective_until);
        const todayObj = new Date(today);
        return endDateObj < todayObj;
    })();



    // Detect if commitment has multiple terms (history) - if so, term fields should be read-only
    const hasTermsHistory = commitmentToEdit && (commitmentToEdit.all_terms?.length || 0) > 1;

    // Show terms section ALWAYS if we are editing a commitment (allows viewing payment history)
    const shouldShowTermsSection = !!commitmentToEdit;

    // When editing existing commitment: term fields are disabled unless reactivating
    // Also disable if manually showing terms history (e.g. for pausing)
    const termFieldsDisabled = (commitmentToEdit && !isTerminated && hasTermsHistory) || showTermsHistory;

    // isActive state - for toggling pause/resume (only for editing)
    const [isActive, setIsActive] = useState(!isTerminated);

    // Flag to skip auto-calculation during initial load of edit data
    const isInitialLoadRef = useRef(false);

    // Form ref para poder hacer submit desde los botones X
    const formRef = useRef<HTMLFormElement>(null);

    // Format CLP with thousand separators
    const formatCLPInput = (value: string): string => {
        if (!value) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(num);
    };

    // Convert amount when switching currency (using centralized convertAmount)
    const handleCurrencyChange = (newCurrency: typeof currency) => {
        if (!newCurrency || newCurrency === currency) {
            setCurrency(newCurrency);
            return;
        }

        const prevCurrency = currency;

        // Convert amount using centralized convertAmount
        if (amount) {
            const amt = parseFloat(amount);
            if (!isNaN(amt) && amt > 0) {
                const converted = convertAmount(amt, prevCurrency, newCurrency);

                if (converted > 0) {
                    const newAmountStr = converted.toString();
                    setAmount(newAmountStr);
                    // Update display format
                    setDisplayAmount(newCurrency === 'CLP' ? formatCLPInput(newAmountStr) : newAmountStr);
                }
            }
        }

        setCurrency(newCurrency);
    };

    // Set default category
    useEffect(() => {
        if (categories.length > 0 && !categoryId) {
            setCategoryId(categories[0].id);
        }
    }, [categories, categoryId]);

    // Local copy of commitment that can be updated when terms change
    const [localCommitment, setLocalCommitment] = useState<CommitmentWithTerm | null>(null);

    // Use local copy if available, otherwise use prop
    const effectiveCommitment = localCommitment || commitmentToEdit;

    // Sync local commitment with prop when it changes
    useEffect(() => {
        setLocalCommitment(commitmentToEdit);
    }, [commitmentToEdit]);

    // Detect if ANY data has changed (metadata OR term fields when editable)
    const hasChanges = useMemo(() => {
        // New commitment case - always allow save
        if (!commitmentToEdit) return true;

        // Compare current form values with original commitment
        const originalName = commitmentToEdit.name || '';
        const originalCategoryId = commitmentToEdit.category_id;
        const originalFlowType = commitmentToEdit.flow_type;
        const originalIsImportant = commitmentToEdit.is_important || false;
        const originalNotes = commitmentToEdit.notes || '';
        const originalLinkedId = commitmentToEdit.linked_commitment_id || null;

        // Check if any metadata field has changed
        const nameChanged = name !== originalName;
        const categoryChanged = categoryId !== originalCategoryId;
        const flowTypeChanged = flowType !== originalFlowType;
        const importantChanged = isImportant !== originalIsImportant;
        const notesChanged = notes !== originalNotes;

        // Special handling for linked ID changes (including __UNLINK__)
        const linkedChanged = (() => {
            if (linkedCommitmentId === '__UNLINK__') return !!originalLinkedId; // unlinking when there was a link
            return linkedCommitmentId !== originalLinkedId;
        })();

        const metadataChanged = nameChanged || categoryChanged || flowTypeChanged || importantChanged || notesChanged || linkedChanged;

        if (metadataChanged) return true;

        // If term fields are editable, check for term changes
        if (!termFieldsDisabled && commitmentToEdit.active_term) {
            const t = commitmentToEdit.active_term;

            // Amount
            const amountVal = parseFloat(amount);
            const amountChanged = !isNaN(amountVal) && Math.abs(amountVal - t.amount_original) > 0.001;

            // Currency & Frequency & Dates
            const currencyChanged = currency !== t.currency_original;
            const frequencyChanged = frequency !== t.frequency;
            const startChanged = startDate !== t.effective_from;
            const dueDayChanged = parseInt(dueDay) !== t.due_day_of_month;

            // End Date / Duration logic
            // Simplified: if current form implies a different effective_until than the stored one
            let formEffectiveUntil: string | null = null;
            if (durationType === 'endsOn' && endDate) formEffectiveUntil = endDate;
            // Note: installments duration calculates effective_until in backend trigger, 
            // but for UI dirty check we mainly care if user changed explicit end date or type.

            const originalEffectiveUntil = t.effective_until;
            const endDateChanged = formEffectiveUntil !== originalEffectiveUntil;

            // Installments count
            const installmentsVal = installments ? parseInt(installments) : null;
            const originalInstallments = t.installments_count;
            const installmentsChanged = installmentsVal !== originalInstallments;

            return amountChanged || currencyChanged || frequencyChanged || startChanged || dueDayChanged || endDateChanged || installmentsChanged;
        }

        return false;
    }, [commitmentToEdit, name, categoryId, flowType, isImportant, notes, linkedCommitmentId,
        termFieldsDisabled, amount, currency, frequency, startDate, dueDay, durationType, endDate, installments]);

    // Load payments when terms history is expanded
    useEffect(() => {
        if (showTermsHistory && effectiveCommitment && termPayments.length === 0 && !loadingPayments) {
            loadPayments();
        }
    }, [showTermsHistory, effectiveCommitment]);

    // Reload commitment data (terms) from the database
    const reloadCommitmentData = async () => {
        if (!commitmentToEdit) return;
        try {
            const terms = await TermService.getTerms(commitmentToEdit.id);
            // Sort by version DESC to get active term first
            const sortedTerms = [...terms].sort((a, b) => b.version - a.version);
            const activeTerm = sortedTerms[0] || null;

            setLocalCommitment({
                ...commitmentToEdit,
                active_term: activeTerm,
                all_terms: sortedTerms,
            });
        } catch (error) {
            console.error('Error reloading commitment data:', error);
        }
    };

    const loadPayments = async () => {
        if (!effectiveCommitment) return;
        setLoadingPayments(true);
        try {
            const payments = await PaymentService.getPayments(effectiveCommitment.id);
            setTermPayments(payments);
        } catch (error) {
            console.error('Error loading payments:', error);
        } finally {
            setLoadingPayments(false);
        }
    };

    // Handler for term updates from TermsListView
    const handleTermUpdate = async (termId: string, updates: Partial<Term>) => {
        // This throws on error, which TermsListView catches and displays
        const result = await TermService.updateTerm(termId, updates);
        if (!result) {
            throw new Error('No se pudo actualizar el término');
        }
        // Reload commitment data (terms) and payments
        await reloadCommitmentData();
        await loadPayments();
        onCommitmentUpdated?.();
    };

    // Handler for creating new terms from TermsListView
    const handleTermCreate = async (termData: Partial<Term>) => {
        if (!commitmentToEdit) return;
        await TermService.createTerm(commitmentToEdit.id, termData as any);
        // Reload commitment data (terms) and payments
        await reloadCommitmentData();
        await loadPayments();
        onCommitmentUpdated?.();
    };

    // Handler for deleting terms from TermsListView
    const handleTermDelete = async (termId: string) => {
        // Smart Undo Logic:
        // If deleting the most recent term, and it immediately follows the previous one (no gap),
        // offer to reopen the previous term (remove effective_until) to restore continuity.
        const terms = effectiveCommitment?.all_terms || [];
        const termIndex = terms.findIndex(t => t.id === termId);
        let termToReopenId: string | null = null;

        // Only if deleting the most recent term (index 0) AND there is a previous term
        if (termIndex === 0 && terms.length > 1) {
            const currentTerm = terms[0];
            const prevTerm = terms[1];

            if (prevTerm.effective_until) {
                const prevEndVals = prevTerm.effective_until.split('-').map(Number); // [YYYY, MM, DD]
                const prevEndDate = new Date(prevEndVals[0], prevEndVals[1] - 1, 1); // 1st of end month

                // Next month of previous term
                prevEndDate.setMonth(prevEndDate.getMonth() + 1);
                const nextMonthYM = `${prevEndDate.getFullYear()}-${String(prevEndDate.getMonth() + 1).padStart(2, '0')}`;

                const currentStartYM = currentTerm.effective_from.substring(0, 7);

                // Use strict continuity: current starts exactly next month or same month
                if (currentStartYM <= nextMonthYM) {
                    if (confirm(`El término anterior (V${prevTerm.version}) termina en ${prevTerm.effective_until}.\n\n¿Desea reabrirlo (quitar fecha de fin) para mantener la continuidad?`)) {
                        termToReopenId = prevTerm.id;
                    }
                }
            }
        }

        try {
            // CRITICAL: Delete the current term FIRST to avoid overlap collision
            await TermService.deleteTerm(termId);

            // Then reopen the previous term if requested
            if (termToReopenId) {
                try {
                    await TermService.updateTerm(termToReopenId, { effective_until: null });
                } catch (e) {
                    console.error('Error reopening previous term', e);
                    // Non-blocking error, user can manually fix
                    alert('El término se eliminó, pero hubo un error al reabrir el anterior. Por favor edítalo manualmente.');
                }
            }

            // Reload commitment data (terms) and payments
            await reloadCommitmentData();
            await loadPayments();
            onCommitmentUpdated?.();
        } catch (e) {
            console.error('Error deleting term', e);
            alert('Error eliminando el término');
        }
    };

    // Callback for TermsListView to refresh data
    const handleRefresh = async () => {
        await reloadCommitmentData();
        await loadPayments();
    };

    // Load edit data - CommitmentWithTerm has fields directly + active_term
    // Load edit data - CommitmentWithTerm has fields directly + active_term
    useEffect(() => {
        if (!isOpen) return;

        if (commitmentToEdit) {
            // CommitmentWithTerm extends Commitment, so fields are directly on the object
            setName(commitmentToEdit.name || '');
            setCategoryId(commitmentToEdit.category_id);
            setFlowType(commitmentToEdit.flow_type);
            setIsImportant(commitmentToEdit.is_important || false);
            setNotes(commitmentToEdit.notes || '');
            setLinkedCommitmentId(commitmentToEdit.linked_commitment_id || null);

            // active_term contains term data
            const term = commitmentToEdit.active_term;
            if (term) {
                // Set flag to skip auto-calculation during this load
                isInitialLoadRef.current = true;

                setFrequency(term.frequency);
                const amountValue = term.amount_original?.toString() || '';
                setAmount(amountValue);
                // Also set displayAmount for the input field
                const currencyValue = (term.currency_original as typeof currency) || 'CLP';
                if (currencyValue === 'CLP' && amountValue) {
                    setDisplayAmount(formatCLPInput(amountValue));
                } else {
                    setDisplayAmount(amountValue);
                }
                setCurrency(currencyValue);
                setDueDay(term.due_day_of_month?.toString() || '1');
                setStartDate(term.effective_from || today);
                // Set duration type based on term data
                if (term.is_divided_amount && term.installments_count && term.installments_count > 0) {
                    setDurationType('installments');
                } else if (term.installments_count && term.installments_count > 0) {
                    setDurationType('endsOn');
                } else if (!term.effective_until) {
                    setDurationType('recurring');
                } else {
                    setDurationType('endsOn');
                }
                setEndDate(term.effective_until || '');
                setInstallments(term.installments_count?.toString() || '');

                // Set isActive based on whether commitment is paused
                const isPaused = term.effective_until && new Date(term.effective_until) < new Date(today);
                setIsActive(!isPaused);

                setTimeout(() => {
                    isInitialLoadRef.current = false;
                }, 600);
            }
        } else {
            // RESET FORM FOR NEW COMMITMENT
            setName('');
            // Reset category to first available if needed, or null to force selection logic
            if (categories.length > 0) {
                setCategoryId(categories.find(c => c.name === 'General')?.id || categories[0].id);
            } else {
                setCategoryId(null);
            }
            setFlowType(FlowType.EXPENSE);
            setIsImportant(false);
            setNotes('');
            setLinkedCommitmentId(null);

            setFrequency('MONTHLY' as Frequency);
            setAmount('');
            setDisplayAmount('');
            setCurrency('CLP');

            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            setStartDate(todayStr); // Reset to today
            setDueDay(now.getDate().toString()); // Reset to today's day

            setDurationType('recurring');
            setEndDate('');
            setInstallments('');
            setLastEditedField(null);
            setIsActive(true);
            setShowTermsHistory(false);
        }
    }, [commitmentToEdit, isOpen]);

    // ============================================================================
    // DEBOUNCED AUTO-CALCULATION (500ms delay to prevent loops and give live feedback)
    // ============================================================================

    // Debounce refs for cleanup
    const debounceStartDateRef = useRef<NodeJS.Timeout | null>(null);
    const debounceInstallmentsRef = useRef<NodeJS.Timeout | null>(null);
    const debounceEndDateRef = useRef<NodeJS.Timeout | null>(null);

    // Helper: Get the effective start date considering due day
    // If start day > due day, first payment is next month
    const getEffectiveStartDate = (start: string, dueDayNum: number): { date: string; adjusted: boolean } => {
        const [year, month, day] = start.split('-').map(Number);

        if (day > dueDayNum) {
            // Move to next month
            const totalMonths = year * 12 + month; // month is already 1-indexed
            const newYear = Math.floor(totalMonths / 12);
            const newMonth = (totalMonths % 12) + 1;
            return {
                date: `${newYear}-${String(newMonth).padStart(2, '0')}-01`,
                adjusted: true
            };
        }

        return { date: start, adjusted: false };
    };

    // Helper function to calculate endDate from startDate + installments
    // Considers due day: if start day > due day, first cuota is next month
    const calculateEndDate = (start: string, count: number, freq: string, dueDayNum: number): string => {
        // Get effective start considering due day
        const { date: effectiveStart } = getEffectiveStartDate(start, dueDayNum);

        // Parse YYYY-MM-DD and work with year/month/day directly
        const [startYear, startMonth, startDay] = effectiveStart.split('-').map(Number);

        let monthsToAdd = 0;
        switch (freq) {
            case 'MONTHLY': monthsToAdd = count - 1; break;
            case 'BIMONTHLY': monthsToAdd = (count - 1) * 2; break;
            case 'QUARTERLY': monthsToAdd = (count - 1) * 3; break;
            case 'SEMIANNUALLY': monthsToAdd = (count - 1) * 6; break;
            case 'ANNUALLY': monthsToAdd = (count - 1) * 12; break;
            case 'ONCE': monthsToAdd = 0; break;
        }

        // Calculate end year/month
        const totalMonths = startYear * 12 + (startMonth - 1) + monthsToAdd;
        const endYear = Math.floor(totalMonths / 12);
        const endMonth = (totalMonths % 12) + 1;

        // Use day 1 for end date when adjusted, otherwise preserve original day
        return `${endYear}-${String(endMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    };

    // Helper function to calculate installments from startDate + endDate
    const calculateInstallments = (start: string, end: string, freq: string): number => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffTime = endDate.getTime() - startDate.getTime();
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));

        switch (freq) {
            case 'MONTHLY': return Math.max(1, diffMonths + 1);
            case 'BIMONTHLY': return Math.max(1, Math.floor(diffMonths / 2) + 1);
            case 'QUARTERLY': return Math.max(1, Math.floor(diffMonths / 3) + 1);
            case 'SEMIANNUALLY': return Math.max(1, Math.floor(diffMonths / 6) + 1);
            case 'ANNUALLY': return Math.max(1, Math.floor(diffMonths / 12) + 1);
            case 'ONCE': return 1;
            default: return 1;
        }
    };

    // Debounced: When startDate changes → recalculate endDate (keeping installments fixed)
    useEffect(() => {
        if (isInitialLoadRef.current) return;
        if (!installments || !startDate || isOngoing || !frequency) return;

        // Clear previous timer
        if (debounceStartDateRef.current) {
            clearTimeout(debounceStartDateRef.current);
        }

        // Set new timer - after 500ms, recalculate endDate
        debounceStartDateRef.current = setTimeout(() => {
            const count = parseInt(installments);
            if (isNaN(count) || count <= 0) return;

            const dueDayNum = parseInt(dueDay) || 1;
            const newEndDate = calculateEndDate(startDate, count, frequency, dueDayNum);
            if (newEndDate !== endDate) {
                setEndDate(newEndDate);
            }
        }, 500);

        // Cleanup on unmount or before next effect
        return () => {
            if (debounceStartDateRef.current) {
                clearTimeout(debounceStartDateRef.current);
            }
        };
    }, [startDate, dueDay]);

    // Debounced: When installments changes → recalculate endDate
    useEffect(() => {
        if (isInitialLoadRef.current) return;
        if (!installments || !startDate || isOngoing || !frequency) return;
        if (lastEditedField !== 'installments') return;

        // Clear previous timer
        if (debounceInstallmentsRef.current) {
            clearTimeout(debounceInstallmentsRef.current);
        }

        // Set new timer
        debounceInstallmentsRef.current = setTimeout(() => {
            const count = parseInt(installments);
            if (isNaN(count) || count <= 0) return;

            const dueDayNum = parseInt(dueDay) || 1;
            const newEndDate = calculateEndDate(startDate, count, frequency, dueDayNum);
            if (newEndDate !== endDate) {
                setEndDate(newEndDate);
            }
        }, 500);

        return () => {
            if (debounceInstallmentsRef.current) {
                clearTimeout(debounceInstallmentsRef.current);
            }
        };
    }, [installments, lastEditedField]);

    // Debounced: When endDate changes → recalculate installments
    // DISABLED when editing existing commitment (to prevent dividing amount when terminating)
    useEffect(() => {
        if (isInitialLoadRef.current) return;
        if (commitmentToEdit) return; // Skip auto-calc when editing existing commitment
        if (!endDate || !startDate || isOngoing || !frequency) return;
        if (lastEditedField !== 'endDate') return;

        // Clear previous timer
        if (debounceEndDateRef.current) {
            clearTimeout(debounceEndDateRef.current);
        }

        // Set new timer
        debounceEndDateRef.current = setTimeout(() => {
            const calculated = calculateInstallments(startDate, endDate, frequency);
            if (calculated > 0 && calculated.toString() !== installments) {
                setInstallments(calculated.toString());
            }
        }, 500);

        return () => {
            if (debounceEndDateRef.current) {
                clearTimeout(debounceEndDateRef.current);
            }
        };
    }, [endDate, lastEditedField]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Helper to trigger shake animation
        const triggerShake = (fieldName: string) => {
            setShakeField(fieldName);
            setTimeout(() => setShakeField(null), 500);
        };

        // Validación mejorada con shake animation
        if (!name.trim()) {
            triggerShake('name');
            return;
        }

        // Skip term field validation when editing with history (term fields are disabled)
        if (!termFieldsDisabled) {
            if (!amount) {
                triggerShake('amount');
                return;
            }

            // Validar campos de duración según el tipo
            if (durationType === 'endsOn' && !installments) {
                triggerShake('installments');
                return;
            }

            if (durationType === 'installments' && !installments) {
                triggerShake('installments');
                return;
            }
        }

        setSaving(true);

        try {
            // Determine the actual linked commitment ID
            // '__UNLINK__' is a special value that means "remove existing link"
            const actualLinkedId = linkedCommitmentId === '__UNLINK__' ? null : linkedCommitmentId;

            // For bidirectional linking:
            // - If we're setting a new link, both commitments get linked_commitment_id pointing to each other
            // - If we're unlinking, both need to be cleared
            // - link_role is no longer used (NET is calculated automatically based on amounts)
            const commitmentData: CommitmentFormData = {
                name: name.trim(),
                category_id: categoryId,
                flow_type: flowType,
                is_important: isImportant,
                notes: notes.trim(),
                linked_commitment_id: actualLinkedId,
                link_role: null, // No longer used - NET calculation is automatic
            };

            // Pass additional info for bidirectional update via a custom property
            // The wrapper will handle updating the other commitment
            (commitmentData as any).__linkingInfo = {
                newLinkedId: actualLinkedId,
                previousLinkedFromId: linkedFromCommitment?.id || null,
                isUnlinking: linkedCommitmentId === '__UNLINK__',
            };

            // When term fields are disabled, use the existing active term's data
            // This allows saving metadata-only changes (name, category, notes)
            let termData: TermFormData;

            // Use effectiveCommitment (local copy that gets updated after TermsListView changes)
            const currentActiveTerm = effectiveCommitment?.active_term || commitmentToEdit?.active_term;

            if (termFieldsDisabled && currentActiveTerm) {
                // Use existing term data - don't modify term
                const existingTerm = currentActiveTerm;
                termData = {
                    effective_from: existingTerm.effective_from,
                    effective_until: existingTerm.effective_until,
                    frequency: existingTerm.frequency,
                    installments_count: existingTerm.installments_count,
                    due_day_of_month: existingTerm.due_day_of_month,
                    currency_original: existingTerm.currency_original,
                    amount_original: existingTerm.amount_original,
                    fx_rate_to_base: existingTerm.fx_rate_to_base,
                    estimation_mode: existingTerm.estimation_mode,
                    is_divided_amount: existingTerm.is_divided_amount,
                };
            } else {
                // due_day_of_month from dueDay state
                const dueDayNum = parseInt(dueDay) || 1;
                // Note: effective_from is the term start date (not the first payment date)
                // The first payment date calculation (if start day > due day) happens at payment generation time

                console.log('Saving term with startDate:', startDate, 'dueDay:', dueDay);

                // Determinar si hay installments_count (para "Definido" y "En cuotas")
                const hasInstallments = (durationType === 'installments' || durationType === 'endsOn') && installments;
                const installmentsCount = hasInstallments ? parseInt(installments) : null;

                termData = {
                    effective_from: startDate, // Use startDate directly - NO adjustment
                    // Si hay installments_count, el trigger de Supabase calcula effective_until
                    // Solo enviar effective_until para 'recurring' sin límite definido
                    effective_until: hasInstallments ? null : (endDate || null),
                    frequency,
                    // installments_count se guarda para AMBOS: "En cuotas" y "Definido"
                    // Esto permite que el trigger calcule effective_until correctamente
                    installments_count: installmentsCount,
                    due_day_of_month: dueDayNum,
                    currency_original: currency,
                    amount_original: parseFloat(amount),
                    // Calculate fx_rate_to_base: how many CLP per 1 unit of original currency
                    // If baseCLP was set during conversion, use it; otherwise use CurrencyService rate
                    fx_rate_to_base: (() => {
                        const amt = parseFloat(amount);
                        if (amt <= 0) return 1.0;
                        if (currency === 'CLP') return 1.0;
                        if (baseCLP && baseCLP > 0) return baseCLP / amt;
                        // Use CurrencyService to get proper rate (fromUnit returns CLP for 1 unit)
                        return fromUnit(1, currency as any);
                    })(),
                    estimation_mode: null,
                    // is_divided_amount: true SOLO para "En cuotas" (divide el monto total)
                    // false para "Definido" (monto fijo por período)
                    is_divided_amount: durationType === 'installments',
                };
            }

            console.log('[handleSubmit] Saving with:', {
                commitmentData,
                termData,
                termFieldsDisabled,
                currentActiveTermId: effectiveCommitment?.active_term?.id,
            });

            // Pass options to let wrapper know whether to process term changes
            const saveOptions: SaveOptions = {
                // When term fields are disabled, we only want to update commitment metadata
                // The term was already updated via TermsListView or shouldn't be touched
                skipTermProcessing: !!termFieldsDisabled,
                // Pass the actual current active term ID (may have changed via TermsListView)
                currentActiveTermId: effectiveCommitment?.active_term?.id,
            };

            await onSave(commitmentData, termData, saveOptions);
            handleClose();
        } catch (error) {
            console.error('Error saving commitment:', error);
            // Show more detailed error message
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            alert(`Error saving commitment: ${errorMessage}`);
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        // Reset form
        setName('');
        setCategoryId(categories[0]?.id || null);
        setFlowType(FlowType.EXPENSE);
        setIsImportant(false);
        setNotes('');
        setFrequency(Frequency.MONTHLY);
        setAmount('');
        setDisplayAmount(''); // ✅ Reset display amount
        setBaseCLP(null);     // ✅ Reset base CLP
        setCurrency('CLP');
        setDueDay('1');
        setStartDate(today);
        setDurationType('recurring');
        setEndDate('');
        setInstallments('');
        setLinkedCommitmentId(null); // ✅ Reset linked commitment
        setLastEditedField(null);     // ✅ Reset last edited field
        setShowTermsHistory(false);   // ✅ Reset terms history visibility
        setTermPayments([]);          // ✅ Clear loaded payments
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    // Smart close: guarda solo si hay cambios en metadatos o término, si no solo cierra
    const handleSmartClose = () => {
        if (hasChanges && formRef.current) {
            // Hay cambios pendientes - guardar y cerrar
            formRef.current.requestSubmit();
        } else {
            // No hay cambios - solo cerrar
            handleClose();
        }
    };

    if (!isOpen) return null;

    // Dynamic Theme Logic
    const isExpense = flowType === FlowType.EXPENSE;

    // Dynamic classes based on flow type
    const themeClasses = {
        saveBtn: isExpense
            ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-rose-500/30 active:scale-95'
            : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/30 active:scale-95',
        activeTab: isExpense
            ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
            : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20',
        inactiveTab: 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200',
        lightBg: isExpense ? 'bg-rose-50/50 dark:bg-rose-900/10' : 'bg-emerald-50/50 dark:bg-emerald-900/10',
        border: isExpense ? 'border-rose-100 dark:border-rose-900/30' : 'border-emerald-100 dark:border-emerald-900/30',
        text: isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
        iconBg: isExpense ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
        ring: isExpense ? 'focus:ring-rose-500/20' : 'focus:ring-emerald-500/20'
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className={`
                w-full max-w-[600px]
                bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl
                rounded-3xl shadow-2xl shadow-black/50
                border border-white/20 dark:border-slate-800
                flex flex-col
                max-h-[90vh]
                overflow-hidden
                transition-all duration-300 ease-out
                ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}
            `}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-20 sticky top-0">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-none">
                            {commitmentToEdit ? t('form.editCommitment', 'Editar') : t('form.newCommitment', 'Nuevo')}
                        </h2>

                        {/* Integrated Toggle - Same Row */}
                        <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setFlowType(FlowType.EXPENSE)}
                                className={`px-4 py-2 rounded-[6px] text-sm font-bold transition-all flex items-center gap-2 ${flowType === FlowType.EXPENSE ? themeClasses.activeTab : themeClasses.inactiveTab}`}
                            >
                                <ArrowTrendingDownIcon className="w-4 h-4" />
                                {t('form.expense', 'Gasto')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setFlowType(FlowType.INCOME)}
                                className={`px-4 py-2 rounded-[6px] text-sm font-bold transition-all flex items-center gap-2 ${flowType === FlowType.INCOME ? themeClasses.activeTab : themeClasses.inactiveTab}`}
                            >
                                <ArrowTrendingUpIcon className="w-4 h-4" />
                                {t('form.income', 'Ingreso')}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Important Toggle */}
                        <button
                            type="button"
                            onClick={() => setIsImportant(!isImportant)}
                            className={`p-2 rounded-full transition-all ${isImportant
                                ? 'bg-amber-100 text-amber-500 dark:bg-amber-900/30 dark:text-amber-400 ring-2 ring-amber-500/20'
                                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            <StarIcon className={`w-5 h-5 ${isImportant ? 'fill-current' : ''}`} />
                        </button>

                        <button
                            type="button"
                            onClick={onClose} // FIX: Now explicitly closes/discards
                            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition w-9 h-9 flex items-center justify-center hover:text-rose-500"
                        >
                            <span className="text-xl leading-none">&times;</span>
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-5"> {/* Reduced space-y slightly */}

                        {/* 1. Flow Type Tabs REMOVED (Moved to Header) */}

                        {/* 2. Hero Amount Input */}
                        {!termFieldsDisabled && (
                            <div className="flex flex-col items-center justify-center py-1 relative">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Monto</label>
                                <div className="flex items-center gap-2">
                                    {/* Amount Input with $ symbol */}
                                    <div className="flex items-baseline relative flex-1 min-w-0 justify-end">
                                        <span className={`text-2xl sm:text-3xl font-bold mr-1 sm:mr-2 ${themeClasses.text} opacity-50`}>$</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={displayAmount}
                                            onChange={(e) => {
                                                const rawValue = e.target.value;
                                                if (currency === 'CLP') {
                                                    const cleaned = rawValue.replace(/\./g, '');
                                                    if (cleaned === '' || /^\d+$/.test(cleaned)) {
                                                        setAmount(cleaned);
                                                        setDisplayAmount(cleaned ? formatCLPInput(cleaned) : '');
                                                    }
                                                } else {
                                                    if (rawValue === '' || /^\d*\.?\d*$/.test(rawValue)) {
                                                        setAmount(rawValue);
                                                        setDisplayAmount(rawValue);
                                                    }
                                                }
                                                if (baseCLP !== null) setBaseCLP(null);
                                            }}
                                            className={`
                                                bg-transparent border-none p-0 text-right sm:text-center text-4xl sm:text-5xl font-extrabold font-mono tracking-tighter tabular-nums w-full sm:max-w-[280px]
                                                focus:ring-0 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600
                                                ${themeClasses.text}
                                                ${shakeField === 'amount' ? 'animate-shake' : ''}
                                            `}
                                            placeholder="0"
                                            autoFocus={!commitmentToEdit}
                                        />
                                    </div>

                                    {/* Currency Dropdown Selector */}
                                    <div className="relative shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                                            className="group/currency px-2 py-1 sm:px-3 sm:py-1.5 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 hover:from-slate-200 hover:to-slate-100 dark:hover:from-slate-700 dark:hover:to-slate-600 text-slate-700 dark:text-slate-200 text-base sm:text-2xl font-black rounded-xl border-2 border-slate-200 dark:border-slate-600 cursor-pointer outline-none focus:ring-4 focus:ring-sky-500/30 transition-all duration-200 active:scale-95 shadow-lg hover:shadow-xl flex items-center gap-1"
                                        >
                                            <span className="tracking-tight">{currency}</span>
                                            <svg className={`w-4 h-4 opacity-60 group-hover/currency:opacity-100 transition-all duration-200 ${currencyDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        {/* Dropdown Menu */}
                                        {currencyDropdownOpen && (
                                            <div className="absolute top-full mt-2 right-0 bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in duration-200 min-w-[100px]">
                                                {['CLP', 'USD', 'EUR', 'UF', 'UTM'].map((curr) => (
                                                    <button
                                                        key={curr}
                                                        type="button"
                                                        onClick={() => {
                                                            handleCurrencyChange(curr as any);
                                                            setCurrencyDropdownOpen(false);
                                                        }}
                                                        className={`w-full px-4 py-2.5 text-left text-sm font-bold transition-colors ${curr === currency
                                                            ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                                                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                                                            }`}
                                                    >
                                                        {curr}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. Main Bento Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                            {/* Separator line for visual hierarchy */}
                            <div className="md:col-span-2 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent my-1"></div>

                            {/* Card: Basic Info */}
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className={formLabelClasses}>{t('form.name', 'Nombre')}</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className={`${formInputClasses} ${shakeField === 'name' ? 'animate-shake' : ''}`}
                                        placeholder="Ej: Netflix, Arriendo..."
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={formLabelClasses}>{t('form.category', 'Categoría')}</label>
                                    <div className="relative">
                                        <select
                                            value={categoryId || ''}
                                            onChange={(e) => setCategoryId(e.target.value || null)}
                                            className={formSelectClasses}
                                        >
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Compensación Helper */}
                            {effectiveLinkedCommitment && (
                                <div className={`md:col-span-2 flex items-center gap-3 p-3 rounded-xl border ${themeClasses.lightBg} ${themeClasses.border}`}>
                                    <div className={`p-1.5 rounded-full bg-white dark:bg-slate-900 shrink-0`}>
                                        <LinkIcon className={`w-4 h-4 ${themeClasses.text}`} />
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-xs font-bold ${themeClasses.text}`}>Compensación Activa</p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                            Este compromiso se compensa con <strong>"{effectiveLinkedCommitment.name}"</strong>
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Separator - Edit Mode Logic */}
                            {termFieldsDisabled ? (
                                !showTermsHistory && (
                                    <div className={`md:col-span-2 p-4 rounded-2xl border ${themeClasses.lightBg} ${themeClasses.border} flex items-center justify-between`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl ${themeClasses.iconBg}`}>
                                                <History className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className={`font-bold text-sm ${themeClasses.text}`}>Historial de Términos</p>
                                                <p className="text-xs text-slate-500">Edita condiciones anteriores aquí</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowTermsHistory(true)}
                                            className="px-4 py-2 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all"
                                        >
                                            Ver Historial
                                        </button>
                                    </div>
                                )
                            ) : (
                                <>
                                    {/* Card: Timing */}
                                    <div className="p-4 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 space-y-3 h-full">
                                        <div className="flex items-center gap-2 mb-1">
                                            <CalendarCheck className={`w-4 h-4 ${themeClasses.text}`} />
                                            <h3 className="text-[11px] font-extrabold uppercase text-slate-400">Tiempo</h3>
                                        </div>
                                        <div>
                                            <label className={formLabelClasses}>{t('form.frequency', 'Frecuencia')}</label>
                                            <div className="relative">
                                                <select
                                                    value={frequency}
                                                    onChange={(e) => setFrequency(e.target.value as Frequency)}
                                                    className={formSelectClasses}
                                                >
                                                    <option value="MONTHLY">{t('frequency.monthly', 'Mensual')}</option>
                                                    <option value="ONCE">{t('frequency.once', 'Una vez')}</option>
                                                    <option value="BIMONTHLY">{t('frequency.bimonthly', 'Bimestral')}</option>
                                                    <option value="QUARTERLY">{t('frequency.quarterly', 'Trimestral')}</option>
                                                    <option value="ANNUALLY">{t('frequency.annually', 'Anual')}</option>
                                                </select>
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <ChevronDown className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>

                                        <label className={formLabelClasses}>1er Vencimiento</label>
                                        <div className="relative">
                                            <DatePicker
                                                selected={startDate ? new Date(startDate + 'T12:00:00') : new Date()}
                                                onChange={(date: Date | null) => {
                                                    if (date) {
                                                        // Construct YYYY-MM-DD manually to avoid timezone issues
                                                        const year = date.getFullYear();
                                                        const month = String(date.getMonth() + 1).padStart(2, '0');
                                                        const day = String(date.getDate()).padStart(2, '0');
                                                        const newDate = `${year}-${month}-${day}`;

                                                        setStartDate(newDate);
                                                        // Update dueDay from the selected date (use local date)
                                                        setDueDay(String(date.getDate()));
                                                    }
                                                }}
                                                dateFormat="dd/MM/yyyy"
                                                locale="es"
                                                shouldCloseOnSelect={true}
                                                strictParsing
                                                placeholderText="dd/mm/aaaa"
                                                onKeyDown={(e) => {
                                                    // 1. Allow standard navigation/editing keys
                                                    const navKeys = ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', '/'];
                                                    if (navKeys.includes(e.key)) {
                                                        return;
                                                    }

                                                    // 2. Allow Arrow Keys for cursor navigation (default behavior)
                                                    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                                                        return;
                                                    }

                                                    // 3. Block non-digits and enforce length 10
                                                    if (!/^\d$/.test(e.key)) {
                                                        e.preventDefault();
                                                        return;
                                                    }

                                                    // Manual maxLength check
                                                    const input = e.target as HTMLInputElement;
                                                    if (input.value.length >= 10) {
                                                        const selection = window.getSelection();
                                                        if (!selection || selection.toString().length === 0) {
                                                            e.preventDefault();
                                                        }
                                                    }
                                                }}
                                                className={formInputClasses}
                                                wrapperClassName="w-full"
                                                popperClassName="z-[9999]"
                                                portalId="root"
                                                autoFocus={false}
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Card: Duration */}
                                    {!isTerminated && frequency !== 'ONCE' && (
                                        <div className="p-4 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 space-y-3 h-full flex flex-col">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Infinity className={`w-4 h-4 ${themeClasses.text}`} />
                                                <h3 className="text-[11px] font-extrabold uppercase text-slate-400">Duración</h3>
                                            </div>

                                            {/* Compact Horizontal Buttons to save space and align with Tempo card */}
                                            <div className="flex flex-col gap-2 flex-1">
                                                {[
                                                    { id: 'recurring', label: 'Indefinido', icon: Infinity },
                                                    { id: 'endsOn', label: 'Definido', icon: CalendarCheck },
                                                    { id: 'installments', label: 'Cuotas', icon: Hash },
                                                ].map((type) => (
                                                    <button
                                                        key={type.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setDurationType(type.id as any);
                                                            if (type.id === 'recurring') { setEndDate(''); setInstallments(''); }
                                                            // Auto-focus input if defined/installments selected? 
                                                            // Logic handled by rendering below
                                                        }}
                                                        className={`
                                                            flex items-center px-3 py-2.5 rounded-xl border transition-all text-left gap-3
                                                            ${durationType === type.id
                                                                ? `${themeClasses.lightBg} ${themeClasses.border} ${themeClasses.text} ring-1 ${themeClasses.ring.replace('focus:', '')}`
                                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-300'
                                                            }
                                                        `}
                                                    >
                                                        <type.icon className="w-4 h-4 shrink-0" />
                                                        <span className="text-xs font-bold leading-none">{type.label}</span>
                                                        {/* Optional Checkmark for active state */}
                                                        {durationType === type.id && (
                                                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Conditional Input */}
                                            {durationType !== 'recurring' && (
                                                <div className="pt-1">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            value={installments}
                                                            onChange={(e) => {
                                                                setInstallments(e.target.value);
                                                                setLastEditedField('installments');
                                                            }}
                                                            className={`${formInputClasses} !h-[40px] ${shakeField === 'installments' ? 'animate-shake' : ''}`}
                                                            placeholder={durationType === 'endsOn' ? "N° Ocurrencias" : "N° de Cuotas"}
                                                            min="1"
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Duration Legend */}
                                            <div className="mt-1 min-h-[20px]">
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                                                    {durationType === 'recurring' && "Se repite indefinidamente hasta que decidas terminarlo."}
                                                    {durationType === 'endsOn' && "Se repite la cantidad de veces especificada."}
                                                    {durationType === 'installments' && "El monto total ingresado se divide equitativamente."}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Row 4: Link & Notes */}
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Link Commitment Selector */}
                                <div>
                                    <label className={formLabelClasses}>
                                        {t('form.linkTo', 'Compensar con')} <span className="text-slate-300 font-normal normal-case">(Opcional)</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={linkedCommitmentId || ''}
                                            onChange={(e) => setLinkedCommitmentId(e.target.value || null)}
                                            className={`${formSelectClasses} ${linkedCommitmentId ? 'font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/10' : ''}`}
                                        >
                                            <option value="">{t('form.noLink', 'Sin compensación')}</option>

                                            {/* Opción para desvincular explícitamente si ya venía vinculado de BD */}
                                            {commitmentToEdit?.linked_commitment_id && (
                                                <option value="__UNLINK__" className="text-rose-500 font-bold">
                                                    -- Desvincular --
                                                </option>
                                            )}

                                            {existingCommitments
                                                .filter(c => c.id !== commitmentToEdit?.id) // No self-link
                                                .map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name} ({c.flow_type === 'EXPENSE' ? 'Gasto' : 'Ingreso'})
                                                    </option>
                                                ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                    </div>
                                    {linkedCommitmentId && linkedCommitmentId !== '__UNLINK__' && (
                                        <p className="text-[10px] text-sky-500 mt-1.5 ml-1 flex items-center gap-1">
                                            <LinkIcon className="w-3 h-3" />
                                            Este compromiso se pagará usando fondos de la selección.
                                        </p>
                                    )}
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className={formLabelClasses}>{t('form.notes', 'Notas')}</label>
                                    <input
                                        type="text"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className={`${formInputClasses} bg-white/50 dark:bg-slate-800/50`}
                                        placeholder="Agregar nota..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Terms History Section */}
                        {shouldShowTermsSection && (
                            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden mt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowTermsHistory(!showTermsHistory)}
                                    className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <History className="w-4 h-4 text-slate-500" />
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                            {t('form.termsHistory', 'Historial de Pagos y Términos')}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                            {commitmentToEdit.all_terms?.length || (commitmentToEdit.active_term ? 1 : 0)}
                                        </span>
                                    </div>
                                    {showTermsHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                </button>

                                {showTermsHistory && (
                                    <div className="p-0 bg-slate-50/30 dark:bg-slate-900/30">
                                        <TermsListView
                                            commitment={effectiveCommitment!}
                                            payments={termPayments}
                                            onTermUpdate={handleTermUpdate}
                                            onTermCreate={handleTermCreate}
                                            onTermDelete={handleTermDelete}
                                            onRefresh={handleRefresh}
                                            openWithPauseForm={openWithPauseForm}
                                            openWithResumeForm={openWithResumeForm}
                                            hideTitle={true}
                                            isLoading={loadingPayments}
                                            onPaymentClick={(date) => onPaymentClick?.(effectiveCommitment!, date)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md z-10 flex gap-3">
                    {/* Cancel Button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-all duration-200 active:scale-95"
                    >
                        Cancelar
                    </button>

                    {/* Main Action */}
                    <button
                        type="button"
                        onClick={handleSmartClose} // Keep the smart validation logic here
                        disabled={saving}
                        className={`
                            flex-1 py-2.5 rounded-xl text-white font-bold text-sm tracking-wide
                            transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
                            shadow-lg ${themeClasses.saveBtn}
                        `}
                    >
                        {saving ? t('form.saving', 'Guardando...') :
                            (isTerminated && !isActive) ? t('form.closed', 'Cerrado') :
                                (isTerminated && isActive) ? 'Reanudar Compromiso' :
                                    hasChanges ? t('form.saveAndClose', 'Guardar y Cerrar') : t('form.close', 'Cerrar')}
                    </button>
                    {/* Secondary Actions (Link) could go here if needed, but keeping it clean for now */}
                </div>
            </div>
        </div>
    );
};
