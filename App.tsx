    // Category normalization utilities (Spanish canonical)
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
    const getCategoryId = (raw: string) => CATEGORY_SYNONYMS[norm(raw)] || (norm(raw) || 'other');
    const toSpanishCanonical = (raw: string) => CATEGORY_LABELS_ES[getCategoryId(raw)] || raw || 'Otros';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Header from './components/Header';
import ExpenseForm from './components/ExpenseFormWorking';
import FilterControls from './components/FilterControls';
// ViewSwitcher moved into Header
import CellEditModal from './components/CellEditModal';
// Lazy page views to keep initial bundle small
const TableView = React.lazy(() => import('./components/ExpenseGridVirtual'));
const CalendarView = React.lazy(() => import('./components/CalendarView'));
const DashboardLazy = React.lazy(() => import('./components/Dashboard'));
const DashboardBody = React.lazy(() => import('./components/Dashboard').then(m => ({ default: m.DashboardBody })));
import CategoryManager from './components/CategoryManager';
import ConfirmationModal from './components/ConfirmationModal';
import { Expense, PaymentStatus, ExpenseType, View, PaymentDetails, PaymentFrequency, PaymentUnit } from './types';
import { exportToExcel } from './services/exportService';
import { useLocalization } from './hooks/useLocalization';
import usePersistentState from './hooks/usePersistentState';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';

import { getExchangeRate } from './services/exchangeRateService';
import { format } from 'date-fns';
import { keysToSnakeCase } from './utils/objectUtils';

type Theme = 'light' | 'dark';

const App: React.FC = () => {
    const { t, getLocalizedMonths, currency, language, exchangeRates } = useLocalization();

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({});
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(isSupabaseConfigured);
    
    const [focusedDate, setFocusedDate] = useState(new Date());
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [editingCell, setEditingCell] = useState<{ expenseId: string; year: number; month: number; } | null>(null);
    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | ExpenseType>('all');
    const [filterImportance, setFilterImportance] = useState<'all' | 'important'>('all');
    const [view, setView] = useState<View>('table');
    const [theme, setTheme] = usePersistentState<Theme>('finansheet-theme', 'dark');
    const [visibleMonthsCount, setVisibleMonthsCount] = usePersistentState<number>('finansheet-visible-months', 7);
    
    // Confirmation modal state (expense deletion)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
    // Confirmation modal state (payment deletion)
    const [isDeletePaymentModalOpen, setIsDeletePaymentModalOpen] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState<{ expenseId: string; year: number; month: number; } | null>(null);

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [theme]);

    useEffect(() => {
        const legacyKeys = ['finansheet-expenses', 'finansheet-categories', 'finansheet-paymentStatus'];
        legacyKeys.forEach(key => {
            try {
                window.localStorage.removeItem(key);
            } catch (error) {
                console.error(`Failed to remove legacy localStorage key "${key}":`, error);
            }
        });
    }, []);

    const fetchData = useCallback(async () => {
        if (!isSupabaseConfigured || !supabase) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const { data: expensesData, error: expensesError } = await supabase.from('expenses').select('*');
            if (expensesError) throw expensesError;

            const { data: paymentsData, error: paymentsError } = await supabase.from('payment_details').select('*');
            if (paymentsError) throw paymentsError;

            const { data: categoriesData, error: categoriesError } = await supabase.from('categories').select('name');
            if (categoriesError) throw categoriesError;
            // Deduplicate to Spanish canonical labels
            const spanishSet = new Map<string, string>(); // id -> ES label
            for (const row of categoriesData || []) {
                const id = getCategoryId(row.name);
                const labelEs = CATEGORY_LABELS_ES[id] || row.name;
                if (!spanishSet.has(id)) spanishSet.set(id, labelEs);
            }
            const spanishCategories = Array.from(spanishSet.values()).sort((a, b) => a.localeCompare(b, 'es'));
            setCategories(spanishCategories);

            // ID ESTABLE: Con la nueva arquitectura, los pagos siempre están asociados al ID correcto
            const paymentsObject = (paymentsData || []).reduce((acc: any, payment: any) => {
                if (!acc[payment.expense_id]) acc[payment.expense_id] = {};
                acc[payment.expense_id][payment.date_key] = {
                    paid: payment.paid,
                    overriddenAmount: payment.overridden_amount,
                    overriddenDueDate: payment.overridden_due_date,
                    paymentDate: payment.payment_date ? new Date(payment.payment_date).getTime() : undefined
                };
                return acc;
            }, {} as PaymentStatus);

            const expensesFromSupabase = (expensesData || []).map((e: any) => {
                // Convert JSONB start_date back to string format for calculations
                let startDateString = '';
                if (e.start_date && typeof e.start_date === 'object') {
                    const { month, year } = e.start_date;
                    // month is 0-indexed in JSONB, so add 1 for display
                    const displayMonth = (month + 1).toString().padStart(2, '0');
                    startDateString = `${year}-${displayMonth}-01`;
                } else if (typeof e.start_date === 'string') {
                    startDateString = e.start_date;
                }
                
                return {
                    id: e.id,
                    name: e.name,
                    category: e.category,
                    amountInClp: e.total_amount,
                    type: (e.type?.toUpperCase() ?? 'RECURRING') as ExpenseType,
                    startDate: startDateString,
                    installments: e.installments,
                    paymentFrequency: e.payment_frequency as PaymentFrequency,
                    isImportant: e.is_important,
                    dueDate: e.due_date_old_text, // Use the integer field for day of month
                    created_at: e.created_at,
                    expenseDate: e.expense_date,
                    originalAmount: e.original_amount,
                    originalCurrency: e.original_currency,
                    exchangeRate: e.exchange_rate,
                    // Versioning fields
                    parentId: e.parent_id,
                    versionDate: e.version_date,
                    endDate: e.end_date,
                    isActive: e.is_active !== undefined ? e.is_active : true
                } as Expense;
            });
            
            // Filter to show only active versions for the UI
            const activeExpenses = expensesFromSupabase.filter(expense => {
                // If it has an endDate, it's been superseded by a newer version
                if (expense.endDate) {
                    return false;
                }
                // If it's explicitly marked as inactive, don't show it
                if (expense.isActive === false) {
                    return false;
                }
                // Show all other expenses (active ones and those without versioning)
                return true;
            });
            
            console.log('Loaded expenses:', {
                total: expensesFromSupabase.length,
                active: activeExpenses.length,
                filtered: expensesFromSupabase.length - activeExpenses.length
            });
            
            setExpenses(activeExpenses);
            setPaymentStatus(paymentsObject);
            setCategories((categoriesData || []).map(c => c.name).sort());

        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Failed to fetch data. Please check your Supabase connection and configuration.');
        } finally {
            setLoading(false);
        }
    }, [isSupabaseConfigured, supabase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // removed unused handleDateChange

    const handleAddExpenseClick = () => {
        setEditingExpense(null);
        setIsFormOpen(true);
    };

    const handleEditExpense = (expense: Expense) => {
        setEditingExpense(expense);
        setIsFormOpen(true);
    };

    const handleDeleteExpense = useCallback((expenseId: string) => {
        console.log('handleDeleteExpense called with ID:', expenseId);
        setExpenseToDelete(expenseId);
        setIsDeleteModalOpen(true);
    }, []);

    const confirmDeleteExpense = useCallback(async () => {
        if (!expenseToDelete) return;
        
        console.log('Confirming deletion for expense:', expenseToDelete);
        
        // Close modal first
        setIsDeleteModalOpen(false);
        
        // Remove from local state immediately for better UX
        setExpenses(prev => prev.filter(e => e.id !== expenseToDelete));
        
        if (!isSupabaseConfigured || !supabase) {
            setExpenseToDelete(null);
            return;
        }
        
        try {
            // Delete the expense from Supabase
            const { error } = await supabase.from('expenses').delete().eq('id', expenseToDelete);
            if (error) throw error;
            
            console.log('Expense deleted successfully');
        } catch (error) {
            console.error('Error deleting expense:', error);
            const errorMessage = error instanceof Error ? error.message : t('delete.expenseError');
            alert(`${t('delete.expenseError')}: ${errorMessage}`);
            // Reload data to restore the expense if deletion failed
            fetchData();
        } finally {
            setExpenseToDelete(null);
        }
    }, [expenseToDelete, isSupabaseConfigured, supabase, t, fetchData]);

    const cancelDeleteExpense = useCallback(() => {
        console.log('Deletion cancelled');
        setIsDeleteModalOpen(false);
        setExpenseToDelete(null);
    }, []);

    const handleSaveExpense = useCallback(async (expense: Omit<Expense, 'id' | 'createdAt'> & { id?: string }) => {
        if (!isSupabaseConfigured || !supabase) return;

        setLoading(true);
        try {
            // 1. Get exchange rate
            const dateForApi = format(new Date(expense.expenseDate), 'dd-MM-yyyy');
            const rate = await getExchangeRate(expense.originalCurrency as PaymentUnit, dateForApi);

            // 2. Calculate final amount and build the full expense object
            let expenseToSave = {
                ...expense,
                id: expense.id, // id can be undefined here, which is fine for upsert
                exchangeRate: rate,
                amountInClp: expense.originalCurrency === 'CLP' ? expense.originalAmount : expense.originalAmount * rate,
            };
            // Normalize category to Spanish canonical for storage
            expenseToSave = {
                ...expenseToSave,
                category: toSpanishCanonical(expenseToSave.category || '')
            };

            // 3. Handle versioning for recurring expenses and special logic for VARIABLE expenses
            const isEditing = !!expense.id;
            const isRecurringExpense = expense.type === 'RECURRING';
            const isVariableExpense = expense.type === 'VARIABLE';
            
            console.log('Versioning check:', {
                isEditing,
                isRecurringExpense,
                expenseId: expense.id,
                expenseType: expense.type,
                expensesCount: expenses.length
            });
            
            // Special handling for VARIABLE expenses (Option B implementation)
            if (isEditing && isVariableExpense && expense.id && supabase) {
                const sb = supabase; // capture non-null instance for use inside closures
                // For VARIABLE expenses, when editing the general template:
                // - Preserve existing pending occurrences with their original amounts
                // - Only new occurrences will use the updated amount
                
                const originalExpense = expenses.find(e => e.id === expense.id);
                if (originalExpense && originalExpense.amountInClp !== expenseToSave.amountInClp) {
                    console.log('VARIABLE expense editing: Preserving pending occurrences with original amount', {
                        expenseId: expense.id,
                        originalAmount: originalExpense.amountInClp,
                        newAmount: expenseToSave.amountInClp
                    });
                    
                    // Create payment records for existing pending occurrences to preserve their amounts
                    // This ensures that only new occurrences (via "+" button) will use the new amount
                    const existingPayments = paymentStatus[expense.id] || {};
                    
                    // For each existing payment that is not paid and doesn't have overriddenAmount,
                    // create a payment record with the original amount to preserve it
                    const preservationPromises = Object.entries(existingPayments).map(async ([dateKey, payment]) => {
                        // Type guard for payment object
                        if (payment && typeof payment === 'object' && 'paid' in payment && 'overriddenAmount' in payment) {
                            if (!payment.paid && !payment.overriddenAmount) {
                                // This is a pending occurrence that should preserve the original amount
                                try {
                                    const { error } = await sb
                                        .from('payment_details')
                                        .upsert({
                                            expense_id: expense.id,
                                            date_key: dateKey,
                                            paid: false,
                                            overridden_amount: originalExpense.amountInClp, // Preserve original amount
                                            payment_date: null
                                        });
                                    
                                    if (error) {
                                        console.error('Error preserving pending occurrence amount:', error);
                                    }
                                } catch (error) {
                                    console.error('Error preserving pending occurrence:', error);
                                }
                            }
                        }
                    });
                    
                    // Wait for all preservation operations to complete
                    await Promise.all(preservationPromises);
                }
            }
            
            if (isEditing && isRecurringExpense) {
                // NUEVA ARQUITECTURA: ID ESTABLE - El ID nunca cambia
                // Solo actualizar el mismo registro con nueva información de versionado
                
                const today = new Date();
                const effectiveDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
                
                console.log('Stable ID Versioning: Updating same expense with version info', {
                    expenseId: expense.id,
                    effectiveDate: effectiveDate,
                    newAmount: expenseToSave.amountInClp
                });
                
                // Mantener el mismo ID, solo agregar información de versionado
                expenseToSave = {
                    ...expenseToSave,
                    id: expense.id, // MISMO ID - NUNCA CAMBIA
                    versionDate: effectiveDate, // Fecha cuando esta versión se vuelve efectiva
                    isActive: true // Esta es la versión activa
                    // NO se setea parentId porque este ES el registro principal
                };
                
                console.log('Stable ID Versioning: Updated expense with new version info:', {
                    expenseId: expenseToSave.id,
                    effectiveDate: effectiveDate,
                    newAmount: expenseToSave.amountInClp,
                    versionDate: expenseToSave.versionDate
                });
            }

            // 3. Map to database schema and save to Supabase
            // Ensure due_date is a valid integer between 1-31
            // Validate dueDate
            const validDueDate = expenseToSave.dueDate >= 1 && expenseToSave.dueDate <= 31 ? expenseToSave.dueDate : 1;
            
            // Convert startDate string to JSONB object for Supabase
            const [year, month] = expenseToSave.startDate.split('-').map(Number);
            const startDateForDb = { month: month - 1, year }; // month is 0-indexed for JSONB
            
            // Create due_date as actual date (YYYY-MM-DD format)
            const dueDateForDb = `${year}-${month.toString().padStart(2, '0')}-${validDueDate.toString().padStart(2, '0')}`;
            
            // Map to exact Supabase schema structure
            const dbExpense = {
                name: expenseToSave.name,
                category: expenseToSave.category || null, // Stored as Spanish canonical label
                total_amount: expenseToSave.amountInClp,
                type: expenseToSave.type,
                start_date: startDateForDb, // JSONB object
                installments: expenseToSave.installments,
                payment_frequency: expenseToSave.paymentFrequency,
                is_important: expenseToSave.isImportant || false,
                due_date_old_text: validDueDate, // Legacy field (required INTEGER)
                due_date: dueDateForDb, // New field (optional DATE)
                expense_date: expenseToSave.expenseDate || null,
                // Currency fields (optional)
                original_amount: expenseToSave.originalAmount || null,
                original_currency: expenseToSave.originalCurrency || null,
                exchange_rate: expenseToSave.exchangeRate || null,
                amount_in_clp: expenseToSave.amountInClp,
                // Versioning fields (optional)
                parent_id: expenseToSave.parentId || null,
                version_date: expenseToSave.versionDate || null,
                end_date: expenseToSave.endDate || null,
                is_active: expenseToSave.isActive !== undefined ? expenseToSave.isActive : true
            };
            
            // Debug logging
            console.log('Final expense object for Supabase:', dbExpense);
            console.log('Field types:', {
                start_date: typeof dbExpense.start_date,
                due_date_old_text: typeof dbExpense.due_date_old_text,
                due_date: typeof dbExpense.due_date,
                total_amount: typeof dbExpense.total_amount
            });
            console.log('start_date object:', dbExpense.start_date);
            
            // ID ESTABLE: Diferenciar entre crear nuevo vs actualizar existente
            let error;
            if (isEditing) {
                // Para ediciones: ACTUALIZAR el registro existente (preserva el ID)
                console.log('Stable ID: Updating existing expense with ID:', expense.id);
                const { error: updateError } = await supabase
                    .from('expenses')
                    .update(dbExpense)
                    .eq('id', expense.id);
                error = updateError;
            } else {
                // Para nuevos gastos: INSERTAR nuevo registro
                console.log('Stable ID: Creating new expense');
                const { error: insertError } = await supabase
                    .from('expenses')
                    .insert([dbExpense]);
                error = insertError;
            }

            if (error) {
                throw error;
            }

            // Auto-assign payment status for new expenses based on due date
            if (!isEditing && isSupabaseConfigured && supabase) {
                try {
                    // First, get the newly created expense ID
                    const { data: newExpense, error: fetchError } = await supabase
                        .from('expenses')
                        .select('id')
                        .eq('name', dbExpense.name)
                        .eq('total_amount', dbExpense.total_amount)
                        .eq('type', dbExpense.type)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();
                    
                    if (fetchError || !newExpense) {
                        console.error('Error fetching new expense ID:', fetchError);
                        return;
                    }
                    
                    // Calculate if expense is overdue or pending based on due date
                    const today = new Date();
                    const currentYear = today.getFullYear();
                    const currentMonth = today.getMonth(); // 0-indexed
                    
                    // For the current month, determine if expense is overdue or pending
                    const dueDay = expenseToSave.dueDate;
                    const dueDate = new Date(currentYear, currentMonth, dueDay);
                    const isPastDue = today > dueDate;
                    
                    // Create payment record with appropriate status
                    const dateKey = `${currentYear}-${currentMonth}`;
                    const { error: paymentError } = await supabase
                        .from('payment_details')
                        .insert([{
                            expense_id: newExpense.id,
                            date_key: dateKey,
                            paid: false, // New expenses start as unpaid
                            overridden_amount: null, // Use default amount from expense
                            payment_date: null
                            // Note: is_overdue is calculated dynamically, not stored
                        }]);
                    
                    if (paymentError) {
                        console.error('Error creating auto payment status:', paymentError);
                    } else {
                        console.log('Auto-assigned payment status:', {
                            expenseId: newExpense.id,
                            dateKey,
                            isPastDue,
                            status: isPastDue ? 'overdue' : 'pending'
                        });
                        
                        // Refresh data again to ensure payment status is loaded
                        await fetchData();
                    }
                } catch (error) {
                    console.error('Error auto-assigning payment status:', error);
                }
            }

            await fetchData(); // Refreshes data grid
            setIsFormOpen(false);
            setEditingExpense(null);
        } catch (error) {
            console.error('Error saving expense:', error);
            const errorMessage = error instanceof Error ? error.message : t('save.expenseError');
            alert(`${t('save.expenseError')}: ${errorMessage}`);
            // We don't call fetchData() here on error, to avoid hiding the form data
        } finally {
            setLoading(false);
        }
    }, [isSupabaseConfigured, supabase, t, fetchData]);

    const requestDeletePayment = useCallback((expenseId: string, year: number, month: number) => {
        setPaymentToDelete({ expenseId, year, month });
        setIsDeletePaymentModalOpen(true);
    }, []);

    const confirmDeletePayment = useCallback(async () => {
        if (!paymentToDelete) return;
        const { expenseId, year, month } = paymentToDelete;
        const date_key = `${year}-${month}`;

        // Optimistic update: remove from local state
        setPaymentStatus(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            if (next[expenseId]) {
                delete next[expenseId][date_key];
                if (Object.keys(next[expenseId]).length === 0) delete next[expenseId];
            }
            return next;
        });

        // Close cell editor and this confirmation modal
        setEditingCell(null);
        setIsDeletePaymentModalOpen(false);
        setPaymentToDelete(null);

        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('payment_details')
                    .delete()
                    .eq('expense_id', expenseId)
                    .eq('date_key', date_key);
                if (error) throw error;
            } catch (error) {
                console.error('Error deleting payment details:', error);
                alert(t('delete.paymentError') || 'Error eliminando el pago');
                fetchData();
            }
        }
    }, [paymentToDelete, isSupabaseConfigured, supabase, t, fetchData]);

    const cancelDeletePayment = useCallback(() => {
        setIsDeletePaymentModalOpen(false);
        setPaymentToDelete(null);
    }, []);

    // removed unused handleDeletePaymentDetails

    const handleOpenCellEditor = (expenseId: string, year: number, month: number) => {
        setEditingCell({ expenseId, year, month });
    };

    const handleSavePaymentDetails = useCallback(async (expenseId: string, year: number, month: number, details: Partial<PaymentDetails>) => {
        const date_key = `${year}-${month}`;
        
        setPaymentStatus(prev => {
            const newStatus = JSON.parse(JSON.stringify(prev));
            if (!newStatus[expenseId]) newStatus[expenseId] = {};
            const existingDetails = newStatus[expenseId][date_key] || {};
            newStatus[expenseId][date_key] = { ...existingDetails, ...details };
            return newStatus;
        });

        if (!isSupabaseConfigured || !supabase) return;

        try {
            const { error } = await supabase.rpc('upsert_payment_details', { 
                p_expense_id: expenseId, 
                p_date_key: date_key, 
                p_details: keysToSnakeCase(details) 
            });
            if (error) throw error;
        } catch (error) {
            console.error('Error saving payment details:', error);
            alert(t('save.paymentError'));
            fetchData();
        }
    }, [isSupabaseConfigured, supabase, t, fetchData]);

    const handleAddCategory = useCallback(async (newCategory: string) => {
        if (!newCategory || categories.includes(newCategory)) return;
        setCategories(prev => [...prev, newCategory].sort());

        if (!isSupabaseConfigured || !supabase) return;

        try {
            const { error } = await supabase.from('categories').insert({ name: newCategory });
            if (error) throw error;
        } catch (error) {
            console.error('Error adding category:', error);
            alert(t('category.addError'));
            fetchData();
        }
    }, [categories, isSupabaseConfigured, supabase, fetchData, t]);

    const handleEditCategory = useCallback(async (oldName: string, newName: string) => {
        if (!newName || newName === oldName || categories.includes(newName)) return;
        
        setCategories(prev => prev.map(c => c === oldName ? newName : c).sort());
        setExpenses(prev => prev.map(e => e.category === oldName ? { ...e, category: newName } : e));

        if (!isSupabaseConfigured || !supabase) return;

        try {
            const { error } = await supabase.rpc('update_category_and_expenses', { old_name: oldName, new_name: newName });
            if (error) throw error;
        } catch (error) {
            console.error('Error updating category:', error);
            alert(t('category.updateError'));
            fetchData();
        }
    }, [isSupabaseConfigured, supabase, fetchData, t]);

    const handleDeleteCategory = useCallback(async (categoryToDelete: string) => {
        const uncategorized = t('grid.uncategorized');
        if (categoryToDelete === uncategorized) {
            alert(t('delete.uncategorizedError'));
            return;
        }
        if (window.confirm(t('delete.categoryConfirm', { category: categoryToDelete }))) {
            setCategories(prev => prev.filter(c => c !== categoryToDelete));
            setExpenses(prev => prev.map(e => e.category === categoryToDelete ? { ...e, category: uncategorized } : e));

            if (!isSupabaseConfigured || !supabase) return;

            try {
                const { error } = await supabase.rpc('delete_category_and_reassign_expenses', { category_name: categoryToDelete, new_category_name: uncategorized });
                if (error) throw error;
            } catch (error) {
                console.error('Error deleting category:', error);
                alert(t('delete.categoryError'));
                fetchData();
            }
        }
    }, [t, fetchData, isSupabaseConfigured, supabase]);

    const filteredAndSortedExpenses = useMemo(() => {
        return expenses
            .filter(expense => {
                const searchLower = searchTerm.toLowerCase();
                const nameMatch = expense.name.toLowerCase().includes(searchLower);
                const categoryMatch = (expense.category || '').toLowerCase().includes(searchLower);
                const typeMatch = filterType === 'all' || expense.type === filterType;
                const importanceMatch = filterImportance === 'all' || expense.isImportant;

                return (nameMatch || categoryMatch) && typeMatch && importanceMatch;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [expenses, searchTerm, filterType, filterImportance]);

    const handleExport = useCallback(() => {
        exportToExcel(filteredAndSortedExpenses, paymentStatus, focusedDate.getFullYear(), t, getLocalizedMonths('short'), currency, language, exchangeRates);
    }, [filteredAndSortedExpenses, paymentStatus, focusedDate, getLocalizedMonths, currency, language, exchangeRates, t]);

    const OfflineBanner = () => (
        <div className="bg-yellow-500 text-white text-center p-2">
            {t('offline.banner')}
        </div>
    );

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-slate-900 text-white">{t('loading')}...</div>;
    }

    return (
        <div className={`flex h-screen font-sans antialiased theme-${theme}`}>
            <React.Suspense fallback={<div className="p-4 text-slate-500 dark:text-slate-400">Cargando panel…</div>}>
                <DashboardLazy 
                    expenses={expenses} 
                    paymentStatus={paymentStatus} 
                    displayYear={focusedDate.getFullYear()}
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                />
            </React.Suspense>
            <div className="flex-1 flex flex-col min-w-0 bg-slate-100/50 dark:bg-slate-900">
                {!isSupabaseConfigured && <OfflineBanner />}
                <Header 
                    onAddExpense={handleAddExpenseClick}
                    onExport={handleExport}
                    onToggleSidebar={() => setIsSidebarOpen(s => !s)}
                    theme={theme}
                    onThemeChange={setTheme}
                    view={view}
                    onViewChange={setView}
                    onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
                />
                <main className={`flex-1 min-h-0 overflow-y-auto ${view === 'graph' ? 'lg:overflow-hidden' : 'lg:overflow-hidden'}`}>
                    <div className="max-w-screen-2xl mx-auto pt-4 px-4">
                        {view === 'table' && (
                            <FilterControls
                                searchTerm={searchTerm}
                                onSearchTermChange={setSearchTerm}
                                filterType={filterType}
                                onFilterTypeChange={setFilterType}
                                filterImportance={filterImportance}
                                onFilterImportanceChange={setFilterImportance}
                            />
                        )}
                        {/* ViewSwitcher relocated to Header */}
                    </div>

                    <div className={`max-w-screen-2xl mx-auto min-h-0 px-4 ${view === 'graph' ? 'lg:h-full' : 'lg:h-full'}`}>
                        <React.Suspense fallback={<div className="p-6 text-slate-500 dark:text-slate-400">Cargando…</div>}>
                            {view === 'table' && (
                                <TableView 
                                    expenses={filteredAndSortedExpenses}
                                    paymentStatus={paymentStatus}
                                    focusedDate={focusedDate}
                                    visibleMonthsCount={visibleMonthsCount}
                                    onEditExpense={handleEditExpense}
                                    onDeleteExpense={handleDeleteExpense}
                                    onOpenCellEditor={handleOpenCellEditor}
                                    onFocusedDateChange={setFocusedDate}
                                    onVisibleMonthsCountChange={setVisibleMonthsCount}
                                />
                            )}
                            {view === 'graph' && (
                                <DashboardBody 
                                    expenses={expenses}
                                    paymentStatus={paymentStatus}
                                    displayYear={focusedDate.getFullYear()}
                                    displayMonth={focusedDate.getMonth()}
                                    onOpenCellEditor={handleOpenCellEditor}
                                    onSelectMonth={(m) => setFocusedDate(new Date(focusedDate.getFullYear(), m, 1))}
                                    onRequestGoToTable={(m) => { setFocusedDate(new Date(focusedDate.getFullYear(), m, 1)); setView('table'); }}
                                />
                            )}
                            {view === 'calendar' && (
                                <CalendarView 
                                    expenses={filteredAndSortedExpenses} 
                                    paymentStatus={paymentStatus} 
                                    displayYear={focusedDate.getFullYear()} 
                                />
                            )}
                        </React.Suspense>
                    </div>
                </main>
            </div>
            <ExpenseForm 
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSave={handleSaveExpense}
                expenseToEdit={editingExpense}
                categories={categories}
            />
            {editingCell && (() => {
                const expense = expenses.find(e => e.id === editingCell.expenseId);
                if (!expense) return null;
                return (
                    <CellEditModal
                        isOpen={!!editingCell}
                        onClose={() => setEditingCell(null)}
                        onSave={(details) => handleSavePaymentDetails(editingCell.expenseId, editingCell.year, editingCell.month, details)}
                        expense={expense}
                        paymentDetails={paymentStatus[editingCell.expenseId]?.[`${editingCell.year}-${editingCell.month}`]}
                        year={editingCell.year}
                        month={editingCell.month}
                        onDelete={() => requestDeletePayment(editingCell.expenseId, editingCell.year, editingCell.month)}
                    />
                )
            })()}
            <CategoryManager
                isOpen={isCategoryManagerOpen}
                onClose={() => setIsCategoryManagerOpen(false)}
                categories={categories}
                onAdd={handleAddCategory}
                onEdit={handleEditCategory}
                onDelete={handleDeleteCategory}
            />
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                title={t('delete.title')}
                message={t('delete.message')}
                confirmText={t('common.delete')}
                cancelText={t('common.cancel')}
                onConfirm={confirmDeleteExpense}
                onCancel={cancelDeleteExpense}
                isDangerous={true}
            />
            <ConfirmationModal
                isOpen={isDeletePaymentModalOpen}
                title={'Confirmar eliminación del registro'}
                message={(function(){
                    if (!paymentToDelete) return '¿Seguro que deseas eliminar este registro mensual? Esta acción no se puede deshacer.';
                    const exp = expenses.find(e => e.id === paymentToDelete.expenseId);
                    const monthName = getLocalizedMonths('long')[paymentToDelete.month];
                    const who = exp ? `"${exp.name}"` : 'este gasto';
                    return `Vas a eliminar el registro de ${monthName} ${paymentToDelete.year} para ${who}.\n\nEsto eliminará solo el registro de ese mes (no se elimina el gasto). Esta acción no se puede deshacer.`;
                })()}
                confirmText={'Eliminar registro'}
                cancelText={t('common.cancel')}
                onConfirm={confirmDeletePayment}
                onCancel={cancelDeletePayment}
                isDangerous={true}
            />
        </div>
    );
};

export default App;
