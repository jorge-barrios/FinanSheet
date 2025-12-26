/**
 * CommitmentForm v2
 * 
 * Simplified form for creating/editing commitments and their initial term.
 * Uses v2 data model: Commitment → Term → Payments
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { useCurrency } from '../hooks/useCurrency';
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, StarIcon } from './icons';
import { Infinity, CalendarCheck, Hash } from 'lucide-react';
import {
    FlowType,
    Frequency,
} from '../types.v2';
import type {
    CommitmentFormData,
    TermFormData,
    Category,
    CommitmentWithTerm
} from '../types.v2';

interface CommitmentFormV2Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (commitment: CommitmentFormData, term: TermFormData) => Promise<void>;
    categories: Category[];
    commitmentToEdit: CommitmentWithTerm | null;
    existingCommitments?: CommitmentWithTerm[]; // For linking
}

const formInputClasses = "w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all [color-scheme:light] dark:[color-scheme:dark]";
const formLabelClasses = "block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5";
const formSelectClasses = `${formInputClasses} appearance-none`;

export const CommitmentFormV2: React.FC<CommitmentFormV2Props> = ({
    isOpen,
    onClose,
    onSave,
    categories,
    commitmentToEdit,
    existingCommitments = []
}) => {
    const { t, formatClp } = useLocalization();
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

    // Detect if editing a terminated/paused commitment (has effective_until in the past)
    const isTerminated = (() => {
        if (!commitmentToEdit?.active_term?.effective_until) return false;
        const endDateObj = new Date(commitmentToEdit.active_term.effective_until);
        const todayObj = new Date(today);
        return endDateObj < todayObj;
    })();

    // isActive state - for toggling pause/resume (only for editing)
    const [isActive, setIsActive] = useState(!isTerminated);

    // Flag to skip auto-calculation during initial load of edit data
    const isInitialLoadRef = useRef(false);

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

    // Format CLP with thousand separators
    const formatCLPInput = (value: string): string => {
        if (!value) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(num);
    };

    // Set default category
    useEffect(() => {
        if (categories.length > 0 && !categoryId) {
            setCategoryId(categories[0].id);
        }
    }, [categories, categoryId]);

    // Load edit data - CommitmentWithTerm has fields directly + active_term
    useEffect(() => {
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
                if (!term.effective_until) {
                    setDurationType('recurring');
                } else if (term.installments_count && term.installments_count > 1) {
                    setDurationType('installments');
                } else {
                    setDurationType('endsOn');
                }
                setEndDate(term.effective_until || '');
                setInstallments(term.installments_count?.toString() || '');

                // Set isActive based on whether commitment is paused
                const isPaused = term.effective_until && new Date(term.effective_until) < new Date(today);
                setIsActive(!isPaused);

                // Clear flag after 600ms (longer than debounce 500ms) to prevent
                // debounce from firing when loading edit data
                setTimeout(() => {
                    isInitialLoadRef.current = false;
                }, 600);
            }
        }
    }, [commitmentToEdit]);

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

        // Validación mejorada con mensajes específicos
        if (!name.trim()) {
            alert('Por favor completa el campo "Nombre"');
            return;
        }

        if (!amount) {
            alert('Por favor completa el campo "Monto"');
            return;
        }

        // Validar campos de duración según el tipo
        if (durationType === 'endsOn' && !installments) {
            alert('Por favor completa el campo "Nº de ocurrencias"');
            return;
        }

        if (durationType === 'installments' && !installments) {
            alert('Por favor completa el campo "Nº Cuotas"');
            return;
        }

        setSaving(true);

        try {
            const commitmentData: CommitmentFormData = {
                name: name.trim(),
                category_id: categoryId,
                flow_type: flowType,
                is_important: isImportant,
                notes: notes.trim(),
                linked_commitment_id: null,
                link_role: null,
            };

            // due_day_of_month from dueDay state
            const dueDayNum = parseInt(dueDay) || 1;
            // Note: effective_from is the term start date (not the first payment date)
            // The first payment date calculation (if start day > due day) happens at payment generation time

            console.log('Saving term with startDate:', startDate, 'dueDay:', dueDay);

            const termData: TermFormData = {
                effective_from: startDate, // Use startDate directly - NO adjustment
                // Use endDate if set (from "End Commitment" modal or duration picker)
                effective_until: endDate || null,
                frequency,
                // installments_count is ONLY set for 'installments' type (divides amount)
                // For 'endsOn' (Defined) or ending via modal, only effective_until is set
                installments_count: durationType === 'installments' && installments
                    ? parseInt(installments)
                    : null,
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
            };

            await onSave(commitmentData, termData);
            handleClose();
        } catch (error) {
            console.error('Error saving commitment:', error);
            alert('Error saving commitment');
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
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

        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header with Title and Type Toggle */}
                <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 z-10">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 order-2 sm:order-1">
                        <h2 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
                            {commitmentToEdit ? t('form.editCommitment', 'Edit Commitment') : t('form.newCommitment', 'New Commitment')}
                        </h2>

                        {/* Active/Paused Toggle - TEMPORARILY DISABLED
                            Will implement proper pause/resume flow in a separate modal
                        {commitmentToEdit && (
                            <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${isActive
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                                }`}>
                                ... checkbox implementation ...
                            </label>
                        )}
                        */}

                        {/* Important Toggle - Always visible */}
                        <label className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all ${isImportant
                            ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700'
                            : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                            }`}>
                            <input
                                type="checkbox"
                                checked={isImportant}
                                onChange={(e) => setIsImportant(e.target.checked)}
                                className="sr-only"
                            />
                            <StarIcon className={`w-4 h-4 transition-colors ${isImportant ? 'text-amber-500' : 'text-slate-400'}`} />
                        </label>

                        {/* Type Toggle */}
                        <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setFlowType(FlowType.EXPENSE)}
                                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-1.5 ${flowType === FlowType.EXPENSE
                                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    } border-r border-slate-300 dark:border-slate-700`}
                            >
                                <ArrowTrendingDownIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                {t('form.expense', 'Expense')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setFlowType(FlowType.INCOME)}
                                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-1.5 ${flowType === FlowType.INCOME
                                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                            >
                                <ArrowTrendingUpIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                {t('form.income', 'Income')}
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3">
                    {/* Row 1: Nombre (2/3) + Categoría (1/3) */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-8">
                            <label className={formLabelClasses}>{t('form.name', 'Nombre')} *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={formInputClasses}
                                placeholder={t('form.namePlaceholder', 'Ej: Arriendo, Sueldo, Netflix')}
                                required
                            />
                        </div>
                        <div className="md:col-span-4">
                            <label className={formLabelClasses}>{t('form.category', 'Categoría')}</label>
                            <select
                                value={categoryId || ''}
                                onChange={(e) => setCategoryId(e.target.value || null)}
                                className={formSelectClasses}
                            >
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name} {cat.is_global ? '🌍' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 2: [Moneda|Monto] + Frecuencia + Primer Vencimiento */}
                    <div className="grid grid-cols-2 md:grid-cols-12 gap-3">
                        {/* Monto con Moneda integrada */}
                        <div className="col-span-2 md:col-span-5">
                            <label className={formLabelClasses}>{t('form.amount', 'Monto')} *</label>
                            <div className="flex">
                                <select
                                    value={currency}
                                    onChange={(e) => handleCurrencyChange(e.target.value as 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM')}
                                    className="px-2 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-r-0 border-slate-300 dark:border-slate-600 rounded-l-md text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                                >
                                    <option value="CLP">CLP</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="UF">UF</option>
                                    <option value="UTM">UTM</option>
                                </select>
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
                                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-r-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:text-white placeholder-slate-400"
                                    placeholder="0"
                                    required
                                />
                            </div>
                        </div>

                        {/* Frecuencia */}
                        <div className="col-span-1 md:col-span-3">
                            <label className={formLabelClasses}>{t('form.frequency', 'Frecuencia')}</label>
                            <select
                                value={frequency}
                                onChange={(e) => setFrequency(e.target.value as Frequency)}
                                className={formSelectClasses}
                            >
                                <option value="ONCE">{t('frequency.once', 'Una vez')}</option>
                                <option value="MONTHLY">{t('frequency.monthly', 'Mensual')}</option>
                                <option value="BIMONTHLY">{t('frequency.bimonthly', 'Bimestral')}</option>
                                <option value="QUARTERLY">{t('frequency.quarterly', 'Trimestral')}</option>
                                <option value="SEMIANNUALLY">{t('frequency.semiannually', 'Semestral')}</option>
                                <option value="ANNUALLY">{t('frequency.annually', 'Anual')}</option>
                            </select>
                        </div>

                        {/* 1er Vencimiento */}
                        <div className="col-span-1 md:col-span-4">
                            <label className={formLabelClasses}>{t('form.firstDueDate', '1er Vencimiento')} *</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    const newDate = e.target.value;
                                    setStartDate(newDate);
                                    if (newDate) {
                                        const day = new Date(newDate).getDate();
                                        setDueDay(day.toString());
                                    }
                                }}
                                className={formInputClasses}
                                required
                            />
                        </div>
                    </div>

                    {/* Link commitment (if applicable) */}
                    {existingCommitments && existingCommitments.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className={formLabelClasses}>
                                    {t('form.linkCommitment', 'Vincular')} ({t('form.optional', 'opcional')})
                                </label>
                                <select
                                    value={linkedCommitmentId || ''}
                                    onChange={(e) => setLinkedCommitmentId(e.target.value || null)}
                                    className={formSelectClasses}
                                >
                                    <option value="">{t('form.noLink', 'Sin vínculo')}</option>
                                    {existingCommitments
                                        .filter(c => c.id !== commitmentToEdit?.id)
                                        .map(commitment => (
                                            <option key={commitment.id} value={commitment.id}>
                                                {commitment.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Duration Type Selector - Hidden when terminated or frequency is ONCE */}
                    {!isTerminated && frequency !== 'ONCE' && (
                        <div className="space-y-3">
                            <label className={formLabelClasses}>{t('form.durationType', 'Duration')}</label>
                            <div className="flex gap-2">
                                {/* Indefinido option */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDurationType('recurring');
                                        setEndDate('');
                                        setInstallments('');
                                    }}
                                    className={`flex-1 px-3 py-2.5 text-sm rounded-lg border transition-all ${durationType === 'recurring'
                                        ? 'bg-sky-100 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 font-medium'
                                        : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Infinity className="w-4 h-4" />
                                        <span>{t('form.durationType.indefinite', 'Indefinido')}</span>
                                    </div>
                                </button>

                                {/* Definido option */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDurationType('endsOn');
                                        setInstallments('');
                                    }}
                                    className={`flex-1 px-3 py-2.5 text-sm rounded-lg border transition-all ${durationType === 'endsOn'
                                        ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-medium'
                                        : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        <CalendarCheck className="w-4 h-4" />
                                        <span>{t('form.durationType.defined', 'Definido')}</span>
                                    </div>
                                </button>

                                {/* En cuotas option */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDurationType('installments');
                                    }}
                                    className={`flex-1 px-3 py-2.5 text-sm rounded-lg border transition-all ${durationType === 'installments'
                                        ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 font-medium'
                                        : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Hash className="w-4 h-4" />
                                        <span>{t('form.durationType.installments', 'En cuotas')}</span>
                                    </div>
                                </button>
                            </div>

                            {/* Description text */}
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {durationType === 'recurring' && t('form.durationType.indefiniteDesc', 'Se repite sin fecha de término')}
                                {durationType === 'endsOn' && t('form.durationType.definedDesc', 'Termina en fecha específica')}
                                {durationType === 'installments' && t('form.durationType.installmentsDesc', 'Monto total dividido en cuotas')}
                            </p>

                        </div>
                    )}

                    {/* Nº Cuotas/Ocurrencias + Notas (en una fila) */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        {/* Occurrences field - for 'endsOn' type (Defined - NOT divided) */}
                        {!isTerminated && durationType === 'endsOn' && (
                            <div className="md:col-span-3">
                                <label className={formLabelClasses}>N° de ocurrencias *</label>
                                <input
                                    type="number"
                                    value={installments}
                                    placeholder="12"
                                    onChange={(e) => {
                                        setInstallments(e.target.value);
                                        setLastEditedField('installments');
                                    }}
                                    className={formInputClasses}
                                    min="1"
                                    required
                                />

                            </div>
                        )}

                        {/* Installments field - for 'installments' type (divides amount) */}
                        {!isTerminated && durationType === 'installments' && (
                            <div className="md:col-span-3">
                                <label className={formLabelClasses}>{t('form.numberOfInstallments', 'Nº Cuotas')} *</label>
                                <input
                                    type="number"
                                    value={installments}
                                    placeholder="12"
                                    onChange={(e) => {
                                        setInstallments(e.target.value);
                                        setLastEditedField('installments');
                                    }}
                                    className={formInputClasses}
                                    min="1"
                                    required
                                />

                            </div>
                        )}

                        {/* Notas - se adapta al espacio disponible */}
                        <div className={`${(durationType === 'endsOn' || durationType === 'installments') && !isTerminated ? 'md:col-span-9' : 'md:col-span-12'}`}>
                            <label className={formLabelClasses}>{t('form.notes', 'Notas')}</label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className={formInputClasses}
                                placeholder={t('form.addNotes', 'Agregar notas...')}
                            />
                        </div>
                    </div>



                    {/* Actions */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                        {/* Terminated Commitment Banner - No reactivation, just info */}
                        {isTerminated && (
                            <div className="p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">⏹️</span>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {t('form.commitmentEnded', 'This commitment has ended')}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('form.commitmentEndedDesc', 'Ended on')} {commitmentToEdit?.active_term?.effective_until}.
                                    {' '}{t('form.commitmentEndedInfo', 'If you need this commitment again, please create a new one.')}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-medium"
                                disabled={saving}
                            >
                                {t('form.cancel', 'Cancel')}
                            </button>
                            <button
                                type="submit"
                                className={`flex-1 px-4 py-2 text-white rounded-md transition-all disabled:opacity-50 font-medium shadow-lg ${flowType === 'EXPENSE'
                                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                                    : 'bg-green-500 hover:bg-green-600 shadow-green-500/20'}`}
                                disabled={saving || (isTerminated && !isActive)}
                            >
                                {saving ? t('form.saving', 'Saving...') :
                                    (isTerminated && !isActive) ? t('form.closed', 'Closed') :
                                        (commitmentToEdit ? t('form.saveButton', 'Save') : t('form.create', 'Create'))}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
