import React, { useState, useEffect, useMemo } from 'react';
import { Expense, ExpenseType, PaymentFrequency, PaymentUnit } from '../types';
import { useLocalization } from '../hooks/useLocalization';

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

const ExpenseFormWorking: React.FC<ExpenseFormProps> = ({ isOpen, onClose, onSave, expenseToEdit, categories }) => {
    const { t, getLocalizedMonths } = useLocalization();

    const today = new Date().toISOString().split('T')[0];
    
    const [name, setName] = useState('');
    const [originalAmount, setOriginalAmount] = useState('');
    const [originalCurrency, setOriginalCurrency] = useState<PaymentUnit>('CLP');
    const [expenseDate, setExpenseDate] = useState(today);

    const [type, setType] = useState<ExpenseType>(ExpenseType.VARIABLE);
    const [category, setCategory] = useState(categories[0] || '');
    const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>(PaymentFrequency.MONTHLY);
    const [startMonth, setStartMonth] = useState(new Date().getMonth());
    const [startYear, setStartYear] = useState(new Date().getFullYear());
    const [installments, setInstallments] = useState('12');
    const [dueDate, setDueDate] = useState('1');
    const [isImportant, setIsImportant] = useState(false);
    const [isOngoing, setIsOngoing] = useState(false);

    const monthOptions = useMemo(() => getLocalizedMonths('long'), [getLocalizedMonths]);
    const yearOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

    const resetForm = () => {
        const today = new Date().toISOString().split('T')[0];
        setName('');
        setOriginalAmount('');
        setOriginalCurrency('CLP');
        setExpenseDate(today);
        setType(ExpenseType.VARIABLE);
        setCategory(categories[0] || '');
        setPaymentFrequency(PaymentFrequency.MONTHLY);
        setStartMonth(new Date().getMonth());
        setStartYear(new Date().getFullYear());
        setInstallments('12');
        setDueDate('1');
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
                setExpenseDate(expenseToEdit.expenseDate);
                setType(expenseToEdit.type);
                setCategory(categories.includes(expenseCategory) ? expenseCategory : (categories[0] || ''));
                setPaymentFrequency(expenseToEdit.paymentFrequency);
                setStartMonth(startMonth - 1);
                setStartYear(startYear);
                setInstallments(expenseToEdit.installments === 999 ? '12' : expenseToEdit.installments.toString());
                setDueDate(expenseToEdit.dueDate.toString());
                setIsImportant(expenseToEdit.isImportant);
                setIsOngoing(expenseToEdit.installments === 999);
            } else {
                resetForm();
            }
        }
    }, [isOpen, expenseToEdit, categories]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const amount = parseFloat(originalAmount) || 0;
        const startDate = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
        
        const expenseData: Omit<Expense, 'id' | 'createdAt'> & { id?: string } = {
            id: expenseToEdit?.id,
            name: name.trim(),
            category: category || 'Sin categoría',
            originalAmount: amount,
            amountInClp: amount, // Simplificado por ahora
            originalCurrency,
            exchangeRate: 1,
            type,
            expenseDate,
            startDate,
            installments: numInstallments,
            paymentFrequency,
            isImportant,
            dueDate: parseInt(dueDate) || 1,
        };

        onSave(expenseData);
        onClose();
        resetForm();
    };

    if (!isOpen) return null;

    const frequencyOptions = [
        { value: PaymentFrequency.ONCE, label: t('form.frequency.once') },
        { value: PaymentFrequency.MONTHLY, label: t('form.frequency.monthly') },
        { value: PaymentFrequency.BIMONTHLY, label: t('form.frequency.bimonthly') },
        { value: PaymentFrequency.QUARTERLY, label: t('form.frequency.quarterly') },
        { value: PaymentFrequency.SEMIANNUALLY, label: t('form.frequency.semiannually') },
        { value: PaymentFrequency.ANNUALLY, label: t('form.frequency.annually') },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl shadow-2xl p-6 md:p-8 w-full max-w-2xl ring-1 ring-slate-200 dark:ring-slate-700/50">
                <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
                    {expenseToEdit ? 'Editar Gasto' : 'Añadir Nuevo Gasto'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className={formLabelClasses}>Nombre del Gasto</label>
                        <input
                            id="name"
                            className={formInputClasses}
                            required
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label htmlFor="originalAmount" className={formLabelClasses}>Monto Original</label>
                            <input
                                id="originalAmount"
                                className={formInputClasses}
                                placeholder="10000"
                                required
                                step="any"
                                type="number"
                                value={originalAmount}
                                onChange={(e) => setOriginalAmount(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="originalCurrency" className={formLabelClasses}>Moneda</label>
                            <select
                                id="originalCurrency"
                                className={formSelectClasses}
                                value={originalCurrency}
                                onChange={(e) => setOriginalCurrency(e.target.value as PaymentUnit)}
                            >
                                <option value="CLP">CLP</option>
                                <option value="USD">USD</option>
                                <option value="UF">UF</option>
                                <option value="UTM">UTM</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="expenseDate" className={formLabelClasses}>Fecha del Gasto</label>
                            <input
                                type="date"
                                id="expenseDate"
                                value={expenseDate}
                                onChange={e => setExpenseDate(e.target.value)}
                                className={formInputClasses}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="category" className={formLabelClasses}>Categoría</label>
                            <select
                                id="category"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className={formSelectClasses}
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="type" className={formLabelClasses}>Tipo</label>
                        <select
                            id="type"
                            value={type}
                            onChange={e => setType(e.target.value as ExpenseType)}
                            className={formSelectClasses}
                        >
                            <option value={ExpenseType.VARIABLE}>Variable</option>
                            <option value={ExpenseType.RECURRING}>Recurrente</option>
                            <option value={ExpenseType.INSTALLMENT}>En Cuotas</option>
                        </select>
                    </div>

                    {(type === ExpenseType.RECURRING || type === ExpenseType.INSTALLMENT) && (
                        <div className="space-y-4 p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                            <div>
                                <label htmlFor="paymentFrequency" className={formLabelClasses}>Frecuencia de Pago</label>
                                <select
                                    id="paymentFrequency"
                                    value={paymentFrequency}
                                    onChange={e => setPaymentFrequency(e.target.value as PaymentFrequency)}
                                    className={formSelectClasses}
                                >
                                    {frequencyOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label htmlFor="startMonth" className={formLabelClasses}>Mes de Inicio</label>
                                    <select
                                        id="startMonth"
                                        value={startMonth}
                                        onChange={e => setStartMonth(parseInt(e.target.value))}
                                        className={formSelectClasses}
                                    >
                                        {monthOptions.map((m, i) => (
                                            <option key={i} value={i}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="startYear" className={formLabelClasses}>Año de Inicio</label>
                                    <select
                                        id="startYear"
                                        value={startYear}
                                        onChange={e => setStartYear(parseInt(e.target.value))}
                                        className={formSelectClasses}
                                    >
                                        {yearOptions.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="installments" className={formLabelClasses}>Número de Pagos</label>
                                <input
                                    type="number"
                                    id="installments"
                                    value={installments}
                                    onChange={e => setInstallments(e.target.value)}
                                    className={`${formInputClasses} ${isOngoing || paymentFrequency === PaymentFrequency.ONCE ? 'disabled:bg-slate-200 dark:disabled:bg-slate-700' : ''}`}
                                    placeholder="e.g., 12"
                                    required
                                    min="1"
                                    disabled={isOngoing || paymentFrequency === PaymentFrequency.ONCE}
                                />
                            </div>
                            <div>
                                <label htmlFor="dueDate" className={formLabelClasses}>Día de Vencimiento</label>
                                <input
                                    type="number"
                                    id="dueDate"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                    className={formInputClasses}
                                    min="1"
                                    max="31"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="isImportant"
                                type="checkbox"
                                checked={isImportant}
                                onChange={e => setIsImportant(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-400 dark:border-slate-500 text-fuchsia-500 focus:ring-fuchsia-600 bg-slate-100 dark:bg-slate-700/50"
                            />
                            <label htmlFor="isImportant" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">
                                Marcar como importante
                            </label>
                        </div>
                        {paymentFrequency !== PaymentFrequency.ONCE && (
                            <div className="flex items-center">
                                <input
                                    id="isOngoing"
                                    type="checkbox"
                                    checked={isOngoing}
                                    onChange={e => setIsOngoing(e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-400 dark:border-slate-500 text-teal-500 focus:ring-teal-600 bg-slate-100 dark:bg-slate-700/50"
                                />
                                <label htmlFor="isOngoing" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">
                                    Gasto recurrente
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-4 pt-4 mt-2 border-t border-slate-200 dark:border-slate-700/50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 dark:hover:bg-teal-400 text-white transition-colors font-medium shadow-lg shadow-teal-500/20"
                        >
                            {expenseToEdit ? 'Guardar Cambios' : 'Añadir Gasto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExpenseFormWorking;
