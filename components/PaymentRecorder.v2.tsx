/**
 * PaymentRecorder.v2.tsx
 *
 * Modal component for recording, editing, or deleting payments for a commitment.
 * Uses the V2 data model with commitments, terms, and payments.
 *
 * Redesigned for clarity:
 * - Two explicit action buttons (Save Pending / Confirm Payment)
 * - Always-editable date field
 * - Optional notes field
 * - Reduced visual noise
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { useCurrency } from '../hooks/useCurrency';
import { PaymentService } from '../services/dataService.v2';
import { getPerPeriodAmount } from '../utils/financialUtils.v2';
import { findTermForPeriod } from '../utils/termUtils';
import { FlowType } from '../types.v2';
import type { CommitmentWithTerm, Payment, PaymentFormData, Term } from '../types.v2';
import { XMarkIcon, CheckCircleIcon, TrashIcon, ExclamationTriangleIcon } from './icons';
import { Calendar, Wallet, FileText, Save, CalendarClock, Pencil } from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { es } from 'date-fns/locale/es';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useCommitmentValue } from '../hooks/useCommitmentValue';

registerLocale('es', es);

// =============================================================================
// TYPES
// =============================================================================

interface PaymentRecorderProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (operation: 'created' | 'updated' | 'deleted', context?: 'paid' | 'pending') => void;
    commitment: CommitmentWithTerm;
    periodDate: string; // YYYY-MM-DD format (always first day of month)
}

// =============================================================================
// COMPONENT
// =============================================================================

const PaymentRecorder: React.FC<PaymentRecorderProps> = ({
    isOpen,
    onClose,
    onSave,
    commitment,
    periodDate,
}) => {
    const { formatClp } = useLocalization();
    const { getDisplayValue } = useCommitmentValue();
    const { convertAmount, getFxRateToBase, refresh } = useCurrency();

    // Parse year and month from periodDate string (YYYY-MM-DD)
    const [year, month] = React.useMemo(() => {
        const [y, m] = periodDate.split('-').map(Number);
        return [y, m - 1]; // Convert to 0-indexed month
    }, [periodDate]);

    // CRITICAL: Find the term that covers THIS specific period
    const monthDate = new Date(year, month, 1);
    const term: Term | null = findTermForPeriod(commitment, monthDate);

    // Currency type
    type CurrencyType = 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM';

    // Ref for date pickers
    const datePickerRef = React.useRef<DatePicker>(null);

    // Computed effective due date from term
    const effectiveDueDate = React.useMemo(() => {
        if (!term?.due_day_of_month) return null;
        const lastDay = new Date(year, month + 1, 0).getDate(); // last day of this month
        const day = Math.min(term.due_day_of_month, lastDay);
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }, [term, year, month]);

    // Form state
    const [paymentDate, setPaymentDate] = useState('');
    const [amount, setAmount] = useState('');
    const [amountCurrency, setAmountCurrency] = useState<CurrencyType>('CLP');
    const [notes, setNotes] = useState('');
    const [dueDateOverride, setDueDateOverride] = useState<string | null>(null); // null = use term default
    const [isDueDateOverridden, setIsDueDateOverridden] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingPayment, setIsFetchingPayment] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Existing payment state
    const [existingPayment, setExistingPayment] = useState<Payment | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    // Edit mode state: default to true only if NOT paid
    const [isEditMode, setIsEditMode] = useState(true);

    // Derived: is currently marked as paid?
    const isPaid = existingPayment?.payment_date != null;

    // Use centralized logic for value calculation (same as DesktopGrid)

    // Force refresh on open to ensure rates are current
    useEffect(() => {
        if (isOpen) {
            refresh();
        }
    }, [isOpen, refresh]);

    // Expected amount from term
    const expectedAmount = term ? getPerPeriodAmount(term, false) : 0; // In original currency (e.g., UF)
    const expectedCurrency = term?.currency_original || 'CLP';

    // Calculate using shared logic to ensure consistency with Grid
    const expectedAmountInClp = useMemo(() => {
        return getDisplayValue(expectedAmount, expectedCurrency, null, 'CLP');
    }, [expectedAmount, expectedCurrency, getDisplayValue]);



    // Month names
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    // Day names for helper text
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    // Helper to format date "dd/MM/yyyy"
    const formatDateShort = (dateStr: string) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    // Helper to get day name
    const getDayName = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T12:00:00');
        return dayNames[date.getDay()];
    };

    // Fetch existing payment
    useEffect(() => {
        if (!isOpen || !commitment.id) return;

        const fetchExistingPayment = async () => {
            setIsFetchingPayment(true);
            try {
                const payment = await PaymentService.getPayment(commitment.id, periodDate);
                setExistingPayment(payment);

                if (payment) {
                    setPaymentDate(payment.payment_date || new Date().toISOString().split('T')[0]);
                    setAmount(String(payment.amount_original));
                    setAmountCurrency((payment.currency_original as CurrencyType) || 'CLP');
                    setNotes(payment.notes || '');
                    // Load due_date override if it differs from the computed default
                    if (payment.due_date && payment.due_date !== effectiveDueDate) {
                        setDueDateOverride(payment.due_date);
                        setIsDueDateOverridden(true);
                    } else {
                        setDueDateOverride(null);
                        setIsDueDateOverridden(false);
                    }
                    
                    // If already paid, start in View Mode
                    if (payment.payment_date) {
                        setIsEditMode(false);
                    } else {
                        setIsEditMode(true);
                    }

                } else {
                    // Default values for new payment
                    setPaymentDate(new Date().toISOString().split('T')[0]);
                    // Use stored amount_in_base for consistency with grid/commitment cards
                    const amountInClp = expectedAmountInClp;
                    setAmount(String(Math.round(amountInClp)));
                    setDueDateOverride(null);
                    setIsDueDateOverridden(false);
                    setAmountCurrency('CLP');
                    setNotes('');
                    setIsEditMode(true);
                }
            } catch (err) {
                console.error('Error fetching existing payment:', err);
            } finally {
                setIsFetchingPayment(false);
            }
        };

        fetchExistingPayment();
    }, [isOpen, commitment.id, periodDate, expectedAmount, expectedCurrency]);

    // Handle ESC key
    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                if (showDeleteConfirm) {
                    setShowDeleteConfirm(false);
                } else {
                    onClose();
                }
            }
        };
        document.addEventListener('keydown', handleEsc, { capture: true });
        return () => document.removeEventListener('keydown', handleEsc, { capture: true } as any);
    }, [isOpen, onClose, showDeleteConfirm]);

    if (!isOpen) return null;

    // Paused period message... (unchanged logic, keeping it brief for replacement context if needed, but assuming block replacement matches)
    if (!term) {
        return (
            <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
                <div 
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />
                <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden z-20 animate-in zoom-in-95 duration-200">
                     {/* ... paused message content ... */}
                     <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                <ExclamationTriangleIcon className="w-5 h-5" />
                            </div>
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                Período Pausado
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-5">
                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                            {monthNames[month]} {year} está fuera de los términos activos.
                        </p>
                        <button
                            onClick={onClose}
                            className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-slate-700 hover:bg-slate-600 transition-colors"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Save/Confirm handlers... (keep existing logic)
    const handleSavePending = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const parsed = parseFloat(amount);
            const amountValue = !isNaN(parsed) ? parsed : expectedAmount;

            const paymentData: PaymentFormData = {
                period_date: periodDate,
                payment_date: null, // Explicitly pending
                amount_original: amountValue,
                currency_original: amountCurrency,
                fx_rate_to_base: getFxRateToBase(amountCurrency),
                notes: notes.trim() || null,
                due_date: isDueDateOverridden ? (dueDateOverride || null) : null,
            };

            if (existingPayment) {
                await PaymentService.updatePayment(existingPayment.id, paymentData);
                onSave('updated', 'pending');
            } else {
                await PaymentService.recordPayment(commitment.id, term.id, paymentData);
                onSave('created', 'pending');
            }
            onClose();
        } catch (err) {
            console.error('[PaymentRecorder] Error saving pending:', err);
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setIsLoading(false);
        }
    };

    // Confirm as paid (with payment_date)
    const handleConfirmPayment = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const parsed = parseFloat(amount);
            const amountValue = !isNaN(parsed) ? parsed : expectedAmount;

            const paymentData: PaymentFormData = {
                period_date: periodDate,
                payment_date: paymentDate, // Mark as paid
                amount_original: amountValue,
                currency_original: amountCurrency,
                fx_rate_to_base: getFxRateToBase(amountCurrency),
                notes: notes.trim() || null,
                due_date: isDueDateOverridden ? (dueDateOverride || null) : null,
            };

            if (existingPayment) {
                await PaymentService.updatePayment(existingPayment.id, paymentData);
                onSave('updated', 'paid');
            } else {
                await PaymentService.recordPayment(commitment.id, term.id, paymentData);
                onSave('created', 'paid');
            }
            onClose();
        } catch (err) {
            console.error('[PaymentRecorder] Error confirming payment:', err);
            setError(err instanceof Error ? err.message : 'Error al confirmar pago');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!existingPayment) return;

        setIsLoading(true);
        setError(null);
        setShowDeleteConfirm(false);

        try {
            await PaymentService.deletePayment(existingPayment.id);
            onSave('deleted');
            onClose();
        } catch (err) {
            console.error('Error deleting payment:', err);
            setError(err instanceof Error ? err.message : 'Error al eliminar');
        } finally {
            setIsLoading(false);
        }
    };

    // Loading state
    if (isFetchingPayment) {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[130]">
                <div className="bg-slate-900/95 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50 animate-pulse">
                    <div className="flex items-center gap-3 text-slate-300">
                        <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        <span>Cargando...</span>
                    </div>
                </div>
            </div>
        );
    }

    // --- CALCULATED METRICS FOR RECEIPT VIEW ---
    const paymentAmountNum = parseFloat(amount) || 0;
    const diffAmount = paymentAmountNum - expectedAmount;
    
    // Determine flow type (default to EXPENSE if not specified, though usually it is)
    // Note: flow_type is 'EXPENSE' | 'INCOME'
    const isExpense = commitment.flow_type === FlowType.EXPENSE;
    
    // Logic:
    // Expense: Paid < Expected -> Good (Green). Paid > Expected -> Bad (Red).
    // Income: Paid > Expected -> Good (Green). Paid < Expected -> Bad (Red).
    const isGoodOutcome = isExpense ? diffAmount <= 0 : diffAmount >= 0;
    const isNeutralOutcome = Math.abs(diffAmount) < 1;
    
    const diffColorClass = isNeutralOutcome 
        ? 'text-slate-400' 
        : isGoodOutcome 
            ? 'text-emerald-600 dark:text-emerald-400' 
            : 'text-rose-600 dark:text-rose-400';

    const diffSign = diffAmount > 0 ? '+' : ''; // Negative numbers have sign automatically

    // Date Delta
    const daysDiff = useMemo(() => {
        if (!paymentDate || !effectiveDueDate) return null;
        try {
            // "Due Date" - "Payment Date"
            // If Due is 5th, Payment is 3rd. Diff = 5 - 3 = 2. Positive = Early.
            const due = parseISO(effectiveDueDate);
            const paid = parseISO(paymentDate);
            return differenceInCalendarDays(due, paid);
        } catch {
            return null;
        }
    }, [paymentDate, effectiveDueDate]);
    
    const getDaysDiffText = (diff: number) => {
        if (diff === 0) return 'Pagado el día del vencimiento';
        if (diff > 0) return `Pagado ${diff} días antes`;
        return `Pagado ${Math.abs(diff)} días después`;
    };

    const daysDiffColorClass = (daysDiff || 0) >= 0 
        ? 'text-emerald-600 dark:text-emerald-400' 
        : 'text-rose-600 dark:text-rose-400';

    return (
        <div className="fixed inset-0 z-[130] flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Side Sheet Content */}
            <div className="relative w-full sm:max-w-lg h-full bg-slate-50 dark:bg-slate-900 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300 border-l border-slate-200 dark:border-slate-800/50 flex flex-col">
                
                {/* Delete Confirmation */}
                {showDeleteConfirm && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[140] p-6 animate-in fade-in duration-200">
                         <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl w-full max-w-sm p-5 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="p-2.5 bg-rose-500/10 rounded-lg border border-rose-500/20">
                                    <ExclamationTriangleIcon className="w-5 h-5 text-rose-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Eliminar registro</h3>
                                    <p className="text-sm text-slate-400">Esta acción no se puede deshacer.</p>
                                </div>
                            </div>
                            <div className="flex gap-2.5 justify-end">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600/50 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isLoading}
                                    className="px-4 py-2 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
                                >
                                    {isLoading ? 'Eliminando...' : 'Eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header (Sticky) - Only show in Edit Mode or if user wants consistency. 
                    User requested specific Receipt header. We'll use the consistent header for Edit Mode, 
                    and a simpler close button for Receipt Mode since the customized header is PART of the receipt.
                    Actually, let's keep the header consistent for navigation but adapt content?
                    Let's stick to the "Digital Receipt" design which implies the content IS the main view.
                    We will hide the standard header in View Mode and use the "Receipt Header" inside the body?
                    No, consistency is key. Let's keep the standard header but hide the "Edit" button in View Mode since it has a stronger "Edit" CTA in the receipt.
                */}
                <div className="sticky top-0 z-20 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5 px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                         <div className={`p-2.5 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm ${isPaid
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}>
                            {isPaid ? <CheckCircleIcon className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold font-brand text-slate-900 dark:text-white leading-tight truncate max-w-[200px]" title={commitment.name}>
                                {commitment.name}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                {monthNames[month]} {year}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Only show Edit pencil in header if we are NOT in View Mode (because View Mode has big Edit button) 
                            OR if we want redundancy. Let's hide it to avoid clutter in Receipt View. coverage. */}
                        {existingPayment && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-rose-500 rounded-full hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                title="Eliminar registro"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-300 text-sm flex gap-2 items-center animate-in slide-in-from-top-2">
                            <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {!isEditMode ? (
                       // --- RECEIPT VIEW (Read-Only) ---
                       <div className="space-y-8 py-4 animate-in fade-in duration-300">
                           
                           {/* 1. Receipt Header */}
                           <div className="text-center space-y-2">
                               <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wide">
                                   <CheckCircleIcon className="w-3.5 h-3.5" />
                                   <span>Pagado Exitosamente</span>
                               </div>
                               <h1 className="text-3xl font-black font-brand text-slate-900 dark:text-white leading-none">
                                   {monthNames[month]} {year}
                               </h1>
                           </div>
                           
                           {/* Separator */}
                           <div className="flex items-center justify-center opacity-20">
                                <div className="w-full border-t-2 border-dashed border-slate-900 dark:border-white"></div>
                           </div>

                           {/* 2. Financials */}
                           <div className="space-y-6">
                               {/* Main Amount */}
                               <div className="text-center">
                                   <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Monto Pagado</div>
                                   <div className="text-5xl font-black tabular-nums text-slate-900 dark:text-white tracking-tight">
                                       {amountCurrency === 'CLP' 
                                           ? Number(amount).toLocaleString('es-CL') 
                                           : Number(amount).toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                                       <span className="text-xl text-slate-400 font-bold ml-2">{amountCurrency}</span>
                                   </div>
                               </div>

                               {/* Stats Grid */}
                               <div className="grid grid-cols-2 gap-4">
                                   {/* Expected */}
                                   <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                                       <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Esperado</div>
                                       <div className="text-xl font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                                            {expectedCurrency === 'CLP' 
                                               ? expectedAmount.toLocaleString('es-CL') 
                                               : expectedAmount.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                                            <span className="text-[10px] ml-1">{expectedCurrency}</span>
                                       </div>
                                   </div>

                                   {/* Difference */}
                                   <div className={`p-4 rounded-2xl text-center border ${isNeutralOutcome ? 'bg-slate-50 border-slate-100 dark:bg-slate-800/20 dark:border-slate-800' : (isGoodOutcome ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 'bg-rose-50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30')}`}>
                                       <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Diferencia</div>
                                       <div className={`text-xl font-black tabular-nums ${diffColorClass}`}>
                                            {diffSign}{diffAmount.toLocaleString('es-CL')}
                                            <span className="text-[10px] opacity-60 ml-1">CLP</span>
                                       </div>
                                   </div>
                               </div>
                           </div>
                           
                           {/* Separator */}
                           <div className="flex items-center justify-center opacity-20">
                                <div className="w-full border-t-2 border-dashed border-slate-900 dark:border-white"></div>
                           </div>

                           {/* 3. Dates */}
                           <div className="space-y-4 px-2">
                               <div className="flex justify-between items-end">
                                   <div className="text-left">
                                       <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Fecha Pago</div>
                                       <div className="text-lg font-bold text-slate-900 dark:text-white">
                                           {formatDateShort(paymentDate)}
                                       </div>
                                       <div className="text-xs text-slate-500 font-medium capitalize">
                                            {getDayName(paymentDate)}
                                       </div>
                                   </div>
                                   {effectiveDueDate && (
                                       <div className="text-right">
                                           <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Vencimiento</div>
                                           <div className="text-lg font-bold text-slate-900 dark:text-white">
                                               {formatDateShort(effectiveDueDate)}
                                           </div>
                                            <div className="text-xs text-slate-500 font-medium capitalize">
                                                {getDayName(effectiveDueDate)}
                                           </div>
                                       </div>
                                   )}
                               </div>
                               
                               {daysDiff !== null && (
                                   <div className={`text-center text-sm font-bold ${daysDiffColorClass} bg-slate-50 dark:bg-slate-800/50 py-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800`}>
                                       {getDaysDiffText(daysDiff)}
                                   </div>
                               )}
                           </div>
                           
                           {/* Separator */}
                           <div className="flex items-center justify-center opacity-20">
                                <div className="w-full border-t-2 border-dashed border-slate-900 dark:border-white"></div>
                           </div>

                           {/* 4. Notes */}
                           <div className="text-center pb-4">
                               <div className="text-[10px] font-bold uppercase text-slate-400 mb-2">Nota</div>
                               {notes ? (
                                   <div className="text-base text-slate-700 dark:text-slate-300 italic">"{notes}"</div>
                               ) : (
                                   <div className="text-sm text-slate-300 italic">Sin notas registradas</div>
                               )}
                           </div>

                           {/* 5. Actions */}
                           <div className="flex justify-center pt-2">
                               <button 
                                   onClick={() => setIsEditMode(true)}
                                   className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-sky-600 bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors"
                               >
                                   <Pencil className="w-4 h-4" />
                                   Editar Comprobante
                               </button>
                           </div>

                       </div>
                    ) : ( 
                        // --- EDIT FORM (Existing Layout) ---
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                             {/* --- COMPACT AMOUNT SECTION --- */}
                            <div className="space-y-3">
                                 {/* Expected Amount (Subtle/Secondary) */}
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Monto Esperado:</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                                            {expectedCurrency === 'CLP'
                                                ? expectedAmount.toLocaleString('es-CL')
                                                : expectedAmount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            <span className="text-[10px] text-slate-400 font-mono ml-1">{expectedCurrency}</span>
                                        </span>
                                        {expectedCurrency !== 'CLP' && (
                                            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                ≈ {formatClp(Math.round(expectedAmountInClp))}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Paid Amount (Prominent/Primary) */}
                                 <div className="p-4 rounded-xl border transition-all bg-white dark:bg-slate-800 border-sky-200 dark:border-sky-700 ring-2 ring-sky-500/10 shadow-sm animate-in slide-in-from-bottom-2">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                                        Monto Pagado
                                    </label>
                                    
                                    <div className="flex items-baseline gap-1">
                                         <input
                                            type="tel"
                                            value={amountCurrency === 'CLP' && amount ? Number(amount).toLocaleString('es-CL') : amount}
                                            onChange={(e) => {
                                                let val = e.target.value;
                                                if (amountCurrency === 'CLP') {
                                                    val = val.replace(/\./g, '').replace(/,/g, '');
                                                }
                                                if (!isNaN(Number(val))) {
                                                    setAmount(val);
                                                }
                                            }}
                                            placeholder={String(expectedAmount)}
                                            className="w-full bg-transparent text-3xl font-black tabular-nums text-slate-900 dark:text-white placeholder-slate-300 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* --- DATE SECTION --- */}
                            <div className="grid grid-cols-1 gap-4">
                                {/* Payment Date */}
                                <div className="relative p-3 rounded-xl border transition-all bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-sky-300">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                        Fecha de Pago
                                    </label>
                                    
                                     <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-900/20 text-sky-500">
                                            <Calendar className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div onClick={() => datePickerRef.current?.setFocus()} className="cursor-pointer">
                                                 <DatePicker
                                                    ref={datePickerRef}
                                                    selected={paymentDate ? new Date(paymentDate + 'T12:00:00') : new Date()}
                                                    onChange={(date: Date | null) => {
                                                        if (date) {
                                                            const y = date.getFullYear();
                                                            const m = String(date.getMonth() + 1).padStart(2, '0');
                                                            const d = String(date.getDate()).padStart(2, '0');
                                                            setPaymentDate(`${y}-${m}-${d}`);
                                                        }
                                                    }}
                                                    dateFormat="dd/MM/yyyy"
                                                    locale="es"
                                                    shouldCloseOnSelect={true}
                                                    placeholderText="Seleccionar fecha"
                                                    className="w-full bg-transparent text-lg font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer p-0 border-none"
                                                    wrapperClassName="w-full"
                                                    popperClassName="z-[9999]"
                                                    portalId="root"
                                                />
                                                {paymentDate && (
                                                    <div className="text-xs text-slate-500 font-medium mt-0.5">
                                                        ({getDayName(paymentDate)})
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                 {/* Due Date (Secondary Info) */}
                                {effectiveDueDate && (
                                    <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CalendarClock className="w-4 h-4 text-slate-400" />
                                                <span className="text-xs font-bold text-slate-500">Vencimiento:</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                 <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                    {formatDateShort(effectiveDueDate)} <span className="text-slate-400 font-normal">({getDayName(effectiveDueDate)})</span>
                                                </span>
                                                {!isDueDateOverridden && (
                                                     <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsDueDateOverridden(true);
                                                            setDueDateOverride(effectiveDueDate);
                                                        }}
                                                        className="ml-2 text-[10px] font-bold text-sky-600 hover:text-sky-500 uppercase"
                                                    >
                                                        Editar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {isDueDateOverridden && (
                                             <div className="mt-2 flex items-center gap-2 animate-in fade-in">
                                                <div className="flex-1 bg-white dark:bg-slate-800 border border-sky-300 rounded-lg px-2">
                                                    <DatePicker
                                                        selected={dueDateOverride ? new Date(dueDateOverride + 'T12:00:00') : new Date()}
                                                        onChange={(date: Date | null) => {
                                                            if (date) {
                                                                const y = date.getFullYear();
                                                                const m = String(date.getMonth() + 1).padStart(2, '0');
                                                                const d = String(date.getDate()).padStart(2, '0');
                                                                setDueDateOverride(`${y}-${m}-${d}`);
                                                            }
                                                        }}
                                                        dateFormat="dd/MM/yyyy"
                                                        locale="es"
                                                        className="w-full bg-transparent text-sm font-bold text-slate-900 dark:text-white focus:outline-none p-1"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsDueDateOverridden(false);
                                                        setDueDateOverride(null);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                                                >
                                                    <XMarkIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>


                            {/* Notes Field */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5" />
                                        Nota (opcional)
                                    </span>
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                                    placeholder="Agregar nota..."
                                    rows={2}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none transition-all"
                                />
                                {notes.length > 0 && (
                                    <p className="mt-1 text-xs text-slate-400 text-right">{notes.length}/500</p>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Extra space for scroll */}
                    <div className="h-6"></div>
                </div>

                {/* Footer - Sticky Actions */}
                {isEditMode && (
                    <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 z-10 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                        {/* Confirm as Paid */}
                        <button
                            onClick={handleConfirmPayment}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <CheckCircleIcon className="w-5 h-5" />
                            )}
                            <span>{isPaid ? 'Actualizar Pago' : 'Confirmar Pago'}</span>
                        </button>
                        
                        {/* Save as Pending */}
                        <button
                            onClick={handleSavePending}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            <span>Guardar como Pendiente</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentRecorder;


