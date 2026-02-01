import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocalization } from './useLocalization';
import usePersistentState from './usePersistentState';
import { useCommitments } from '../context/CommitmentsContext';
import { CommitmentWithTerm } from '../types.v2';
import { extractYearMonth, parseDateString } from '../utils/financialUtils.v2';
import { findTermForPeriod } from '../utils/termUtils';
import { getCommitmentSummary } from '../utils/commitmentStatusUtils';

// Types extracted from component
export type StatusFilter = 'all' | 'pendiente' | 'pagado' | 'ingresos';
export type ViewMode = 'monthly' | 'inventory';
export type KPIType = 'ingresos' | 'comprometido' | 'pagado' | 'pendiente';
export type Density = 'minimal' | 'compact' | 'detailed';

interface UseExpenseGridLogicProps {
    focusedDate: Date;
    onFocusedDateChange?: (date: Date) => void;
}

export const useExpenseGridLogic = ({ focusedDate }: UseExpenseGridLogicProps) => {
    const { t, language } = useLocalization();
    const {
        commitments,
        payments,
        loading,
        error,
        setDisplayYear,
        setDisplayMonth,
        getMonthTotals
    } = useCommitments();

    // =========================================================================
    // STATE
    // =========================================================================

    // Density: minimal (9 months), compact (12 months), detailed (6 months)
    const [density, setDensity] = usePersistentState<Density>('gridDensity', 'compact');

    // Category filter
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Status filter (tied to KPI carousel)
    const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('pendiente');

    // View mode: monthly (filtered) or inventory (all)
    const [viewMode, setViewMode] = useState<ViewMode>('monthly');

    // Smart sticky header state
    const [showMetrics, setShowMetrics] = useState(true);
    const [currentKPI, setCurrentKPI] = useState<KPIType>('pendiente');
    const [showKPISelector, setShowKPISelector] = useState(false);

    // =========================================================================
    // DATA SYNC
    // =========================================================================

    // Sync context with focused date
    useEffect(() => {
        const year = focusedDate.getFullYear();
        const month = focusedDate.getMonth();
        setDisplayYear(year);
        setDisplayMonth(month);
    }, [focusedDate, setDisplayYear, setDisplayMonth]);

    // =========================================================================
    // HELPERS & LOGIC
    // =========================================================================

    // Helper: Find term (aliased for compatibility/clarity)
    const getTermForPeriod = findTermForPeriod;

    // Helper: Get translated category name
    const getTranslatedCategoryName = useCallback((commitment: CommitmentWithTerm): string => {
        const category = commitment.category as any;
        if (category?.base_category_key) {
            return t(`category.${category.base_category_key}`, category.name);
        }
        return category?.name || t('grid.uncategorized', 'Sin categoría');
    }, [t]);

    // Helper: Format CLP
    const formatClp = useCallback((amount: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    }, []);

    // Check if commitment is active in month
    const isActiveInMonth = useCallback((commitment: CommitmentWithTerm, monthDate: Date): boolean => {
        const term = getTermForPeriod(commitment, monthDate);
        if (!term) return false;

        const { year: startYear, month: startMonth } = extractYearMonth(term.effective_from);
        const monthsDiff = (monthDate.getFullYear() - startYear) * 12 +
            (monthDate.getMonth() + 1 - startMonth);

        if (monthsDiff < 0) return false;

        switch (term.frequency) {
            case 'ONCE': return monthsDiff === 0;
            case 'MONTHLY': return true;
            case 'BIMONTHLY': return monthsDiff % 2 === 0;
            case 'QUARTERLY': return monthsDiff % 3 === 0;
            case 'SEMIANNUALLY': return monthsDiff % 6 === 0;
            case 'ANNUALLY': return monthsDiff % 12 === 0;
            default: return true;
        }
    }, [getTermForPeriod]);

    // Get Payment Status
    const getPaymentStatus = useCallback((commitmentId: string, monthDate: Date, dueDay: number = 1) => {
        const commitmentPayments = payments.get(commitmentId) || [];
        const targetYear = monthDate.getFullYear();
        const targetMonth = monthDate.getMonth() + 1;

        const payment = commitmentPayments.find(p => {
            const parts = p.period_date.split('-');
            const pYear = parseInt(parts[0], 10);
            const pMonth = parseInt(parts[1], 10);
            return pYear === targetYear && pMonth === targetMonth;
        });

        if (payment) {
            const paidAmount = payment.currency_original === 'CLP'
                ? payment.amount_original
                : payment.amount_in_base ?? payment.amount_original;

            const paymentDate = payment.payment_date ? parseDateString(payment.payment_date) : null;
            const isPaid = !!payment.payment_date;

            const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
            const paidOnTime = paymentDate ? paymentDate <= dueDate : true;

            return {
                isPaid,
                amount: paidAmount,
                paymentDate,
                paidOnTime,
                payment,
                hasPaymentRecord: true
            };
        }

        return {
            isPaid: false,
            amount: null,
            paymentDate: null,
            paidOnTime: false,
            payment: null,
            hasPaymentRecord: false
        };
    }, [payments]);

    // Smart Sort Logic
    const getCommitmentSortData = useCallback((c: CommitmentWithTerm) => {
        const summary = getCommitmentSummary(c, payments.get(c.id) || []);
        const term = c.active_term;
        const dueDay = term?.due_day_of_month ?? 32;
        const amount = summary.perPeriodAmount || 0;

        const today = new Date();
        const createdAt = new Date(c.created_at);
        const isRecentlyCreated = (today.getTime() - createdAt.getTime()) < 5 * 60 * 1000;

        let statusPriority = 1; // Default Pending

        const isPaid = summary.estado === 'ok' || summary.estado === 'completed' || summary.estado === 'paused' || summary.estado === 'terminated' || summary.estado === 'no_payments';
        const isOverdue = summary.estado === 'overdue';

        if (isRecentlyCreated && !isPaid) {
            statusPriority = -2;
        } else if (c.is_important && !isPaid) {
            statusPriority = -1;
        } else if (isOverdue) {
            statusPriority = 0;
        } else if (isPaid) {
            statusPriority = 2;
        } else {
            statusPriority = 1;
        }

        return { statusPriority, dueDay, amount, name: c.name, id: c.id };
    }, [payments]);

    const performSmartSort = useCallback((a: CommitmentWithTerm, b: CommitmentWithTerm) => {
        const dataA = getCommitmentSortData(a);
        const dataB = getCommitmentSortData(b);

        if (dataA.statusPriority !== dataB.statusPriority) return dataA.statusPriority - dataB.statusPriority;
        if (dataA.dueDay !== dataB.dueDay) return dataA.dueDay - dataB.dueDay;
        if (Math.abs(dataA.amount - dataB.amount) > 0.01) return dataB.amount - dataA.amount;

        const nameCompare = dataA.name.localeCompare(dataB.name, language === 'es' ? 'es' : 'en');
        if (nameCompare !== 0) return nameCompare;

        return dataA.id.localeCompare(dataB.id);
    }, [getCommitmentSortData, language]);

    // =========================================================================
    // COMPUTED DATA
    // =========================================================================

    // Dynamic Month Count based on density
    const effectiveMonthCount = density === 'minimal' ? 11 : density === 'compact' ? 7 : 5;

    const visibleMonths = useMemo(() => {
        const count = effectiveMonthCount;
        const months: Date[] = [];

        // Minimal View: 11 months "Elastic Year"
        // Base: Tries to show current year (Jan start).
        // Exceptions: Slides back for Jan/Feb (to show past) and forward for Oct/Nov/Dec (to show future).
        if (density === 'minimal') {
            const currentYear = focusedDate.getFullYear();
            const monthIndex = focusedDate.getMonth();

            // 1. Ideal Start: January (Index 0)
            let startMonthIndex = 0;

            // 2. Constraint: Must see at least 2 months PAST (Early Year)
            // If Jan (0) -> Start -2 (Nov). If Feb (1) -> Start -1 (Dec).
            startMonthIndex = Math.min(startMonthIndex, monthIndex - 2);

            // 3. Constraint: Must see at least 2 months FUTURE (Late Year)
            // Total 11. End = Start + 10. We want End >= Focus + 2.
            // Start + 10 >= Focus + 2  =>  Start >= Focus - 8
            startMonthIndex = Math.max(startMonthIndex, monthIndex - 8);

            const start = new Date(currentYear, startMonthIndex, 1);

            for (let i = 0; i < count; i++) {
                const d = new Date(start);
                d.setMonth(start.getMonth() + i);
                months.push(d);
            }
        }
        // Compact View: 7 months centered (Focus - 3 months)
        // User Request: "vista compacta perfectamente podria mostrar 7 meses"
        else if (density === 'compact') {
            const start = new Date(focusedDate);
            start.setDate(1);
            start.setMonth(start.getMonth() - 3);

            for (let i = 0; i < count; i++) {
                const d = new Date(start);
                d.setMonth(start.getMonth() + i);
                months.push(d);
            }
        }
        // Detailed View: 5 months centered (Focus - 2 months)
        else {
            const start = new Date(focusedDate);
            start.setDate(1);
            start.setMonth(start.getMonth() - 2); // Start 2 months before

            for (let i = 0; i < count; i++) {
                const d = new Date(start);
                d.setMonth(start.getMonth() + i);
                months.push(d);
            }
        }
        return months;
    }, [focusedDate, effectiveMonthCount, density]);

    // Grouping Logic
    const groupedCommitments = useMemo(() => {
        const activeItems: CommitmentWithTerm[] = [];

        commitments.forEach(c => {
            let isVisible = viewMode === 'inventory';

            if (!isVisible) {
                const isActiveInVisibleRange = visibleMonths.some(m => isActiveInMonth(c, m));
                const hasPaymentInRange = visibleMonths.some(m => {
                    const { hasPaymentRecord } = getPaymentStatus(c.id, m, 1);
                    return hasPaymentRecord;
                });
                isVisible = isActiveInVisibleRange || hasPaymentInRange;
            }

            if (!isVisible) return;

            const categoryName = getTranslatedCategoryName(c);
            if (selectedCategory === 'FILTER_IMPORTANT') {
                if (!c.is_important) return;
            } else if (selectedStatus === 'ingresos') {
                if (c.flow_type !== 'INCOME') return;
            } else if (selectedCategory !== 'all' && categoryName !== selectedCategory) {
                return;
            }

            activeItems.push(c);
        });

        if (density === 'compact') {
            return [{
                category: 'all',
                flowType: 'EXPENSE' as const,
                commitments: activeItems.sort(performSmartSort)
            }];
        }

        const groups: Record<string, { items: CommitmentWithTerm[], flowType: 'INCOME' | 'EXPENSE' }> = {};

        activeItems.forEach(c => {
            const categoryName = getTranslatedCategoryName(c);
            if (!groups[categoryName]) {
                groups[categoryName] = {
                    items: [],
                    flowType: c.flow_type
                };
            }
            groups[categoryName].items.push(c);
        });

        return Object.entries(groups)
            .map(([category, data]) => {
                const sortedItems = data.items.sort(performSmartSort);
                const minPriority = sortedItems.length > 0
                    ? Math.min(...sortedItems.map(c => getCommitmentSortData(c).statusPriority))
                    : 2;

                return {
                    category,
                    flowType: data.flowType,
                    commitments: sortedItems,
                    minPriority
                };
            })
            .sort((a, b) => {
                if (a.minPriority !== b.minPriority) return a.minPriority - b.minPriority;
                return a.category.localeCompare(b.category, language === 'es' ? 'es' : 'en');
            });
    }, [commitments, viewMode, visibleMonths, isActiveInMonth, getPaymentStatus, selectedCategory, density, performSmartSort, getTranslatedCategoryName, getCommitmentSortData, language]);

    // Available Categories
    const availableCategories = useMemo(() => {
        const categorySet = new Set<string>();
        const visibleInContext = commitments.filter(c => {
            if (viewMode === 'inventory') return true;
            const isActiveInVisibleRange = visibleMonths.some(m => isActiveInMonth(c, m));
            const hasPaymentInRange = visibleMonths.some(m => {
                const { hasPaymentRecord } = getPaymentStatus(c.id, m, 1);
                return hasPaymentRecord;
            });
            return isActiveInVisibleRange || hasPaymentInRange;
        });

        visibleInContext.forEach(c => {
            categorySet.add(getTranslatedCategoryName(c));
        });

        const hasImportant = visibleInContext.some(c => c.is_important);
        const categories = ['all', ...Array.from(categorySet).sort((a, b) => a.localeCompare(b, language === 'es' ? 'es' : 'en'))];

        if (hasImportant) {
            categories.splice(1, 0, 'FILTER_IMPORTANT');
        }
        return categories;
    }, [commitments, viewMode, visibleMonths, isActiveInMonth, getPaymentStatus, getTranslatedCategoryName, language]);

    // KPI Change Handler
    const handleKPIChange = useCallback((kpi: KPIType) => {
        setCurrentKPI(kpi);
        switch (kpi) {
            case 'pendiente':
                setSelectedStatus('pendiente');
                break;
            case 'pagado':
                setSelectedStatus('pagado');
                break;
            case 'ingresos':
                setSelectedStatus('ingresos');
                break;
            case 'comprometido':
                setSelectedStatus('all');
                break;
        }
    }, [setCurrentKPI, setSelectedStatus]);

    // Scroll Handler for Sticky Header
    useEffect(() => {
        const scrollContainer = document.querySelector('main');
        if (!scrollContainer) return;

        let lastScrollY = 0;

        const handleScroll = () => {
            const currentScrollY = scrollContainer.scrollTop;
            if (currentScrollY < 50) {
                setShowMetrics(true);
            } else if (currentScrollY < lastScrollY) {
                setShowMetrics(true);
            } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
                setShowMetrics(false);
            }
            lastScrollY = currentScrollY;
        };

        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, []);

    // Termination Status Helpers
    type TerminationReason = 'ACTIVE' | 'PAUSED' | 'COMPLETED_INSTALLMENTS' | 'TERMINATED';

    const getTerminationReason = useCallback((commitment: CommitmentWithTerm): TerminationReason => {
        const terms = commitment.all_terms || [];
        const latestTerm = terms.length > 0
            ? terms.slice().sort((a, b) => b.version - a.version)[0]
            : commitment.active_term;

        if (!latestTerm) return 'TERMINATED';
        if (!latestTerm.effective_until) return 'ACTIVE';

        const { year: endYear, month: endMonth } = extractYearMonth(latestTerm.effective_until);
        const endOfMonth = new Date(endYear, endMonth, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (endOfMonth >= today) return 'ACTIVE';
        if (latestTerm.installments_count && latestTerm.installments_count > 1) return 'COMPLETED_INSTALLMENTS';
        return 'PAUSED';
    }, []);

    const isCommitmentTerminated = useCallback((commitment: CommitmentWithTerm): boolean => {
        const reason = getTerminationReason(commitment);
        return reason === 'TERMINATED' || reason === 'COMPLETED_INSTALLMENTS';
    }, [getTerminationReason]);

    return {
        // State
        loading,
        error,
        density,
        setDensity,
        selectedCategory,
        setSelectedCategory,
        selectedStatus,
        setSelectedStatus,
        viewMode,
        setViewMode,
        showMetrics,
        currentKPI,
        handleKPIChange,
        showKPISelector,
        setShowKPISelector,

        // Data
        commitments,
        payments,
        groupedCommitments,
        availableCategories,
        visibleMonths,

        // Helpers
        getPaymentStatus,
        performSmartSort,
        isActiveInMonth,
        getTranslatedCategoryName,
        formatClp,
        getTermForPeriod,
        getTerminationReason,
        isCommitmentTerminated,

        // Context
        language,
        t,
        getMonthTotals,
        effectiveMonthCount,
    };
};
