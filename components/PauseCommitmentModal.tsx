/**
 * PauseCommitmentModal.tsx
 * 
 * Modal for pausing or terminating a commitment.
 * Lets user select the last active month before pause takes effect.
 */

import React, { useState, useEffect } from 'react';
import { XMarkIcon, PauseCircleIcon, ExclamationTriangleIcon, CalendarIcon } from './icons';
import { TermService } from '../services/dataService.v2';
import type { CommitmentWithTerm } from '../types.v2';

interface PauseCommitmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    commitment: CommitmentWithTerm;
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const PauseCommitmentModal: React.FC<PauseCommitmentModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    commitment,
}) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    // Default to current month
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentsWarning, setPaymentsWarning] = useState<number>(0);

    // Check if commitment has installments (cannot be paused)
    const hasInstallments = !!(commitment.active_term?.installments_count &&
                            commitment.active_term.installments_count > 1);

    // Block pausing commitments with installments
    useEffect(() => {
        if (!isOpen) return;

        if (hasInstallments) {
            setError('Este compromiso tiene cuotas definidas. Para terminarlo anticipadamente, edítelo y modifique la cantidad de cuotas.');
        } else {
            setError(null);
        }
    }, [isOpen, hasInstallments]);

    // Check for payments after selected date
    useEffect(() => {
        if (!isOpen || !commitment.id || hasInstallments) return;

        const checkPayments = async () => {
            try {
                const lastMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
                const payments = await TermService.getPaymentsAfterDate(commitment.id, `${lastMonth}-01`);
                setPaymentsWarning(payments.length);
            } catch (err) {
                console.error('Error checking payments:', err);
            }
        };

        checkPayments();
    }, [isOpen, commitment.id, selectedYear, selectedMonth, hasInstallments]);

    // Handle ESC key
    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', handleEsc, { capture: true });
        return () => document.removeEventListener('keydown', handleEsc, { capture: true } as any);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handlePause = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const lastMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
            const result = await TermService.pauseCommitment(commitment.id, lastMonth);

            if (result) {
                onSuccess();
                onClose();
            } else {
                setError('No se pudo pausar el compromiso');
            }
        } catch (err) {
            console.error('Error pausing commitment:', err);
            setError(err instanceof Error ? err.message : 'Error al pausar el compromiso');
        } finally {
            setIsLoading(false);
        }
    };

    // Generate year options (current year - 1 to current year + 2)
    const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - 1 + i);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[120]">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                            <PauseCircleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Pausar Compromiso
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {commitment.name}
                            </p>
                        </div>
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

                    {/* Info */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Selecciona el <strong>último mes</strong> en que este compromiso estará activo.
                            A partir del mes siguiente, no aparecerá en tus pagos pendientes.
                        </p>
                    </div>

                    {/* Month/Year selector */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                            <CalendarIcon className="w-4 h-4 inline mr-1" />
                            Último mes activo
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            >
                                {MONTHS.map((month, idx) => (
                                    <option key={idx} value={idx}>{month}</option>
                                ))}
                            </select>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="w-24 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            >
                                {yearOptions.map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Payments warning */}
                    {paymentsWarning > 0 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <div className="flex items-start gap-2">
                                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                        Pagos existentes después de esta fecha
                                    </p>
                                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                        Hay {paymentsWarning} pago(s) registrado(s) después de {MONTHS[selectedMonth]} {selectedYear}.
                                        Estos pagos <strong>no serán eliminados</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handlePause}
                        disabled={isLoading || hasInstallments}
                        className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                Pausando...
                            </>
                        ) : (
                            <>
                                <PauseCircleIcon className="w-4 h-4" />
                                Pausar desde {MONTHS[selectedMonth + 1] || MONTHS[0]} {selectedMonth === 11 ? selectedYear + 1 : selectedYear}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PauseCommitmentModal;
