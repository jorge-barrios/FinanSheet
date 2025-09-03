import React, { useState, useEffect, useMemo } from 'react';
import { Expense, ExpenseType, PaymentFrequency, PaymentUnit } from '../types';
import { useLocalization } from '../hooks/useLocalization';
import usePersistentState from '../hooks/usePersistentState';
import CurrencyService from '../services/currencyService';
import useCurrency from '../hooks/useCurrency';
import { getFrequencyInMonths } from '../utils/expenseCalculations';

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

// Helpers for CLP input formatting (thousand separators)
const formatCLPInput = (s: string) => {
    if (!s) return '';
    const digits = s.replace(/[^0-9]/g, '');
    if (!digits) return '';
    const n = parseInt(digits, 10);
    if (isNaN(n)) return '';
    return new Intl.NumberFormat('es-CL').format(n);
};
const stripSeparators = (s: string) => s.replace(/\./g, '').replace(/\s/g, '');

const ExpenseFormWorking: React.FC<ExpenseFormProps> = ({ isOpen, onClose, onSave, expenseToEdit, categories }) => {
    const { t, getLocalizedMonths, formatClp, language } = useLocalization();
    // Ensure currency rates are initialized for conversions in this form
    useCurrency();
    
    // Category localization: mirror grid behavior and provide ES/EN labels
    const stripAccents = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const norm = (s: string) => stripAccents((s || '').toLowerCase().trim());
    const CATEGORY_LABELS_ES: Record<string, string> = {
        housing: 'Vivienda',
        utilities: 'Servicios',
        food: 'Alimentación',
        transport: 'Transporte',
        health: 'Salud',
        entertainment: 'Entretenimiento',
        subscriptions: 'Suscripciones',
        education: 'Educación',
        personal: 'Personal',
        savings: 'Ahorro',
        debt: 'Deuda',
        insurance: 'Seguros',
        taxes: 'Impuestos',
        business: 'Negocios',
        gifts: 'Regalos',
        travel: 'Viajes',
        home: 'Hogar',
        pets: 'Mascotas',
        charity: 'Donaciones',
        other: 'Otros',
    };

    // Convert current inputs when switching currency, preserving CLP value
    const handleCurrencySwitch = (newUnit: PaymentUnit) => {
        if (!newUnit || newUnit === originalCurrency) {
            setOriginalCurrency(newUnit);
            return;
        }
        const snap = CurrencyService.getSnapshot();
        if (!snap) {
            // If rates not ready, just switch unit without conversion
            setOriginalCurrency(newUnit);
            return;
        }
        const prevUnit = originalCurrency;
        // Convert total amount
        if (originalAmount) {
            const amt = parseFloat(originalAmount);
            if (!isNaN(amt)) {
                const clp = CurrencyService.fromUnit(amt, prevUnit);
                const converted = CurrencyService.toUnit(clp, newUnit);
                if (isFinite(converted) && converted > 0) {
                    setOriginalAmount(String(+converted.toFixed(2)));
                }
            }
        }
        // Convert installment field if present
        if (installmentAmount) {
            const inst = parseFloat(installmentAmount);
            if (!isNaN(inst)) {
                const clpI = CurrencyService.fromUnit(inst, prevUnit);
                const convertedI = CurrencyService.toUnit(clpI, newUnit);
                if (isFinite(convertedI) && convertedI > 0) {
                    setInstallmentAmount(String(+convertedI.toFixed(2)));
                }
            }
        }
        setOriginalCurrency(newUnit);
    };
    const CATEGORY_LABELS_EN: Record<string, string> = {
        housing: 'Housing',
        utilities: 'Utilities',
        food: 'Food',
        transport: 'Transport',
        health: 'Health',
        entertainment: 'Entertainment',
        subscriptions: 'Subscriptions',
        education: 'Education',
        personal: 'Personal',
        savings: 'Savings',
        debt: 'Debt',
        insurance: 'Insurance',
        taxes: 'Taxes',
        business: 'Business',
        gifts: 'Gifts',
        travel: 'Travel',
        home: 'Home',
        pets: 'Pets',
        charity: 'Charity',
        other: 'Other',
    };
    const CATEGORY_SYNONYMS: Record<string, string> = {
        // Vivienda / Housing
        'vivienda': 'housing', 'arriendo': 'housing', 'hipoteca': 'housing', 'mortgage': 'housing', 'rent': 'housing', 'housing': 'housing',
        // Servicios / Utilities
        'servicios': 'utilities', 'luz': 'utilities', 'agua': 'utilities', 'gas': 'utilities', 'internet': 'utilities', 'electricidad': 'utilities', 'utilities': 'utilities',
        // Alimentación / Food
        'alimentacion': 'food', 'alimentos': 'food', 'comida': 'food', 'supermercado': 'food', 'food': 'food', 'groceries': 'food',
        // Transporte / Transport
        'transporte': 'transport', 'bencina': 'transport', 'gasolina': 'transport', 'auto': 'transport', 'carro': 'transport', 'bus': 'transport', 'metro': 'transport', 'estacionamiento': 'transport', 'transport': 'transport',
        // Salud / Health
        'salud': 'health', 'medico': 'health', 'medicina': 'health', 'isapre': 'health', 'fonasa': 'health', 'health': 'health', 'doctor': 'health', 'medicine': 'health',
        // Entretenimiento / Entertainment
        'entretenimiento': 'entertainment', 'cine': 'entertainment', 'salidas': 'entertainment', 'juegos': 'entertainment', 'videojuegos': 'entertainment', 'entertainment': 'entertainment',
        // Suscripciones / Subscriptions
        'suscripciones': 'subscriptions', 'suscripcion': 'subscriptions', 'netflix': 'subscriptions', 'spotify': 'subscriptions', 'hbo': 'subscriptions', 'prime': 'subscriptions', 'subscriptions': 'subscriptions', 'subscription': 'subscriptions',
        // Educación / Education
        'educacion': 'education', 'colegio': 'education', 'universidad': 'education', 'cursos': 'education', 'education': 'education',
        // Personal
        'personal': 'personal', 'ropa': 'personal', 'cuidado personal': 'personal', 'personal care': 'personal', 'personal expenses': 'personal',
        // Ahorro / Savings
        'ahorro': 'savings', 'savings': 'savings',
        // Deuda / Debt
        'deuda': 'debt', 'deudas': 'debt', 'creditos': 'debt', 'tarjeta': 'debt', 'debt': 'debt',
        // Seguros / Insurance
        'seguros': 'insurance', 'seguro': 'insurance', 'insurance': 'insurance',
        // Impuestos / Taxes
        'impuestos': 'taxes', 'iva': 'taxes', 'tax': 'taxes', 'taxes': 'taxes',
        // Negocios / Business
        'negocios': 'business', 'negocio': 'business', 'business': 'business',
        // Regalos / Gifts
        'regalos': 'gifts', 'regalo': 'gifts', 'gifts': 'gifts', 'gift': 'gifts',
        // Viajes / Travel
        'viajes': 'travel', 'viaje': 'travel', 'travel': 'travel', 'trip': 'travel',
        // Hogar / Home (mantenimiento, muebles)
        'hogar': 'home', 'muebles': 'home', 'mantencion': 'home', 'home': 'home', 'furniture': 'home',
        // Mascotas / Pets
        'mascotas': 'pets', 'mascota': 'pets', 'pets': 'pets', 'pet': 'pets',
        // Donaciones / Charity
        'donaciones': 'charity', 'donacion': 'charity', 'charity': 'charity',
        // Otros / Other
        'otros': 'other', 'otro': 'other', 'misc': 'other', 'otros gastos': 'other', 'other': 'other',
    };
    const getCategoryId = (raw: string) => {
        const n = norm(raw);
        return CATEGORY_SYNONYMS[n] || (n || 'other');
    };
    const getCategoryLabel = (raw: string) => {
        const id = getCategoryId(raw);
        const dict = language === 'es' ? CATEGORY_LABELS_ES : CATEGORY_LABELS_EN;
        return dict[id] || (raw || (language === 'es' ? 'Otros' : 'Other'));
    };
    


    const today = new Date().toISOString().split('T')[0];
    
    const [name, setName] = useState('');
    const [originalAmount, setOriginalAmount] = useState('');
    // Persist last used selections as smart defaults
    const [lastCategory, setLastCategory] = usePersistentState<string>('last_selected_category', '');
    const [lastCurrency, setLastCurrency] = usePersistentState<PaymentUnit>('last_selected_currency', 'CLP');
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

    // Advanced toggle removed; type-specific sections are always visible below

    // Live validation states
    const [nameError, setNameError] = useState<string>('');
    const [amountError, setAmountError] = useState<string>('');
    const [categoryError, setCategoryError] = useState<string>('');

    const monthOptions = useMemo(() => getLocalizedMonths('long'), [getLocalizedMonths]);
    const yearOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

    const resetForm = () => {
        const today = new Date().toISOString().split('T')[0];
        setName('');
        setOriginalAmount('');
        setOriginalCurrency(lastCurrency || 'CLP');
        setExpenseDate(today);
        setType(ExpenseType.VARIABLE);
        setCategory(lastCategory || categories[0] || '');
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
        setNameError('');
        setAmountError('');
        setCategoryError('');
    };

    const numInstallments = useMemo(() => {
        if (type === ExpenseType.VARIABLE) return 1;
        if (type === ExpenseType.INSTALLMENT) return parseInt(installments, 10) || 1;
        if (type === ExpenseType.RECURRING) {
            // For recurring, 0 means indefinite in calculation utils
            return isOngoing ? 0 : (parseInt(recurringPeriods, 10) || 1);
        }
        if (paymentFrequency === PaymentFrequency.ONCE) return 1;
        return parseInt(installments, 10) || 1;
    }, [type, installments, isOngoing, paymentFrequency, recurringPeriods]);

    // Dynamic legend for recurring summary
    const recurringLegend = useMemo(() => {
        if (type !== ExpenseType.RECURRING) return '';
        const freqMonths = getFrequencyInMonths(paymentFrequency);
        const isES = language === 'es';
        const periods = isOngoing ? null : (parseInt(recurringPeriods, 10) || 0);
        const timesText = isES ? 'veces' : 'times';
        const perText = isES ? 'cada' : 'every';
        const monthWord = (n: number) => isES ? (n === 1 ? 'mes' : 'meses') : (n === 1 ? 'month' : 'months');
        const freqLabel: Record<PaymentFrequency, string> = isES ? {
            [PaymentFrequency.MONTHLY]: 'mensual',
            [PaymentFrequency.BIMONTHLY]: 'bimensual',
            [PaymentFrequency.QUARTERLY]: 'trimestral',
            [PaymentFrequency.SEMIANNUALLY]: 'semestral',
            [PaymentFrequency.ANNUALLY]: 'anual',
            [PaymentFrequency.ONCE]: 'única vez'
        } : {
            [PaymentFrequency.MONTHLY]: 'monthly',
            [PaymentFrequency.BIMONTHLY]: 'bimonthly',
            [PaymentFrequency.QUARTERLY]: 'quarterly',
            [PaymentFrequency.SEMIANNUALLY]: 'semiannually',
            [PaymentFrequency.ANNUALLY]: 'annually',
            [PaymentFrequency.ONCE]: 'once'
        };
        if (isOngoing) {
            return isES
                ? `Este gasto se repetirá ${perText} ${freqMonths} ${monthWord(freqMonths)} de forma indefinida.`
                : `This expense will repeat ${perText} ${freqMonths} ${monthWord(freqMonths)} indefinitely.`;
        }
        const totalMonths = periods ? periods * freqMonths : 0;
        const years = totalMonths / 12;
        const durationText = years >= 1 && Number.isInteger(years)
            ? (isES ? `lo que comprende un período de ${years} ${years === 1 ? 'año' : 'años'}.` : `which spans a period of ${years} ${years === 1 ? 'year' : 'years'}.`)
            : (isES ? `lo que comprende un período de ${totalMonths} ${monthWord(totalMonths)}.` : `which spans a period of ${totalMonths} ${monthWord(totalMonths)}.`);
        return isES
            ? `Si marcaste ${freqLabel[paymentFrequency]} por ${periods} período${periods === 1 ? '' : 's'}, este gasto se repetirá ${perText} ${freqMonths} ${monthWord(freqMonths)} por ${periods} ${timesText}, ${durationText}`
            : `If you selected ${freqLabel[paymentFrequency]} for ${periods} period${periods === 1 ? '' : 's'}, this expense will repeat ${perText} ${freqMonths} ${monthWord(freqMonths)} for ${periods} ${timesText}, ${durationText}`;
    }, [type, paymentFrequency, recurringPeriods, isOngoing, language]);

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
                setDueDate(expenseToEdit.dueDate ? expenseToEdit.dueDate.toString() : '1');
                setIsImportant(expenseToEdit.isImportant || false);

                // Initialize periods/ongoing based on type
                if (expenseToEdit.type === ExpenseType.RECURRING) {
                    const inst = expenseToEdit.installments;
                    const isIndef = !(inst && inst > 0); // <= 0 => ongoing
                    setIsOngoing(isIndef);
                    if (!isIndef) {
                        setRecurringPeriods(String(inst));
                    }
                } else if (expenseToEdit.type === ExpenseType.INSTALLMENT) {
                    setInstallments((expenseToEdit.installments || 1).toString());
                } else {
                    // VARIABLE
                    setInstallments('1');
                }
                
            } else {
                resetForm();
            }
        }
    }, [isOpen, expenseToEdit, categories]);

    // If categories list becomes available and we don't have a category yet, choose last or first
    useEffect(() => {
        if (!expenseToEdit && isOpen) {
            setCategory(prev => prev || lastCategory || categories[0] || '');
            setOriginalCurrency(prev => prev || lastCurrency || 'CLP');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categories, isOpen]);

    // Validation helpers
    const validateName = (v: string) => {
        const val = v.trim();
        if (!val) return language === 'es' ? 'Ingresa un nombre.' : 'Please enter a name.';
        if (val.length < 2) return language === 'es' ? 'El nombre es muy corto.' : 'Name is too short.';
        return '';
    };
    const validateAmount = (v: string) => {
        if (!v) return language === 'es' ? 'Ingresa un monto.' : 'Please enter an amount.';
        const n = parseFloat(v);
        if (isNaN(n) || n <= 0) return language === 'es' ? 'El monto debe ser mayor que 0.' : 'Amount must be greater than 0.';
        return '';
    };
    const validateCategory = (v: string) => {
        if (!v) return language === 'es' ? 'Selecciona una categoría.' : 'Please select a category.';
        return '';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Run validation
        const nErr = validateName(name);
        const aErr = validateAmount(originalAmount);
        const cErr = validateCategory(category);
        setNameError(nErr);
        setAmountError(aErr);
        setCategoryError(cErr);
        if (nErr || aErr || cErr) return;
        
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

        // Persist last selections
        try {
            if (category) setLastCategory(category);
            if (originalCurrency) setLastCurrency(originalCurrency);
        } catch {}

        onSave(expenseData);
        onClose();
        resetForm();
    };

    if (!isOpen) return null;

    const frequencyOptions = [
        { value: PaymentFrequency.ONCE, label: t('frequency.once') },
        { value: PaymentFrequency.MONTHLY, label: t('frequency.monthly') },
        { value: PaymentFrequency.BIMONTHLY, label: t('frequency.bimonthly') },
        { value: PaymentFrequency.QUARTERLY, label: t('frequency.quarterly') },
        { value: PaymentFrequency.SEMIANNUALLY, label: t('frequency.semiannually') },
        { value: PaymentFrequency.ANNUALLY, label: t('frequency.annually') },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl ring-1 ring-slate-200 dark:ring-slate-700/50 max-h-[90vh] overflow-y-auto overflow-x-hidden">
                <div className="p-4 md:p-6">
                <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">
                    {expenseToEdit ? 'Editar Gasto' : 'Añadir Nuevo Gasto'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                    {/* Esenciales: Nombre + Fecha (2 columnas) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Nombre del Gasto</label>
                            <input
                                id="name"
                                className="w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all"
                                type="text"
                                value={name}
                                onChange={(e) => { setName(e.target.value); setNameError(validateName(e.target.value)); }}
                                onBlur={() => setNameError(validateName(name))}
                                aria-invalid={!!nameError}
                                aria-describedby="name-error"
                                required
                            />
                            {nameError && (
                                <p id="name-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">{nameError}</p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="expenseDate" className={formLabelClasses}>
                                {t('form.expenseDateLabel')}
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
                    </div>

                    

                    {/* Interfaz mejorada para gastos en cuotas */}
                    {type === ExpenseType.INSTALLMENT ? (
                        <div className="space-y-3 animate-fade-slide">
                            {/* Toggle y Moneda en la misma fila */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
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
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('form.originalCurrencyLabel')}</label>
                                    <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700">
                                        {(['CLP','USD','UF','UTM'] as PaymentUnit[]).map(unit => (
                                            <div key={unit} className="relative group">
                                                <button
                                                    type="button"
                                                    title={t(`unit.${unit}` as any)}
                                                    aria-label={t(`unit.${unit}` as any)}
                                                    onClick={() => handleCurrencySwitch(unit)}
                                                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                                                        originalCurrency === unit
                                                            ? 'bg-teal-500 text-white'
                                                            : 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                    } ${unit !== 'UTM' ? 'border-r border-slate-300 dark:border-slate-700' : ''}`}
                                                    aria-pressed={originalCurrency === unit}
                                                >
                                                    {unit}
                                                </button>
                                                <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded bg-slate-800 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition shadow-lg whitespace-nowrap z-50">
                                                    {t(`unit.${unit}` as any)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            

                            {/* Mostrar solo el campo seleccionado por el toggle */}
                            <div className="grid grid-cols-1 gap-4">
                                {amountInputMode === 'total' ? (
                                    <div>
                                        <label htmlFor="totalAmount" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                            Monto Total
                                            <span className="text-teal-500 ml-1">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="totalAmount"
                                            inputMode="numeric"
                                            value={originalCurrency === 'CLP' ? formatCLPInput(originalAmount) : originalAmount}
                                            onChange={e => handleTotalAmountChange(originalCurrency === 'CLP' ? stripSeparators(e.target.value) : e.target.value)}
                                            onFocus={() => setAmountInputMode('total')}
                                            className={`w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all`}
                                            placeholder={originalCurrency === 'CLP' ? '3.600.000' : '3600000'}
                                            required
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label htmlFor="installmentAmount" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                            Valor por Cuota
                                            <span className="text-teal-500 ml-1">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="installmentAmount"
                                            inputMode="numeric"
                                            value={originalCurrency === 'CLP' ? formatCLPInput(installmentAmount) : installmentAmount}
                                            onChange={e => handleInstallmentAmountChange(originalCurrency === 'CLP' ? stripSeparators(e.target.value) : e.target.value)}
                                            onFocus={() => setAmountInputMode('installment')}
                                            className={`w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all`}
                                            placeholder={originalCurrency === 'CLP' ? '600.000' : '600000'}
                                            required
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Interfaz estándar para otros tipos de gastos */
                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-slide`}>
                            <div>
                                <label htmlFor="originalAmount" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('form.amountLabel')}</label>
                                <input
                                    id="originalAmount"
                                    type="text"
                                    inputMode="numeric"
                                    value={originalCurrency === 'CLP' ? formatCLPInput(originalAmount) : originalAmount}
                                    onChange={e => {
                                        const raw = originalCurrency === 'CLP' ? stripSeparators(e.target.value) : e.target.value;
                                        handleTotalAmountChange(raw);
                                        setAmountError(validateAmount(raw));
                                    }}
                                    onBlur={() => setAmountError(validateAmount(originalAmount))}
                                    className="w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all"
                                    placeholder={originalCurrency === 'CLP' ? '150.000' : '150000'}
                                    required
                                />
                                {amountError && (
                                    <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{amountError}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('form.originalCurrencyLabel')}</label>
                                <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700">
                                    {(['CLP','USD','UF','UTM'] as PaymentUnit[]).map(unit => (
                                        <div key={unit} className="relative group">
                                            <button
                                                type="button"
                                                title={t(`unit.${unit}` as any)}
                                                aria-label={t(`unit.${unit}` as any)}
                                                onClick={() => handleCurrencySwitch(unit)}
                                                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                                                    originalCurrency === unit
                                                        ? 'bg-teal-500 text-white'
                                                        : 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                } ${unit !== 'UTM' ? 'border-r border-slate-300 dark:border-slate-700' : ''}`}
                                                aria-pressed={originalCurrency === unit}
                                            >
                                                {unit}
                                            </button>
                                            <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded bg-slate-800 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition shadow-lg whitespace-nowrap z-50">
                                                {t(`unit.${unit}` as any)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="category" className={formLabelClasses}>{t('form.categoryLabel')}</label>
                            <select
                                id="category"
                                value={category}
                                onChange={e => { setCategory(e.target.value); setCategoryError(validateCategory(e.target.value)); }}
                                className={formSelectClasses}
                                required
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                                ))}
                            </select>
                            {categoryError && (
                                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{categoryError}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('form.typeLabel')}</label>
                            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                                {[{k: ExpenseType.VARIABLE, l: t('form.type.variable')}, {k: ExpenseType.RECURRING, l: t('form.type.recurring')}, {k: ExpenseType.INSTALLMENT, l: t('form.type.installment')}].map((opt, idx) => (
                                    <button
                                        key={opt.k}
                                        type="button"
                                        onClick={() => { setType(opt.k); if (opt.k === ExpenseType.INSTALLMENT) setAmountInputMode('total'); }}
                                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                                            type === opt.k ? 'bg-teal-500 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        } ${idx < 2 ? 'border-r border-slate-300 dark:border-slate-700' : ''}`}
                                        aria-pressed={type === opt.k}
                                    >
                                        {opt.l}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>





                    {type === ExpenseType.RECURRING && (
                        <div className="space-y-4 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border-l-4 border-blue-500 animate-fade-slide">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {t('form.recurringFieldsTitle')}
                                </span>
                            </div>
                            {/* Frecuencia, Mes de Inicio y Año en una sola fila */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                            max="240"
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
                                        ✓ <strong>{language === 'es' ? 'Gasto Indefinido' : 'Ongoing Expense'}:</strong> {recurringLegend}
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                        ⏰ <strong>{language === 'es' ? 'Gasto Limitado' : 'Limited Expense'}:</strong> {recurringLegend}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <div className={`grid gap-4 grid-cols-1 md:grid-cols-2`}>
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
                                <div>
                                    <label htmlFor="installments" className={formLabelClasses}>
                                        {t('form.installmentsLabel')}
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
                                        max="240"
                                    />
                                </div>
                            </div>
                            {amountInputMode === 'total' && originalAmount && installments && (
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
