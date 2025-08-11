import React, { useState, useMemo } from 'react';
import { Expense, ExpenseType, PaymentFrequency, PaymentUnit } from '../types';
import { useLocalization } from '../hooks/useLocalization';

// Tipo para el modo de cálculo de cuotas
type InstallmentCalculationMode = 'total' | 'installment';

// Tipo para el paso del formulario
type FormStep = 'type-selection' | 'expense-details';

interface ExpenseFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (expense: Omit<Expense, 'id' | 'created_at'> & { id?: string }) => void;
    expenseToEdit: Expense | null;
    categories: string[];
}

const formInputClasses = "w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all";
const formSelectClasses = `${formInputClasses} appearance-none`;
const formLabelClasses = "block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5";

const ExpenseFormNew: React.FC<ExpenseFormProps> = ({ isOpen, onClose, onSave, expenseToEdit, categories }) => {
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
    
    // Estados para gastos únicos (VARIABLE)
    const [variableAmount, setVariableAmount] = useState('');
    const [expenseDate, setExpenseDate] = useState(today);
    const [variableDueDate, setVariableDueDate] = useState('');
    
    // Estados para gastos recurrentes (RECURRING)
    const [recurringAmount, setRecurringAmount] = useState('');
    const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>(PaymentFrequency.MONTHLY);
    const [startMonth, setStartMonth] = useState(new Date().getMonth());
    const [startYear, setStartYear] = useState(new Date().getFullYear());
    const [isOngoing, setIsOngoing] = useState(true);
    const [recurringDueDay, setRecurringDueDay] = useState('1');
    
    // Estados para gastos en cuotas (INSTALLMENT)
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

    // Cálculo automático para cuotas
    const calculatedValues = useMemo(() => {
        const numInstallments = parseInt(numberOfInstallments, 10) || 1;
        const total = parseFloat(totalAmount) || 0;
        const installment = parseFloat(installmentAmount) || 0;

        if (calculationMode === 'total' && total > 0 && numInstallments > 0) {
            return {
                totalAmount: total,
                installmentAmount: total / numInstallments,
                numberOfInstallments: numInstallments
            };
        } else if (calculationMode === 'installment' && installment > 0 && numInstallments > 0) {
            return {
                totalAmount: installment * numInstallments,
                installmentAmount: installment,
                numberOfInstallments: numInstallments
            };
        }

        return { totalAmount: total, installmentAmount: installment, numberOfInstallments: numInstallments };
    }, [calculationMode, totalAmount, installmentAmount, numberOfInstallments]);

    const handleTypeSelection = (type: ExpenseType) => {
        setSelectedType(type);
        setCurrentStep('expense-details');
    };

    const handleBack = () => {
        setCurrentStep('type-selection');
        setSelectedType(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl shadow-2xl p-6 md:p-8 w-full max-w-2xl ring-1 ring-slate-200 dark:ring-slate-700/50 max-h-[90vh] overflow-y-auto">
                {currentStep === 'type-selection' ? (
                    <div>
                        <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
                            {expenseToEdit ? 'Editar Gasto' : 'Añadir Nuevo Gasto'}
                        </h2>
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-4">
                                ¿Qué tipo de gasto es?
                            </h3>
                            
                            <div className="grid gap-4">
                                <button
                                    type="button"
                                    onClick={() => handleTypeSelection(ExpenseType.RECURRING)}
                                    className="p-4 border-2 border-slate-200 dark:border-slate-600 rounded-lg hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🔄</span>
                                        <div>
                                            <div className="font-semibold text-slate-900 dark:text-white">Gasto Recurrente</div>
                                            <div className="text-sm text-slate-600 dark:text-slate-400">Se repite periódicamente (mensual, trimestral, etc.)</div>
                                        </div>
                                    </div>
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => handleTypeSelection(ExpenseType.INSTALLMENT)}
                                    className="p-4 border-2 border-slate-200 dark:border-slate-600 rounded-lg hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">📊</span>
                                        <div>
                                            <div className="font-semibold text-slate-900 dark:text-white">Gasto en Cuotas</div>
                                            <div className="text-sm text-slate-600 dark:text-slate-400">Monto total dividido en pagos específicos</div>
                                        </div>
                                    </div>
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => handleTypeSelection(ExpenseType.VARIABLE)}
                                    className="p-4 border-2 border-slate-200 dark:border-slate-600 rounded-lg hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">💰</span>
                                        <div>
                                            <div className="font-semibold text-slate-900 dark:text-white">Gasto Único</div>
                                            <div className="text-sm text-slate-600 dark:text-slate-400">Pago único sin repetición</div>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-4 pt-6 mt-6 border-t border-slate-200 dark:border-slate-700/50">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="px-5 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
) : (
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        // Aquí iría la lógica de envío
                        console.log('Enviando formulario:', { selectedType, name, category });
                        onClose();
                    }} className="space-y-4">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {selectedType === ExpenseType.RECURRING && '🔄 Gasto Recurrente'}
                                {selectedType === ExpenseType.INSTALLMENT && '📊 Gasto en Cuotas'}
                                {selectedType === ExpenseType.VARIABLE && '💰 Gasto Único'}
                            </h2>
                            <button
                                type="button"
                                onClick={handleBack}
                                className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                            >
                                ← Cambiar tipo
                            </button>
                        </div>

                        {/* Campos comunes */}
                        <div>
                            <label htmlFor="name" className={formLabelClasses}>Nombre del Gasto</label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={formInputClasses}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="category" className={formLabelClasses}>Categoría</label>
                            <select
                                id="category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className={formSelectClasses}
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* Campos específicos por tipo */}
                        {selectedType === ExpenseType.VARIABLE && (
                            <>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <label htmlFor="variableAmount" className={formLabelClasses}>Monto</label>
                                        <input
                                            id="variableAmount"
                                            type="number"
                                            value={variableAmount}
                                            onChange={(e) => setVariableAmount(e.target.value)}
                                            className={formInputClasses}
                                            step="any"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="originalCurrency" className={formLabelClasses}>Moneda</label>
                                        <select
                                            id="originalCurrency"
                                            value={originalCurrency}
                                            onChange={(e) => setOriginalCurrency(e.target.value as PaymentUnit)}
                                            className={formSelectClasses}
                                        >
                                            <option value="CLP">CLP</option>
                                            <option value="USD">USD</option>
                                            <option value="UF">UF</option>
                                            <option value="UTM">UTM</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="expenseDate" className={formLabelClasses}>Fecha del Gasto</label>
                                    <input
                                        id="expenseDate"
                                        type="date"
                                        value={expenseDate}
                                        onChange={(e) => setExpenseDate(e.target.value)}
                                        className={formInputClasses}
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="variableDueDate" className={formLabelClasses}>Día de Vencimiento (opcional)</label>
                                    <input
                                        id="variableDueDate"
                                        type="number"
                                        value={variableDueDate}
                                        onChange={(e) => setVariableDueDate(e.target.value)}
                                        className={formInputClasses}
                                        min="1"
                                        max="31"
                                        placeholder="Día del mes (1-31)"
                                    />
                                </div>
                            </>
                        )}

                        {selectedType === ExpenseType.RECURRING && (
                            <>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <label htmlFor="recurringAmount" className={formLabelClasses}>Monto por Período</label>
                                        <input
                                            id="recurringAmount"
                                            type="number"
                                            value={recurringAmount}
                                            onChange={(e) => setRecurringAmount(e.target.value)}
                                            className={formInputClasses}
                                            step="any"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="originalCurrency" className={formLabelClasses}>Moneda</label>
                                        <select
                                            id="originalCurrency"
                                            value={originalCurrency}
                                            onChange={(e) => setOriginalCurrency(e.target.value as PaymentUnit)}
                                            className={formSelectClasses}
                                        >
                                            <option value="CLP">CLP</option>
                                            <option value="USD">USD</option>
                                            <option value="UF">UF</option>
                                            <option value="UTM">UTM</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="paymentFrequency" className={formLabelClasses}>Frecuencia de Pago</label>
                                    <select
                                        id="paymentFrequency"
                                        value={paymentFrequency}
                                        onChange={(e) => setPaymentFrequency(e.target.value as PaymentFrequency)}
                                        className={formSelectClasses}
                                    >
                                        <option value={PaymentFrequency.MONTHLY}>Mensual</option>
                                        <option value={PaymentFrequency.BIMONTHLY}>Bimestral</option>
                                        <option value={PaymentFrequency.QUARTERLY}>Trimestral</option>
                                        <option value={PaymentFrequency.SEMIANNUALLY}>Semestral</option>
                                        <option value={PaymentFrequency.ANNUALLY}>Anual</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="startMonth" className={formLabelClasses}>Mes de Inicio</label>
                                        <select
                                            id="startMonth"
                                            value={startMonth}
                                            onChange={(e) => setStartMonth(parseInt(e.target.value))}
                                            className={formSelectClasses}
                                        >
                                            {monthOptions.map((month, index) => (
                                                <option key={index} value={index}>{month}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="startYear" className={formLabelClasses}>Año de Inicio</label>
                                        <select
                                            id="startYear"
                                            value={startYear}
                                            onChange={(e) => setStartYear(parseInt(e.target.value))}
                                            className={formSelectClasses}
                                        >
                                            {yearOptions.map(year => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="recurringDueDay" className={formLabelClasses}>Día de Vencimiento</label>
                                    <input
                                        id="recurringDueDay"
                                        type="number"
                                        value={recurringDueDay}
                                        onChange={(e) => setRecurringDueDay(e.target.value)}
                                        className={formInputClasses}
                                        min="1"
                                        max="31"
                                        required
                                    />
                                </div>

                                <div className="flex items-center">
                                    <input
                                        id="isOngoing"
                                        type="checkbox"
                                        checked={isOngoing}
                                        onChange={(e) => setIsOngoing(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-400 dark:border-slate-500 text-teal-500 focus:ring-teal-600 bg-slate-100 dark:bg-slate-700/50"
                                    />
                                    <label htmlFor="isOngoing" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">
                                        Gasto indefinido (sin fecha de fin)
                                    </label>
                                </div>
                            </>
                        )}

                        {selectedType === ExpenseType.INSTALLMENT && (
                            <>
                                <div className="border border-slate-200 dark:border-slate-600 rounded-lg p-4">
                                    <h4 className="font-medium text-slate-900 dark:text-white mb-3">Cálculo de Cuotas</h4>
                                    
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <label className="flex items-center">
                                                <input
                                                    type="radio"
                                                    name="calculationMode"
                                                    value="total"
                                                    checked={calculationMode === 'total'}
                                                    onChange={(e) => setCalculationMode(e.target.value as InstallmentCalculationMode)}
                                                    className="mr-2"
                                                />
                                                Conozco el monto total
                                            </label>
                                            <label className="flex items-center">
                                                <input
                                                    type="radio"
                                                    name="calculationMode"
                                                    value="installment"
                                                    checked={calculationMode === 'installment'}
                                                    onChange={(e) => setCalculationMode(e.target.value as InstallmentCalculationMode)}
                                                    className="mr-2"
                                                />
                                                Conozco el valor por cuota
                                            </label>
                                        </div>

                                        {calculationMode === 'total' ? (
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="col-span-2">
                                                    <label htmlFor="totalAmount" className={formLabelClasses}>Monto Total</label>
                                                    <input
                                                        id="totalAmount"
                                                        type="number"
                                                        value={totalAmount}
                                                        onChange={(e) => setTotalAmount(e.target.value)}
                                                        className={formInputClasses}
                                                        step="any"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="numberOfInstallments" className={formLabelClasses}>Nº Cuotas</label>
                                                    <input
                                                        id="numberOfInstallments"
                                                        type="number"
                                                        value={numberOfInstallments}
                                                        onChange={(e) => setNumberOfInstallments(e.target.value)}
                                                        className={formInputClasses}
                                                        min="1"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="col-span-2">
                                                    <label htmlFor="installmentAmount" className={formLabelClasses}>Valor por Cuota</label>
                                                    <input
                                                        id="installmentAmount"
                                                        type="number"
                                                        value={installmentAmount}
                                                        onChange={(e) => setInstallmentAmount(e.target.value)}
                                                        className={formInputClasses}
                                                        step="any"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="numberOfInstallments" className={formLabelClasses}>Nº Cuotas</label>
                                                    <input
                                                        id="numberOfInstallments"
                                                        type="number"
                                                        value={numberOfInstallments}
                                                        onChange={(e) => setNumberOfInstallments(e.target.value)}
                                                        className={formInputClasses}
                                                        min="1"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="bg-slate-100 dark:bg-slate-700 rounded p-3">
                                            <div className="text-sm text-slate-600 dark:text-slate-400">
                                                <div>→ Monto total: <span className="font-medium">${calculatedValues.totalAmount.toLocaleString('es-CL')}</span></div>
                                                <div>→ Valor por cuota: <span className="font-medium">${calculatedValues.installmentAmount.toLocaleString('es-CL')}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="installmentFrequency" className={formLabelClasses}>Frecuencia de las Cuotas</label>
                                    <select
                                        id="installmentFrequency"
                                        value={installmentFrequency}
                                        onChange={(e) => setInstallmentFrequency(e.target.value as PaymentFrequency)}
                                        className={formSelectClasses}
                                    >
                                        <option value={PaymentFrequency.MONTHLY}>Mensual</option>
                                        <option value={PaymentFrequency.BIMONTHLY}>Bimestral</option>
                                        <option value={PaymentFrequency.QUARTERLY}>Trimestral</option>
                                        <option value={PaymentFrequency.SEMIANNUALLY}>Semestral</option>
                                        <option value={PaymentFrequency.ANNUALLY}>Anual</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="firstInstallmentMonth" className={formLabelClasses}>Mes de Primera Cuota</label>
                                        <select
                                            id="firstInstallmentMonth"
                                            value={firstInstallmentMonth}
                                            onChange={(e) => setFirstInstallmentMonth(parseInt(e.target.value))}
                                            className={formSelectClasses}
                                        >
                                            {monthOptions.map((month, index) => (
                                                <option key={index} value={index}>{month}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="firstInstallmentYear" className={formLabelClasses}>Año de Primera Cuota</label>
                                        <select
                                            id="firstInstallmentYear"
                                            value={firstInstallmentYear}
                                            onChange={(e) => setFirstInstallmentYear(parseInt(e.target.value))}
                                            className={formSelectClasses}
                                        >
                                            {yearOptions.map(year => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="installmentDueDay" className={formLabelClasses}>Día de Vencimiento</label>
                                    <input
                                        id="installmentDueDay"
                                        type="number"
                                        value={installmentDueDay}
                                        onChange={(e) => setInstallmentDueDay(e.target.value)}
                                        className={formInputClasses}
                                        min="1"
                                        max="31"
                                        required
                                    />
                                </div>
                            </>
                        )}

                        {/* Checkbox importante para todos los tipos */}
                        <div className="flex items-center">
                            <input
                                id="isImportant"
                                type="checkbox"
                                checked={isImportant}
                                onChange={(e) => setIsImportant(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-400 dark:border-slate-500 text-fuchsia-500 focus:ring-fuchsia-600 bg-slate-100 dark:bg-slate-700/50"
                            />
                            <label htmlFor="isImportant" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">
                                Marcar como importante
                            </label>
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
                )}
            </div>
        </div>
    );
};

export default ExpenseFormNew;
