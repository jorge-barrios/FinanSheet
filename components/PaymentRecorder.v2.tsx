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

// =============================================================================
// TYPES
// =============================================================================

interface PaymentRecorderProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (operation: 'created' | 'updated' | 'deleted') => void; // Callback with operation type
    commitment: CommitmentWithTerm;
    year: number;
    month: number; // 0-indexed
}

// =============================================================================
// COMPONENT
// =============================================================================

const PaymentRecorder: React.FC<PaymentRecorderProps> = ({
    isOpen,
    onClose,
    onSave,
    commitment,
    year,
    month,
}) => {
    const { formatClp } = useLocalization();
    const { fromUnit, convertAmount, getFxRateToBase } = useCurrency();

    // CRITICAL: Find the term that covers THIS specific period, not just active_term
    // This ensures payments for historical months are associated with the correct term
    // Example: If V1 covers Jan-Jun and V2 covers Jul-∞, paying for April should use V1
    const monthDate = new Date(year, month, 1);
    const term: Term | null = findTermForPeriod(commitment, monthDate);

    // Currency type
    // Currency type - updated to include EUR and UTM
    type CurrencyType = 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM';

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

    // Period date string (YYYY-MM-DD format, first day of month)
    const periodDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;

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
            const amountValue = parseFloat(amount) || expectedAmount;

            const paymentData: PaymentFormData = {
                period_date: periodDate,
                payment_date: isPaid ? paymentDate : null,
                amount_original: amountValue,
                currency_original: amountCurrency,
                fx_rate_to_base: getFxRateToBase(amountCurrency),  // ✅ Using centralized function
            };

            if (existingPayment) {
                // Update existing payment
                await PaymentService.updatePayment(existingPayment.id, paymentData);
                onSave('updated');
            } else {
                // Create new payment
                await PaymentService.recordPayment(commitment.id, term.id, paymentData);
                onSave('created');
            }
            onClose();
        } catch (err) {
            console.error('Error saving payment:', err);
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
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-8">
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                        <span className="animate-spin text-2xl">⏳</span>
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
                    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full shrink-0">
                                <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                    Eliminar pago
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Esta acción no se puede deshacer.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isLoading}
                                className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-colors shadow-lg shadow-red-600/20"
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
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl bg-gradient-to-br ${isPaid ? 'from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400' : 'from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-500 dark:text-slate-400'}`}>
                            {isPaid ? <CheckCircleIcon className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                {existingPayment ? 'Editar Pago' : 'Registrar Pago'}
                            </h2>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {year} · {monthNames[month]}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
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
                        <div className="col-span-2 relative overflow-hidden group rounded-2xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700/50 p-6 text-center shadow-sm">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Coins className="w-24 h-24 rotate-12" />
                            </div>

                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                                Monto Esperado
                            </p>
                            <div className="flex items-center justify-center gap-2 text-slate-900 dark:text-white">
                                <span className="text-lg font-medium text-slate-400">{expectedCurrency}</span>
                                <span className={`text-4xl font-extrabold tracking-tight ${!isPaid ? 'text-slate-900 dark:text-white' : 'text-emerald-500 dark:text-emerald-400'}`}>
                                    {expectedCurrency === 'CLP'
                                        ? formatClp(expectedAmount).replace('$', '')
                                        : expectedAmount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">
                                {commitment.name}
                            </p>
                        </div>

                        {/* 2. ACTIONS ROW */}

                        {/* Toggle Status Card */}
                        <button
                            type="button"
                            onClick={() => setIsPaid(!isPaid)}
                            className={`col-span-1 p-4 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-2 group relative overflow-hidden outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-slate-900 ${isPaid
                                ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-500/25'
                                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                }`}
                        >
                            <div className={`p-2 rounded-full transition-transform duration-300 group-hover:scale-110 ${isPaid ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                <CheckCircleIcon className="w-6 h-6" />
                            </div>
                            <span className="font-bold text-sm">
                                {isPaid ? 'Pagado' : 'Pendiente'}
                            </span>
                            {/* Ripple effect hint */}
                            {isPaid && <div className="absolute inset-0 bg-white/10 animate-pulse rounded-2xl" />}
                        </button>

                        {/* Date Picker Card */}
                        <div className={`col-span-1 p-4 rounded-2xl border flex flex-col justify-center gap-1 transition-all duration-300 ${isPaid
                            ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-100'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-50 grayscale cursor-not-allowed'
                            }`}>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Fecha
                            </label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                onFocus={() => !isPaid && setIsPaid(true)}
                                className="w-full bg-transparent p-0 border-none text-sm font-bold text-slate-900 dark:text-white focus:ring-0 focus:outline-none cursor-pointer"
                            />
                        </div>

                        {/* 3. AMOUNT INPUT ROW (Full Width, Animated) */}
                        <div className={`col-span-2 transition-all duration-500 ease-out ${isPaid ? 'opacity-100 translate-y-0' : 'opacity-80 translate-y-0'}`}>
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
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>

                                    {/* Amount Input */}
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        onFocus={() => !isPaid && setIsPaid(true)}
                                        placeholder={String(expectedAmount)}
                                        className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 text-lg font-mono font-bold text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none"
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

                {/* Footer Actions */}
                <div className="p-6 pt-2 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                    {existingPayment && (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="px-4 py-3 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 transition-colors"
                            title="Eliminar Pago"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-white shadow-xl transition-all active:scale-[0.98] ${isPaid
                            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25 ring-2 ring-emerald-600/20'
                            : 'bg-slate-800 hover:bg-slate-700 shadow-slate-900/20 dark:bg-blue-600 dark:hover:bg-blue-500 dark:shadow-blue-600/25'
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
