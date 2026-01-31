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
import { ExpenseCommitmentFormWrapper } from './components/ExpenseCommitmentFormWrapper';
import FilterControls from './components/FilterControls';
// ViewSwitcher moved into Header
import CellEditModal from './components/CellEditModal';
// Lazy page views to keep initial bundle small
const TableView = React.lazy(() => import('./components/ExpenseGridVirtual'));
const TableViewV2 = React.lazy(() => import('./components/ExpenseGrid/index'));
const CalendarView = React.lazy(() => import('./components/CalendarView'));
const DashboardFullV2 = React.lazy(() => import('./components/DashboardFull.v2'));
const PaymentRecorderV2 = React.lazy(() => import('./components/PaymentRecorder.v2'));
const PauseCommitmentModal = React.lazy(() => import('./components/PauseCommitmentModal'));
import CategoryManager from './components/CategoryManager';
import ConfirmationModal from './components/ConfirmationModal';
import { CommitmentDetailModal } from './components/CommitmentDetailModal';
import { FloatingActionButton } from './components/FloatingActionButton';
import { PWAUpdateNotifier } from './components/PWAUpdateNotifier';
import { AppLoadingSkeleton } from './components/AppLoadingSkeleton';
import { Expense, PaymentStatus, ExpenseType, View, PaymentDetails, PaymentFrequency, PaymentUnit } from './types';
import type { CommitmentWithTerm } from './types.v2';
import type { Category } from './services/categoryService.v2';
import { exportToExcel } from './services/exportService';
import { useLocalization } from './hooks/useLocalization';
import usePersistentState from './hooks/usePersistentState';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { useToast } from './context/ToastContext';
import { useAuth } from './context/AuthContext';
import { useFeature } from './context/FeatureFlagsContext';
import { useCommitments } from './context/CommitmentsContext';
import { CommitmentService, PaymentService, getCurrentUserId } from './services/dataService.v2';
import type { Payment } from './types.v2';

import { getExchangeRate } from './services/exchangeRateService';
import { format } from 'date-fns';
import { keysToSnakeCase } from './utils/objectUtils';

type Theme = 'light' | 'dark';

const App: React.FC = () => {
    const { t, getLocalizedMonths, currency, language, exchangeRates } = useLocalization();
    const { showToast, removeToast } = useToast();
    const { user } = useAuth();
    const useV2Dashboard = useFeature('useV2Dashboard');
    const { refresh: refreshCommitments, commitments: contextCommitments, payments: contextPayments } = useCommitments();

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({});
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryMap, setCategoryMap] = useState<Map<string, string>>(new Map()); // categoryName -> categoryId
    const [loading, setLoading] = useState(isSupabaseConfigured);
    const [dataFetchError, setDataFetchError] = useState<string | null>(null); // Non-blocking error display

    const [focusedDate, setFocusedDate] = useState(new Date());
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [editingCommitment, setEditingCommitment] = useState<CommitmentWithTerm | null>(null);
    const [openWithPauseForm, setOpenWithPauseForm] = useState(false); // When true, opens edit modal with pause form expanded
    const [openWithResumeForm, setOpenWithResumeForm] = useState(false); // When true, opens edit modal with resume (new term) form expanded
    // V2 data (preloaded at app startup for instant tab switching)
    const [commitmentsV2, setCommitmentsV2] = useState<CommitmentWithTerm[]>([]);
    const [paymentsV2, setPaymentsV2] = useState<Map<string, Payment[]>>(new Map());
    // PaymentRecorder V2 state - uses periodDate string directly (YYYY-MM-DD)
    const [paymentRecorderState, setPaymentRecorderState] = useState<{
        isOpen: boolean;
        commitment: CommitmentWithTerm | null;
        periodDate: string;
    }>({ isOpen: false, commitment: null, periodDate: '' });
    const [editingCell, setEditingCell] = useState<{ expenseId: string; year: number; month: number; } | null>(null);
    // State for viewing commitment (read-only detail mode)
    const [viewingCommitment, setViewingCommitment] = useState<CommitmentWithTerm | null>(null);

    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | ExpenseType>('all');
    const [filterImportance, setFilterImportance] = useState<'all' | 'important'>('all');
    const [view, setView] = useState<View>('table');
    const [theme, setTheme] = usePersistentState<Theme>('finansheet-theme', 'dark');
    const [visibleMonthsCount, setVisibleMonthsCount] = usePersistentState<number>('finansheet-visible-months', 6);

    // Confirmation modal state (expense deletion)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
    // Confirmation modal state (payment deletion)
    const [isDeletePaymentModalOpen, setIsDeletePaymentModalOpen] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState<{ expenseId: string; year: number; month: number; } | null>(null);
    // Confirmation modal state (commitment deletion V2)
    const [commitmentToDelete, setCommitmentToDelete] = useState<string | null>(null);
    // Pause modal state
    const [pauseModalState, setPauseModalState] = useState<{
        isOpen: boolean;
        commitment: CommitmentWithTerm | null;
    }>({ isOpen: false, commitment: null });
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

    // Mobile: Prevent back navigation from closing the app
    useEffect(() => {
        // Push initial state to prevent immediate back navigation
        window.history.pushState({ app: 'finansheet' }, '');

        const handlePopState = () => {
            // Re-push state to stay in app (prevents swipe-back on mobile)
            window.history.pushState({ app: 'finansheet' }, '');
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const fetchData = useCallback(async () => {
        if (!isSupabaseConfigured || !supabase) {
            setLoading(false);
            return;
        }

        // Guard: If we already have data loaded, skip refetch on window focus/auth refresh
        // This prevents the "Failed to fetch" error when switching windows
        if (expenses.length > 0 && categories.length > 0) {
            console.log('fetchData: Data already loaded, skipping refetch');
            setLoading(false);
            return;
        }

        // Clear any previous error when retrying
        setDataFetchError(null);

        try {
            const { data: expensesData, error: expensesError } = await supabase
                .from('expenses')
                .select('*, categories(name)');
            if (expensesError) throw expensesError;

            const { data: paymentsData, error: paymentsError } = await supabase.from('payment_details').select('*');
            if (paymentsError) throw paymentsError;

            // Load categories using new v2 service (global + custom - hidden)
            const userId = await getCurrentUserId();
            if (!userId) {
                console.error('No user ID found');
                setCategories([]);
                setCategoryMap(new Map());
            } else {
                const { getUserCategories } = await import('./services/categoryService.v2');
                const categoriesV2 = await getUserCategories(userId, t, language);

                // Build category map: name -> id
                const nameToIdMap = new Map<string, string>();
                categoriesV2.forEach(cat => {
                    nameToIdMap.set(cat.name, cat.id);
                });

                console.log('📁 Categories loaded from v2 service:', {
                    total: categoriesV2.length,
                    categories: categoriesV2.map(c => c.name)
                });

                setCategories(categoriesV2);
                setCategoryMap(nameToIdMap);
            }

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
                // Extract category name from JOIN
                // Supabase returns: { ..., categories: { name: "Vivienda" } }
                const categoryName = e.categories?.name || 'Otros';

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
                    category: categoryName,
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
            // Categories already set on line 219 with Spanish canonical labels
            // Don't overwrite them here with raw database names

            // ============ V2 DATA PRELOAD (in parallel) ============
            try {
                const userId = await getCurrentUserId();
                if (userId) {
                    const currentYear = new Date().getFullYear();

                    // Fetch V2 commitments and payments in parallel
                    const [commitments, allPayments] = await Promise.all([
                        CommitmentService.getCommitmentsWithTerms(userId),
                        PaymentService.getPaymentsByDateRange(userId, `${currentYear}-01-01`, `${currentYear + 1}-01-01`)
                    ]);

                    setCommitmentsV2(commitments);

                    // Group payments by commitment_id
                    const paymentsByCommitment = new Map<string, Payment[]>();
                    allPayments.forEach(p => {
                        const existing = paymentsByCommitment.get(p.commitment_id) || [];
                        paymentsByCommitment.set(p.commitment_id, [...existing, p]);
                    });
                    setPaymentsV2(paymentsByCommitment);

                    console.log('V2 data preloaded:', { commitments: commitments.length, payments: allPayments.length });
                }
            } catch (v2Error) {
                console.error('V2 preload error (non-fatal):', v2Error);
            }
            // ============ END V2 PRELOAD ============

        } catch (error) {
            console.error('Error fetching data:', error);
            // Non-blocking error: show dismissible banner instead of blocking alert
            setDataFetchError('Failed to fetch data. Please check your Supabase connection and configuration.');
        } finally {
            setLoading(false);
        }
    }, [isSupabaseConfigured, supabase, user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ============ RELOAD CATEGORIES ON LANGUAGE CHANGE ============
    useEffect(() => {
        const reloadCategories = async () => {
            try {
                const userId = await getCurrentUserId();
                if (!userId) return;

                const { getUserCategories } = await import('./services/categoryService.v2');
                const categoriesV2 = await getUserCategories(userId, t, language);

                // Build category map: name -> id
                const nameToIdMap = new Map<string, string>();
                categoriesV2.forEach(cat => {
                    nameToIdMap.set(cat.name, cat.id);
                });

                console.log('📁 Categories reloaded for language change:', {
                    language,
                    total: categoriesV2.length,
                    categories: categoriesV2.map(c => c.name)
                });

                setCategories(categoriesV2);
                setCategoryMap(nameToIdMap);
            } catch (err) {
                console.error('Failed to reload categories on language change:', err);
            }
        };

        // Only reload if we already have categories (initial load handled by fetchData)
        if (categories.length > 0) {
            reloadCategories();
        }
    }, [language, t]);

    // ============ V2 HOT RELOAD FUNCTION ============
    const refreshV2Data = useCallback(async () => {
        try {
            const userId = await getCurrentUserId();
            if (!userId) return;

            const currentYear = new Date().getFullYear();

            // Fetch V2 commitments and payments in parallel
            const [commitments, allPayments] = await Promise.all([
                CommitmentService.getCommitmentsWithTerms(userId),
                PaymentService.getPaymentsByDateRange(userId, `${currentYear}-01-01`, `${currentYear + 1}-01-01`)
            ]);

            setCommitmentsV2(commitments);

            // Group payments by commitment_id
            const paymentsByCommitment = new Map<string, Payment[]>();
            allPayments.forEach(p => {
                const existing = paymentsByCommitment.get(p.commitment_id) || [];
                paymentsByCommitment.set(p.commitment_id, [...existing, p]);
            });
            setPaymentsV2(paymentsByCommitment);

            console.log('V2 data refreshed:', { commitments: commitments.length, payments: allPayments.length });
        } catch (error) {
            console.error('V2 refresh error:', error);
            throw error; // Re-throw for caller to handle
        }
    }, []);

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
            showToast(t('delete.expenseSuccess', 'Gasto eliminado exitosamente'), 'success');
            return;
        }

        try {
            // Delete the expense from Supabase
            const { error } = await supabase.from('expenses').delete().eq('id', expenseToDelete);
            if (error) throw error;

            console.log('Expense deleted successfully');
            showToast(t('delete.expenseSuccess', 'Gasto eliminado exitosamente'), 'success');
        } catch (error) {
            console.error('Error deleting expense:', error);
            const errorMessage = error instanceof Error ? error.message : t('delete.expenseError');
            showToast(`${t('delete.expenseError')}: ${errorMessage}`, 'error');
            // Reload data to restore the expense if deletion failed
            fetchData();
        } finally {
            setExpenseToDelete(null);
        }
    }, [expenseToDelete, isSupabaseConfigured, supabase, t, fetchData, showToast]);

    const cancelDeleteExpense = useCallback(() => {
        console.log('Deletion cancelled');
        setIsDeleteModalOpen(false);
        setExpenseToDelete(null);
    }, []);

    const handleSaveExpense = useCallback(async (expense: Omit<Expense, 'id' | 'createdAt'> & { id?: string }) => {
        if (!isSupabaseConfigured || !supabase) return;

        // Show "Saving..." toast immediately for user feedback
        // 0 duration means it stays until we manually remove it
        const savingToastId = showToast(t('save.saving', 'Guardando...'), 'info', 0);

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
                                            payment_date: null,
                                            user_id: user?.id || null
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

            // Map category name to UUID
            const categoryId = categoryMap.get(expenseToSave.category || '');
            if (!categoryId) {
                throw new Error(`Category "${expenseToSave.category}" not found in category map`);
            }

            // Map to exact Supabase schema structure
            const dbExpense = {
                name: expenseToSave.name,
                category_id: categoryId, // UUID reference to categories table
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
                is_active: expenseToSave.isActive !== undefined ? expenseToSave.isActive : true,
                // User ID for RLS (explicitly set, though trigger also handles it)
                user_id: user?.id || null
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

            // Vinculación bidireccional automática
            let savedExpenseId = expense.id; // For edits, we already have the ID

            // For new expenses, fetch the newly created ID
            if (!isEditing && isSupabaseConfigured && supabase) {
                const { data: newExpense, error: fetchError } = await supabase
                    .from('expenses')
                    .select('id')
                    .eq('name', dbExpense.name)
                    .eq('total_amount', dbExpense.total_amount)
                    .eq('type', dbExpense.type)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (!fetchError && newExpense) {
                    savedExpenseId = newExpense.id;
                }
            }

            // Si tiene vinculación, actualizar el expense vinculado automáticamente
            if (expenseToSave.linkedExpenseId && expenseToSave.linkRole && savedExpenseId) {
                const linkedExpense = expenses.find(e => e.id === expenseToSave.linkedExpenseId);

                if (linkedExpense) {
                    // Determinar el rol opuesto
                    const oppositeRole = expenseToSave.linkRole === 'primary' ? 'secondary' : 'primary';

                    // Actualizar el expense vinculado
                    const { error: linkError } = await supabase
                        .from('expenses')
                        .update({
                            linked_expense_id: savedExpenseId,
                            link_role: oppositeRole
                        })
                        .eq('id', expenseToSave.linkedExpenseId);

                    if (linkError) {
                        console.error('Error updating linked expense:', linkError);
                    }
                }
            }

            // Si se desvinculó (linkedExpenseId === undefined), limpiar el otro lado
            if (editingExpense?.linkedExpenseId && !expenseToSave.linkedExpenseId) {
                const previouslyLinked = expenses.find(e => e.id === editingExpense.linkedExpenseId);

                if (previouslyLinked?.linkedExpenseId === editingExpense.id) {
                    const { error: unlinkError } = await supabase
                        .from('expenses')
                        .update({
                            linked_expense_id: null,
                            link_role: null
                        })
                        .eq('id', editingExpense.linkedExpenseId);

                    if (unlinkError) {
                        console.error('Error unlinking expense:', unlinkError);
                    }
                }
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
                            payment_date: null,
                            user_id: user?.id || null
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

            setIsFormOpen(false);
            setEditingExpense(null);

            // Remove "Saving..." toast immediately
            removeToast(savingToastId);

            // Show success toast
            const message = isEditing
                ? t('save.expenseUpdated', 'Gasto actualizado exitosamente')
                : t('save.expenseCreated', 'Gasto creado exitosamente');
            showToast(message, 'success');
        } catch (error) {
            console.error('Error saving expense:', error);
            const errorMessage = error instanceof Error ? error.message : t('save.expenseError');

            // Remove "Saving..." toast immediately
            removeToast(savingToastId);

            // Show error toast
            showToast(`${t('save.expenseError')}: ${errorMessage}`, 'error');
        }
    }, [isSupabaseConfigured, supabase, user, expenses, paymentStatus, categoryMap, t, fetchData, showToast, removeToast]);

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
                showToast(t('delete.paymentSuccess', 'Pago eliminado exitosamente'), 'success');
            } catch (error) {
                console.error('Error deleting payment details:', error);
                showToast(t('delete.paymentError') || 'Error eliminando el pago', 'error');
                fetchData();
            }
        } else {
            showToast(t('delete.paymentSuccess', 'Pago eliminado exitosamente'), 'success');
        }
    }, [paymentToDelete, isSupabaseConfigured, supabase, t, fetchData, showToast]);

    const cancelDeletePayment = useCallback(() => {
        setIsDeletePaymentModalOpen(false);
        setPaymentToDelete(null);
    }, []);

    // removed unused handleDeletePaymentDetails

    const handleOpenCellEditor = (expenseId: string, year: number, month: number) => {
        setEditingCell({ expenseId, year, month });
    };

    // Handlers for Commitment Actions
    const handleViewCommitment = React.useCallback((commitment: CommitmentWithTerm) => {
        setViewingCommitment(commitment);
    }, []);

    const handleEditCommitment = React.useCallback((commitment: CommitmentWithTerm) => {
        // If we serve a detail view, we might want to close it before opening edit
        setViewingCommitment(null);
        setEditingCommitment(commitment);
        setOpenWithPauseForm(false);
        setOpenWithResumeForm(false);
        setIsFormOpen(true);
    }, []);

    // Handler to open edit form for resuming a terminated commitment
    const handleResumeCommitment = React.useCallback((commitment: CommitmentWithTerm) => {
        setEditingCommitment(commitment);
        setOpenWithResumeForm(true); // Pre-expand the resume (new term) form
        setOpenWithPauseForm(false); // Ensure pause form is closed
        setIsFormOpen(true);
    }, []);

    // Opens the PaymentRecorder modal for a specific period
    // periodDate format: YYYY-MM-DD (always first day of month)
    const handleOpenPaymentRecorder = useCallback((commitmentId: string, periodDate: string) => {
        const commitment = contextCommitments.find(c => c.id === commitmentId);
        if (commitment) {
            setPaymentRecorderState({
                isOpen: true,
                commitment,
                periodDate,
            });
        }
    }, [contextCommitments]);

    // Wrapper for clicked payment row in TermsListView - passes periodDate directly
    const handlePaymentClick = useCallback((commitment: CommitmentWithTerm, periodDate: string) => {
        handleOpenPaymentRecorder(commitment.id, periodDate);
    }, [handleOpenPaymentRecorder]);

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
            // Convert details to database format
            const dbPaymentDetails: any = {
                expense_id: expenseId,
                date_key: date_key,
                user_id: user?.id || null
            };

            if (details.paid !== undefined) {
                dbPaymentDetails.paid = details.paid;
            }
            if (details.paymentDate !== undefined) {
                dbPaymentDetails.payment_date = details.paymentDate
                    ? new Date(details.paymentDate).toISOString()
                    : null;
            }
            if (details.overriddenAmount !== undefined) {
                dbPaymentDetails.overridden_amount = details.overriddenAmount;
            }
            if (details.overriddenDueDate !== undefined) {
                dbPaymentDetails.overridden_due_date = details.overriddenDueDate;
            }

            // Use direct upsert instead of RPC
            const { error } = await supabase
                .from('payment_details')
                .upsert(dbPaymentDetails, {
                    onConflict: 'expense_id,date_key'
                });

            if (error) throw error;
            showToast(t('save.paymentSuccess', 'Pago guardado exitosamente'), 'success');
        } catch (error) {
            console.error('Error saving payment details:', error);
            showToast(t('save.paymentError', 'Error guardando el pago'), 'error');
            fetchData();
        }
    }, [isSupabaseConfigured, supabase, user, t, fetchData, showToast]);

    const handleAddCategory = useCallback(async (newCategory: string) => {
        if (!newCategory || categories.some(c => c.name === newCategory)) return;

        // Optimistically update UI using a temp Category object
        const tempCategory: Category = {
            id: `temp-${Date.now()}`,
            name: newCategory,
            isBase: false,
            base_category_key: null
        };
        setCategories(prev => [...prev, tempCategory].sort((a, b) => a.name.localeCompare(b.name)));

        if (!isSupabaseConfigured || !supabase) {
            showToast(t('category.addSuccess', 'Categoría agregada exitosamente'), 'success');
            return;
        }

        try {
            const userId = await getCurrentUserId();
            if (!userId) throw new Error('No user ID');

            const { addCustomCategory } = await import('./services/categoryService.v2');
            const newCat = await addCustomCategory(userId, newCategory);

            // Update category map and replace temp object with real one
            if (newCat) {
                setCategoryMap(prev => new Map(prev).set(newCat.name, newCat.id));
                setCategories(prev => prev.map(c => c.id === tempCategory.id ? newCat : c).sort((a, b) => a.name.localeCompare(b.name)));
            }

            showToast(t('category.addSuccess', 'Categoría agregada exitosamente'), 'success');

            // Refresh data to ensure consistency
            fetchData();
        } catch (error) {
            console.error('Error adding category:', error);
            showToast(t('category.addError', 'Error agregando categoría'), 'error');
            fetchData();
        }
    }, [categories, isSupabaseConfigured, supabase, user, fetchData, t, showToast]);

    const handleEditCategory = useCallback(async (oldName: string, newName: string) => {
        if (!newName || newName === oldName || categories.some(c => c.name === newName)) return;

        setCategories(prev => prev.map(c => c.name === oldName ? { ...c, name: newName } : c).sort((a, b) => a.name.localeCompare(b.name)));
        setExpenses(prev => prev.map(e => e.category === oldName ? { ...e, category: newName } : e));

        if (!isSupabaseConfigured || !supabase) {
            showToast(t('category.updateSuccess', 'Categoría actualizada exitosamente'), 'success');
            return;
        }

        try {
            const { error } = await supabase.rpc('update_category_and_expenses', { old_name: oldName, new_name: newName });
            if (error) throw error;
            showToast(t('category.updateSuccess', 'Categoría actualizada exitosamente'), 'success');
            fetchData(); // Refresh to sync category changes
        } catch (error) {
            console.error('Error updating category:', error);
            showToast(t('category.updateError', 'Error actualizando categoría'), 'error');
            fetchData();
        }
    }, [isSupabaseConfigured, supabase, fetchData, t, showToast]);

    const handleDeleteCategory = useCallback(async (categoryToDelete: string) => {
        const uncategorized = t('grid.uncategorized');
        if (categoryToDelete === uncategorized) {
            showToast(t('delete.uncategorizedError', 'No se puede eliminar la categoría "Sin categoría"'), 'warning');
            return;
        }
        if (window.confirm(t('delete.categoryConfirm', { category: categoryToDelete }))) {
            setCategories(prev => prev.filter(c => c.name !== categoryToDelete));
            setExpenses(prev => prev.map(e => e.category === categoryToDelete ? { ...e, category: uncategorized } : e));

            if (!isSupabaseConfigured || !supabase) {
                showToast(t('delete.categorySuccess', 'Categoría eliminada exitosamente'), 'success');
                return;
            }

            try {
                const { error } = await supabase.rpc('delete_category_and_reassign_expenses', { category_name: categoryToDelete, new_category_name: uncategorized });
                if (error) throw error;
                showToast(t('delete.categorySuccess', 'Categoría eliminada exitosamente'), 'success');
                fetchData(); // Refresh to sync category changes
            } catch (error) {
                console.error('Error deleting category:', error);
                showToast(t('delete.categoryError', 'Error eliminando categoría'), 'error');
                fetchData();
            }
        }
    }, [t, fetchData, isSupabaseConfigured, supabase, showToast]);

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

    // Dismissible error banner for fetch failures (non-blocking)
    const DataFetchErrorBanner = () => dataFetchError ? (
        <div className="bg-red-600/90 backdrop-blur-sm text-white text-center p-3 flex items-center justify-center gap-3 shadow-lg">
            <span className="text-sm">{dataFetchError}</span>
            <button
                onClick={() => setDataFetchError(null)}
                className="px-3 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            >
                Cerrar
            </button>
        </div>
    ) : null;

    if (loading) {
        return <AppLoadingSkeleton />;
    }

    return (
        <div className={`flex h-screen font-sans antialiased theme-${theme}`}>
            <div className="flex-1 flex flex-col min-w-0 bg-slate-100/50 dark:bg-slate-900">
                {!isSupabaseConfigured && <OfflineBanner />}
                <DataFetchErrorBanner />
                <Header
                    onAddExpense={handleAddExpenseClick}
                    onExport={handleExport}
                    theme={theme}
                    onThemeChange={setTheme}
                    view={view}
                    onViewChange={setView}
                    onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
                />
                <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
                    <div className={`max-w-screen-2xl mx-auto min-h-0 px-4 pt-4 md:pt-6 ${view === 'graph' ? 'lg:h-full' : 'lg:h-full'}`}>
                        <React.Suspense fallback={<div className="p-6 text-slate-500 dark:text-slate-400">Cargando…</div>}>
                            {view === 'table' && (
                                useV2Dashboard ? (
                                    <TableViewV2
                                        focusedDate={focusedDate}
                                        visibleMonthsCount={visibleMonthsCount}
                                        // Use context commitments (auto-updates) instead of stale local state
                                        preloadedCommitments={contextCommitments}
                                        preloadedPayments={contextPayments}
                                        onEditCommitment={handleEditCommitment} // Edit form for basic data
                                        onDetailCommitment={handleViewCommitment} // Detail modal with terms
                                        onDeleteCommitment={(id) => {
                                            // Open confirmation modal instead of window.confirm
                                            setCommitmentToDelete(id);
                                        }}
                                        onPauseCommitment={(c) => {
                                            // Open edit modal with pause form pre-expanded
                                            setEditingCommitment(c);
                                            setOpenWithPauseForm(true);
                                            setOpenWithResumeForm(false); // Ensure resume form is closed
                                            setIsFormOpen(true);
                                        }}
                                        onResumeCommitment={handleResumeCommitment}
                                        onRecordPayment={handleOpenPaymentRecorder}
                                        onFocusedDateChange={setFocusedDate}
                                        onVisibleMonthsCountChange={setVisibleMonthsCount}
                                    />
                                ) : (
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
                                )
                            )}
                            {view === 'graph' && (
                                <DashboardFullV2
                                    displayYear={focusedDate.getFullYear()}
                                    displayMonth={focusedDate.getMonth()}
                                    onMonthChange={(m) => setFocusedDate(prev => new Date(prev.getFullYear(), m, 1))}
                                    onYearChange={(y) => setFocusedDate(prev => new Date(y, prev.getMonth(), 1))}
                                    onOpenPaymentRecorder={handleOpenPaymentRecorder}
                                />
                            )}
                            {view === 'calendar' && !useV2Dashboard && (
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
            {/* Mobile Floating Action Button */}
            <FloatingActionButton onClick={handleAddExpenseClick} />
            {/* Detail View Modal */}
            {viewingCommitment && (
                <CommitmentDetailModal
                    isOpen={!!viewingCommitment}
                    onClose={() => setViewingCommitment(null)}
                    commitment={viewingCommitment}
                    payments={contextPayments.get(viewingCommitment.id) || []} // Pass specific payments for this commitment
                    onEdit={() => handleEditCommitment(viewingCommitment)}
                    onPaymentClick={handlePaymentClick}
                />
            )}
            <ExpenseCommitmentFormWrapper
                isOpen={isFormOpen}
                onClose={() => {
                    setIsFormOpen(false);
                    setEditingExpense(null);
                    setEditingCommitment(null);
                    setOpenWithPauseForm(false); // Reset pause form flag
                    setOpenWithResumeForm(false); // Reset resume form flag
                }}
                onSave={handleSaveExpense}
                expenseToEdit={editingExpense}
                commitmentToEdit={editingCommitment}
                categories={categories}
                expenses={expenses}
                onRefresh={async () => {
                    showToast('Actualizando datos...', 'loading');
                    try {
                        await refreshCommitments();
                        showToast('Datos actualizados', 'success');
                    } catch {
                        showToast('Error al actualizar', 'error');
                    }
                }}
                openWithPauseForm={openWithPauseForm}
                openWithResumeForm={openWithResumeForm}
                onPaymentClick={handlePaymentClick}
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
                message={(function () {
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
            {/* Commitment V2 deletion modal */}
            <ConfirmationModal
                isOpen={!!commitmentToDelete}
                title={'Eliminar compromiso'}
                message={(function () {
                    if (!commitmentToDelete) return '¿Seguro que deseas eliminar este compromiso?';
                    // Use contextCommitments for consistency with handleOpenPaymentRecorder
                    const commitment = contextCommitments.find(c => c.id === commitmentToDelete);
                    const name = commitment ? `"${commitment.name}"` : 'este compromiso';
                    return `Vas a eliminar ${name} y todos sus pagos asociados.\n\nEsta acción no se puede deshacer.`;
                })()}
                confirmText={'Eliminar'}
                cancelText={t('common.cancel')}
                onConfirm={async () => {
                    if (!commitmentToDelete) return;
                    const toastId = showToast('Eliminando compromiso...', 'loading');
                    try {
                        const success = await CommitmentService.deleteCommitment(commitmentToDelete);
                        if (success) {
                            removeToast(toastId);
                            showToast('Compromiso eliminado', 'success');
                            // Refresh both local state and context
                            await Promise.all([refreshV2Data(), refreshCommitments()]);
                        } else {
                            removeToast(toastId);
                            showToast('Error al eliminar. Revisa la consola.', 'error');
                        }
                    } catch (error) {
                        console.error('Error deleting commitment:', error);
                        removeToast(toastId);
                        const errMsg = error instanceof Error ? error.message : 'Error desconocido';
                        showToast(`Error: ${errMsg}`, 'error');
                    } finally {
                        setCommitmentToDelete(null);
                    }
                }}
                onCancel={() => setCommitmentToDelete(null)}
                isDangerous={true}
            />

            {/* PaymentRecorder V2 Modal */}
            {paymentRecorderState.isOpen && paymentRecorderState.commitment && (
                <React.Suspense fallback={null}>
                    <PaymentRecorderV2
                        isOpen={paymentRecorderState.isOpen}
                        onClose={() => setPaymentRecorderState(prev => ({ ...prev, isOpen: false }))}
                        onSave={async (operation) => {
                            // Hot reload data after saving payment
                            const messages = {
                                created: 'Pago registrado',
                                updated: 'Pago actualizado',
                                deleted: 'Pago eliminado',
                            };
                            const toastId = showToast('Procesando...', 'loading');
                            try {
                                // Refresh context silently (Grid now uses context data)
                                await refreshCommitments({ silent: true, force: true });
                                removeToast(toastId);
                                showToast(messages[operation], 'success');
                            } catch {
                                removeToast(toastId);
                                showToast('Error al actualizar datos', 'error');
                            }
                        }}
                        commitment={paymentRecorderState.commitment}
                        periodDate={paymentRecorderState.periodDate}
                    />
                </React.Suspense>
            )}

            {/* Pause Commitment Modal */}
            {pauseModalState.isOpen && pauseModalState.commitment && (
                <React.Suspense fallback={null}>
                    <PauseCommitmentModal
                        isOpen={pauseModalState.isOpen}
                        onClose={() => setPauseModalState({ isOpen: false, commitment: null })}
                        onSuccess={async () => {
                            showToast('Compromiso pausado', 'success');
                            await refreshCommitments({ silent: true, force: true });
                        }}
                        commitment={pauseModalState.commitment}
                    />
                </React.Suspense>
            )}

            {/* PWA Update Notification */}
            <PWAUpdateNotifier />
        </div>
    );
};

export default App;
