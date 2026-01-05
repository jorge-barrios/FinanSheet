/**
 * ResumeCommitmentModal.tsx
 *
 * Modal for resuming a paused/terminated commitment.
 * Lets user configure the new term: start month, due day, amount, frequency.
 */

import React, { useState, useEffect } from 'react';
import { XMarkIcon, ArrowPathIcon, CalendarIcon, CurrencyDollarIcon } from './icons';
import { TermService } from '../services/dataService.v2';
import type { CommitmentWithTerm, TermFormData, Frequency } from '../types.v2';

interface ResumeCommitmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    commitment: CommitmentWithTerm;
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const FREQUENCIES: { value: Frequency; label: string }[] = [
    { value: 'MONTHLY', label: 'Mensual' },
    { value: 'BIMONTHLY', label: 'Bimestral' },
    { value: 'QUARTERLY', label: 'Trimestral' },
    { value: 'SEMIANNUALLY', label: 'Semestral' },
    { value: 'ANNUALLY', label: 'Anual' },
];

const ResumeCommitmentModal: React.FC<ResumeCommitmentModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    commitment,
}) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    // Get the last term's data as defaults
    const lastTerm = commitment.active_term || commitment.all_terms?.[0];

    // Form state
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [dueDay, setDueDay] = useState(lastTerm?.due_day_of_month ?? 1);
    const [amount, setAmount] = useState(lastTerm?.amount_original ?? 0);
    const [currency, setCurrency] = useState(lastTerm?.currency_original ?? 'CLP');
    const [frequency, setFrequency] = useState<Frequency>(lastTerm?.frequency ?? 'MONTHLY');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen && lastTerm) {
            setSelectedYear(currentYear);
            setSelectedMonth(currentMonth);
            setDueDay(lastTerm.due_day_of_month ?? 1);
            setAmount(lastTerm.amount_original);
            setCurrency(lastTerm.currency_original);
            setFrequency(lastTerm.frequency);
            setError(null);
        }
    }, [isOpen, lastTerm, currentYear, currentMonth]);

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

    const handleResume = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Build effective_from date (first day of selected month)
            const effectiveFrom = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;

            const termData: TermFormData = {
                effective_from: effectiveFrom,
                effective_until: null,
                frequency,
                installments_count: null,
                due_day_of_month: dueDay,
                currency_original: currency,
                amount_original: amount,
                fx_rate_to_base: lastTerm?.fx_rate_to_base ?? 1,
                estimation_mode: lastTerm?.estimation_mode ?? null,
                is_divided_amount: null,
            };

            const result = await TermService.createTerm(commitment.id, termData);

            if (result) {
                onSuccess();
                onClose();
            } else {
                setError('No se pudo reanudar el compromiso');
            }
        } catch (err) {
            console.error('Error resuming commitment:', err);
            setError(err instanceof Error ? err.message : 'Error al reanudar el compromiso');
        } finally {
            setIsLoading(false);
        }
    };

    // Generate year options (current year - 1 to current year + 2)
    const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - 1 + i);

    // Generate day options (1-31)
    const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                            <ArrowPathIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Reanudar Compromiso
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
                            Configura el nuevo período de este compromiso.
                            Se creará un nuevo término desde el mes seleccionado.
                        </p>
                    </div>

                    {/* Start Month/Year selector */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                            <CalendarIcon className="w-4 h-4 inline mr-1" />
                            Primer mes activo
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                                {MONTHS.map((month, idx) => (
                                    <option key={idx} value={idx}>{month}</option>
                                ))}
                            </select>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="w-24 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                                {yearOptions.map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Due Day */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                            Día de vencimiento
                        </label>
                        <select
                            value={dueDay}
                            onChange={(e) => setDueDay(parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                            {dayOptions.map((day) => (
                                <option key={day} value={day}>Día {day}</option>
                            ))}
                        </select>
                    </div>

                    {/* Amount and Currency */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                            <CurrencyDollarIcon className="w-4 h-4 inline mr-1" />
                            Monto
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-24 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                                <option value="CLP">CLP</option>
                                <option value="USD">USD</option>
                                <option value="UF">UF</option>
                                <option value="UTM">UTM</option>
                                <option value="EUR">EUR</option>
                            </select>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                min="0"
                                step={currency === 'CLP' ? '1' : '0.01'}
                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    {/* Frequency */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                            Frecuencia
                        </label>
                        <select
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as Frequency)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                            {FREQUENCIES.map((f) => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                        </select>
                    </div>
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
                        onClick={handleResume}
                        disabled={isLoading || amount <= 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                Reanudando...
                            </>
                        ) : (
                            <>
                                <ArrowPathIcon className="w-4 h-4" />
                                Reanudar desde {MONTHS[selectedMonth]} {selectedYear}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResumeCommitmentModal;
