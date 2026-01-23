/**
 * ExpenseGridVirtual.v2.tsx
 *
 * V2 version of the expense grid that uses Commitments + Terms data model
 * instead of the v1 Expense model. Fetches data directly from v2 services.
 *
 * Design matches the v2 style guide:
 * - Color-coded expense/income (red/green)
 * - Dynamic theming
 * - Icon-based feedback
 */

import React, { useMemo, useEffect, useRef, useState, useCallback, forwardRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { es } from 'date-fns/locale/es';
registerLocale('es', es);
import { useLocalization } from '../hooks/useLocalization';
import usePersistentState from '../hooks/usePersistentState';
import { useCommitments } from '../context/CommitmentsContext';
import {
    EditIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon,
    CheckCircleIcon, ExclamationTriangleIcon, ClockIcon,
    CalendarIcon, HomeIcon, TransportIcon, DebtIcon, HealthIcon,
    SubscriptionIcon, MiscIcon, CategoryIcon,
    StarIcon, IconProps, PauseIcon, PlusIcon, MoreVertical, Link2,
    FunnelIcon, FolderIcon, HashIcon
} from './icons';
import type { CommitmentWithTerm, Payment } from '../types.v2';
import { parseDateString, extractYearMonth, getPerPeriodAmount } from '../utils/financialUtils.v2';
import { findTermForPeriod } from '../utils/termUtils';
import { getCommitmentSummary } from '../utils/commitmentStatusUtils';
import { CommitmentCard } from './CommitmentCard';
import { Sparkles, Home, Minus, RefreshCw, TrendingUp, Wallet, Eye } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================
// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const DateCustomInput = forwardRef<HTMLButtonElement, any>(({ value, onClick }, ref) => (
    <button
        className="h-full flex items-center justify-center px-3 sm:px-4 text-center min-w-[100px] sm:min-w-[140px] text-sm font-semibold text-slate-900 dark:text-white capitalize hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-full outline-none border-x border-slate-200 dark:border-slate-700"
        onClick={onClick}
        ref={ref}
    >
        {value}
    </button>
));
DateCustomInput.displayName = 'DateCustomInput';

const CompactTooltip = ({ children, content, triggerClassName, sideOffset = 5 }: { children: React.ReactNode, content: React.ReactNode, triggerClassName?: string, sideOffset?: number }) => (
    <Tooltip.Provider delayDuration={500} skipDelayDuration={0}>
        <Tooltip.Root disableHoverableContent={true}>
            <Tooltip.Trigger asChild>
                {/* Wrap in span to ensure ref passing if child is composite */}
                <span className={`h-full w-full block outline-none ${triggerClassName || ''}`}>{children}</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content
                    className="z-50 rounded-lg bg-white dark:bg-slate-800 px-3 py-2 text-sm shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in-0 zoom-in-95 duration-200 pointer-events-none"
                    sideOffset={sideOffset}
                >
                    {content}
                    <Tooltip.Arrow className="fill-white dark:fill-slate-800 border-t border-l border-slate-200" />
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    </Tooltip.Provider>
);

// =============================================================================
// TYPES
// =============================================================================

interface ExpenseGridV2Props {
    focusedDate: Date;
    onEditCommitment: (commitment: CommitmentWithTerm) => void;
    onDetailCommitment?: (commitment: CommitmentWithTerm) => void;  // NEW: Opens detail modal
    onDeleteCommitment: (commitmentId: string) => void;
    onPauseCommitment: (commitment: CommitmentWithTerm) => void;
    onResumeCommitment: (commitment: CommitmentWithTerm) => void;
    onRecordPayment: (commitmentId: string, periodDate: string) => void; // periodDate: YYYY-MM-DD
    onFocusedDateChange?: (date: Date) => void;
    visibleMonthsCount?: number;
    onVisibleMonthsCountChange?: (count: number) => void;
    // Optional preloaded data from App.tsx for instant rendering
    preloadedCommitments?: CommitmentWithTerm[];
    preloadedPayments?: Map<string, Payment[]>;
    // Optional pre-calculated totals from dashboard (avoids duplicate logic)
    monthlyTotals?: { expenses: number; income: number };
}

// =============================================================================
// ICON MAPPING
// =============================================================================

const categoryIconsMap: Record<string, React.ReactElement<IconProps>> = {
    'Hogar': <HomeIcon />,
    'Vivienda': <HomeIcon />,
    'Transporte': <TransportIcon />,
    'Deudas': <DebtIcon />,
    'Salud': <HealthIcon />,
    'Suscripciones': <SubscriptionIcon />,
    'Varios': <MiscIcon />,
};

const getCategoryIcon = (category: string) => {
    const icon = categoryIconsMap[category] || <CategoryIcon />;
    return React.cloneElement(icon, { className: 'w-5 h-5' });
};

// NOTE: getTermForPeriod has been extracted to utils/termUtils.ts as findTermForPeriod
// It is imported at the top of this file. This alias maintains backward compatibility.
const getTermForPeriod = findTermForPeriod;

// Helper to convert Date to periodDate string (YYYY-MM-DD, first day of month)
const dateToPeriod = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
};


// =============================================================================
// COMPONENT
// =============================================================================

const ExpenseGridVirtual2: React.FC<ExpenseGridV2Props> = ({
    focusedDate,
    onEditCommitment,
    onDetailCommitment,
    onDeleteCommitment,
    onPauseCommitment,
    onResumeCommitment,
    onRecordPayment,
    onFocusedDateChange,
}) => {
    const { t, language } = useLocalization();

    // CONSUME GLOBAL CONTEXT directly - no more local state shadowing
    const {
        commitments,
        payments,
        loading,
        error,
        getMonthTotals,
        setDisplayYear,
        setDisplayMonth
    } = useCommitments();

    // Sync Grid navigation with Context to ensure data is loaded for the viewed period
    useEffect(() => {
        const year = focusedDate.getFullYear();
        const month = focusedDate.getMonth();

        // Update context window to ensure we have data for this period
        setDisplayYear(year);
        setDisplayMonth(month);
    }, [focusedDate, setDisplayYear, setDisplayMonth]);

    // Density: minimal (9 months, 40px), compact (12 months, 48px), detailed (6 months, 100px)
    const [density, setDensity] = usePersistentState<'minimal' | 'compact' | 'detailed'>(
        'gridDensity',
        'compact' // Default to compact view (12 months)
    );

    // Show/hide terminated commitments (default: hidden)


    // Category filter state
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Status filter state for mobile KPI cards (pendiente, pagado, all)
    type StatusFilter = 'all' | 'pendiente' | 'pagado';
    const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');

    // View mode: monthly (filtered by focused date) or inventory (all commitments)
    type ViewMode = 'monthly' | 'inventory';
    const [viewMode, setViewMode] = useState<ViewMode>('monthly');

    const pad = useMemo(() =>
        density === 'minimal' ? 'p-0.5' : density === 'compact' ? 'p-1' : 'p-3',
        [density]
    );

    // Layout refs
    const scrollAreaRef = useRef<HTMLDivElement | null>(null);
    const [availableHeight, setAvailableHeight] = useState<number>(400);
    const footerRef = useRef<HTMLDivElement | null>(null);

    // Removed duplicate local fetching logic (fetchData) to prevent state desync
    // The context now handles all data loading based on setDisplayYear/Month calls above

    // ==========================================================================
    // CATEGORY TRANSLATION - uses local i18n files directly (no DB calls)
    // ==========================================================================

    // Helper to get translated category name using base_category_key
    const getTranslatedCategoryName = (commitment: CommitmentWithTerm): string => {
        const category = commitment.category as any; // Cast to access base_category_key

        // If it's a base category with a key, translate it
        if (category?.base_category_key) {
            return t(`category.${category.base_category_key}`, category.name);
        }

        // Otherwise use the raw name (custom category) or fallback
        return category?.name || t('grid.uncategorized', 'Sin categoría');
    };

    // ==========================================================================
    // HEIGHT CALCULATION
    // ==========================================================================

    useEffect(() => {
        const recalc = () => {
            const el = scrollAreaRef.current;
            if (!el) return;

            const rect = el.getBoundingClientRect();
            const vh = window.innerHeight || document.documentElement.clientHeight;
            const footerH = footerRef.current ? footerRef.current.offsetHeight : 48;
            // Just the footer + small margin
            const bottomMargin = footerH + 16;

            const h = Math.max(200, vh - rect.top - bottomMargin);
            setAvailableHeight(h);
        };

        recalc();
        // Recalculate after footer renders
        const timer = setTimeout(recalc, 100);
        window.addEventListener('resize', recalc);
        return () => {
            window.removeEventListener('resize', recalc);
            clearTimeout(timer);
        };
    }, []);

    // ==========================================================================
    // COMPUTED DATA
    // ==========================================================================

    // Visible months centered on focused date - controlled by density
    // minimal=12 (solo iconos, máxima densidad), compact=9 (balance), detailed=6 (análisis)
    const densityMonthCount = density === 'minimal' ? 12 : density === 'compact' ? 9 : 6;
    const effectiveMonthCount = densityMonthCount;

    const visibleMonths = useMemo(() => {
        const count = effectiveMonthCount;
        const months: Date[] = [];
        // Forward-Looking View: Start 1 month before focused date
        // This gives 1 month of context (past) and maximizes planning view (future)
        const start = new Date(focusedDate);
        start.setDate(1); // Normalize to first of month
        start.setMonth(start.getMonth() - 1); // Start 1 month back

        for (let i = 0; i < count; i++) {
            const d = new Date(start);
            d.setMonth(start.getMonth() + i);
            months.push(d);
        }
        return months;
    }, [focusedDate, effectiveMonthCount]);

    // Auto-scroll to current month on load/density change
    useEffect(() => {
        if (!scrollAreaRef.current) return;

        // Find index of current month
        const today = new Date();
        const currentMonthIndex = visibleMonths.findIndex(m => m.getMonth() === today.getMonth() && m.getFullYear() === today.getFullYear());

        if (currentMonthIndex !== -1) {
            // Wait for render
            setTimeout(() => {
                const headerEl = document.getElementById(`month-header-${currentMonthIndex}`);
                if (headerEl && scrollAreaRef.current) {
                    // Center the element
                    const containerWidth = scrollAreaRef.current.clientWidth;
                    const headerLeft = headerEl.offsetLeft;
                    const headerWidth = headerEl.clientWidth;

                    // Specific logic for compact view to ensure context (center it)
                    // For wider views, standard scrolling to view is sufficient, but centering is nice.
                    const offset = headerLeft - (containerWidth / 2) + (headerWidth / 2);

                    scrollAreaRef.current.scrollTo({
                        left: Math.max(0, offset),
                        behavior: 'smooth'
                    });
                }
            }, 100);
        }
    }, [density, visibleMonths]);


    // Get payment status for a commitment in a month
    // Note: We use amount_original for CLP payments due to migration bug with amount_in_base
    const getPaymentStatus = useCallback((commitmentId: string, monthDate: Date, dueDay: number = 1) => {
        const commitmentPayments = payments.get(commitmentId) || [];
        // DEBUG: Trace P. Trainer specific matching issues for 2024
        const isPTrainer = commitmentId === '992f32ae-7143-4605-b661-21908ace3921';
        const targetYear = monthDate.getFullYear();
        const targetMonth = monthDate.getMonth() + 1;

        if (isPTrainer && targetYear === 2024 && [9, 10, 11, 12].includes(targetMonth)) {
            console.log(`[DEBUG] Checking P. Trainer for ${targetYear}-${targetMonth}`, {
                totalPaymentsInContext: commitmentPayments.length,
                samplePaymentDates: commitmentPayments.slice(0, 5).map(p => p.period_date),
                lookingFor: `${targetYear}-${String(targetMonth).padStart(2, '0')}`
            });
        }

        const payment = commitmentPayments.find(p => {
            // Robust parsing to avoid string format/timezone issues
            const parts = p.period_date.split('-');
            const pYear = parseInt(parts[0], 10);
            const pMonth = parseInt(parts[1], 10);

            const match = pYear === targetYear && pMonth === targetMonth;

            if (isPTrainer && targetYear === 2024 && [9, 10, 11, 12].includes(targetMonth) && pYear === 2024) {
                // Log near-misses or matches
                if (match || Math.abs(pMonth - targetMonth) <= 1) {
                    console.log(`[DEBUG] Comparing payment ${p.period_date} vs target ${targetYear}-${targetMonth}`, {
                        pYear, pMonth, match
                    });
                }
            }

            return match;
        });

        if (payment) {
            // If currency is CLP, amount_original IS the CLP value (migration bug with amount_in_base)
            // Otherwise, we'd need to convert - but most payments are in CLP
            const paidAmount = payment.currency_original === 'CLP'
                ? payment.amount_original
                : payment.amount_in_base ?? payment.amount_original;

            // A payment is only "paid" if payment_date exists
            // If payment_date is null, it's a registered custom amount but not yet paid
            const paymentDate = payment.payment_date ? parseDateString(payment.payment_date) : null;
            const isPaid = !!payment.payment_date; // Only true if date exists

            // Check if payment was on time (payment_date <= due date of the month)
            const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
            const paidOnTime = paymentDate ? paymentDate <= dueDate : true; // Assume on-time if no date

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

    // Smart Sort Function - Uses centralized getCommitmentSummary for consistent logic
    const getCommitmentSortData = useCallback((c: CommitmentWithTerm) => {
        const summary = getCommitmentSummary(c, payments.get(c.id) || []);

        // Use active term or defaults
        const term = c.active_term;
        const dueDay = term?.due_day_of_month ?? 32;
        const amount = summary.perPeriodAmount || 0;

        // Check for recently created (Last 5 minutes)
        const today = new Date();
        const createdAt = new Date(c.created_at);
        const isRecentlyCreated = (today.getTime() - createdAt.getTime()) < 5 * 60 * 1000;

        // Status Priority Alignment with Dashboard:
        // -2: Recently Created
        // -1: Important & Overdue/Pending
        // 0: Overdue
        // 1: Pending (Next 7 Days or This Month)
        // 2: Paid / Future / Others

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
            statusPriority = 1; // Pending
        }

        return { statusPriority, dueDay, amount, name: c.name, id: c.id };
    }, [payments]);

    const performSmartSort = useCallback((a: CommitmentWithTerm, b: CommitmentWithTerm) => {
        const dataA = getCommitmentSortData(a);
        const dataB = getCommitmentSortData(b);

        // 1. Status Priority (based on current month)
        if (dataA.statusPriority !== dataB.statusPriority) {
            return dataA.statusPriority - dataB.statusPriority;
        }

        // 2. Due Day (Ascending)
        if (dataA.dueDay !== dataB.dueDay) {
            return dataA.dueDay - dataB.dueDay;
        }

        // 3. Amount (Descending - Higher value first)
        if (Math.abs(dataA.amount - dataB.amount) > 0.01) {
            return dataB.amount - dataA.amount;
        }

        // 4. Name (Alphabetical)
        const nameCompare = dataA.name.localeCompare(dataB.name, language === 'es' ? 'es' : 'en');
        if (nameCompare !== 0) return nameCompare;

        // 5. Stable tiebreaker: UUID
        return dataA.id.localeCompare(dataB.id);
    }, [getCommitmentSortData, language]);

    // Check if commitment is active in a given month based on frequency
    // IMPORTANT: Uses getTermForPeriod to check ALL terms (not just active_term)
    // This ensures historical periods covered by closed terms are still shown
    const isActiveInMonth = useCallback((commitment: CommitmentWithTerm, monthDate: Date): boolean => {
        // Use getTermForPeriod to find ANY term that covers this month (including closed terms)
        const term = getTermForPeriod(commitment, monthDate);
        if (!term) return false;

        // Use extractYearMonth to avoid timezone issues
        const { year: startYear, month: startMonth } = extractYearMonth(term.effective_from);

        // Check frequency - use extracted year/month for correct calculation
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
    }, []);

    // Group commitments by category (for grid view)
    // Hybrid Strategy:
    // - Compact View: Treat as flat list (single 'All' group) to enforce strict Priority Sorting (Overdue > Pending)
    // - Detailed View: Maintain Category Grouping, but sort Groups by Urgency
    const groupedCommitments = useMemo(() => {
        // 1. Filter active terms & selected category
        const activeItems: CommitmentWithTerm[] = [];

        commitments.forEach(c => {
            // Context-aware visibility check
            let isVisible = viewMode === 'inventory';

            if (!isVisible) {
                // Check if active in any of the visible months
                const isActiveInVisibleRange = visibleMonths.some(m => isActiveInMonth(c, m));

                // OR check if has payment record in any of the visible months
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
            } else if (selectedCategory !== 'all' && categoryName !== selectedCategory) {
                return;
            }

            activeItems.push(c);
        });

        // 2. COMPACT MODE: Flat List (Strict Smart Sort)
        if (density === 'compact') {
            return [{
                category: 'all', // Dummy category, header is hidden in compact mode anyway
                flowType: 'EXPENSE', // Irrelevant for flat list
                commitments: activeItems.sort(performSmartSort)
            }];
        }

        // 3. DETAILED MODE: Grouped Items (Grouped Smart Sort)
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
                // Sort items within category
                const sortedItems = data.items.sort(performSmartSort);

                // Calculate min priority for the category
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
            // Sort categories by Urgency then Name
            .sort((a, b) => {
                if (a.minPriority !== b.minPriority) {
                    return a.minPriority - b.minPriority;
                }
                return a.category.localeCompare(b.category, language === 'es' ? 'es' : 'en');
            });
    }, [commitments, viewMode, visibleMonths, selectedCategory, t, language, performSmartSort, getCommitmentSortData, density]);

    // Available categories for filter tabs (derived from all non-terminated commitments)
    const availableCategories = useMemo(() => {
        const categorySet = new Set<string>();
        const visibleInContext = commitments.filter(c => {
            if (viewMode === 'inventory') return true;

            // Same logic as groupedCommitments to keep categories consistent
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
    }, [commitments, viewMode, visibleMonths, language]);



    // Format CLP
    const formatClp = (amount: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Check if current month
    const isCurrentMonth = (date: Date) => {
        const today = new Date();
        return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    };

    // Termination reason type for differentiated badges
    type TerminationReason = 'ACTIVE' | 'PAUSED' | 'COMPLETED_INSTALLMENTS' | 'TERMINATED';

    /**
     * Get the termination reason for a commitment
     * Used to display differentiated badges: PAUSADO, COMPLETADO, TERMINADO
     * 
     * PAUSED = Ended by manual pause (effective_until passed, no installments)
     * COMPLETED_INSTALLMENTS = Completed all installments
     * TERMINATED = Generic ended state
     * ACTIVE = Currently running (even if has future end date)
     */
    const getTerminationReason = useCallback((commitment: CommitmentWithTerm): TerminationReason => {
        // Use the most recent term, not just active_term
        const terms = commitment.all_terms || [];
        const latestTerm = terms.length > 0
            ? terms.slice().sort((a, b) => b.version - a.version)[0]
            : commitment.active_term;

        if (!latestTerm) return 'TERMINATED';

        // No end date = active (indefinite)
        if (!latestTerm.effective_until) return 'ACTIVE';

        // Use extractYearMonth to avoid timezone issues with date parsing
        const { year: endYear, month: endMonth } = extractYearMonth(latestTerm.effective_until);
        const endOfMonth = new Date(endYear, endMonth, 0); // Last day of end month

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // If end date hasn't passed yet → commitment is still ACTIVE
        // (even if it has a scheduled end date)
        if (endOfMonth >= today) {
            return 'ACTIVE';
        }

        // End date HAS PASSED - now determine why it ended
        if (latestTerm.installments_count && latestTerm.installments_count > 1) {
            return 'COMPLETED_INSTALLMENTS'; // Completed all installments
        }

        // Ended manually (pause that already passed)
        return 'PAUSED';
    }, []);

    // Check if commitment is terminated (has effective_until in the past)
    const isCommitmentTerminated = useCallback((commitment: CommitmentWithTerm): boolean => {
        const reason = getTerminationReason(commitment);
        return reason === 'TERMINATED' || reason === 'COMPLETED_INSTALLMENTS';
    }, [getTerminationReason]);


    // ==========================================================================
    // RENDER
    // ==========================================================================

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-red-500">{error}</p>
            </div>
        );
    }

    return (
        <div>
            {/* Header Toolbar - Unified for Mobile + Desktop */}
            <div className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm lg:border-b border-slate-200 dark:border-slate-700/50 shadow-sm transition-all duration-200">
                {/* Single Row Layout: Navigation | Totals (lg only) | Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 md:p-4">
                    {/* Left: Navigation Group */}
                    <div className="flex items-center gap-1.5">
                        {viewMode === 'monthly' ? (
                            <>
                                {/* Month Selector - Normal mode */}
                                <div className="h-9 flex items-center bg-white dark:bg-slate-700 rounded-lg ring-1 ring-slate-200 dark:ring-slate-600 shadow-sm">
                                    {/* Today button integrated */}
                                    <button
                                        onClick={() => onFocusedDateChange && onFocusedDateChange(new Date())}
                                        disabled={isCurrentMonth(focusedDate)}
                                        className={`h-full px-2.5 flex items-center justify-center rounded-l-lg transition-colors ${isCurrentMonth(focusedDate)
                                            ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-95'
                                            }`}
                                        title="Ir a hoy"
                                    >
                                        <Home className="w-4 h-4" />
                                    </button>
                                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-600"></div>

                                    {/* Month navigation buttons */}
                                    <button
                                        onClick={() => {
                                            const newDate = new Date(focusedDate);
                                            newDate.setMonth(newDate.getMonth() - 1);
                                            onFocusedDateChange && onFocusedDateChange(newDate);
                                        }}
                                        className="h-full px-2.5 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-l-lg transition-colors active:scale-95"
                                    >
                                        <ChevronLeftIcon className="w-5 h-5" />
                                    </button>
                                    <DatePicker
                                        selected={focusedDate}
                                        onChange={(date) => date && onFocusedDateChange && onFocusedDateChange(date)}
                                        dateFormat="MMM yyyy"
                                        locale="es"
                                        showMonthYearPicker
                                        showYearDropdown
                                        scrollableYearDropdown
                                        yearDropdownItemNumber={10}
                                        customInput={<DateCustomInput />}
                                        wrapperClassName="h-full flex"
                                        popperPlacement="bottom"
                                        showPopperArrow={false}
                                        portalId="root"
                                    />
                                    <button
                                        onClick={() => {
                                            const newDate = new Date(focusedDate);
                                            newDate.setMonth(newDate.getMonth() + 1);
                                            onFocusedDateChange && onFocusedDateChange(newDate);
                                        }}
                                        className="h-full px-2.5 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-r-lg transition-colors active:scale-95"
                                    >
                                        <ChevronRightIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Inventario Button - Opens inventory mode */}
                                <button
                                    onClick={() => {
                                        setViewMode('inventory');
                                        setSelectedStatus('all');
                                        setSelectedCategory('all');
                                    }}
                                    className="h-9 flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-all
                                        bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"
                                    title="Ver todos los compromisos"
                                >
                                    <FolderIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline">Inventario</span>
                                </button>
                            </>
                        ) : (
                            /* Inventory Mode Badge - Replaces month selector */
                            <div className="h-9 flex items-center gap-2 bg-sky-600 text-white px-4 rounded-lg shadow-md">
                                <FolderIcon className="w-4 h-4" />
                                <span className="text-sm font-semibold">Inventario</span>
                                <span className="text-xs opacity-80">({commitments.length} compromisos)</span>
                                <button
                                    onClick={() => setViewMode('monthly')}
                                    className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
                                    title="Volver a vista mensual"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Center: Totals (lg+ only, inline) */}
                    {/* Right: Display Options (Desktop Only) */}
                    <div className="hidden lg:flex items-center gap-3">

                        {/* Density Selector - 3 options with icons */}
                        <div className="h-9 flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                            {(['minimal', 'compact', 'detailed'] as const).map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setDensity(d)}
                                    title={d === 'minimal' ? 'Vista mínima (9 meses)' : d === 'compact' ? 'Vista compacta (12 meses)' : 'Vista detallada (6 meses)'}
                                    className={`h-full flex items-center gap-1.5 px-3 text-sm font-semibold rounded-[6px] transition-all duration-200 ${density === d
                                        ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-500'
                                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                                        }`}
                                >
                                    {/* Density icon - horizontal lines */}
                                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        {d === 'minimal' ? (
                                            // Minimal: 2 lines, widely spaced
                                            <>
                                                <line x1="2" y1="5" x2="14" y2="5" />
                                                <line x1="2" y1="11" x2="14" y2="11" />
                                            </>
                                        ) : d === 'compact' ? (
                                            // Compact: 3 lines, medium spacing
                                            <>
                                                <line x1="2" y1="4" x2="14" y2="4" />
                                                <line x1="2" y1="8" x2="14" y2="8" />
                                                <line x1="2" y1="12" x2="14" y2="12" />
                                            </>
                                        ) : (
                                            // Detailed: 4 lines, close spacing
                                            <>
                                                <line x1="2" y1="3" x2="14" y2="3" />
                                                <line x1="2" y1="6" x2="14" y2="6" />
                                                <line x1="2" y1="10" x2="14" y2="10" />
                                                <line x1="2" y1="13" x2="14" y2="13" />
                                            </>
                                        )}
                                    </svg>
                                    <span className="hidden xl:inline">
                                        {d === 'minimal' ? 'Mínima' : d === 'compact' ? 'Compacta' : 'Detallada'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Row 2: Unified Metrics Bento Grid (Responsive) - Glassmorphism Style */}
                {(() => {
                    const totals = getMonthTotals(focusedDate.getFullYear(), focusedDate.getMonth());
                    return (
                        <div className="px-3 py-3 lg:px-6 border-b border-slate-200/50 dark:border-white/10">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                                {/* Card 1: Ingresos */}
                                <div className="p-4 rounded-2xl bg-white dark:bg-white/5 backdrop-blur-xl border border-emerald-200/50 dark:border-emerald-500/20 shadow-sm dark:shadow-none ring-1 ring-emerald-500/10">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <TrendingUp className="w-4 h-4 text-emerald-500/60" />
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ingresos</p>
                                    </div>
                                    <p className="text-xl lg:text-2xl font-black font-mono tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                                        {formatClp(totals.ingresos || 0)}
                                    </p>
                                </div>

                                {/* Card 2: Comprometido */}
                                <button
                                    onClick={() => {
                                        setSelectedStatus('all');
                                        setSelectedCategory('all');
                                    }}
                                    className={`text-left p-4 rounded-2xl backdrop-blur-xl transition-all duration-300 active:scale-[0.98] ${selectedStatus === 'all' && selectedCategory === 'all'
                                        ? 'bg-sky-500/10 dark:bg-sky-500/20 border-2 border-sky-500/50 shadow-lg shadow-sky-500/10 ring-1 ring-sky-500/30'
                                        : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none ring-1 ring-slate-900/5 dark:ring-white/5 hover:border-sky-300 dark:hover:border-sky-500/30'
                                        }`}
                                >
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Wallet className={`w-4 h-4 ${selectedStatus === 'all' && selectedCategory === 'all' ? 'text-sky-500' : 'text-sky-500/60'}`} />
                                        <p className={`text-[10px] font-bold uppercase tracking-wider ${selectedStatus === 'all' && selectedCategory === 'all' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'
                                            }`}>Comprometido</p>
                                    </div>
                                    <p className={`text-xl lg:text-2xl font-black font-mono tabular-nums tracking-tight ${selectedStatus === 'all' && selectedCategory === 'all' ? 'text-sky-600 dark:text-sky-300' : 'text-slate-900 dark:text-white'
                                        }`}>
                                        {formatClp(totals.comprometido)}
                                    </p>
                                </button>

                                {/* Card 3: Pagado */}
                                <button
                                    onClick={() => setSelectedStatus(selectedStatus === 'pagado' ? 'all' : 'pagado')}
                                    className={`text-left p-4 rounded-2xl backdrop-blur-xl transition-all duration-300 active:scale-[0.98] ${selectedStatus === 'pagado'
                                        ? 'bg-emerald-500/10 dark:bg-emerald-500/20 border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                                        : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none ring-1 ring-slate-900/5 dark:ring-white/5 hover:border-emerald-300 dark:hover:border-emerald-500/30'
                                        }`}
                                >
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <CheckCircleIcon className={`w-4 h-4 ${selectedStatus === 'pagado' ? 'text-emerald-500' : 'text-emerald-500/60'}`} />
                                        <p className={`text-[10px] font-bold uppercase tracking-wider ${selectedStatus === 'pagado' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                                            }`}>Pagado</p>
                                    </div>
                                    <p className={`text-xl lg:text-2xl font-black font-mono tabular-nums tracking-tight ${selectedStatus === 'pagado' ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-900 dark:text-white'
                                        }`}>
                                        {formatClp(totals.pagado)}
                                    </p>
                                </button>

                                {/* Card 4: Pendiente */}
                                <button
                                    onClick={() => setSelectedStatus(selectedStatus === 'pendiente' ? 'all' : 'pendiente')}
                                    className={`text-left p-4 rounded-2xl backdrop-blur-xl transition-all duration-300 active:scale-[0.98] ${selectedStatus === 'pendiente'
                                        ? 'bg-amber-500/10 dark:bg-amber-500/20 border-2 border-amber-500/50 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
                                        : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none ring-1 ring-slate-900/5 dark:ring-white/5 hover:border-amber-300 dark:hover:border-amber-500/30'
                                        }`}
                                >
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <ClockIcon className={`w-4 h-4 ${selectedStatus === 'pendiente' ? 'text-amber-500' : 'text-amber-500/60'}`} />
                                        <p className={`text-[10px] font-bold uppercase tracking-wider ${selectedStatus === 'pendiente' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                                            }`}>Pendiente</p>
                                    </div>
                                    <p className={`text-xl lg:text-2xl font-black font-mono tabular-nums tracking-tight ${selectedStatus === 'pendiente' ? 'text-amber-600 dark:text-amber-300' : 'text-slate-900 dark:text-white'
                                        }`}>
                                        {formatClp(totals.pendiente)}
                                    </p>
                                </button>
                            </div>
                        </div>
                    );
                })()}

                {/* Row 3: Unified Filter Bar (Responsive) */}
                <div className="sticky top-[58px] z-30 px-3 py-2 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800 transition-all">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                        <span className="hidden lg:inline text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-2">Filtrar:</span>

                        {selectedCategory !== 'all' && (
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className="flex-shrink-0 p-1.5 rounded-lg bg-slate-200/50 dark:bg-slate-800 text-slate-500 hover:bg-slate-300/50 dark:hover:bg-slate-700 transition"
                                title="Limpiar filtros"
                            >
                                <FunnelIcon className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {availableCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => {
                                    if (selectedCategory === cat) {
                                        setSelectedCategory('all');
                                    } else {
                                        setSelectedCategory(cat);
                                        setSelectedStatus('all');
                                    }
                                }}
                                className={`
                                    flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200
                                    ${selectedCategory === cat
                                        ? 'bg-sky-500 text-white shadow-md ring-1 ring-sky-400/50'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-sky-300 dark:hover:border-sky-500/50 hover:bg-slate-50 dark:hover:bg-slate-750'
                                    }
                                `}
                            >
                                <span className="flex items-center gap-1.5">
                                    {cat === 'FILTER_IMPORTANT' && <StarIcon className="w-3 h-3 fill-current" />}
                                    <span>{cat === 'all' ? 'Todos' : cat === 'FILTER_IMPORTANT' ? 'Imp.' : cat}</span>
                                    <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${selectedCategory === cat ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                        ({cat === 'all'
                                            ? commitments.filter(c => viewMode === 'inventory' || !c.active_term?.effective_until || new Date(c.active_term.effective_until) >= new Date()).length
                                            : cat === 'FILTER_IMPORTANT'
                                                ? commitments.filter(c => c.is_important).length
                                                : commitments.filter(c => getTranslatedCategoryName(c) === cat).length
                                        })
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile View - Compact Cards */}
            <div className="lg:hidden p-3 space-y-2.5 pb-28">
                {(() => {
                    const filteredCommitments = commitments.filter(c => {
                        // In inventory mode, show ALL commitments (including terminated)
                        if (viewMode === 'inventory') return true;

                        // 1. Siempre mostrar si "Ver terminados" está activo


                        // 2. Verificar si hay un registro de pago en el mes enfocado
                        // Use robust getPaymentStatus to check for payment record
                        const activeTerm = getTermForPeriod(c, focusedDate);
                        const dueDay = activeTerm?.due_day_of_month ?? 1;
                        const { hasPaymentRecord } = getPaymentStatus(c.id, focusedDate, dueDay);

                        if (hasPaymentRecord) return true;

                        // 3. Verificar si está activo según su término en el mes enfocado
                        return isActiveInMonth(c, focusedDate);
                    }).filter(c => {
                        // Aplicar filtro de categoría
                        if (selectedCategory === 'all') return true;
                        if (selectedCategory === 'FILTER_IMPORTANT') return c.is_important;
                        return getTranslatedCategoryName(c) === selectedCategory;
                    }).filter(c => {
                        // Aplicar filtro de status (pendiente/pagado)
                        if (selectedStatus === 'all') return true;

                        const activeTerm = getTermForPeriod(c, focusedDate);
                        const dueDay = activeTerm?.due_day_of_month ?? 1;
                        const { isPaid } = getPaymentStatus(c.id, focusedDate, dueDay);

                        if (selectedStatus === 'pagado') return isPaid;
                        if (selectedStatus === 'pendiente') return !isPaid;
                        return true;
                    }).sort(performSmartSort);

                    return filteredCommitments.length > 0 ? filteredCommitments.map(c => {
                        // Sync logic with desktop cells
                        const monthDate = focusedDate;
                        const term = getTermForPeriod(c, monthDate);

                        // Strict validation: Ensure term covers the current month
                        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
                        const termEnds = term?.effective_until ? new Date(term.effective_until) : null;
                        // Check if term exists AND (no end date OR end date is after start of this month)
                        const isTermActiveInMonth = !!term && (!termEnds || termEnds >= monthStart);

                        const dueDay = term?.due_day_of_month ?? 1;
                        const { isPaid, payment: currentPayment } = getPaymentStatus(c.id, monthDate, dueDay);

                        // Note: amount calculations are handled by CommitmentCard via payments prop

                        const today = new Date();
                        const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
                        // Validation: Must have active term to be overdue
                        const isOverdue = isTermActiveInMonth && !isPaid && dueDate < today && monthDate <= today;

                        // Cálculos consistentes con tooltip desktop
                        const daysOverdue = isOverdue
                            ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                            : 0;

                        // Note: cuotaNumber, terminated, terminationReason are handled by CommitmentCard


                        // Prepare monthly info for CommitmentCard
                        const monthlyInfo = {
                            isPaid,
                            paymentDate: currentPayment?.payment_date
                                ? parseDateString(currentPayment.payment_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
                                : undefined,
                            dueDate: !isPaid && isTermActiveInMonth
                                ? `Vence: ${dueDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
                                : undefined,
                            daysOverdue: daysOverdue > 0 ? daysOverdue : undefined
                        };

                        return (
                            <CommitmentCard
                                key={c.id}
                                commitment={c}
                                payments={payments.get(c.id) || []}
                                mode={viewMode === 'inventory' ? 'inventory' : 'monthly'}
                                viewDate={monthDate}
                                monthlyInfo={monthlyInfo}
                                categoryName={getTranslatedCategoryName(c)}
                                formatAmount={formatClp}
                                onClick={() => {
                                    // Contextual Intelligent Flow (see Identidad.md recommendations)
                                    if (viewMode === 'inventory') {
                                        // Inventory: Always show full detail/history
                                        if (onDetailCommitment) {
                                            onDetailCommitment(c);
                                        } else {
                                            onEditCommitment(c);
                                        }
                                    } else {
                                        // Monthly View: Context-aware action
                                        if (isTermActiveInMonth && !isPaid) {
                                            // CASE 1: Pending/Overdue → Quick payment (most common action)
                                            onRecordPayment(c.id, dateToPeriod(monthDate));
                                        } else if (isPaid && onDetailCommitment) {
                                            // CASE 2: Paid → View payment details/receipt
                                            onDetailCommitment(c);
                                        } else if (onDetailCommitment) {
                                            // CASE 3: Other states (paused, future) → View detail
                                            onDetailCommitment(c);
                                        } else {
                                            // FALLBACK: Edit (if detail modal not available)
                                            onEditCommitment(c);
                                        }
                                    }
                                }}
                                onEdit={() => onEditCommitment(c)}
                                onDetail={onDetailCommitment ? () => onDetailCommitment(c) : undefined}
                                onPause={() => onPauseCommitment(c)}
                                onResume={() => onResumeCommitment(c)}
                                onDelete={() => onDeleteCommitment(c.id)}
                                translateFrequency={(freq) => t(`frequency.${freq}`) || freq}
                            />
                        );
                    }) : (
                        <div className="text-center py-20 px-6 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            {commitments.length === 0 ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mb-2">
                                        <Sparkles className="w-8 h-8 text-sky-500 dark:text-sky-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                            ¡Bienvenido a FinanSheet!
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6">
                                            Aún no tienes compromisos registrados. Comienza agregando tus ingresos y gastos fijos.
                                        </p>
                                        <p className="text-sm font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 py-2 px-4 rounded-full inline-block">
                                            ✨ Tip: Usa el botón "+" arriba a la derecha
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                                        No hay compromisos en esta categoría
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                        Intenta seleccionar otra categoría en el filtro
                                    </p>
                                </div>
                            )}
                        </div>
                    )
                })()}
            </div >

            {/* Desktop View Content */}
            < div className="hidden lg:block px-4" >
                <div className="mt-4">


                    {/* Grid */}
                    <div className="relative mb-2">
                        {/* Scroll Indicator - Right Edge Gradient */}
                        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/80 dark:from-slate-900/80 to-transparent pointer-events-none z-30" />

                        <div
                            ref={scrollAreaRef}
                            className="relative overflow-x-auto overflow-y-auto scrollbar-thin pr-1"
                            style={{ height: `${availableHeight}px` }}
                        >
                            <table className="w-full border-separate border-spacing-0">
                                <thead className="sticky top-0 z-40">
                                    {/* Month Header - Continuous Capsule (border-collapse) */}
                                    <tr className="bg-slate-800 backdrop-blur-xl shadow-[0_6px_0_0_rgb(15,23,42)]">
                                        {/* COMPROMISO - Left end (adaptive height) */}
                                        <th className={`sticky left-0 z-50 backdrop-blur-xl min-w-[160px] max-w-[200px] w-[180px] bg-slate-800 border border-slate-600/80 text-center rounded-l-xl ${density === 'minimal' ? 'py-2 px-3' :
                                            density === 'compact' ? 'py-2.5 px-4' :
                                                'py-3 px-4'
                                            }`}>
                                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                                                Compromiso
                                            </span>
                                        </th>
                                        {/* Month cells */}
                                        {visibleMonths.map((month, i) => (
                                            <th
                                                key={i}
                                                className={`relative min-w-[85px] w-auto p-0 text-center align-middle transition-all duration-300 border border-slate-600/80
                                                    ${isCurrentMonth(month) ? 'bg-slate-700' : 'bg-slate-800'}
                                                    ${i === visibleMonths.length - 1 ? 'rounded-r-xl' : ''}
                                                `}
                                            >
                                                {/* Month content - adaptive height */}
                                                <div className={`
                                                    flex flex-col items-center justify-center px-2 transition-all duration-200
                                                    ${density === 'minimal' ? 'py-2 min-h-[40px]' :
                                                        density === 'compact' ? 'py-2.5 min-h-[48px]' :
                                                            'py-3 min-h-[56px]'}
                                                    ${isCurrentMonth(month) ? 'ring-2 ring-inset ring-sky-500/50' : ''}
                                                `}>
                                                    {/* Month name - Protagonist */}
                                                    <span className={`tracking-wide ${density === 'minimal' ? 'text-xs' : 'text-sm'
                                                        } ${isCurrentMonth(month)
                                                            ? 'font-bold text-sky-400'
                                                            : 'font-semibold text-slate-300'
                                                        }`}>
                                                        {month.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '').charAt(0).toUpperCase() + month.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '').slice(1)}
                                                        {density === 'detailed' && (
                                                            <span className={`text-xs ml-1 font-normal ${isCurrentMonth(month) ? 'text-sky-500/80' : 'text-slate-500'}`}>
                                                                {month.getFullYear()}
                                                            </span>
                                                        )}
                                                    </span>

                                                    {/* Total paid - Hidden in minimal, shown in compact/detailed */}
                                                    {density !== 'minimal' && (
                                                        <div className={`text-[10px] font-mono mt-1 tabular-nums ${getMonthTotals(month.getFullYear(), month.getMonth()).pagado > 0
                                                            ? isCurrentMonth(month) ? 'text-emerald-400 font-medium' : 'text-emerald-500/80'
                                                            : 'text-slate-600'
                                                            }`}>
                                                            {getMonthTotals(month.getFullYear(), month.getMonth()).pagado > 0
                                                                ? formatClp(getMonthTotals(month.getFullYear(), month.getMonth()).pagado)
                                                                : '—'}
                                                        </div>
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-transparent">

                                    {groupedCommitments.map(({ category, commitments: catCommitments }) => (
                                        <React.Fragment key={category}>
                                            {/* Category badge is now inside each commitment card - no separator needed */}
                                            {/* Commitment rows */}
                                            {catCommitments.map((commitment) => {
                                                const monthDate = focusedDate; // En vista compacta, solo vemos el mes enfocado

                                                const isGloballyTerminated = isCommitmentTerminated(commitment);

                                                // Necesitamos saber si está pagado en este mes para decidir el tachado
                                                const termForMonth = getTermForPeriod(commitment, monthDate);
                                                const dueDay = termForMonth?.due_day_of_month ?? 1;
                                                const { isPaid } = getPaymentStatus(commitment.id, monthDate, dueDay);

                                                // Solo tachar si: está terminado globalmente, ESTABA activo en este mes, Y YA FUE PAGADO
                                                const wasActiveInMonth = termForMonth !== null;
                                                const terminated = isGloballyTerminated && wasActiveInMonth && isPaid;
                                                const terminationReason = getTerminationReason(commitment);
                                                return (
                                                    <tr
                                                        key={commitment.id}
                                                        className={`
                                                            group
                                                            transition-all duration-200 ease-out
                                                            ${terminated ? 'opacity-60 grayscale-[0.5]' : ''}
                                                        `}
                                                    >
                                                        {/* Name cell - Bento Card Style */}
                                                        <td
                                                            onClick={() => onDetailCommitment ? onDetailCommitment(commitment) : onEditCommitment(commitment)}
                                                            className={`
                                                            relative sticky left-0 z-30 p-0
                                                            bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-800
                                                            min-w-[160px] max-w-[200px] w-[180px]
                                                            h-[1px]
                                                        `}>
                                                            {/* Inner Content - Nivel 1: Sólido Estructural per Identidad.md */}
                                                            <div className={`
                                                                relative cursor-pointer group/card h-full
                                                                ${density === 'minimal' ? 'min-h-[40px] px-2 py-1' : density === 'compact' ? 'min-h-[48px] px-2.5 py-1.5' : 'min-h-[100px] px-3 py-2'}
                                                                bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/50
                                                                hover:bg-slate-100 dark:hover:bg-slate-700/50
                                                                transition-colors duration-200
                                                                ${terminated ? 'opacity-70' : ''}
                                                            `}>
                                                                {/* Flow Type Indicator - Left edge bar */}
                                                                <div className={`absolute left-0 ${density === 'minimal' ? 'top-1 bottom-1' : 'top-2 bottom-2'} w-1 rounded-full ${commitment.flow_type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                                                                {/* Content Container - Different layouts for minimal/compact/detailed */}
                                                                {density === 'minimal' ? (
                                                                    /* === MINIMAL: Single line with tooltip === */
                                                                    <div
                                                                        className="flex items-center justify-between h-full pl-2 pr-4"
                                                                        title={`${commitment.name} · ${getTranslatedCategoryName(commitment)} · ${formatClp(Math.round(commitment.active_term ? getPerPeriodAmount(commitment.active_term, true) : 0))}`}
                                                                    >
                                                                        <span className={`font-semibold truncate text-xs ${terminated ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                                                            {commitment.name}
                                                                        </span>
                                                                        {commitment.is_important && <StarIcon className="w-2.5 h-2.5 text-amber-500 fill-amber-500 shrink-0 ml-1" />}
                                                                    </div>
                                                                ) : density === 'compact' ? (
                                                                    /* === COMPACT: 2 rows === */
                                                                    <div className="flex flex-col justify-center h-full pl-2 pr-6">
                                                                        {/* Row 1: Name + Icons */}
                                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                                            <span className={`font-semibold truncate text-sm ${terminated ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`} title={commitment.name}>
                                                                                {commitment.name}
                                                                            </span>
                                                                            {commitment.is_important && <StarIcon className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                                                                            {commitment.linked_commitment_id && <Link2 className="w-3 h-3 text-sky-500 shrink-0" />}
                                                                        </div>
                                                                        {/* Row 2: Category + Amount */}
                                                                        <div className="flex items-center gap-2 mt-0.5">
                                                                            <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                                                {getTranslatedCategoryName(commitment)}
                                                                            </span>
                                                                            <span className="font-mono font-semibold text-xs tabular-nums text-slate-700 dark:text-slate-200">
                                                                                {formatClp(Math.round(commitment.active_term ? getPerPeriodAmount(commitment.active_term, true) : 0))}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    /* === DETAILED: 4 rows to match payment cells === */
                                                                    <div className="flex flex-col justify-between h-full px-3 py-1">
                                                                        {/* Row 1: Name + Icons */}
                                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                                            <span className={`font-bold truncate text-base ${terminated ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`} title={commitment.name}>
                                                                                {commitment.name}
                                                                            </span>
                                                                            {commitment.is_important && <StarIcon className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                                                                            {commitment.linked_commitment_id && <Link2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                                                                        </div>

                                                                        {/* Row 2: Category badge + Frequency */}
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300">
                                                                                {getTranslatedCategoryName(commitment)}
                                                                            </span>
                                                                            {/* Removed loose frequency icons in favor of badges below */}
                                                                        </div>

                                                                        {/* Row 3: Amount (protagonista) */}
                                                                        <div className="font-mono font-bold text-xl tabular-nums text-slate-900 dark:text-white tracking-tight">
                                                                            {formatClp(Math.round(commitment.active_term ? getPerPeriodAmount(commitment.active_term, true) : 0))}
                                                                        </div>

                                                                        {/* Row 4: Term info - Ghost style (no bg/border) */}
                                                                        <div className="flex items-center justify-between">
                                                                            {/* Recurrence/Term info - minimal */}
                                                                            {/* Tech Badge for Term/Recurrence */}
                                                                            {commitment.active_term?.effective_until ? (
                                                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 ring-1 ring-sky-500/10">
                                                                                    {commitment.active_term.installments_count && commitment.active_term.installments_count > 1 ? (
                                                                                        <>
                                                                                            <HashIcon className="w-3 h-3 text-sky-500" />
                                                                                            {commitment.active_term.installments_count} Cuotas
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <CalendarIcon className="w-3 h-3 text-sky-500" />
                                                                                            {(() => {
                                                                                                const [y, m] = commitment.active_term!.effective_until.substring(0, 7).split('-');
                                                                                                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                                                                                return `${months[parseInt(m) - 1]} ${y}`;
                                                                                            })()}
                                                                                        </>
                                                                                    )}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                                    <RefreshCw className="w-3 h-3 text-slate-400" /> Mensual
                                                                                </span>
                                                                            )}
                                                                            {/* Status icons - solo cuando hay estado especial */}
                                                                            {terminationReason === 'PAUSED' && (
                                                                                <PauseIcon className="w-3.5 h-3.5 text-amber-500" />
                                                                            )}
                                                                            {terminationReason === 'COMPLETED_INSTALLMENTS' && (
                                                                                <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
                                                                            )}
                                                                            {terminationReason === 'TERMINATED' && (
                                                                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fin</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Actions Menu (Absolute, hover) */}
                                                                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/card:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                                    <DropdownMenu.Root>
                                                                        <DropdownMenu.Trigger asChild>
                                                                            <button className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                                                                <MoreVertical className="w-4 h-4" />
                                                                            </button>
                                                                        </DropdownMenu.Trigger>
                                                                        <DropdownMenu.Portal>
                                                                            <DropdownMenu.Content
                                                                                className="min-w-[160px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 p-1 z-50 animate-in fade-in zoom-in-95 duration-200"
                                                                                sideOffset={5}
                                                                                align="end"
                                                                            >
                                                                                <DropdownMenu.Item
                                                                                    className="flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer outline-none"
                                                                                    onClick={(e) => { e.stopPropagation(); onEditCommitment(commitment); }}
                                                                                >
                                                                                    <EditIcon className="w-3.5 h-3.5 text-blue-500" /> Editar
                                                                                </DropdownMenu.Item>
                                                                                {onDetailCommitment && (
                                                                                    <DropdownMenu.Item
                                                                                        className="flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-sky-600 dark:text-sky-400 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 cursor-pointer outline-none"
                                                                                        onClick={(e) => { e.stopPropagation(); onDetailCommitment(commitment); }}
                                                                                    >
                                                                                        <Eye className="w-3.5 h-3.5" /> Detalle
                                                                                    </DropdownMenu.Item>
                                                                                )}
                                                                                <DropdownMenu.Item
                                                                                    className={`flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer outline-none ${terminationReason === 'COMPLETED_INSTALLMENTS' ? 'opacity-50' : ''}`}
                                                                                    disabled={terminationReason === 'COMPLETED_INSTALLMENTS'}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        const hasEndDate = !!commitment.active_term?.effective_until;
                                                                                        if (hasEndDate || terminationReason === 'PAUSED' || terminationReason === 'TERMINATED') {
                                                                                            onResumeCommitment(commitment);
                                                                                        } else {
                                                                                            onPauseCommitment(commitment);
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <PauseIcon className="w-3.5 h-3.5 text-amber-500" />
                                                                                    {(() => {
                                                                                        const hasEndDate = !!commitment.active_term?.effective_until;
                                                                                        if (terminationReason === 'COMPLETED_INSTALLMENTS') return 'Completado';
                                                                                        if (hasEndDate || terminationReason === 'PAUSED' || terminationReason === 'TERMINATED') return 'Reanudar';
                                                                                        return 'Pausar';
                                                                                    })()}
                                                                                </DropdownMenu.Item>
                                                                                <DropdownMenu.Separator className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                                                                <DropdownMenu.Item
                                                                                    className="flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/10 cursor-pointer outline-none"
                                                                                    onClick={(e) => { e.stopPropagation(); onDeleteCommitment(commitment.id); }}
                                                                                >
                                                                                    <TrashIcon className="w-3.5 h-3.5" /> Eliminar
                                                                                </DropdownMenu.Item>
                                                                            </DropdownMenu.Content>
                                                                        </DropdownMenu.Portal>
                                                                    </DropdownMenu.Root>
                                                                </div>
                                                            </div>{/* Close Inner Bento Card */}
                                                        </td>

                                                        {/* Month cells */}
                                                        {visibleMonths.map((monthDate, mi) => {
                                                            // Get term for THIS specific period (supports multi-term)
                                                            const term = getTermForPeriod(commitment, monthDate);
                                                            const isActive = isActiveInMonth(commitment, monthDate);
                                                            const dueDay = term?.due_day_of_month ?? 1;
                                                            const { isPaid, amount: paidAmount, paidOnTime, payment: currentPayment, hasPaymentRecord } = getPaymentStatus(commitment.id, monthDate, dueDay);

                                                            // Calculate expected per-period amount from term (only used when no payment)
                                                            const totalAmount = term?.amount_in_base ?? term?.amount_original ?? 0;
                                                            const installmentsCount = term?.installments_count ?? null;

                                                            // Solo dividir si is_divided_amount = true (tipo "En cuotas")
                                                            const perPeriodAmount = term?.is_divided_amount && installmentsCount && installmentsCount > 1
                                                                ? totalAmount / installmentsCount
                                                                : totalAmount;

                                                            // Show REAL data: if there's a payment record (even if not marked paid), show that amount
                                                            // Otherwise show expected amount from term
                                                            const displayAmount = (hasPaymentRecord && paidAmount !== null) ? paidAmount : perPeriodAmount;

                                                            // Calculate cuota number if installments
                                                            let cuotaNumber: number | null = null;
                                                            if (term && installmentsCount && installmentsCount > 1) {
                                                                // Parse date parts directly to avoid timezone issues
                                                                const [startYear, startMonth] = term.effective_from.split('-').map(Number);
                                                                const monthsDiff = (monthDate.getFullYear() - startYear) * 12 +
                                                                    (monthDate.getMonth() + 1 - startMonth); // +1 because getMonth() is 0-indexed
                                                                cuotaNumber = monthsDiff + 1;
                                                                if (cuotaNumber < 1 || cuotaNumber > installmentsCount) {
                                                                    cuotaNumber = null; // Out of range
                                                                }
                                                            }

                                                            // Original currency display
                                                            const originalCurrency = term?.currency_original;
                                                            const originalAmount = term?.amount_original ?? 0;
                                                            // Solo dividir si is_divided_amount = true (tipo "En cuotas")
                                                            const perPeriodOriginal = term?.is_divided_amount && installmentsCount && installmentsCount > 1
                                                                ? originalAmount / installmentsCount
                                                                : originalAmount;
                                                            const showOriginalCurrency = originalCurrency && originalCurrency !== 'CLP';

                                                            const today = new Date();
                                                            const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
                                                            const isOverdue = !!term && !isPaid && dueDate < today && monthDate <= today;
                                                            const isPending = !!term && !isPaid && !isOverdue && isCurrentMonth(monthDate);
                                                            const isGap = !term && !isPaid;

                                                            // Check if this is a future month (after current month)
                                                            // BUT don't dim if there's a payment record (pre-registered amount)
                                                            const isFutureMonth = monthDate > today && !isCurrentMonth(monthDate) && !hasPaymentRecord;

                                                            // Days overdue/remaining calculation
                                                            const daysOverdue = isOverdue
                                                                ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                                                                : 0;
                                                            const daysRemaining = !isOverdue
                                                                ? Math.max(0, Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
                                                                : 0;
                                                            const isDisabled = isFutureMonth && !(hasPaymentRecord || (installmentsCount && installmentsCount > 1));

                                                            // === Render Status Badge Helper ===
                                                            const renderStatusBadge = () => {
                                                                if (isPaid) {
                                                                    return (
                                                                        <div className="grid grid-cols-1 items-center justify-items-center group/badge w-full mt-1">
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 group-hover/cell:opacity-0">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 ring-1 ring-emerald-500/10">
                                                                                    {paidOnTime && <Sparkles className="w-3 h-3" />}
                                                                                    <CheckCircleIcon className="w-3.5 h-3.5" />
                                                                                    Pagado
                                                                                </span>
                                                                            </div>
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 opacity-0 group-hover/cell:opacity-100">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 cursor-pointer">
                                                                                    <EditIcon className="w-3.5 h-3.5" />
                                                                                    Editar
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                if (isOverdue) {
                                                                    return (
                                                                        <div className="grid grid-cols-1 items-center justify-items-center group/badge w-full mt-1">
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 group-hover/cell:opacity-0">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800 ring-1 ring-rose-500/10">
                                                                                    <ExclamationTriangleIcon className="w-3.5 h-3.5 animate-pulse" />
                                                                                    -{daysOverdue}d
                                                                                </span>
                                                                            </div>
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 opacity-0 group-hover/cell:opacity-100">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700 cursor-pointer">
                                                                                    <PlusIcon className="w-3.5 h-3.5" />
                                                                                    Pagar
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                if (isPending && (isCurrentMonth(monthDate) || !(daysRemaining > 45))) {
                                                                    return (
                                                                        <div className="grid grid-cols-1 items-center justify-items-center group/badge w-full mt-1">
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 group-hover/cell:opacity-0">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800 ring-1 ring-amber-500/10">
                                                                                    <ClockIcon className="w-3.5 h-3.5" />
                                                                                    {daysRemaining === 0 ? 'Hoy' : `${daysRemaining}d`}
                                                                                </span>
                                                                            </div>
                                                                            <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 opacity-0 group-hover/cell:opacity-100">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700 cursor-pointer">
                                                                                    <PlusIcon className="w-3.5 h-3.5" />
                                                                                    Pagar
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                // Default: Scheduled / Future
                                                                return (
                                                                    <div className="grid grid-cols-1 items-center justify-items-center group/badge w-full mt-1">
                                                                        <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 group-hover/cell:opacity-0">
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                                <CalendarIcon className="w-3.5 h-3.5" />
                                                                                Prog.
                                                                            </span>
                                                                        </div>
                                                                        <div className="col-start-1 row-start-1 flex items-center justify-center w-full transition-all duration-200 opacity-0 group-hover/cell:opacity-100">
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 cursor-pointer">
                                                                                <PlusIcon className="w-3.5 h-3.5" />
                                                                                Pagar
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            };

                                                            return (
                                                                <td
                                                                    key={mi}
                                                                    className="p-1 h-[1px]"
                                                                    onClick={() => onRecordPayment(commitment.id, dateToPeriod(monthDate))}
                                                                >
                                                                    {/* Mini Bento Card for payment cell - Nivel 2: Estándar per Identidad.md */}
                                                                    <div className={`
                                                                        rounded-lg w-full h-full transition-all duration-200 cursor-pointer
                                                                        flex flex-col items-center justify-center border
                                                                        ${density === 'minimal' ? 'px-1 py-0.5 min-h-[40px]' : density === 'compact' ? 'px-1.5 py-1 min-h-[48px]' : 'px-2 py-2 min-h-[100px]'}
                                                                        ${isCurrentMonth(monthDate)
                                                                            ? 'bg-slate-800/60 border-sky-500/40 ring-2 ring-sky-500/20' // Nivel 4: Highlight
                                                                            : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50' // Nivel 2: Estándar
                                                                        }
                                                                        ${isDisabled ? 'opacity-50 bg-slate-900/20 border-slate-700/30' : ''} // Nivel 3: Deshabilitado (más visible)
                                                                        ${isGap ? 'bg-slate-50/50 dark:bg-slate-900/20 border-dashed border-slate-300 dark:border-slate-800' : ''} // Nivel 3: Gap
                                                                        ${isOverdue ? '!border-rose-500 dark:!border-rose-500/60 ring-1 ring-rose-500/20' : ''}
                                                                        ${isPending ? '!border-amber-400 dark:!border-amber-500/50 ring-1 ring-amber-500/20' : ''}
                                                                        ${isPaid ? '!border-emerald-400 dark:!border-emerald-500/50 ring-1 ring-emerald-500/20' : ''}
                                                                    `}>
                                                                        {/* GAP: No term for this period */}
                                                                        {!term && !isPaid ? (
                                                                            <div className="flex items-center justify-center h-full w-full text-slate-400 dark:text-slate-600 select-none" title="Sin término activo en este período">
                                                                                <Minus className="w-5 h-5" />
                                                                            </div>
                                                                        ) : !term && isPaid ? (
                                                                            /* ORPHAN: Payment without term */
                                                                            <div className="space-y-1">
                                                                                <div className="font-bold font-mono tabular-nums text-base text-orange-600 dark:text-orange-500" title="⚠️ Pago registrado sin término activo">
                                                                                    {formatClp(paidAmount!)} ⚠️
                                                                                </div>
                                                                                <div className="text-xs text-orange-500">
                                                                                    Pago huérfano
                                                                                </div>
                                                                            </div>
                                                                        ) : (isActive || isPaid) ? (
                                                                            /* === MINIMAL VIEW: Amount + icon only === */
                                                                            density === 'minimal' ? (
                                                                                <CompactTooltip
                                                                                    triggerClassName="p-0"
                                                                                    sideOffset={8}
                                                                                    content={
                                                                                        <div className="min-w-[130px] text-slate-800 dark:text-slate-100">
                                                                                            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5">
                                                                                                {monthDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                                                                                            </div>
                                                                                            <div className="text-base font-bold font-mono tabular-nums">
                                                                                                {formatClp(displayAmount!)}
                                                                                            </div>
                                                                                            {(cuotaNumber && installmentsCount && installmentsCount > 1) && (
                                                                                                <div className="text-[10px] text-slate-500 mt-1">
                                                                                                    Cuota {cuotaNumber}/{installmentsCount}
                                                                                                </div>
                                                                                            )}
                                                                                            <div className={`text-[10px] font-medium mt-1.5 ${isPaid ? 'text-emerald-600 dark:text-emerald-400' :
                                                                                                isOverdue ? 'text-rose-600 dark:text-rose-400' :
                                                                                                    'text-amber-600 dark:text-amber-400'
                                                                                                }`}>
                                                                                                {isPaid ? '✓ Pagado' : isOverdue ? '⚠ Vencido' : '⏱ Pendiente'}
                                                                                            </div>
                                                                                        </div>
                                                                                    }
                                                                                >
                                                                                    {/* Minimal cell: ONLY status icon (centered, larger for visibility) */}
                                                                                    <div className="flex items-center justify-center h-full w-full">
                                                                                        {isPaid ? (
                                                                                            <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
                                                                                        ) : isOverdue ? (
                                                                                            <ExclamationTriangleIcon className="w-6 h-6 text-rose-500 animate-pulse" />
                                                                                        ) : isPending ? (
                                                                                            <ClockIcon className="w-6 h-6 text-amber-500" />
                                                                                        ) : isDisabled ? (
                                                                                            <CalendarIcon className="w-5 h-5 text-slate-400" />
                                                                                        ) : (
                                                                                            <CalendarIcon className="w-6 h-6 text-sky-400" />
                                                                                        )}
                                                                                    </div>
                                                                                </CompactTooltip>
                                                                            ) :
                                                                                /* === COMPACT VIEW: Rectangular pill badges === */
                                                                                density === 'compact' ? (
                                                                                    <CompactTooltip
                                                                                        triggerClassName={pad}
                                                                                        sideOffset={14}
                                                                                        content={
                                                                                            <div className="min-w-[140px] text-slate-800 dark:text-slate-100">
                                                                                                {/* --- HEADER: Fecha del período --- */}
                                                                                                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-2">
                                                                                                    {monthDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                                                                                                </div>

                                                                                                {/* --- CONTENT: Monto + Badge en línea --- */}
                                                                                                <div className="flex items-center justify-between gap-3 mb-1">
                                                                                                    {/* Monto - protagonista, siempre neutro */}
                                                                                                    <div className="text-base font-semibold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                                                                                                        {formatClp(displayAmount!)}
                                                                                                    </div>
                                                                                                    {/* Badge de estado compacto */}
                                                                                                    {isPaid ? (
                                                                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-inset ring-emerald-500/20 px-2 py-0.5 rounded-full">
                                                                                                            <CheckCircleIcon className="w-3.5 h-3.5" />
                                                                                                            Pagado
                                                                                                        </span>
                                                                                                    ) : isOverdue ? (
                                                                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 ring-1 ring-inset ring-red-500/20 px-2 py-0.5 rounded-full">
                                                                                                            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                                                                                            Vencido
                                                                                                        </span>
                                                                                                    ) : isDisabled ? (
                                                                                                        <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                                                                                                            <CalendarIcon className="w-3.5 h-3.5" />
                                                                                                            Futuro
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                                                                                                            <ClockIcon className="w-3.5 h-3.5" />
                                                                                                            Pendiente
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>

                                                                                                {/* Original Currency (si aplica) */}
                                                                                                {showOriginalCurrency && (
                                                                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums mb-1">
                                                                                                        {originalCurrency} {perPeriodOriginal?.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                                    </div>
                                                                                                )}

                                                                                                {/* Cuota info (si aplica) */}
                                                                                                {(cuotaNumber && installmentsCount && installmentsCount > 1) ? (
                                                                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                                                        {term?.is_divided_amount ? 'Cuota' : 'Pago'} {cuotaNumber}/{installmentsCount}
                                                                                                    </div>
                                                                                                ) : term && term.effective_from && term.frequency === 'MONTHLY' && (!installmentsCount || installmentsCount <= 1) ? (
                                                                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                                                        Pago {(() => {
                                                                                                            const [startYear, startMonth] = term.effective_from.split('-').map(Number);
                                                                                                            const paymentNumber = (monthDate.getFullYear() - startYear) * 12 +
                                                                                                                (monthDate.getMonth() + 1 - startMonth) + 1;
                                                                                                            return paymentNumber > 0 ? paymentNumber : 1;
                                                                                                        })()}/∞
                                                                                                    </div>
                                                                                                ) : null}

                                                                                                {/* --- FOOTER: Fecha relativa + CTA --- */}
                                                                                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                                                                                                    <span className="text-slate-400 dark:text-slate-500">
                                                                                                        {isPaid && currentPayment?.payment_date ? (
                                                                                                            `Pagado: ${new Date(currentPayment.payment_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
                                                                                                        ) : isOverdue ? (
                                                                                                            `Venció hace ${daysOverdue} ${daysOverdue === 1 ? 'día' : 'días'}`
                                                                                                        ) : daysRemaining === 0 ? (
                                                                                                            'Vence hoy'
                                                                                                        ) : isCurrentMonth(monthDate) ? (
                                                                                                            `Vence en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}`
                                                                                                        ) : (
                                                                                                            `Vence: ${new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
                                                                                                        )}
                                                                                                    </span>
                                                                                                    {!isPaid && !isDisabled && (
                                                                                                        <span className="text-sky-500 dark:text-sky-400 font-medium">
                                                                                                            Click →
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        }
                                                                                    >
                                                                                        <div className="flex items-center justify-between w-full h-full px-1 gap-2">
                                                                                            {/* Left: Status Icon (Sutil) */}
                                                                                            <div className={`opacity-60 transition-opacity group-hover/cell:opacity-100 ${isPaid ? 'text-emerald-600 dark:text-emerald-400' :
                                                                                                isOverdue ? 'text-rose-500 dark:text-rose-400' :
                                                                                                    'text-slate-400 dark:text-slate-500'
                                                                                                }`}>
                                                                                                {isPaid ? <CheckCircleIcon className="w-3.5 h-3.5" /> :
                                                                                                    isOverdue ? <ExclamationTriangleIcon className="w-3.5 h-3.5" /> :
                                                                                                        isPending ? <ClockIcon className="w-3.5 h-3.5" /> :
                                                                                                            (installmentsCount && installmentsCount > 1) ? <CalendarIcon className="w-3.5 h-3.5" /> :
                                                                                                                null}
                                                                                            </div>

                                                                                            {/* Right: Amount + Cuota */}
                                                                                            <div className="flex flex-col items-end leading-none">
                                                                                                <span className={`text-sm font-semibold tabular-nums ${isPaid ? 'text-emerald-800 dark:text-emerald-200' :
                                                                                                    isOverdue ? 'text-rose-700 dark:text-rose-300' :
                                                                                                        'text-slate-700 dark:text-slate-200'
                                                                                                    }`}>
                                                                                                    {formatClp(displayAmount!)}
                                                                                                </span>
                                                                                                {(cuotaNumber && installmentsCount && installmentsCount > 1) && (
                                                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                                                                                        {cuotaNumber}/{installmentsCount}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </CompactTooltip>
                                                                                ) : (
                                                                                    /* === FULL VIEW: Optimized hierarchy === */
                                                                                    <div
                                                                                        className={`${pad} relative h-full flex flex-col justify-between cursor-pointer py-1.5`}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onRecordPayment(commitment.id, dateToPeriod(monthDate));
                                                                                        }}
                                                                                    >
                                                                                        {/* ROW 1: Amount - PROTAGONISTA */}
                                                                                        <div className="text-center">
                                                                                            <span className="font-bold font-mono tabular-nums text-xl text-slate-900 dark:text-white tracking-tight">
                                                                                                {formatClp(displayAmount)}
                                                                                            </span>
                                                                                            {/* Original currency inline */}
                                                                                            {showOriginalCurrency && (
                                                                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums -mt-0.5">
                                                                                                    {originalCurrency} {perPeriodOriginal.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* ROW 2: Metadata compacta - una sola línea */}
                                                                                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                                                                            {/* Fecha */}
                                                                                            <span>
                                                                                                {isPaid && currentPayment?.payment_date
                                                                                                    ? new Date(currentPayment.payment_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
                                                                                                    : `${dueDay} ${monthDate.toLocaleDateString('es-CL', { month: 'short' })}`
                                                                                                }
                                                                                            </span>
                                                                                            {/* Separator + Cuota/Pago */}
                                                                                            {(cuotaNumber && installmentsCount && installmentsCount > 1) ? (
                                                                                                <>
                                                                                                    <span className="text-slate-300 dark:text-slate-600">·</span>
                                                                                                    <span className="font-medium">{cuotaNumber}/{installmentsCount}</span>
                                                                                                </>
                                                                                            ) : term && term.effective_from && term.frequency === 'MONTHLY' && (!installmentsCount || installmentsCount <= 1) ? (
                                                                                                <>
                                                                                                    <span className="text-slate-300 dark:text-slate-600">·</span>
                                                                                                    <span className="font-medium">
                                                                                                        {(() => {
                                                                                                            const [startYear, startMonth] = term.effective_from.split('-').map(Number);
                                                                                                            const paymentNumber = (monthDate.getFullYear() - startYear) * 12 +
                                                                                                                (monthDate.getMonth() + 1 - startMonth) + 1;
                                                                                                            return paymentNumber > 0 ? paymentNumber : 1;
                                                                                                        })()}/∞
                                                                                                    </span>
                                                                                                </>
                                                                                            ) : null}
                                                                                        </div>

                                                                                        {/* ROW 3: Status - icono pequeño + texto corto */}
                                                                                        <div className="flex items-center justify-center">
                                                                                            {/* ROW 3: Status - Rendered via helper to avoid nesting hell */}
                                                                                            <div className="flex items-center justify-center">
                                                                                                {renderStatusBadge()}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )
                                                                        ) : (
                                                                            <div className="text-slate-300 dark:text-slate-600">—</div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div >

                    {/* Grid Footer: Legend + Stats */}
                    <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-900/80">
                        {/* Left: Legend */}
                        <div className="hidden md:flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg px-3 py-1.5">
                            <div className="flex items-center gap-1.5" title="Pagado">
                                <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Pagado</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Pendiente">
                                <ClockIcon className="w-3.5 h-3.5 text-amber-500" />
                                <span>Pendiente</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Vencido">
                                <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-500" />
                                <span>Vencido</span>
                            </div>
                            <div className="w-px h-3 bg-slate-300 dark:bg-slate-600" />
                            <div className="flex items-center gap-1.5" title="Recurrente mensual">
                                <RefreshCw className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                <span>Mensual</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Plazo definido/Cuotas">
                                <CalendarIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                <span>Definido</span>
                            </div>
                        </div>

                        {/* Right: Stats */}
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {groupedCommitments.reduce((sum, g) => sum + g.commitments.length, 0)} compromisos · {effectiveMonthCount} meses
                        </div>
                    </div>

                </div >
            </div >
        </div >
    );
};

export default ExpenseGridVirtual2;
