import React, { useState, useEffect, useMemo } from 'react';
import { Expense, ExpenseType, PaymentFrequency, PaymentUnit } from '../types';
import { useLocalization } from '../hooks/useLocalization';

// Tipo para el modo de cálculo de cuotas
type InstallmentCalculationMode = 'total' | 'installment';

// Tipo para el paso del formulario
type FormStep = 'type-selection' | 'expense-details';

interface ExpenseFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (expense: Omit<Expense, 'id' | 'createdAt'> & { id?: string }) => void;
    expenseToEdit: Expense | null;
    categories: string[];
}

const formInputClasses = "w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all";
const formSelectClasses = `${formInputClasses} appearance-none`;
const formLabelClasses = "block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5";

const ExpenseForm: React.FC<ExpenseFormProps> = ({ isOpen, onClose, onSave, expenseToEdit, categories }) => {
    const { t, getLocalizedMonths } = useLocalization();

    const today = new Date().toISOString().split('T')[0];
    
    // Estados del formulario
    const [currentStep, setCurrentStep] = useState<FormStep>('type-selection');
    const [selectedType, setSelectedType] = useState<ExpenseType | null>(null);
    
    // Estados comunes
    const [name, setName] = useState('');
    const [category, setCategory] = useState(categories[0] || '');
    const [originalCurrency, setOriginalCurrency] = useState<PaymentUnit>('CLP');
    const [isImportant, setIsImportant] = useState(false);
    
    // Estados para gastos únicos
    const [variableAmount, setVariableAmount] = useState('');
    const [expenseDate, setExpenseDate] = useState(today);
    const [variableDueDate, setVariableDueDate] = useState('');
    
    // Estados para gastos recurrentes
    const [recurringAmount, setRecurringAmount] = useState('');
    const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>(PaymentFrequency.MONTHLY);
    const [startMonth, setStartMonth] = useState(new Date().getMonth());
    const [startYear, setStartYear] = useState(new Date().getFullYear());
    const [isOngoing, setIsOngoing] = useState(true);
    const [endMonth, setEndMonth] = useState(new Date().getMonth());
    const [endYear, setEndYear] = useState(new Date().getFullYear() + 1);
    const [recurringDueDay, setRecurringDueDay] = useState('1');
    
    // Estados para gastos en cuotas
    const [calculationMode, setCalculationMode] = useState<InstallmentCalculationMode>('total');
    const [totalAmount, setTotalAmount] = useState('');
    const [installmentAmount, setInstallmentAmount] = useState('');
    const [numberOfInstallments, setNumberOfInstallments] = useState('12');
    const [installmentFrequency, setInstallmentFrequency] = useState<PaymentFrequency>(PaymentFrequency.MONTHLY);
    const [firstInstallmentMonth, setFirstInstallmentMonth] = useState(new Date().getMonth());
    const [firstInstallmentYear, setFirstInstallmentYear] = useState(new Date().getFullYear());
    const [installmentDueDay, setInstallmentDueDay] = useState('1');

    const monthOptions = useMemo(() => getLocalizedMonths('long'), [getLocalizedMonths]);
    const yearOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

    const resetForm = () => {
        const today = new Date().toISOString().split('T')[0];
        setName('');
        setOriginalAmount('');
        setOriginalCurrency('CLP');
        setExpenseDate(today);
        setType(ExpenseType.VARIABLE);
        setCategory(categories[0] || t('grid.uncategorized'));
        setPaymentFrequency(PaymentFrequency.MONTHLY);
        setStartMonth(new Date().getMonth());
        setStartYear(new Date().getFullYear());
        setInstallments('12');
        setDueDate(today);
        setIsImportant(false);
        setIsOngoing(false);
    };

    const numInstallments = useMemo(() => {
        if (paymentFrequency === PaymentFrequency.ONCE) return 1;
        return isOngoing ? 999 : (parseInt(installments, 10) || 1);
    }, [installments, isOngoing, paymentFrequency]);

    useEffect(() => {
        if (isOpen) {
            if (expenseToEdit) {
                const expenseCategory = expenseToEdit.category || '';
                const [startYear, startMonth] = expenseToEdit.startDate.split('-').map(Number);

                setName(expenseToEdit.name);
                setOriginalAmount(expenseToEdit.originalAmount.toString());
                setOriginalCurrency(expenseToEdit.originalCurrency);
                setExpenseDate(expenseToEdit.expenseDate); // Expects YYYY-MM-DD
                setType(expenseToEdit.type);
                setCategory(categories.includes(expenseCategory) ? expenseCategory : (categories[0] || ''));
                setPaymentFrequency(expenseToEdit.paymentFrequency);
                setStartMonth(startMonth - 1); // Adjust to 0-indexed
                setStartYear(startYear);
                setInstallments(expenseToEdit.installments === 999 ? '12' : expenseToEdit.installments.toString());
                setDueDate(expenseToEdit.dueDate.toString()); // Convert number to string for input
                setIsImportant(expenseToEdit.isImportant);
                setIsOngoing(expenseToEdit.installments === 999);
            } else {
                resetForm();
            }
        }
    }, [isOpen, expenseToEdit, categories]);

    useEffect(() => {
        if (paymentFrequency === PaymentFrequency.ONCE) {
            setInstallments('1');
            setIsOngoing(false);
        }
    }, [paymentFrequency]);

    useEffect(() => {
        if (isOngoing) {
            setInstallments('999');
        } else if (installments === '999') {
            setInstallments('12'); // Revert to a sensible default
        }
    }, [isOngoing]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newExpense: Omit<Expense, 'id' | 'createdAt'> & { id?: string } = {
            name,
            originalAmount: parseFloat(originalAmount) || 0,
            originalCurrency,
            expenseDate,
            type,
            category,
            paymentFrequency,
            startDate: `${startYear}-${(startMonth + 1).toString().padStart(2, '0')}-01`,
            installments: numInstallments,
            dueDate: parseInt(dueDate, 10) || 1,
            isImportant,
            // These are calculated in App.tsx, but need to be here to satisfy the type
            amountInClp: 0,
            exchangeRate: 0,
        };

        if (expenseToEdit) {
            (newExpense as any).id = expenseToEdit.id;
        }

        onSave(newExpense);
        onClose();
    };

    const frequencyOptions = [
        { value: PaymentFrequency.ONCE, label: t('frequency.once') },
        { value: PaymentFrequency.MONTHLY, label: t('frequency.monthly') },
        { value: PaymentFrequency.BIMONTHLY, label: t('frequency.bimonthly') },
        { value: PaymentFrequency.QUARTERLY, label: t('frequency.quarterly') },
        { value: PaymentFrequency.SEMIANNUALLY, label: t('frequency.semiannually') },
        { value: PaymentFrequency.ANNUALLY, label: t('frequency.annually') },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-40 flex justify-center items-center p-4" onClick={onClose} role="dialog" aria-modal="true">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl shadow-2xl p-6 md:p-8 w-full max-w-2xl ring-1 ring-slate-200 dark:ring-slate-700/50" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">{expenseToEdit ? t('form.editTitle') : t('form.addTitle')}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    <div>
                        <label htmlFor="name" className={formLabelClasses}>{t('form.nameLabel')}</label>
                        <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} className={formInputClasses} required />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label htmlFor="originalAmount" className={formLabelClasses}>{t('form.originalAmountLabel')}</label>
                            <input type="number" id="originalAmount" value={originalAmount} onChange={e => setOriginalAmount(e.target.value)} className={formInputClasses} placeholder="10000" required step="any" />
                        </div>
                        <div>
                            <label htmlFor="originalCurrency" className={formLabelClasses}>{t('form.originalCurrencyLabel')}</label>
                            <select id="originalCurrency" value={originalCurrency} onChange={e => setOriginalCurrency(e.target.value as PaymentUnit)} className={formSelectClasses}>
                                <option value="CLP">CLP</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="UF">UF</option>
                                <option value="UTM">UTM</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="expenseDate" className={formLabelClasses}>{t('form.expenseDateLabel')}</label>
                            <input type="date" id="expenseDate" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className={formInputClasses} required />
                        </div>
                        <div>
                            <label htmlFor="dueDate" className={formLabelClasses}>{t('form.dueDateLabel')}</label>
                            <input type="date" id="dueDate" value={dueDate} onChange={e => setDueDate(e.target.value)} className={formInputClasses} required />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="category" className={formLabelClasses}>{t('form.categoryLabel')}</label>
                            <select id="category" value={category} onChange={e => setCategory(e.target.value)} className={formSelectClasses} required>
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div>
                             <label htmlFor="type" className={formLabelClasses}>{t('form.typeLabel')}</label>
                            <select id="type" value={type} onChange={e => setType(e.target.value as ExpenseType)} className={formSelectClasses}>
                                <option value={ExpenseType.FIXED}>{t('form.type.fixed')}</option>
                                <option value={ExpenseType.VARIABLE}>{t('form.type.variable')}</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div>
                                <label htmlFor="paymentFrequency" className={formLabelClasses}>{t('form.frequencyLabel')}</label>
                                <select id="paymentFrequency" value={paymentFrequency} onChange={e => setPaymentFrequency(e.target.value as PaymentFrequency)} className={formSelectClasses}>
                                    {frequencyOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label htmlFor="startMonth" className={formLabelClasses}>{t('form.startMonthLabel')}</label>
                                    <select id="startMonth" value={startMonth} onChange={e => setStartMonth(parseInt(e.target.value))} className={formSelectClasses}>
                                        {monthOptions.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="startYear" className={formLabelClasses}>{t('form.startYearLabel')}</label>
                                    <select id="startYear" value={startYear} onChange={e => setStartYear(parseInt(e.target.value))} className={formSelectClasses}>
                                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="installments" className={formLabelClasses}>{t('form.installmentsLabel')}</label>
                                <input type="number" id="installments" value={installments} onChange={e => setInstallments(e.target.value)} className={`${formInputClasses} disabled:bg-slate-200 dark:disabled:bg-slate-700`} placeholder="e.g., 12" required min="1" disabled={isOngoing || paymentFrequency === PaymentFrequency.ONCE} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input id="isImportant" type="checkbox" checked={isImportant} onChange={e => setIsImportant(e.target.checked)} className="h-4 w-4 rounded border-slate-400 dark:border-slate-500 text-fuchsia-500 focus:ring-fuchsia-600 bg-slate-100 dark:bg-slate-700/50"/>
                                <label htmlFor="isImportant" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">{t('form.importantLabel')}</label>
                            </div>
                            {paymentFrequency !== PaymentFrequency.ONCE && (
                                <div className="flex items-center">
                                    <input id="isOngoing" type="checkbox" checked={isOngoing} onChange={e => setIsOngoing(e.target.checked)} className="h-4 w-4 rounded border-slate-400 dark:border-slate-500 text-teal-500 focus:ring-teal-600 bg-slate-100 dark:bg-slate-700/50"/>
                                    <label htmlFor="isOngoing" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">{t('form.ongoingLabel')}</label>
                                </div>
                           )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-4 mt-2 border-t border-slate-200 dark:border-slate-700/50">
                        <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium">{t('form.cancel')}</button>
                        <button type="submit" className="px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 dark:hover:bg-teal-400 text-white transition-colors font-medium shadow-lg shadow-teal-500/20">{expenseToEdit ? t('form.save') : t('form.add')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExpenseForm;
