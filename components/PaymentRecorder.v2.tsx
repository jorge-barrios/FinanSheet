/**
 * PaymentRecorder.v2.tsx
 * 
 * Modal component for recording, editing, or deleting payments for a commitment.
 * Uses the V2 data model with commitments, terms, and payments.
 */

import React, { useState, useEffect } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { useCurrency } from '../hooks/useCurrency';
import { PaymentService } from '../services/dataService.v2';
import { getPerPeriodAmount } from '../utils/financialUtils.v2';
import { findTermForPeriod } from '../utils/termUtils';
import type { CommitmentWithTerm, Payment, PaymentFormData, Term } from '../types.v2';
import { XMarkIcon, CheckCircleIcon, TrashIcon, ExclamationTriangleIcon } from './icons';
import { Calendar, Wallet, Coins, Banknote } from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { es } from 'date-fns/locale/es';

registerLocale('es', es);

// =============================================================================
// TYPES
// =============================================================================

interface PaymentRecorderProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (operation: 'created' | 'updated' | 'deleted') => void; // Callback with operation type
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
    const { fromUnit, convertAmount, getFxRateToBase } = useCurrency();

    // Parse year and month from periodDate string (YYYY-MM-DD)
    const [year, month] = React.useMemo(() => {
        const [y, m] = periodDate.split('-').map(Number);
        return [y, m - 1]; // Convert to 0-indexed month
    }, [periodDate]);

    // CRITICAL: Find the term that covers THIS specific period, not just active_term
    // This ensures payments for historical months are associated with the correct term
    // Example: If V1 covers Jan-Jun and V2 covers Jul-∞, paying for April should use V1
    const monthDate = new Date(year, month, 1);
    const term: Term | null = findTermForPeriod(commitment, monthDate);

    // Currency type - updated to include EUR and UTM
    type CurrencyType = 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM';

    // Ref for date picker to enable card click
    const datePickerRef = React.useRef<DatePicker>(null);

    // Form state
    const [isPaid, setIsPaid] = useState(false);
    const [paymentDate, setPaymentDate] = useState('');
    const [amount, setAmount] = useState('');
    // Default to CLP (user's base currency) for payments, regardless of commitment's original currency
    const [amountCurrency, setAmountCurrency] = useState<CurrencyType>('CLP');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingPayment, setIsFetchingPayment] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Existing payment (fetched from DB to ensure fresh data)
    const [existingPayment, setExistingPayment] = useState<Payment | null>(null);

    // Confirmation dialog state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Expected amount from term (per-cuota if installments exist) - using centralized function
    const expectedAmount = term ? getPerPeriodAmount(term, false) : 0;
    const expectedCurrency = term?.currency_original || 'CLP';

    // Month name for display
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Fetch existing payment from DB when modal opens (ensures fresh data)
    useEffect(() => {
        if (!isOpen || !commitment.id) return;

        const fetchExistingPayment = async () => {
            setIsFetchingPayment(true);
            try {
                const payment = await PaymentService.getPayment(commitment.id, periodDate);
                setExistingPayment(payment);

                // Initialize form with payment data
                if (payment) {
                    setIsPaid(!!payment.payment_date);
                    setPaymentDate(payment.payment_date || new Date().toISOString().split('T')[0]);
                    setAmount(String(payment.amount_original));
                    setAmountCurrency((payment.currency_original as CurrencyType) || 'CLP');
                } else {
                    // Default values for new payment
                    // Show CLP by default since "Monto esperado" already shows original currency
                    setIsPaid(false);
                    setPaymentDate(new Date().toISOString().split('T')[0]);
                    const amountInClp = expectedCurrency === 'CLP'
                        ? expectedAmount
                        : fromUnit(expectedAmount, expectedCurrency as any);
                    setAmount(String(Math.round(amountInClp))); // CLP doesn't need decimals
                    setAmountCurrency('CLP');
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

    // If there's no term for this period, show a message that payments are blocked
    // This happens when the month falls in a "paused" period (between closed terms)
    if (!term) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                <ExclamationTriangleIcon className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                Período Pausado
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6">
                        <div className="mb-4">
                            <p className="text-slate-900 dark:text-white font-medium text-lg mb-1">
                                No se puede registrar pago
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">
                                {monthNames[month]} {year} está fuera de los términos activos del compromiso.
                            </p>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                            Esto ocurre cuando el compromiso ha sido pausado o terminado antes de este mes.
                        </p>
                        <button
                            onClick={onClose}
                            className="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors shadow-lg shadow-slate-900/20"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const handleSave = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Allow 0 as a valid amount (e.g., waived payment)
            const parsed = parseFloat(amount);
            const amountValue = !isNaN(parsed) ? parsed : expectedAmount;

            const paymentData: PaymentFormData = {
                period_date: periodDate,
                payment_date: isPaid ? paymentDate : null,
                amount_original: amountValue,
                currency_original: amountCurrency,
                fx_rate_to_base: getFxRateToBase(amountCurrency),
            };

            console.log('[PaymentRecorder] Saving payment:', {
                existingPayment: existingPayment?.id,
                commitmentId: commitment.id,
                termId: term?.id,
                paymentData,
            });

            if (existingPayment) {
                // Update existing payment
                const result = await PaymentService.updatePayment(existingPayment.id, paymentData);
                console.log('[PaymentRecorder] Update result:', result);
                onSave('updated');
            } else {
                // Create new payment (even if pending - stores the expected amount)
                if (!term) {
                    throw new Error('No hay término activo para este período');
                }
                const result = await PaymentService.recordPayment(commitment.id, term.id, paymentData);
                console.log('[PaymentRecorder] Create result:', result);
                onSave('created');
            }
            onClose();
        } catch (err) {
            console.error('[PaymentRecorder] Error saving payment:', err);
            setError(err instanceof Error ? err.message : 'Error al guardar el pago');
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
            setError(err instanceof Error ? err.message : 'Error al eliminar el pago');
        } finally {
            setIsLoading(false);
        }
    };

    // Loading state while fetching payment
    if (isFetchingPayment) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
                <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-slate-700/50">
                    <div className="flex items-center gap-3 text-slate-300">
                        <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        <span>Cargando...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300">
            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/5 rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-rose-500/10 rounded-xl shrink-0 border border-rose-500/20">
                                <ExclamationTriangleIcon className="w-6 h-6 text-rose-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white leading-tight">
                                    Eliminar pago
                                </h3>
                                <p className="text-sm text-slate-400 mt-1">
                                    Esta acción no se puede deshacer.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-5 py-2.5 text-sm font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/50 rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isLoading}
                                className="px-5 py-2.5 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-colors shadow-lg shadow-rose-500/20"
                            >
                                {isLoading ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header Compacto con Glassmorphism */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-xl bg-gradient-to-br shrink-0 ${isPaid ? 'from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400' : 'from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-500 dark:text-slate-400'}`}>
                            {isPaid ? <CheckCircleIcon className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate" title={commitment.name}>
                                {commitment.name}
                            </h2>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {monthNames[month]} {year} · {existingPayment ? 'Editar' : 'Nuevo'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Delete Button - Only shown when editing existing payment */}
                        {existingPayment && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Eliminar registro de pago"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body Scrollable */}
                <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">

                    {/* Error message */}
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-300 text-sm flex gap-3 items-center animate-in fade-in slide-in-from-top-2">
                            <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* BENTO GRID LAYOUT */}
                    <div className="grid grid-cols-2 gap-4">

                        {/* 1. HERO CARD (Full Width) - Monto Esperado */}
                        <div className="col-span-2 relative overflow-hidden group rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 p-6 text-center shadow-sm">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Coins className="w-24 h-24 rotate-12" />
                            </div>

                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                                Monto Esperado
                            </p>
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-lg font-medium text-slate-500">{expectedCurrency}</span>
                                <span className={`text-4xl font-extrabold tracking-tight tabular-nums ${!isPaid ? 'text-white' : 'text-emerald-400'}`}>
                                    {expectedCurrency === 'CLP'
                                        ? expectedAmount.toLocaleString('es-CL')
                                        : expectedAmount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        {/* 2. TOGGLE STATUS - Dual Button Design */}
                        <div className="col-span-2 flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
                            {/* Pendiente Option */}
                            <button
                                type="button"
                                onClick={() => setIsPaid(false)}
                                className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${!isPaid
                                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-md ring-1 ring-amber-200/50 dark:ring-amber-500/20'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" strokeWidth="2" />
                                    <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
                                </svg>
                                <span>Pendiente</span>
                            </button>

                            {/* Pagado Option */}
                            <button
                                type="button"
                                onClick={() => setIsPaid(true)}
                                className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${isPaid
                                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                                    : 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20'
                                    }`}
                            >
                                <CheckCircleIcon className="w-4 h-4" />
                                <span>Marcar Pagado</span>
                            </button>
                        </div>

                        {/* Date Picker Card - Always visible, disabled when pending */}
                        <div
                            onClick={() => {
                                if (isPaid && datePickerRef.current) {
                                    datePickerRef.current.setFocus();
                                }
                            }}
                            className={`col-span-2 p-4 rounded-2xl border flex items-center gap-4 transition-all duration-300 ${isPaid
                                ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-pointer hover:border-sky-300 dark:hover:border-sky-600'
                                : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 cursor-not-allowed opacity-50'
                                }`}
                        >
                            <div className={`p-2 rounded-xl transition-colors ${isPaid
                                ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
                                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500'
                                }`}>
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Fecha de Pago
                                </label>
                                <DatePicker
                                    ref={datePickerRef}
                                    selected={paymentDate ? new Date(paymentDate + 'T12:00:00') : new Date()}
                                    onChange={(date: Date | null) => {
                                        if (date && isPaid) {
                                            const year = date.getFullYear();
                                            const month = String(date.getMonth() + 1).padStart(2, '0');
                                            const day = String(date.getDate()).padStart(2, '0');
                                            setPaymentDate(`${year}-${month}-${day}`);
                                        }
                                    }}
                                    disabled={!isPaid}
                                    onFocus={undefined}
                                    dateFormat="dd/MM/yyyy"
                                    locale="es"
                                    shouldCloseOnSelect={true}
                                    strictParsing
                                    placeholderText="dd/mm/aaaa"
                                    onKeyDown={(e) => {
                                        if (!isPaid) return;
                                        const navKeys = ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', '/'];
                                        if (navKeys.includes(e.key)) return;
                                        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                                        if (!/^\d$/.test(e.key)) {
                                            e.preventDefault();
                                            return;
                                        }
                                        const input = e.target as HTMLInputElement;
                                        if (input.value.length >= 10) {
                                            const selection = window.getSelection();
                                            if (!selection || selection.toString().length === 0) {
                                                e.preventDefault();
                                            }
                                        }
                                    }}
                                    className={`w-full bg-transparent p-0 border-none text-base font-bold focus:ring-0 focus:outline-none ${isPaid
                                        ? 'text-slate-900 dark:text-white cursor-pointer'
                                        : 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                        }`}
                                    wrapperClassName="w-full"
                                    popperClassName="z-[9999]"
                                    portalId="root"
                                    autoFocus={false}
                                />
                            </div>
                        </div>

                        {/* 3. AMOUNT INPUT ROW (Full Width, Animated) */}
                        <div className={`col-span-2 transition-all duration-500 ease-out opacity-100 translate-y-0`}>
                            <div className="relative group">
                                <label className="absolute -top-2.5 left-4 px-2 bg-white dark:bg-slate-900 text-xs font-bold text-blue-600 dark:text-blue-400 z-10 transition-colors">
                                    Monto Real
                                </label>
                                <div className="flex rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all overflow-hidden">
                                    {/* Currency Select */}
                                    <div className="relative border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                                        <select
                                            value={amountCurrency}
                                            onChange={(e) => {
                                                const newCurrency = e.target.value as CurrencyType;
                                                if (amount && parseFloat(amount) > 0 && newCurrency !== amountCurrency) {
                                                    const converted = convertAmount(parseFloat(amount), amountCurrency as any, newCurrency as any);
                                                    if (converted > 0) setAmount(converted.toString());
                                                }
                                                setAmountCurrency(newCurrency);
                                            }}
                                            className="h-full pl-3 pr-8 py-3 bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none appearance-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                                        >
                                            <option value="CLP">CLP</option>
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="UF">UF</option>
                                            <option value="UTM">UTM</option>
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>

                                    {/* Amount Input */}
                                    <input
                                        type="tel"
                                        value={amountCurrency === 'CLP' && amount ? Number(amount).toLocaleString('es-CL') : amount}
                                        onChange={(e) => {
                                            let val = e.target.value;
                                            if (amountCurrency === 'CLP') {
                                                // Remove dots for parsing
                                                val = val.replace(/\./g, '');
                                            }
                                            // Allow empty or valid number
                                            if (val === '' || !isNaN(Number(val))) {
                                                setAmount(val);
                                            }
                                        }}
                                        placeholder={amountCurrency === 'CLP' ? expectedAmount.toLocaleString('es-CL') : String(expectedAmount)}
                                        className="flex-1 px-4 py-3 bg-slate-800 text-lg font-bold tabular-nums tracking-tight text-white placeholder-slate-500 focus:outline-none"
                                    />
                                </div>

                                {/* Conversion Hint */}
                                {amountCurrency !== 'CLP' && amount && parseFloat(amount) > 0 && (
                                    <div className="absolute right-2 -bottom-6 text-xs font-mono text-slate-400">
                                        ≈ {formatClp(fromUnit(parseFloat(amount), amountCurrency as any))}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer Actions - Simplified */}
                <div className="p-6 pt-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-white shadow-xl transition-all active:scale-[0.98] ${isPaid
                            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25 ring-2 ring-emerald-600/20'
                            : 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/25 dark:bg-sky-600 dark:hover:bg-sky-500'
                            }`}
                    >
                        {isLoading ? (
                            <span className="animate-spin">⏳</span>
                        ) : (
                            isPaid ? <CheckCircleIcon className="w-5 h-5" /> : <Banknote className="w-5 h-5" />
                        )}
                        <span>{existingPayment ? 'Actualizar Registro' : isPaid ? 'Confirmar Pago' : 'Guardar Pendiente'}</span>
                    </button>
                </div>
            </div>
        </div >
    );
};

export default PaymentRecorder;
