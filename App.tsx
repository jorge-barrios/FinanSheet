
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Header from './components/Header';
import ExpenseGrid from './components/ExpenseGrid';
import ExpenseForm from './components/ExpenseFormWorking';
import FilterControls from './components/FilterControls';
import Dashboard from './components/Dashboard';
import ViewSwitcher from './components/ViewSwitcher';
import GraphView from './components/GraphView';
import CalendarView from './components/CalendarView';
import CellEditModal from './components/CellEditModal';
import CategoryManager from './components/CategoryManager';
import { Expense, PaymentStatus, ExpenseType, View, PaymentDetails, PaymentFrequency } from './types';
import { exportToExcel } from './services/exportService';
import { useLocalization } from './hooks/useLocalization';
import usePersistentState from './hooks/usePersistentState';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { getExchangeRate } from './src/services/exchangeRateService';
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

            const paymentsObject = (paymentsData || []).reduce((acc, payment) => {
                if (!acc[payment.expense_id]) acc[payment.expense_id] = {};
                acc[payment.expense_id][payment.date_key] = {
                    paid: payment.paid,
                    overriddenAmount: payment.overridden_amount,
                    paymentDate: payment.payment_date ? new Date(payment.payment_date).getTime() : undefined
                };
                return acc;
            }, {} as PaymentStatus);

            const expensesFromSupabase = (expensesData || []).map((e: any) => ({
                id: e.id,
                name: e.name,
                category: e.category,
                amountInClp: e.total_amount,
                type: (e.type?.toUpperCase() ?? 'RECURRING') as ExpenseType,
                startDate: e.start_date,
                installments: e.installments,
                paymentFrequency: e.payment_frequency as PaymentFrequency,
                isImportant: e.is_important,
                dueDate: e.due_date,
                created_at: e.created_at,
                expenseDate: e.expense_date,
                originalAmount: e.original_amount,
                originalCurrency: e.original_currency,
                exchangeRate: e.exchange_rate,
            } as Expense));
            setExpenses(expensesFromSupabase);
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

    const handleDateChange = (newDate: Date) => {
        setFocusedDate(newDate);
    };

    const handleAddExpenseClick = () => {
        setEditingExpense(null);
        setIsFormOpen(true);
    };

    const handleEditExpense = (expense: Expense) => {
        setEditingExpense(expense);
        setIsFormOpen(true);
    };

    const handleDeleteExpense = useCallback(async (expenseId: string) => {
        if (window.confirm(t('delete.confirm'))) {
            setExpenses(prev => prev.filter(e => e.id !== expenseId));
            
            if (!isSupabaseConfigured || !supabase) return;
            
            const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
            if (error) {
                console.error('Error deleting expense:', error);
                alert(t('delete.error'));
                fetchData();
            }
        }
    }, [t, fetchData, isSupabaseConfigured, supabase]);

    const handleSaveExpense = useCallback(async (expense: Omit<Expense, 'id' | 'createdAt'> & { id?: string }) => {
        if (!isSupabaseConfigured || !supabase) return;

        setLoading(true);
        try {
            // 1. Get exchange rate
            const dateForApi = format(new Date(expense.expenseDate), 'dd-MM-yyyy');
            const rate = await getExchangeRate(expense.originalCurrency, dateForApi);

            // 2. Calculate final amount and build the full expense object
            const expenseToSave = {
                ...expense,
                id: expense.id, // id can be undefined here, which is fine for upsert
                exchangeRate: rate,
                amountInClp: expense.originalCurrency === 'CLP' ? expense.originalAmount : expense.originalAmount * rate,
            };

            // 3. Convert to snake_case and save to Supabase
            const snakeCaseExpense = keysToSnakeCase(expenseToSave);
            const { error } = await supabase.from('expenses').upsert(snakeCaseExpense);

            if (error) {
                throw error;
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
            <Dashboard 
                expenses={filteredAndSortedExpenses} 
                paymentStatus={paymentStatus} 
                displayYear={focusedDate.getFullYear()}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
            />
            <div className="flex-1 flex flex-col min-w-0 bg-slate-100/50 dark:bg-slate-900">
                {!isSupabaseConfigured && <OfflineBanner />}
                <Header 
                    focusedDate={focusedDate}
                    onDateChange={handleDateChange}
                    onAddExpense={handleAddExpenseClick}
                    onExport={handleExport}
                    onToggleSidebar={() => setIsSidebarOpen(s => !s)}
                    theme={theme}
                    onThemeChange={setTheme}
                    visibleMonthsCount={visibleMonthsCount}
                    onVisibleMonthsCountChange={setVisibleMonthsCount}
                />
                <main className="flex-1 overflow-y-auto overflow-x-hidden">
                    <div className="max-w-screen-2xl mx-auto pt-4 px-4">
                        <FilterControls
                            searchTerm={searchTerm}
                            onSearchTermChange={setSearchTerm}
                            filterType={filterType}
                            onFilterTypeChange={setFilterType}
                            filterImportance={filterImportance}
                            onFilterImportanceChange={setFilterImportance}
                        />
                        <ViewSwitcher currentView={view} onViewChange={setView} />
                    </div>
                    
                    <div className="max-w-screen-2xl mx-auto h-[calc(100%-140px)]">
                        {view === 'table' && (
                            <ExpenseGrid 
                                expenses={filteredAndSortedExpenses}
                                paymentStatus={paymentStatus}
                                focusedDate={focusedDate}
                                onEditExpense={handleEditExpense}
                                onDeleteExpense={handleDeleteExpense}
                                onOpenCellEditor={handleOpenCellEditor}
                                visibleMonthsCount={visibleMonthsCount}
                            />
                        )}
                        {view === 'graph' && <GraphView expenses={filteredAndSortedExpenses} paymentStatus={paymentStatus} displayYear={focusedDate.getFullYear()} />}
                        {view === 'calendar' && <CalendarView expenses={filteredAndSortedExpenses} paymentStatus={paymentStatus} displayYear={focusedDate.getFullYear()} />}
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
        </div>
    );
};

export default App;
