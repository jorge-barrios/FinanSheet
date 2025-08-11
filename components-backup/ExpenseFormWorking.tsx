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
    const { t, getLocalizedMonths, formatClp } = useLocalization();
    


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
    const [installments, setInstallments] = useState('12'); // Para gastos en cuotas
    const [recurringPeriods, setRecurringPeriods] = useState('12'); // Para gastos recurrentes
    const [dueDate, setDueDate] = useState('1');
    const [isImportant, setIsImportant] = useState(false);
    const [isOngoing, setIsOngoing] = useState(false);
    
    // Estados para el toggle entre monto total y valor cuota
    const [amountInputMode, setAmountInputMode] = useState<'total' | 'installment'>('total');
    const [installmentAmount, setInstallmentAmount] = useState('');

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
        setRecurringPeriods('12');
        setDueDate('1');
        setIsImportant(false);
        setIsOngoing(false);
        setAmountInputMode('total');
        setInstallmentAmount('');
    };

    const numInstallments = useMemo(() => {
        if (type === ExpenseType.VARIABLE) return 1;
        if (type === ExpenseType.INSTALLMENT) return parseInt(installments, 10) || 1;
        if (type === ExpenseType.RECURRING) {
            return 999; // Recurring expenses are always unlimited/indefinite
        }
        if (paymentFrequency === PaymentFrequency.ONCE) return 1;
        return isOngoing ? 999 : (parseInt(installments, 10) || 1);
    }, [type, installments, isOngoing, paymentFrequency]);

    // Funciones para sincronizar los campos de monto total y valor cuota
    const handleTotalAmountChange = (value: string) => {
        setOriginalAmount(value);
        if (type === ExpenseType.INSTALLMENT && value && installments) {
            const totalAmount = parseFloat(value);
            const numInstallmentsValue = parseInt(installments, 10);
            if (!isNaN(totalAmount) && numInstallmentsValue > 0) {
                setInstallmentAmount((totalAmount / numInstallmentsValue).toString());
            }
        }
    };

    const handleInstallmentAmountChange = (value: string) => {
        setInstallmentAmount(value);
        if (type === ExpenseType.INSTALLMENT && value && installments) {
            const installmentValue = parseFloat(value);
            const numInstallmentsValue = parseInt(installments, 10);
            if (!isNaN(installmentValue) && numInstallmentsValue > 0) {
                setOriginalAmount((installmentValue * numInstallmentsValue).toString());
            }
        }
    };

    const handleInstallmentsChange = (value: string) => {
        setInstallments(value);
        // Recalcular el campo que no está siendo editado actualmente
        if (type === ExpenseType.INSTALLMENT && value) {
            const numInstallmentsValue = parseInt(value, 10);
            if (numInstallmentsValue > 0) {
                if (amountInputMode === 'total' && originalAmount) {
                    const totalAmount = parseFloat(originalAmount);
                    if (!isNaN(totalAmount)) {
                        setInstallmentAmount((totalAmount / numInstallmentsValue).toString());
                    }
                } else if (amountInputMode === 'installment' && installmentAmount) {
                    const installmentValue = parseFloat(installmentAmount);
                    if (!isNaN(installmentValue)) {
                        setOriginalAmount((installmentValue * numInstallmentsValue).toString());
                    }
                }
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            if (expenseToEdit) {
                console.log('Editing expense:', expenseToEdit);
                
                const expenseCategory = expenseToEdit.category || '';
                const [startYear, startMonth] = expenseToEdit.startDate.split('-').map(Number);

                setName(expenseToEdit.name);
                // Handle optional fields safely
                setOriginalAmount(expenseToEdit.originalAmount ? expenseToEdit.originalAmount.toString() : expenseToEdit.amountInClp.toString());
                setOriginalCurrency((expenseToEdit.originalCurrency || 'CLP') as PaymentUnit);
                setExpenseDate(expenseToEdit.expenseDate || today);
                setType(expenseToEdit.type);
                setCategory(categories.includes(expenseCategory) ? expenseCategory : (categories[0] || ''));
                setPaymentFrequency(expenseToEdit.paymentFrequency);
                setStartMonth(startMonth - 1);
                setStartYear(startYear);
                setInstallments(expenseToEdit.installments === 999 ? '12' : expenseToEdit.installments.toString());
                setDueDate(expenseToEdit.dueDate ? expenseToEdit.dueDate.toString() : '1');
                setIsImportant(expenseToEdit.isImportant || false);
                setIsOngoing(expenseToEdit.installments === 999);
            } else {
                resetForm();
            }
        }
    }, [isOpen, expenseToEdit, categories]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const amount = parseFloat(originalAmount) || 0;
        
        // Different logic for different expense types
        let finalStartDate: string;
        let finalPaymentFrequency: PaymentFrequency;
        
        if (type === ExpenseType.VARIABLE) {
            // Variable expenses use the specific expense date
            finalStartDate = expenseDate;
            finalPaymentFrequency = PaymentFrequency.ONCE;
        } else {
            // Recurring and installment expenses use start month/year
            finalStartDate = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
            if (type === ExpenseType.INSTALLMENT) {
                // Installments are always monthly
                finalPaymentFrequency = PaymentFrequency.MONTHLY;
            } else {
                // Recurring expenses use the selected frequency
                finalPaymentFrequency = paymentFrequency;
            }
        }
        
        const expenseData: Omit<Expense, 'id' | 'createdAt'> & { id?: string } = {
            id: expenseToEdit?.id,
            name: name.trim(),
            category: category || 'Sin categoría',
            originalAmount: amount,
            amountInClp: amount, // Simplificado por ahora
            originalCurrency,
            exchangeRate: 1,
            type,
            expenseDate: type === ExpenseType.VARIABLE ? expenseDate : finalStartDate,
            startDate: finalStartDate,
            installments: numInstallments,
            paymentFrequency: finalPaymentFrequency,
            isImportant,
            dueDate: parseInt(dueDate) || 1,
        };

        // Debug logging
        console.log('Form values being sent:', {
            type,
            expenseDate,
            finalStartDate,
            finalPaymentFrequency,
            dueDate: parseInt(dueDate) || 1,
            startMonth,
            startYear,
            numInstallments
        });

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
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl ring-1 ring-slate-200 dark:ring-slate-700/50 max-h-[90vh] overflow-y-auto">
                <div className="p-4 md:p-6">
                <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">
                    {expenseToEdit ? 'Editar Gasto' : 'Añadir Nuevo Gasto'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                    {/* Nombre y Tipo en la misma fila */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Nombre del Gasto</label>
                            <input
                                id="name"
                                className="w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all"
                                required
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="type" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('form.typeLabel')}</label>
                            <select
                                id="type"
                                value={type}
                                onChange={e => setType(e.target.value as ExpenseType)}
                                className="w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all"
                                required
                            >
                                <option value={ExpenseType.VARIABLE}>{t('form.type.variable')} - {t('form.type.variableDesc')}</option>
                                <option value={ExpenseType.RECURRING}>{t('form.type.recurring')} - {t('form.type.recurringDesc')}</option>
                                <option value={ExpenseType.INSTALLMENT}>{t('form.type.installment')} - {t('form.type.installmentDesc')}</option>
                            </select>
                        </div>
                    </div>

                    {/* Interfaz mejorada para gastos en cuotas */}
                    {type === ExpenseType.INSTALLMENT ? (
                        <div className="space-y-3">
                            {/* Toggle y Moneda en la misma fila */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Modo de Entrada</label>
                                    <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex">
                                        <button
                                            type="button"
                                            onClick={() => setAmountInputMode('total')}
                                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                                amountInputMode === 'total'
                                                    ? 'bg-teal-500 text-white shadow-sm'
                                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                        >
                                            Monto Total
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAmountInputMode('installment')}
                                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                                amountInputMode === 'installment'
                                                    ? 'bg-teal-500 text-white shadow-sm'
                                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                        >
                                            Valor Cuota
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="originalCurrency" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('form.originalCurrencyLabel')}</label>
                                    <select
                                        id="originalCurrency"
                                        value={originalCurrency}
                                        onChange={e => setOriginalCurrency(e.target.value as PaymentUnit)}
                                        className="w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all"
                                        required
                                    >
                                        <option value="CLP">{t('unit.CLP')}</option>
                                        <option value="USD">{t('unit.USD')}</option>
                                        <option value="UF">{t('unit.UF')}</option>
                                        <option value="UTM">{t('unit.UTM')}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Monto Total */}
                            <div>
                                <label htmlFor="totalAmount" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                    Monto Total
                                    {amountInputMode === 'total' && <span className="text-teal-500 ml-1">*</span>}
                                </label>
                                <input
                                    type="number"
                                    id="totalAmount"
                                    step="any"
                                    value={originalAmount}
                                    onChange={e => handleTotalAmountChange(e.target.value)}
                                    onFocus={() => setAmountInputMode('total')}
                                    className={`w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all ${
                                        amountInputMode === 'installment' ? 'bg-slate-50 dark:bg-slate-800' : ''
                                    }`}
                                    placeholder="3600000"
                                    min="0"
                                    readOnly={amountInputMode === 'installment'}
                                    required
                                />
                            </div>
                                
                            {/* Valor por Cuota y Número de Cuotas en la misma fila */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="installmentAmount" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Valor por Cuota
                                        {amountInputMode === 'installment' && <span className="text-teal-500 ml-1">*</span>}
                                    </label>
                                    <input
                                        type="number"
                                        id="installmentAmount"
                                        step="any"
                                        value={installmentAmount}
                                        onChange={e => handleInstallmentAmountChange(e.target.value)}
                                        onFocus={() => setAmountInputMode('installment')}
                                        className={`w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all ${
                                            amountInputMode === 'total' ? 'bg-slate-50 dark:bg-slate-800' : ''
                                        }`}
                                        placeholder="600000"
                                        min="0"
                                        readOnly={amountInputMode === 'total'}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="installments" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Número de Cuotas
                                    </label>
                                    <input
                                        type="number"
                                        id="installments"
                                        value={installments}
                                        onChange={e => handleInstallmentsChange(e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all"
                                        placeholder="6"
                                        required
                                        min="1"
                                        max="120"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Interfaz estándar para otros tipos de gastos */
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label htmlFor="originalAmount" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('form.amountLabel')}</label>
                                <input
                                    id="originalAmount"
                                    type="number"
                                    step="any"
                                    value={originalAmount}
                                    onChange={e => handleTotalAmountChange(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all"
                                    placeholder="150000"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="originalCurrency" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('form.originalCurrencyLabel')}</label>
                                <select
                                    id="originalCurrency"
                                    value={originalCurrency}
                                    onChange={e => setOriginalCurrency(e.target.value as PaymentUnit)}
                                    className="w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all"
                                    required
                                >
                                    <option value="CLP">{t('unit.CLP')}</option>
                                    <option value="USD">{t('unit.USD')}</option>
                                    <option value="UF">{t('unit.UF')}</option>
                                    <option value="UTM">{t('unit.UTM')}</option>
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="expenseDate" className={formLabelClasses}>
                                {t('form.expenseDateLabel')}
                                {type !== ExpenseType.VARIABLE && (
                                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                                        ({type === ExpenseType.RECURRING ? t('form.recurringDateNote') : t('form.installmentDateNote')})
                                    </span>
                                )}
                            </label>
                            <input
                                type="date"
                                id="expenseDate"
                                value={expenseDate}
                                onChange={e => setExpenseDate(e.target.value)}
                                className={`${formInputClasses} ${type !== ExpenseType.VARIABLE ? 'opacity-50 cursor-not-allowed' : ''}`}
                                required={type === ExpenseType.VARIABLE}
                                disabled={type !== ExpenseType.VARIABLE}
                            />
                        </div>
                        <div>
                            <label htmlFor="category" className={formLabelClasses}>{t('form.categoryLabel')}</label>
                            <select
                                id="category"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className={formSelectClasses}
                                required
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>



                    {type === ExpenseType.RECURRING && (
                        <div className="space-y-4 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border-l-4 border-blue-500">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {t('form.recurringFieldsTitle')}
                                </span>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800 mb-4">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    <strong>Gasto Recurrente:</strong> Un gasto que se repite automáticamente según la frecuencia seleccionada.<br/>
                                    El monto ingresado arriba es el <strong>monto de cada pago</strong> individual.
                                </p>
                            </div>
                            {/* Frecuencia, Mes de Inicio y Año en una sola fila */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label htmlFor="paymentFrequency" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('form.frequencyLabel')}</label>
                                    <select
                                        id="paymentFrequency"
                                        value={paymentFrequency}
                                        onChange={e => setPaymentFrequency(e.target.value as PaymentFrequency)}
                                        className="w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all"
                                        required
                                    >
                                        {frequencyOptions.filter(option => option.value !== PaymentFrequency.ONCE).map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="startMonth" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('form.startMonthLabel')}</label>
                                    <select
                                        id="startMonth"
                                        value={startMonth}
                                        onChange={e => setStartMonth(parseInt(e.target.value))}
                                        className="w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all"
                                        required
                                    >
                                        {monthOptions.map((month, index) => (
                                            <option key={index} value={index}>{month}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="startYear" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('form.startYearLabel')}</label>
                                    <select
                                        id="startYear"
                                        value={startYear}
                                        onChange={e => setStartYear(parseInt(e.target.value))}
                                        className="w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all"
                                        required
                                    >
                                        {yearOptions.map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className={`grid gap-4 ${isOngoing ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                {!isOngoing && (
                                    <div>
                                        <label htmlFor="recurringInstallments" className={formLabelClasses}>
                                            Número de períodos
                                            <span className="text-xs text-slate-500 dark:text-slate-400 block">
                                                Cuántos períodos durará este gasto
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            id="recurringInstallments"
                                            value={recurringPeriods}
                                            onChange={e => setRecurringPeriods(e.target.value)}
                                            className="w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all"
                                            placeholder="12"
                                            required
                                            min="1"
                                            max="120"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="dueDate" className={formLabelClasses}>
                                        {t('form.dueDateLabel')}
                                        <span className="text-xs text-slate-500 dark:text-slate-400 block">
                                            Día del mes en que se cobra (1-31)
                                        </span>
                                    </label>
                                    <input
                                        type="number"
                                        id="dueDate"
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                        className={formInputClasses}
                                        min="1"
                                        max="31"
                                        placeholder="1"
                                        required
                                    />
                                </div>
                            </div>
                            {isOngoing ? (
                                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-200 dark:border-green-800">
                                    <p className="text-sm text-green-800 dark:text-green-200">
                                        ✓ <strong>Gasto Indefinido:</strong> Este gasto se repetirá automáticamente según la frecuencia seleccionada, sin fecha de término.
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                        ⏰ <strong>Gasto Limitado:</strong> Este gasto durará {installments} período{parseInt(installments) !== 1 ? 's' : ''} y luego terminará automáticamente.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}



                    {type === ExpenseType.INSTALLMENT && (
                        <div className="space-y-3 p-3 bg-teal-100 dark:bg-teal-900/30 rounded-lg border-l-4 border-teal-500">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {t('form.installmentFieldsTitle')}
                                </span>
                            </div>
                            <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-md border border-teal-200 dark:border-teal-800 mb-4">
                                <p className="text-sm text-teal-800 dark:text-teal-200">
                                    <strong>💡 Tip:</strong> Puedes elegir si ingresar el monto total o el valor por cuota. Los campos se sincronizan automáticamente.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="startMonth" className={formLabelClasses}>{t('form.startMonthLabel')}</label>
                                    <select
                                        id="startMonth"
                                        value={startMonth}
                                        onChange={e => setStartMonth(parseInt(e.target.value))}
                                        className={formSelectClasses}
                                        required
                                    >
                                        {monthOptions.map((month, index) => (
                                            <option key={index} value={index}>{month}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="startYear" className={formLabelClasses}>{t('form.startYearLabel')}</label>
                                    <select
                                        id="startYear"
                                        value={startYear}
                                        onChange={e => setStartYear(parseInt(e.target.value))}
                                        className={formSelectClasses}
                                        required
                                    >
                                        {yearOptions.map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className={`grid gap-4 ${isOngoing ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                {!isOngoing && (
                                    <div>
                                        <label htmlFor="installments" className={formLabelClasses}>
                                            {t('form.installmentsLabel')}
                                            <span className="text-xs text-slate-500 dark:text-slate-400 block">
                                                Número de cuotas mensuales
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            id="installments"
                                            value={installments}
                                            onChange={e => handleInstallmentsChange(e.target.value)}
                                            className={formInputClasses}
                                            placeholder="12"
                                            required
                                            min="1"
                                            max="120"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="dueDate" className={formLabelClasses}>{t('form.dueDateLabel')}</label>
                                    <input
                                        type="number"
                                        id="dueDate"
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                        className={formInputClasses}
                                        min="1"
                                        max="31"
                                        placeholder="1"
                                        required
                                    />
                                </div>
                            </div>
                            {originalAmount && installments && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-md">
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        <strong>Monto por cuota:</strong> {formatClp(parseFloat(originalAmount) / parseInt(installments))}
                                    </p>
                                </div>
                            )}
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
                                {t('form.importantLabel')}
                            </label>
                        </div>
                        {type === ExpenseType.RECURRING && (
                            <div className="flex items-center">
                                <input
                                    id="isOngoing"
                                    type="checkbox"
                                    checked={isOngoing}
                                    onChange={e => setIsOngoing(e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-400 dark:border-slate-500 text-teal-500 focus:ring-teal-600 bg-slate-100 dark:bg-slate-700/50"
                                />
                                <label htmlFor="isOngoing" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">
                                    Sin fecha de fin
                                    <span className="text-xs text-slate-500 dark:text-slate-400 block">
                                        Para suscripciones indefinidas (ej: Netflix, Spotify, luz)
                                    </span>
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
                            {t('form.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 dark:hover:bg-teal-400 text-white transition-colors font-medium shadow-lg shadow-teal-500/20"
                        >
                            {expenseToEdit ? t('form.save') : t('form.add')}
                        </button>
                    </div>
                </form>
                </div>
            </div>
        </div>
    );
};

export default ExpenseFormWorking;
