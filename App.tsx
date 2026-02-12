
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Header from './components/Header';
import { ExpenseCommitmentFormWrapper } from './components/ExpenseCommitmentFormWrapper';
// FilterControls removed (legacy v1)
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
import { Expense, PaymentStatus, ExpenseType, View, PaymentDetails } from './types';
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
    const [, setCategoryMap] = useState<Map<string, string>>(new Map()); // categoryName -> categoryId
    const [loading, setLoading] = useState(isSupabaseConfigured);
    const [dataFetchError, setDataFetchError] = useState<string | null>(null); // Non-blocking error display

    const [focusedDate, setFocusedDate] = useState(new Date());
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [editingCommitment, setEditingCommitment] = useState<CommitmentWithTerm | null>(null);
    const [openWithPauseForm, setOpenWithPauseForm] = useState(false); // When true, opens edit modal with pause form expanded
    const [openWithResumeForm, setOpenWithResumeForm] = useState(false); // When true, opens edit modal with resume (new term) form expanded
    // V2 data (preloaded at app startup for instant tab switching)
    const [, setCommitmentsV2] = useState<CommitmentWithTerm[]>([]);
    const [, setPaymentsV2] = useState<Map<string, Payment[]>>(new Map());
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

        // Clear any previous error when retrying
        setDataFetchError(null);

        try {
            // Load categories using v2 service (global + custom - hidden)
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

            // V2 data: commitments + payments
            if (userId) {
                const currentYear = new Date().getFullYear();
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

                console.log('V2 data loaded:', { commitments: commitments.length, payments: allPayments.length });
            }

        } catch (error) {
            console.error('Error fetching data:', error);
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
        console.warn('[LEGACY] confirmDeleteExpense called - expenses table no longer exists');
        setIsDeleteModalOpen(false);
        setExpenses(prev => prev.filter(e => e.id !== expenseToDelete));
        setExpenseToDelete(null);
        showToast(t('delete.expenseSuccess', 'Gasto eliminado exitosamente'), 'success');
    }, [expenseToDelete, t, showToast]);

    const cancelDeleteExpense = useCallback(() => {
        console.log('Deletion cancelled');
        setIsDeleteModalOpen(false);
        setExpenseToDelete(null);
    }, []);

    const handleSaveExpense = useCallback(async (expense: Omit<Expense, 'id' | 'createdAt'> & { id?: string }) => {
        // [LEGACY] This function referenced the dropped 'expenses' and 'payment_details' tables.
        // V2 commitments are saved via CommitmentForm.v2 -> CommitmentService/PaymentService.
        console.warn('[LEGACY] handleSaveExpense called - expenses table no longer exists. Use CommitmentForm.v2 instead.');
        showToast('Esta función legacy ha sido deshabilitada. Usa el formulario v2.', 'error');
    }, [showToast]);

    const requestDeletePayment = useCallback((expenseId: string, year: number, month: number) => {
        setPaymentToDelete({ expenseId, year, month });
        setIsDeletePaymentModalOpen(true);
    }, []);

    const confirmDeletePayment = useCallback(async () => {
        if (!paymentToDelete) return;
        console.warn('[LEGACY] confirmDeletePayment called - payment_details table no longer exists');
        const { expenseId, year, month } = paymentToDelete;
        const date_key = `${year}-${month}`;
        setPaymentStatus(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            if (next[expenseId]) {
                delete next[expenseId][date_key];
                if (Object.keys(next[expenseId]).length === 0) delete next[expenseId];
            }
            return next;
        });
        setEditingCell(null);
        setIsDeletePaymentModalOpen(false);
        setPaymentToDelete(null);
        showToast(t('delete.paymentSuccess', 'Pago eliminado exitosamente'), 'success');
    }, [paymentToDelete, t, showToast]);

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
        console.warn('[LEGACY] handleSavePaymentDetails called - payment_details table no longer exists');
        const date_key = `${year}-${month}`;
        setPaymentStatus(prev => {
            const newStatus = JSON.parse(JSON.stringify(prev));
            if (!newStatus[expenseId]) newStatus[expenseId] = {};
            const existingDetails = newStatus[expenseId][date_key] || {};
            newStatus[expenseId][date_key] = { ...existingDetails, ...details };
            return newStatus;
        });
        showToast(t('save.paymentSuccess', 'Pago guardado exitosamente'), 'success');
    }, [t, showToast]);

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

    // Mobile Filter State (Lifted for Global Header Access)
    const [showMobileFilters, setShowMobileFilters] = useState(false);

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
                    onToggleMobileFilters={() => setShowMobileFilters(prev => !prev)}
                />
                <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
                    <div className={`max-w-screen-2xl mx-auto min-h-0 px-4 pt-2 md:pt-3 ${view === 'graph' ? 'lg:h-full' : 'lg:h-full'}`}>
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
                                        // Mobile Filter Props
                                        showMobileFilters={showMobileFilters}
                                        onCloseMobileFilters={() => setShowMobileFilters(false)}
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
