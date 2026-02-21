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
    const [markAsPaid, setMarkAsPaid] = useState(true);

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

    // Date Delta (must be declared before any early return to preserve hook order)
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
    const paidAmountInClp = getDisplayValue(paymentAmountNum, amountCurrency, null, 'CLP');
    const diffAmountInClp = paidAmountInClp - expectedAmountInClp;
    
    // Determine flow type (default to EXPENSE if not specified, though usually it is)
    // Note: flow_type is 'EXPENSE' | 'INCOME'
    const isExpense = commitment.flow_type === FlowType.EXPENSE;
    
    // Logic:
    // Expense: Paid < Expected -> Good (Green). Paid > Expected -> Bad (Red).
    // Income: Paid > Expected -> Good (Green). Paid < Expected -> Bad (Red).
    const isGoodOutcome = isExpense ? diffAmountInClp <= 0 : diffAmountInClp >= 0;
    const isNeutralOutcome = Math.abs(diffAmountInClp) < 1;
    
    const diffColorClass = isNeutralOutcome 
        ? 'text-slate-400' 
        : isGoodOutcome 
            ? 'text-emerald-600 dark:text-emerald-400' 
            : 'text-rose-600 dark:text-rose-400';

    const diffSign = diffAmountInClp > 0 ? '+' : ''; // Negative numbers have sign automatically

    
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
                <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/10 px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                         <div className="p-2.5 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold font-brand text-slate-900 dark:text-white leading-tight truncate max-w-[200px]" title={commitment.name}>
                                {commitment.name}
                            </h2>
                            {isEditMode && (
                                <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                                    <span>{monthNames[month]} {year}</span>
                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-100/70 dark:bg-sky-900/30">
                                        {existingPayment ? 'Editando' : 'Nuevo'}
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            aria-label="Cerrar modal"
                            onClick={onClose}
                            className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3 custom-scrollbar">

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-300 text-sm flex gap-2 items-center animate-in slide-in-from-top-2">
                            <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {!isEditMode ? (
                       // --- RECEIPT VIEW (Read-Only) ---
                       <div className="space-y-6 py-4 animate-in fade-in duration-300">
                           
                           {/* 1. Hero Card */}
                           <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40 p-6 text-center space-y-3">
                               {/* Period */}
                               <div className="text-sm sm:text-base font-bold text-slate-500 dark:text-slate-400 tracking-wide">{monthNames[month]} {year}</div>
                               {/* Success icon */}
                               <CheckCircleIcon className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-500 dark:text-emerald-400 mx-auto" />
                               {/* Amount */}
                               <div className="text-3xl sm:text-4xl font-mono font-bold tabular-nums text-slate-900 dark:text-white tracking-tight">
                                   <span className="text-base sm:text-lg font-mono font-medium text-slate-400 mr-1.5">{amountCurrency}</span>
                                   {amountCurrency === 'CLP' 
                                       ? Number(amount).toLocaleString('es-CL') 
                                       : Number(amount).toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                               </div>
                               {/* Achievement indicator */}
                               {daysDiff !== null && (
                                   <div className={`flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold ${daysDiffColorClass}`}>
                                       <span>●</span>
                                       <span>{getDaysDiffText(daysDiff)}</span>
                                   </div>
                               )}
                           </div>

                           {/* 2. Detail Card */}
                           <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40 overflow-hidden">
                               <div className="divide-y divide-slate-200/60 dark:divide-slate-700/40 text-xs sm:text-sm">
                                   {/* Esperado */}
                                   <div className="flex justify-between items-center px-5 py-3">
                                       <span className="text-slate-500 dark:text-slate-400 font-medium">Esperado</span>
                                       <span className="font-mono font-bold tabular-nums text-slate-700 dark:text-slate-300">
                                           <span className="font-medium text-slate-400 mr-1">{expectedCurrency}</span>
                                           {expectedCurrency === 'CLP' 
                                               ? expectedAmount.toLocaleString('es-CL') 
                                               : expectedAmount.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                                       </span>
                                   </div>
                                   {/* Diferencia */}
                                   <div className="flex justify-between items-center px-5 py-3">
                                       <span className="text-slate-500 dark:text-slate-400 font-medium">Diferencia</span>
                                       <span className={`font-mono font-bold tabular-nums ${diffColorClass}`}>
                                           <span className="font-medium opacity-70 mr-1">CLP</span>
                                           {diffSign}{diffAmountInClp.toLocaleString('es-CL')}
                                       </span>
                                   </div>
                                   {/* Fecha de Pago */}
                                   <div className="flex justify-between items-center px-5 py-3">
                                       <span className="text-slate-500 dark:text-slate-400 font-medium">Fecha Pago</span>
                                       <span className="font-medium text-slate-700 dark:text-slate-300">
                                           {formatDateShort(paymentDate)}
                                           <span className="text-slate-400 dark:text-slate-500 ml-1.5 capitalize text-xs">{getDayName(paymentDate)}</span>
                                       </span>
                                   </div>
                                   {/* Vencimiento */}
                                   {effectiveDueDate && (
                                       <div className="flex justify-between items-center px-5 py-3">
                                           <span className="text-slate-500 dark:text-slate-400 font-medium">Vencimiento</span>
                                           <span className="font-medium text-slate-700 dark:text-slate-300">
                                               {formatDateShort(effectiveDueDate)}
                                               <span className="text-slate-400 dark:text-slate-500 ml-1.5 capitalize text-xs">{getDayName(effectiveDueDate)}</span>
                                           </span>
                                       </div>
                                   )}
                                   {/* Notes (only if present) */}
                                   {notes && (
                                       <div className="flex justify-between items-start px-5 py-3">
                                           <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Nota</span>
                                           <span className="text-slate-700 dark:text-slate-300 italic text-right ml-4">"{notes}"</span>
                                       </div>
                                   )}
                               </div>
                           </div>

                       </div>
                    ) : ( 
                        // --- EDIT FORM (Existing Layout) ---
                         <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {/* --- DATE SECTION --- */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Vencimiento (Read-only display, tap to override) */}
                                {effectiveDueDate && (
                                    <div className="relative p-3 rounded-xl border transition-all bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/50">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                Vencimiento
                                            </label>
                                            {isDueDateOverridden && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsDueDateOverridden(false);
                                                        setDueDateOverride(''); // Native date inputs expect empty string to reset, not null
                                                    }}
                                                    className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                                    title="Restablecer vencimiento"
                                                >
                                                    Restablecer
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative flex items-center w-full">
                                            <input
                                                type="date"
                                                value={dueDateOverride || effectiveDueDate}
                                                onChange={(e) => {
                                                    setDueDateOverride(e.target.value);
                                                    setIsDueDateOverridden(true);
                                                }}
                                                className="bg-transparent text-base font-semibold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer p-0 border-none transition-all w-full block pr-20 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-20 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer z-10"
                                            />
                                            <div className="absolute right-0 flex items-center gap-2 pointer-events-none z-0">
                                                <CalendarClock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium text-right min-w-[32px] uppercase">
                                                    {getDayName(dueDateOverride || effectiveDueDate)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Fecha de Pago (Editable - Primary, highlighted) */}
                                <div className="relative p-3 rounded-xl border transition-all duration-300 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 focus-within:-translate-y-0.5 focus-within:shadow-md focus-within:ring-2 focus-within:ring-sky-500/50 focus-within:border-sky-500 shadow-sm">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">
                                        Fecha de Pago
                                    </label>
                                    <div className="relative flex items-center w-full">
                                        <input
                                            type="date"
                                            value={paymentDate}
                                            onChange={(e) => setPaymentDate(e.target.value)}
                                            className="w-full bg-transparent text-lg font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer p-0 border-none transition-all block pr-20 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-20 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer z-10"
                                        />
                                        <div className="absolute right-0 flex items-center gap-2 pointer-events-none z-0">
                                            <Calendar className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                                            {paymentDate && (
                                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium text-right min-w-[32px] uppercase">
                                                    {getDayName(paymentDate)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Amount Input */}
                            <div
                                className="p-4 rounded-xl border transition-all duration-300 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 focus-within:-translate-y-0.5 focus-within:shadow-md focus-within:ring-2 focus-within:ring-sky-500/50 focus-within:border-sky-500 shadow-sm"
                            >    <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-3">
                                    Monto Pagado
                                </label>
                                <div className="flex justify-end mb-2">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-sm sm:text-base font-mono font-medium text-slate-400 dark:text-slate-500 shrink-0">{amountCurrency}</span>
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
                                            className="w-full bg-transparent text-2xl sm:text-3xl font-mono font-semibold tabular-nums text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 border-none outline-none shadow-none focus:outline-none focus:ring-0 transition-all caret-sky-400 selection:bg-sky-500/25 text-right p-0 m-0"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-1.5 text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
                                    <span className="font-medium">Esperado:</span>
                                    <span className="font-mono">{expectedCurrency}</span>
                                    <span className="font-bold font-mono tabular-nums">
                                        {expectedCurrency === 'CLP'
                                            ? expectedAmount.toLocaleString('es-CL')
                                            : expectedAmount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    {expectedCurrency !== 'CLP' && (
                                        <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500">
                                            ≈ CLP {formatClp(Math.round(expectedAmountInClp))}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Nota (Optional) */}
                            <div className="p-4 rounded-xl border transition-all duration-300 bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/50 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 focus-within:-translate-y-0.5 focus-within:shadow-md focus-within:ring-2 focus-within:ring-slate-500/50 focus-within:border-slate-500 mt-3">
                                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <FileText className="w-3 h-3" />
                                        Nota
                                    </span>
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                                    placeholder="Agregar nota..."
                                    rows={2}
                                    className="w-full mt-2 px-1 py-1 bg-transparent border-none text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 resize-none h-[60px]"
                                />
                                {notes.length > 0 && (
                                    <p className="mt-0.5 text-[10px] text-slate-400 text-right tabular-nums">{notes.length}/500</p>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Danger Zone - Delete (only in edit mode) */}
                    {isEditMode && existingPayment && (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="w-full flex items-center justify-center gap-2 py-3 mt-6 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-slate-100 dark:border-slate-800/0 transition-colors"
                        >
                            <TrashIcon className="w-4 h-4" />
                            Eliminar Registro
                        </button>
                    )}

                    {/* Extra space for scroll */}
                    <div className="h-2"></div>
                </div>

                {/* Footer - Sticky Actions (always visible) */}
                <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 z-10 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    {isEditMode ? (
                        <>
                        {/* Paid/Pending toggle (only for new payments) */}
                        {!isPaid && (
                            <button
                                type="button"
                                onClick={() => setMarkAsPaid(!markAsPaid)}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 transition-colors"
                            >
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Marcar como pagado</span>
                                <div className={`relative w-11 h-6 rounded-full transition-colors ${
                                    markAsPaid ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                                }`}>
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                                        markAsPaid ? 'translate-x-[22px]' : 'translate-x-0.5'
                                    }`} />
                                </div>
                            </button>
                        )}
                        {/* Single adaptive CTA */}
                        <button
                            onClick={markAsPaid || isPaid ? handleConfirmPayment : handleSavePending}
                            disabled={isLoading}
                            className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold active:scale-[0.98] shadow-lg transition-all disabled:opacity-50 disabled:scale-100 ${
                                markAsPaid || isPaid
                                    ? 'text-white bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                                    : 'text-white bg-slate-600 hover:bg-slate-500 dark:bg-slate-700 dark:hover:bg-slate-600 shadow-slate-600/20'
                            }`}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : markAsPaid || isPaid ? (
                                <CheckCircleIcon className="w-5 h-5" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            <span>{
                                isPaid ? 'Actualizar Pago' 
                                : markAsPaid ? 'Confirmar Pago' 
                                : 'Guardar Pendiente'
                            }</span>
                        </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => setIsEditMode(true)}
                            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition-all"
                        >
                            <Pencil className="w-4 h-4" />
                            Editar Comprobante
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentRecorder;


