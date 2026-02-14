
import React, { useState, useEffect, useRef } from 'react';
import { Expense, PaymentDetails, PaymentUnit } from '../types';
import { useLocalization } from '../hooks/useLocalization';
import { getAmountForMonth } from '../utils/expenseCalculations';
import CurrencyService from '../services/currencyService';
import { getExchangeRate } from '../services/exchangeRateService';

interface CellEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (details: Partial<PaymentDetails>) => void;
    expense: Expense;
    paymentDetails: PaymentDetails | undefined;
    year: number;
    month: number;
    onDelete?: () => void;
}

const formInputClasses = "w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all";
const formLabelClasses = "block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5";


const CellEditModal: React.FC<CellEditModalProps> = ({ isOpen, onClose, onSave, expense, paymentDetails, year, month, onDelete }) => {
    const { t, currency, getLocalizedMonths } = useLocalization();

    const [displayAmount, setDisplayAmount] = useState('');
    const [dueDate, setDueDate] = useState(expense.dueDate);
    const [isPaid, setIsPaid] = useState(false);
    const [paymentDate, setPaymentDate] = useState(''); // YYYY-MM-DD format
    const [unit, setUnit] = useState<PaymentUnit>(currency);
    const [defaultAmountInBase, setDefaultAmountInBase] = useState(0);

    // Convert an amount from one unit to another using API-backed rates.
    // If paid and a payment date is present, use historical rates for that date; else use current snapshot.
    const convertBetweenUnitsApiBacked = async (amount: number, fromUnit: PaymentUnit, toUnit: PaymentUnit): Promise<number> => {
        if (fromUnit === toUnit) return amount;
        // First convert from 'fromUnit' to CLP
        let amountInClp = amount;
        if (fromUnit === 'CLP') {
            amountInClp = amount;
        } else if (isPaid && paymentDate) {
            // Historical rate by date
            const [y, m, d] = paymentDate.split('-').map(p => parseInt(p, 10));
            const dateStr = `${d.toString().padStart(2, '0')}-${m.toString().padStart(2, '0')}-${y}`;
            const rate = await getExchangeRate(fromUnit, dateStr); // CLP per unit
            amountInClp = amount * rate;
        } else {
            amountInClp = CurrencyService.fromUnit(amount, fromUnit as any);
        }
        // Then convert CLP to 'toUnit'
        if (toUnit === 'CLP') return amountInClp;
        if (isPaid && paymentDate) {
            const [y, m, d] = paymentDate.split('-').map(p => parseInt(p, 10));
            const dateStr = `${d.toString().padStart(2, '0')}-${m.toString().padStart(2, '0')}-${y}`;
            const rateTo = await getExchangeRate(toUnit, dateStr); // CLP per unit
            if (!rateTo) return amount; // fallback
            return amountInClp / rateTo;
        }
        const converted = CurrencyService.toUnit(amountInClp, toUnit as any);
        return converted;
    };

    const handleUnitChange = async (nextUnit: PaymentUnit) => {
        const currentVal = parseFloat(displayAmount) || 0;
        const converted = await convertBetweenUnitsApiBacked(currentVal, unit, nextUnit);
        setUnit(nextUnit);
        const formatted = nextUnit === 'CLP' ? String(Math.round(converted)) : String(parseFloat(converted.toFixed(6)));
        setDisplayAmount(formatted);
    };

    // Robust overlay click handling to prevent accidental close on drag/select
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const [mouseDownOnOverlay, setMouseDownOnOverlay] = useState(false);

    const handleOverlayMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
        if (e.target === overlayRef.current) {
            setMouseDownOnOverlay(true);
        } else {
            setMouseDownOnOverlay(false);
        }
    };

    const handleOverlayMouseUp: React.MouseEventHandler<HTMLDivElement> = (e) => {
        // Only close if both mousedown and mouseup happened on the overlay (true backdrop click)
        if (e.target === overlayRef.current && mouseDownOnOverlay) {
            onClose();
        }
        setMouseDownOnOverlay(false);
    };

    useEffect(() => {
        if (isOpen) {
            // Compute amount using centralized function
            const computedDefaultAmount = getAmountForMonth(expense, year, month, paymentDetails);
            setDefaultAmountInBase(computedDefaultAmount);
            setDisplayAmount(String(computedDefaultAmount.toFixed(0)));

            setDueDate(paymentDetails?.overriddenDueDate ?? expense.dueDate);
            setIsPaid(paymentDetails?.paid ?? false);

            setUnit(currency); // Reset to current display currency on open

            if (paymentDetails?.paymentDate) {
                setPaymentDate(new Date(paymentDetails.paymentDate).toISOString().split('T')[0]);
            } else {
                setPaymentDate(new Date().toISOString().split('T')[0]); // Default to today
            }
        }
    }, [isOpen, paymentDetails, expense, year, month, currency]);


    useEffect(() => {
        if (!isOpen) return;
        const onKey = (ev: KeyboardEvent) => {
            if (ev.key === 'Escape') {
                ev.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', onKey, { capture: true });
        return () => document.removeEventListener('keydown', onKey, { capture: true } as any);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const hasRecord = !!paymentDetails; // Only enable destructive actions if a saved record exists

    const handleSave = async () => {
        const newDetails: Partial<PaymentDetails> = {
            paid: isPaid,
        };

        const displayValue = parseFloat(displayAmount) || 0;
        // Always save overriddenAmount in CLP using API-backed rates
        let savedAmountInClp: number;
        if (unit === 'CLP') {
            savedAmountInClp = displayValue;
        } else if (isPaid && paymentDate) {
            const [y, m, d] = paymentDate.split('-').map(p => parseInt(p, 10));
            const dateStr = `${d.toString().padStart(2, '0')}-${m.toString().padStart(2, '0')}-${y}`;
            const rate = await getExchangeRate(unit, dateStr);
            savedAmountInClp = displayValue * rate;
        } else {
            savedAmountInClp = CurrencyService.fromUnit(displayValue, unit as any);
        }
        
        // If the installment is paid, ALWAYS save the amount to freeze it.
        // Otherwise, only save it if it's different from the default.
        if (isPaid) {
            newDetails.overriddenAmount = savedAmountInClp;
        } else if (Math.abs(savedAmountInClp - defaultAmountInBase) > 0.001) {
            newDetails.overriddenAmount = savedAmountInClp;
        } else {
            newDetails.overriddenAmount = undefined; // Explicitly clear if not paid and returned to default
        }
        
        if (dueDate !== expense.dueDate) {
            newDetails.overriddenDueDate = dueDate;
        } else {
            newDetails.overriddenDueDate = undefined; // Explicitly clear
        }
        
        if (isPaid) {
            const dateParts = paymentDate.split('-').map(p => parseInt(p, 10));
            const dateTimestamp = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getTime();
            newDetails.paymentDate = dateTimestamp;
        }

        onSave(newDetails);
        onClose();
    };

    const monthName = getLocalizedMonths('long')[month];
    const title = `${expense.name} - ${monthName} ${year}`;

    return (
         <div
            ref={overlayRef}
            className="fixed inset-0 bg-black bg-opacity-75 z-[120] flex justify-center items-center p-4"
            onMouseDown={handleOverlayMouseDown}
            onMouseUp={handleOverlayMouseUp}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cell-edit-title"
        >
            <div className="bg-slate-50 dark:bg-slate-850 rounded-xl shadow-2xl p-6 w-full max-w-md ring-1 ring-slate-200 dark:ring-slate-700/50" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()}>
                <h2 id="cell-edit-title" className="text-xl font-bold mb-1 text-slate-800 dark:text-white">{t('cell_edit.title')}</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">{title}</p>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="cell-amount" className={formLabelClasses}>{t('cell_edit.amount')}</label>
                        <div className="flex gap-2">
                           <input
                                type="number"
                                id="cell-amount"
                                value={displayAmount}
                                onChange={e => setDisplayAmount(e.target.value)}
                                className={formInputClasses}
                                step="any"
                            />
                            <select id="cell-unit" value={unit} onChange={e => handleUnitChange(e.target.value as PaymentUnit)} className="w-40 bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                                <option value="CLP">{t('unit.CLP')}</option>
                                <option value="USD">{t('unit.USD')}</option>
                                <option value="UF">{t('unit.UF')}</option>
                                <option value="UTM">{t('unit.UTM')}</option>
                            </select>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="cell-dueDate" className={formLabelClasses}>{t('cell_edit.dueDate')}</label>
                        <input
                            type="number"
                            id="cell-dueDate"
                            value={dueDate}
                            onChange={e => setDueDate(parseInt(e.target.value) || 1)}
                            className={formInputClasses}
                            min="1"
                            max="31"
                        />
                    </div>
                    <div>
                        <label className={formLabelClasses}>{t('cell_edit.status')}</label>
                        <button
                            type="button"
                            onClick={() => setIsPaid(p => !p)}
                            className={`w-full p-2 rounded-md font-semibold transition-colors ${
                                isPaid 
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                : 'bg-orange-400 hover:bg-orange-500 text-white'
                            }`}
                        >
                            {isPaid ? t('cell_edit.markUnpaid') : t('cell_edit.markPaid')}
                        </button>
                    </div>
                    {isPaid && (
                         <div>
                            <label htmlFor="cell-paymentDate" className={formLabelClasses}>{t('cell_edit.paymentDate')}</label>
                            <input
                                type="date"
                                id="cell-paymentDate"
                                value={paymentDate}
                                onChange={e => setPaymentDate(e.target.value)}
                                className={formInputClasses}
                            />
                        </div>
                    )}
                </div>
                 <div className="flex items-center justify-between pt-6 mt-4 border-t border-slate-200 dark:border-slate-700/50">
                    <div>
                        {onDelete && (
                            <button
                                type="button"
                                disabled={!hasRecord}
                                onClick={() => { if (hasRecord) onDelete(); }}
                                className={`px-3 py-2 rounded-lg text-white font-medium transition-colors ${hasRecord ? 'bg-rose-600 hover:bg-rose-700' : 'bg-rose-600/50 cursor-not-allowed opacity-60'}`}
                                aria-disabled={!hasRecord}
                                title={hasRecord ? '' : 'No hay registro de pago guardado para eliminar'}
                            >
                                Eliminar registro
                            </button>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium">{t('cell_edit.cancel')}</button>
                        <button type="button" onClick={handleSave} className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 dark:hover:bg-sky-400 text-white transition-colors font-medium">{t('cell_edit.save')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CellEditModal;
