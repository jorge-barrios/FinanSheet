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

import React, { useState, useEffect } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { useCurrency } from '../hooks/useCurrency';
import { PaymentService } from '../services/dataService.v2';
import { getPerPeriodAmount } from '../utils/financialUtils.v2';
import { findTermForPeriod } from '../utils/termUtils';
import type { CommitmentWithTerm, Payment, PaymentFormData, Term } from '../types.v2';
import { XMarkIcon, CheckCircleIcon, TrashIcon, ExclamationTriangleIcon } from './icons';
import { Calendar, Wallet, FileText, Save } from 'lucide-react';
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
    onSave: (operation: 'created' | 'updated' | 'deleted') => void;
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

    // CRITICAL: Find the term that covers THIS specific period
    const monthDate = new Date(year, month, 1);
    const term: Term | null = findTermForPeriod(commitment, monthDate);

    // Currency type
    type CurrencyType = 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM';

    // Ref for date picker
    const datePickerRef = React.useRef<DatePicker>(null);

    // Form state
    const [paymentDate, setPaymentDate] = useState('');
    const [amount, setAmount] = useState('');
    const [amountCurrency, setAmountCurrency] = useState<CurrencyType>('CLP');
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingPayment, setIsFetchingPayment] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Existing payment state
    const [existingPayment, setExistingPayment] = useState<Payment | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Derived: is currently marked as paid?
    const isPaid = existingPayment?.payment_date != null;

    // Expected amount from term
    const expectedAmount = term ? getPerPeriodAmount(term, false) : 0;
    const expectedCurrency = term?.currency_original || 'CLP';

    // Month names
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

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
                } else {
                    // Default values for new payment
                    setPaymentDate(new Date().toISOString().split('T')[0]);
                    const amountInClp = expectedCurrency === 'CLP'
                        ? expectedAmount
                        : fromUnit(expectedAmount, expectedCurrency as any);
                    setAmount(String(Math.round(amountInClp)));
                    setAmountCurrency('CLP');
                    setNotes('');
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

    // Paused period message
    if (!term) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
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

    // Save as pending (no payment_date)
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
            };

            if (existingPayment) {
                await PaymentService.updatePayment(existingPayment.id, paymentData);
                onSave('updated');
            } else {
                await PaymentService.recordPayment(commitment.id, term.id, paymentData);
                onSave('created');
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
            };

            if (existingPayment) {
                await PaymentService.updatePayment(existingPayment.id, paymentData);
                onSave('updated');
            } else {
                await PaymentService.recordPayment(commitment.id, term.id, paymentData);
                onSave('created');
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
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
                <div className="bg-slate-900/95 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
                    <div className="flex items-center gap-3 text-slate-300">
                        <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        <span>Cargando...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl w-full max-w-sm p-5">
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

            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-lg shrink-0 ${isPaid
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}>
                            {isPaid ? <CheckCircleIcon className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate" title={commitment.name}>
                                {commitment.name}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {monthNames[month]} {year}
                                {isPaid && <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">· Pagado</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {existingPayment && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                title="Eliminar registro"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar">

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-300 text-sm flex gap-2 items-center">
                            <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Expected Amount - Compact */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Esperado</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-sm text-slate-400">{expectedCurrency}</span>
                            <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                                {expectedCurrency === 'CLP'
                                    ? expectedAmount.toLocaleString('es-CL')
                                    : expectedAmount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {expectedCurrency !== 'CLP' && (
                                <span className="text-xs text-slate-400">
                                    (~{formatClp(fromUnit(expectedAmount, expectedCurrency as any))})
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Date Field - Always Editable */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            Fecha de Pago
                        </label>
                        <div
                            onClick={() => datePickerRef.current?.setFocus()}
                            className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:border-sky-300 dark:hover:border-sky-600 transition-colors"
                        >
                            <Calendar className="w-5 h-5 text-sky-500" />
                            <div className="flex-1" onClick={(e) => e.stopPropagation()}>
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
                                    className="w-full bg-transparent text-base font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                                    wrapperClassName="w-full"
                                    popperClassName="z-[9999]"
                                    portalId="root"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Amount Field */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            Monto Pagado
                        </label>
                        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-transparent transition-all">
                            <div className="relative border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
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
                                    className="h-full pl-3 pr-7 py-3 bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none appearance-none cursor-pointer"
                                >
                                    <option value="CLP">CLP</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="UF">UF</option>
                                    <option value="UTM">UTM</option>
                                </select>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            <input
                                type="tel"
                                value={amountCurrency === 'CLP' && amount ? Number(amount).toLocaleString('es-CL') : amount}
                                onChange={(e) => {
                                    let val = e.target.value;
                                    if (amountCurrency === 'CLP') {
                                        val = val.replace(/\./g, '');
                                    }
                                    if (val === '' || !isNaN(Number(val))) {
                                        setAmount(val);
                                    }
                                }}
                                placeholder={amountCurrency === 'CLP' ? expectedAmount.toLocaleString('es-CL') : String(expectedAmount)}
                                className="flex-1 px-3 py-3 bg-white dark:bg-slate-800 text-base font-semibold tabular-nums text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                            />
                        </div>
                        {amountCurrency !== 'CLP' && amount && parseFloat(amount) > 0 && (
                            <p className="mt-1 text-xs text-slate-400 text-right">
                                ≈ {formatClp(fromUnit(parseFloat(amount), amountCurrency as any))}
                            </p>
                        )}
                    </div>

                    {/* Notes Field */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            <span className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" />
                                Nota (opcional)
                            </span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                            placeholder="Ej: Pagado con tarjeta, monto ajustado por IPC..."
                            rows={2}
                            className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none transition-all"
                        />
                        {notes.length > 0 && (
                            <p className="mt-1 text-xs text-slate-400 text-right">{notes.length}/500</p>
                        )}
                    </div>
                </div>

                {/* Footer - Two Explicit Buttons */}
                <div className="p-5 pt-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    {/* Save as Pending */}
                    <button
                        onClick={handleSavePending}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        <span>Guardar Pendiente</span>
                    </button>

                    {/* Confirm as Paid */}
                    <button
                        onClick={handleConfirmPayment}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <CheckCircleIcon className="w-5 h-5" />
                        )}
                        <span>Confirmar Pago</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentRecorder;
