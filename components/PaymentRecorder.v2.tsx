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
import type { CommitmentWithTerm, Payment, PaymentFormData } from '../types.v2';
import { XMarkIcon, CheckCircleIcon, TrashIcon, CalendarIcon, ExclamationTriangleIcon } from './icons';

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
    const term = commitment.active_term;

    // Currency type
    type CurrencyType = 'CLP' | 'USD' | 'UF';

    // Form state
    const [isPaid, setIsPaid] = useState(false);
    const [paymentDate, setPaymentDate] = useState('');
    const [amount, setAmount] = useState('');
    const [amountCurrency, setAmountCurrency] = useState<CurrencyType>((term?.currency_original as CurrencyType) || 'CLP');
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
                    setIsPaid(false);
                    setPaymentDate(new Date().toISOString().split('T')[0]);
                    setAmount(String(expectedAmount));
                    setAmountCurrency((expectedCurrency as CurrencyType) || 'CLP');
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

    if (!isOpen || !term) return null;

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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Confirmar eliminación
                            </h3>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">
                            ¿Estás seguro de que deseas eliminar este registro de pago de {monthNames[month]} {year}?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isLoading}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isLoading ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {existingPayment ? 'Editar Pago' : 'Registrar Pago'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {commitment.name} · {monthNames[month]} {year}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    {/* Error message */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Existing payment indicator */}
                    {existingPayment && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm">
                                <CheckCircleIcon className="w-4 h-4" />
                                <span>Ya existe un registro de pago para este período</span>
                            </div>
                        </div>
                    )}

                    {/* Expected amount info */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                Monto esperado ({expectedCurrency}):
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                                {expectedCurrency} {formatClp(expectedAmount)}
                            </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Puedes registrar el pago en cualquier moneda
                        </div>
                    </div>

                    {/* Paid toggle */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsPaid(!isPaid)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPaid ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPaid ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {isPaid ? (
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircleIcon className="w-4 h-4" /> Pagado
                                </span>
                            ) : (
                                'Marcar como pagado'
                            )}
                        </label>
                    </div>

                    {/* Payment date (only if paid) */}
                    {isPaid && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                                <CalendarIcon className="w-4 h-4 inline mr-1" />
                                Fecha de pago
                            </label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            />
                        </div>
                    )}

                    {/* Amount - integrated currency selector like CommitmentForm */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                            Monto pagado
                        </label>
                        <div className="flex">
                            <select
                                value={amountCurrency}
                                onChange={(e) => {
                                    const newCurrency = e.target.value as CurrencyType;
                                    // Hot conversion: convert amount when changing currency
                                    if (amount && parseFloat(amount) > 0 && newCurrency !== amountCurrency) {
                                        const converted = convertAmount(
                                            parseFloat(amount),
                                            amountCurrency as any,
                                            newCurrency as any
                                        );
                                        if (converted > 0) {
                                            setAmount(converted.toString());
                                        }
                                    }
                                    setAmountCurrency(newCurrency);
                                }}
                                className="px-2 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-r-0 border-slate-300 dark:border-slate-600 rounded-l-md text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="CLP">CLP</option>
                                <option value="USD">USD</option>
                                <option value="UF">UF</option>
                            </select>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={String(expectedAmount)}
                                className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-r-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:text-white placeholder-slate-400"
                            />
                        </div>
                        {/* Show conversion to CLP */}
                        {amountCurrency !== 'CLP' && amount && parseFloat(amount) > 0 && (
                            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                ≈ {formatClp(fromUnit(parseFloat(amount), amountCurrency as 'USD' | 'UF'))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <div>
                        {existingPayment && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isLoading}
                                className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Eliminar
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    Guardando...
                                </>
                            ) : (
                                existingPayment ? 'Actualizar' : 'Guardar'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentRecorder;
