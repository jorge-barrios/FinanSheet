
import React, { useState, useEffect } from 'react';
import { Expense, PaymentDetails, PaymentUnit } from '../types';
import { useLocalization } from '../hooks/useLocalization';
import { getInstallmentAmount } from '../utils/expenseCalculations';

interface CellEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (details: Partial<PaymentDetails>) => void;
    expense: Expense;
    paymentDetails: PaymentDetails | undefined;
    year: number;
    month: number;
}

const formInputClasses = "w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all";
const formSelectClasses = `${formInputClasses} appearance-none`;
const formLabelClasses = "block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5";


const CellEditModal: React.FC<CellEditModalProps> = ({ isOpen, onClose, onSave, expense, paymentDetails, year, month }) => {
    const { t, currency, getLocalizedMonths, fromBase, toBaseFromUnit } = useLocalization();

    const [displayAmount, setDisplayAmount] = useState('');
    const [dueDate, setDueDate] = useState(expense.dueDate);
    const [isPaid, setIsPaid] = useState(false);
    const [paymentDate, setPaymentDate] = useState(''); // YYYY-MM-DD format
    const [unit, setUnit] = useState<PaymentUnit>(currency);

    const defaultAmountInBase = getInstallmentAmount(expense);

    useEffect(() => {
        if (isOpen) {
            const amountInBase = paymentDetails?.overriddenAmount ?? defaultAmountInBase;
            const amountInDisplay = fromBase(amountInBase);
            setDisplayAmount(String(amountInDisplay.toFixed(currency === 'CLP' ? 0 : 2)));
            
            setDueDate(paymentDetails?.overriddenDueDate ?? expense.dueDate);
            setIsPaid(paymentDetails?.paid ?? false);
            
            setUnit(currency); // Reset to current display currency on open

            if (paymentDetails?.paymentDate) {
                setPaymentDate(new Date(paymentDetails.paymentDate).toISOString().split('T')[0]);
            } else {
                setPaymentDate(new Date().toISOString().split('T')[0]); // Default to today
            }
        }
    }, [isOpen, paymentDetails, defaultAmountInBase, expense.dueDate, fromBase, currency]);


    if (!isOpen) return null;

    const handleSave = () => {
        const newDetails: Partial<PaymentDetails> = {
            paid: isPaid,
        };

        const displayValue = parseFloat(displayAmount) || 0;
        const savedAmountInBase = toBaseFromUnit(displayValue, unit);
        
        // If the installment is paid, ALWAYS save the amount to freeze it.
        // Otherwise, only save it if it's different from the default.
        if (isPaid) {
            newDetails.overriddenAmount = savedAmountInBase;
        } else if (Math.abs(savedAmountInBase - defaultAmountInBase) > 0.001) {
            newDetails.overriddenAmount = savedAmountInBase;
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
         <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="cell-edit-title">
            <div className="bg-slate-50 dark:bg-slate-850 rounded-xl shadow-2xl p-6 w-full max-w-md ring-1 ring-slate-200 dark:ring-slate-700/50" onClick={e => e.stopPropagation()}>
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
                            <select id="cell-unit" value={unit} onChange={e => setUnit(e.target.value as PaymentUnit)} className="w-40 bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
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
                 <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-slate-200 dark:border-slate-700/50">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium">{t('cell_edit.cancel')}</button>
                    <button type="button" onClick={handleSave} className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 dark:hover:bg-teal-400 text-white transition-colors font-medium">{t('cell_edit.save')}</button>
                </div>
            </div>
        </div>
    );
};

export default CellEditModal;
