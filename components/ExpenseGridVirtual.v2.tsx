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
    CalendarIcon, InfinityIcon, HomeIcon, TransportIcon, DebtIcon, HealthIcon,
    SubscriptionIcon, MiscIcon, CategoryIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    StarIcon, IconProps, PauseIcon, PlusIcon, EyeIcon, EyeSlashIcon, InfoIcon, MoreVertical, Link2
} from './icons';
import type { CommitmentWithTerm, Payment } from '../types.v2';
import { parseDateString, extractYearMonth, getPerPeriodAmount } from '../utils/financialUtils.v2';
import { findTermForPeriod } from '../utils/termUtils';
import { Sparkles, Home, Minus } from 'lucide-react';
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
        className="h-full flex items-center justify-center px-3 sm:px-4 text-center min-w-[100px] sm:min-w-[140px] text-sm font-semibold text-slate-900 dark:text-white capitalize hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors w-full outline-none border-x border-slate-200 dark:border-slate-600"
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
    onDeleteCommitment: (commitmentId: string) => void;
    onPauseCommitment: (commitment: CommitmentWithTerm) => void;
    onResumeCommitment: (commitment: CommitmentWithTerm) => void;
    onRecordPayment: (commitmentId: string, year: number, month: number) => void;
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


// =============================================================================
// COMPONENT
// =============================================================================

const ExpenseGridVirtual2: React.FC<ExpenseGridV2Props> = ({
    focusedDate,
    onEditCommitment,
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

    const [density, setDensity] = usePersistentState<'compact' | 'medium'>(
        'gridDensity',
        'medium' // Default to detailed/standard view
    );

    // Show/hide terminated commitments (default: hidden)
    const [showTerminated, setShowTerminated] = usePersistentState<boolean>(
        'showTerminatedCommitments',
        false
    );

    // Category filter state
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Status filter state for mobile KPI cards (pendiente, pagado, all)
    type StatusFilter = 'all' | 'pendiente' | 'pagado';
    const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');

    const pad = useMemo(() =>
        density === 'compact' ? 'p-1' : 'p-3',
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

    // Visible months centered on focused date - now controlled by density
    // compact=12 (Año), medium=6 (Semestre), comfortable=3 (Trimestre)
    // Compact: 12 months, Detailed: 6 months
    const densityMonthCount = density === 'compact' ? 12 : 6;
    const effectiveMonthCount = densityMonthCount; // Density overrides visibleMonthsCount

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

    // Smart Sort Function - Uses CURRENT month for stable sorting across navigation
    // This prevents items from "jumping" when changing the viewed month
    const getCommitmentSortData = useCallback((c: CommitmentWithTerm) => {
        // Always use TODAY for sorting, not the viewed month
        const today = new Date();
        const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);

        const term = c.active_term; // Use active term, not term for period
        const dueDay = term?.due_day_of_month ?? 32; // 32 = end of list if no active term
        const { isPaid } = getPaymentStatus(c.id, currentMonthDate, dueDay);

        const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);

        // Check for recently created (Last 5 minutes)
        const createdAt = new Date(c.created_at);
        const isRecentlyCreated = (today.getTime() - createdAt.getTime()) < 5 * 60 * 1000;

        // Status Priority (based on CURRENT month, not viewed month):
        // -2: Recently Created
        // -1: Important
        // 0: Overdue (past due in current month)
        // 1: Pending
        // 2: Paid (in current month)

        let statusPriority = 1; // Default to Pending

        if (isRecentlyCreated && !isPaid) {
            statusPriority = -2;
        } else if (c.is_important && !isPaid) {
            statusPriority = -1;
        } else if (isPaid) {
            statusPriority = 2;
        } else if (dueDate < today) {
            statusPriority = 0; // Overdue
        }

        // Amount from active term
        const amount = term?.amount_in_base ?? term?.amount_original ?? 0;

        return { statusPriority, dueDay, amount, name: c.name, id: c.id };
    }, [getPaymentStatus]);

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
            let isVisible = showTerminated;

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
    }, [commitments, showTerminated, selectedCategory, t, language, performSmartSort, getCommitmentSortData, density]);

    // Available categories for filter tabs (derived from all non-terminated commitments)
    const availableCategories = useMemo(() => {
        const categorySet = new Set<string>();
        const visibleInContext = commitments.filter(c => {
            if (showTerminated) return true;

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
    }, [commitments, language]);

    // Count of terminated commitments (for toggle label)
    const terminatedCount = useMemo(() => {
        return commitments.filter(c => {
            const term = c.active_term;
            if (!term?.effective_until) return false;
            const endDate = new Date(term.effective_until);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return endDate < today;
        }).length;
    }, [commitments]);

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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
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
                    <div className="flex items-center gap-2">
                        {/* Today button - Visible en mobile también */}
                        <button
                            onClick={() => onFocusedDateChange && onFocusedDateChange(new Date())}
                            disabled={isCurrentMonth(focusedDate)}
                            className={`h-9 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${isCurrentMonth(focusedDate)
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
                                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 ring-1 ring-slate-200 dark:ring-slate-600 shadow-sm active:scale-95'
                                }`}
                            title="Ir a hoy"
                        >
                            <Home className="w-4 h-4" />
                            <span className="hidden sm:inline ml-2">Hoy</span>
                        </button>

                        {/* Unified Month + Year Navigator */}
                        <div className="h-9 flex items-center bg-white dark:bg-slate-700 rounded-lg ring-1 ring-slate-200 dark:ring-slate-600 shadow-sm">
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

                        {/* Terminated Toggle (Mobile only in nav row) */}
                        {terminatedCount > 0 && (
                            <button
                                onClick={() => setShowTerminated(!showTerminated)}
                                className={`
                                    lg:hidden h-9 flex items-center justify-center px-3 rounded-lg text-xs font-medium transition-all
                                    ${showTerminated
                                        ? 'bg-slate-800 text-white shadow-md ring-1 ring-slate-700'
                                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                                    }
                                `}
                                title={showTerminated ? 'Ocultar terminados' : 'Mostrar terminados'}
                            >
                                {showTerminated ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
                            </button>
                        )}
                    </div>

                    {/* Center: Totals (lg+ only, inline) */}
                    {(() => {
                        const totals = getMonthTotals(focusedDate.getFullYear(), focusedDate.getMonth());
                        return (
                            <div className="hidden lg:flex items-center gap-4 xl:gap-6 px-4 border-x border-slate-200 dark:border-slate-700">
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ingresos</span>
                                    <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-500">
                                        {formatClp(totals.ingresos)}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comprometido</span>
                                    <span className="text-sm font-bold font-mono text-slate-700 dark:text-slate-200">
                                        {formatClp(totals.comprometido)}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pagado</span>
                                    <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-500 flex items-center gap-1">
                                        <CheckCircleIcon className="w-3 h-3" />
                                        {formatClp(totals.pagado)}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pendiente</span>
                                    <span className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">
                                        {formatClp(totals.pendiente)}
                                    </span>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Right: Display Options (Desktop Only) */}
                    <div className="hidden lg:flex items-center gap-3">
                        {/* Terminated Toggle (Desktop - grouped with density) */}
                        {terminatedCount > 0 && (
                            <button
                                onClick={() => setShowTerminated(!showTerminated)}
                                className={`
                                    h-9 flex items-center gap-2 px-3 rounded-lg text-sm font-bold transition-all border
                                    ${showTerminated
                                        ? 'bg-slate-800 text-white border-slate-700 shadow-md shadow-slate-900/10'
                                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }
                                `}
                                title={showTerminated ? 'Ocultar terminados' : 'Mostrar terminados'}
                            >
                                {showTerminated ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
                                <span>{showTerminated ? 'Ocultar' : 'Ver'} terminados ({terminatedCount})</span>
                            </button>
                        )}

                        {/* Density Selector */}
                        <div className="h-9 flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                            {(['compact', 'medium'] as const).map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setDensity(d)}
                                    className={`h-full flex items-center px-3.5 text-sm font-bold rounded-[6px] transition-all duration-200 ${density === d
                                        ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-500'
                                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                                        }`}
                                >
                                    {d === 'compact' ? 'Compacta' : 'Detallada'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Row 2: KPIs Mobile - Bento Grid + Glassmorphism */}
                {(() => {
                    const totals = getMonthTotals(focusedDate.getFullYear(), focusedDate.getMonth());
                    return (
                        <div className="lg:hidden border-b border-slate-200/50 dark:border-white/5">
                            {/* Hero Card: Pendiente - Full width with decorative background */}
                            <div className="px-3 pt-3 pb-2">
                                <button
                                    onClick={() => {
                                        setSelectedStatus(selectedStatus === 'pendiente' ? 'all' : 'pendiente');
                                        setSelectedCategory('all'); // Reset category when selecting status
                                    }}
                                    className={`relative w-full overflow-hidden rounded-2xl p-4 text-center backdrop-blur-xl transition-all duration-300 active:scale-[0.98] ${selectedStatus === 'pendiente'
                                        ? 'bg-gradient-to-br from-amber-500/25 to-orange-500/15 dark:from-amber-600/30 dark:to-orange-600/15 border border-amber-400/50 dark:border-amber-400/40 shadow-lg shadow-amber-500/20'
                                        : 'bg-gradient-to-br from-amber-500/10 to-orange-500/5 dark:from-amber-900/30 dark:to-orange-900/10 border border-amber-200/30 dark:border-amber-500/20 hover:from-amber-500/15 hover:to-orange-500/10'
                                        }`}
                                >
                                    {/* Decorative Background Icon */}
                                    <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-[0.08] pointer-events-none">
                                        <ClockIcon className="w-24 h-24 text-amber-600 dark:text-amber-400" />
                                    </div>

                                    <div className="relative z-10">
                                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${selectedStatus === 'pendiente'
                                            ? 'text-amber-700 dark:text-amber-300'
                                            : 'text-amber-600/80 dark:text-amber-400/80'
                                            }`}>
                                            Pendiente por pagar
                                        </p>
                                        <p className={`text-3xl font-black font-mono tracking-tighter ${selectedStatus === 'pendiente'
                                            ? 'text-amber-700 dark:text-amber-200'
                                            : 'text-amber-700/90 dark:text-amber-300/90'
                                            }`}>
                                            {formatClp(totals.pendiente)}
                                        </p>
                                    </div>
                                </button>
                            </div>

                            {/* Secondary KPIs Row: Comprometido + Pagado */}
                            <div className="px-3 pb-2 grid grid-cols-2 gap-2">
                                {/* Comprometido - Shows all */}
                                <button
                                    onClick={() => {
                                        setSelectedStatus('all');
                                        setSelectedCategory('all'); // Reset category when selecting status
                                    }}
                                    className={`flex flex-col items-center justify-center p-3 rounded-2xl backdrop-blur-xl transition-all duration-300 active:scale-[0.97] ${selectedStatus === 'all' && selectedCategory === 'all'
                                        ? 'bg-sky-500/15 dark:bg-sky-500/10 border border-sky-400/30 dark:border-sky-400/20 shadow-md shadow-sky-500/10'
                                        : 'bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10'
                                        }`}
                                >
                                    <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${selectedStatus === 'all' && selectedCategory === 'all' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'
                                        }`}>Comprometido</p>
                                    <p className={`text-lg font-extrabold font-mono tracking-tight ${selectedStatus === 'all' && selectedCategory === 'all' ? 'text-sky-700 dark:text-sky-300' : 'text-slate-700 dark:text-slate-200'
                                        }`}>{formatClp(totals.comprometido)}</p>
                                </button>

                                {/* Pagado */}
                                <button
                                    onClick={() => {
                                        setSelectedStatus(selectedStatus === 'pagado' ? 'all' : 'pagado');
                                        setSelectedCategory('all'); // Reset category when selecting status
                                    }}
                                    className={`flex flex-col items-center justify-center p-3 rounded-2xl backdrop-blur-xl transition-all duration-300 active:scale-[0.97] ${selectedStatus === 'pagado'
                                        ? 'bg-teal-500/20 dark:bg-teal-500/15 border border-teal-400/40 dark:border-teal-400/30 shadow-md shadow-teal-500/10'
                                        : 'bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-1 mb-0.5">
                                        <CheckCircleIcon className={`w-3.5 h-3.5 ${selectedStatus === 'pagado' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
                                        <p className={`text-[9px] font-bold uppercase tracking-wider ${selectedStatus === 'pagado' ? 'text-teal-700 dark:text-teal-300' : 'text-slate-500 dark:text-slate-400'}`}>Pagado</p>
                                    </div>
                                    <p className={`text-lg font-extrabold font-mono tracking-tight ${selectedStatus === 'pagado' ? 'text-teal-700 dark:text-teal-300' : 'text-slate-700 dark:text-slate-200'}`}>{formatClp(totals.pagado)}</p>
                                </button>
                            </div>

                            {/* Category Filter Pills - Mutually exclusive with status */}
                            <div className="px-3 pb-3">
                                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                                    {availableCategories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => {
                                                if (selectedCategory === cat) {
                                                    setSelectedCategory('all');
                                                } else {
                                                    setSelectedCategory(cat);
                                                    setSelectedStatus('all'); // Reset status when selecting category
                                                }
                                            }}
                                            className={`
                                                flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-semibold whitespace-nowrap
                                                backdrop-blur-lg transition-all duration-200
                                                ${selectedCategory === cat
                                                    ? 'bg-slate-800/90 dark:bg-white/90 text-white dark:text-slate-900 shadow-md'
                                                    : 'bg-white/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-white/40 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10'
                                                }
                                            `}
                                        >
                                            {cat === 'all' ? 'Todos' : cat === 'FILTER_IMPORTANT' ? <StarIcon className="w-3.5 h-3.5 fill-current" /> : cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Mobile View */}
            <div className="lg:hidden p-4 space-y-4 min-h-screen pb-32">
                {(() => {
                    const filteredCommitments = commitments.filter(c => {
                        // 1. Siempre mostrar si "Ver terminados" está activo
                        if (showTerminated) return true;

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
                        const { isPaid, amount: paidAmount, hasPaymentRecord, payment: currentPayment } = getPaymentStatus(c.id, monthDate, dueDay);

                        // Calculation logic exactly like desktop
                        const totalAmount = term?.amount_in_base ?? term?.amount_original ?? 0;
                        const installmentsCount = term?.installments_count ?? null;
                        const perPeriodAmount = term?.is_divided_amount && installmentsCount && installmentsCount > 1
                            ? totalAmount / installmentsCount
                            : totalAmount;

                        const amount = (hasPaymentRecord && paidAmount !== null) ? paidAmount : perPeriodAmount;

                        const today = new Date();
                        const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
                        // Validation: Must have active term to be overdue
                        const isOverdue = isTermActiveInMonth && !isPaid && dueDate < today && monthDate <= today;

                        // Cálculos consistentes con tooltip desktop
                        const daysOverdue = isOverdue
                            ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                            : 0;

                        // Cuota number (consistente con desktop)
                        let cuotaNumber: number | null = null;
                        if (term && installmentsCount && installmentsCount > 1) {
                            const [startYear, startMonth] = term.effective_from.split('-').map(Number);
                            const monthsDiff = (monthDate.getFullYear() - startYear) * 12 +
                                (monthDate.getMonth() + 1 - startMonth);
                            cuotaNumber = monthsDiff + 1;
                            if (cuotaNumber < 1 || cuotaNumber > installmentsCount) {
                                cuotaNumber = null;
                            }
                        }

                        // Determinar si se debe mostrar como tachado (terminated)
                        const isGloballyTerminated = isCommitmentTerminated(c);
                        const wasActiveInMonth = getTermForPeriod(c, monthDate) !== null;
                        const terminated = isGloballyTerminated && wasActiveInMonth && isPaid;

                        const terminationReason = getTerminationReason(c);

                        // Payment record from getPaymentStatus
                        // const currentPayment = ... (already retrieved above)

                        return (
                            <div
                                key={c.id}
                                onClick={() => isTermActiveInMonth && onRecordPayment(c.id, monthDate.getFullYear(), monthDate.getMonth())}
                                className={`
                                    relative overflow-hidden rounded-3xl
                                    transition-all duration-300 ease-out
                                    border
                                    ${isPaid
                                        ? 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-500/20 shadow-sm'
                                        : isOverdue
                                            ? 'bg-white/80 dark:bg-slate-800/40 border-red-200 dark:border-red-500/30 shadow-sm'
                                            : !isTermActiveInMonth
                                                ? 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800'
                                                : 'bg-white/90 dark:bg-slate-800/40 border-slate-200 dark:border-white/10 shadow-sm'
                                    }
                                    backdrop-blur-xl
                                    ${isTermActiveInMonth && !isPaid ? 'active:scale-[0.98] cursor-pointer' : 'cursor-default opacity-80'}
                                `}
                            >
                                {/* Flow Indicator */}
                                {isTermActiveInMonth && (
                                    <div className={`absolute top-4 left-0 w-1 h-8 rounded-r-full ${c.flow_type === 'INCOME' ? 'bg-emerald-400' : 'bg-rose-400'} opacity-80`} />
                                )}

                                <div className="p-5 pl-6">
                                    {/* Top Row: Name & Menu */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1 pr-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className={`text-base font-bold leading-tight ${terminated || !isTermActiveInMonth ? 'text-slate-500 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                                    {c.name}
                                                </h3>
                                                {c.is_important && <StarIcon className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
                                                {!isTermActiveInMonth && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 uppercase font-bold">Inactivo</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    {getTranslatedCategoryName(c)}
                                                </span>
                                                {/* Status Badges */}
                                                {terminationReason === 'PAUSED' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600">PAUSADO</span>
                                                )}
                                                {((new Date().getTime() - new Date(c.created_at).getTime()) < 5 * 60 * 1000) && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-600 animate-pulse">NUEVO</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="shrink-0 -mr-2 -mt-2">
                                            <DropdownMenu.Root>
                                                <DropdownMenu.Trigger asChild>
                                                    <button
                                                        className="p-3 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-full active:bg-slate-100 dark:active:bg-slate-800"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>
                                                </DropdownMenu.Trigger>
                                                <DropdownMenu.Portal>
                                                    <DropdownMenu.Content
                                                        className="min-w-[180px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-200"
                                                        sideOffset={5}
                                                        align="end"
                                                    >
                                                        <DropdownMenu.Item
                                                            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer outline-none"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onEditCommitment(c);
                                                            }}
                                                        >
                                                            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500">
                                                                <EditIcon className="w-4 h-4" />
                                                            </div>
                                                            Editar
                                                        </DropdownMenu.Item>

                                                        <DropdownMenu.Item
                                                            className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer outline-none ${terminationReason === 'COMPLETED_INSTALLMENTS' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            disabled={terminationReason === 'COMPLETED_INSTALLMENTS'}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const hasEndDate = !!c.active_term?.effective_until;
                                                                if (hasEndDate || terminationReason === 'PAUSED' || terminationReason === 'TERMINATED') {
                                                                    onResumeCommitment(c);
                                                                } else {
                                                                    onPauseCommitment(c);
                                                                }
                                                            }}
                                                        >
                                                            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-500">
                                                                <PauseIcon className="w-4 h-4" />
                                                            </div>
                                                            {(() => {
                                                                const hasEndDate = !!c.active_term?.effective_until;
                                                                if (terminationReason === 'COMPLETED_INSTALLMENTS') return 'Completado';
                                                                if (hasEndDate || terminationReason === 'PAUSED' || terminationReason === 'TERMINATED') return 'Reanudar';
                                                                return 'Pausar';
                                                            })()}
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Separator className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                                        <DropdownMenu.Item
                                                            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/10 cursor-pointer outline-none"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onDeleteCommitment(c.id);
                                                            }}
                                                        >
                                                            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500">
                                                                <TrashIcon className="w-4 h-4" />
                                                            </div>
                                                            Eliminar
                                                        </DropdownMenu.Item>
                                                    </DropdownMenu.Content>
                                                </DropdownMenu.Portal>
                                            </DropdownMenu.Root>
                                        </div>
                                    </div>

                                    {/* Middle Row: Amount & Status */}
                                    <div className="flex items-end justify-between mb-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs text-slate-400 font-medium">Monto</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className={`text-2xl font-bold font-mono tracking-tighter ${!isTermActiveInMonth ? 'text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                                                    {isTermActiveInMonth ? formatClp(amount ?? 0) : '—'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Status Pill */}
                                        <div
                                            className={`
                                                flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-1 ring-inset
                                                ${isPaid
                                                    ? 'bg-emerald-100/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20'
                                                    : isOverdue
                                                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 ring-red-500/20 animate-pulse'
                                                        : !isTermActiveInMonth
                                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 ring-slate-200 dark:ring-slate-700'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 ring-slate-200 dark:ring-slate-700'}
                                            `}
                                            aria-label={isPaid ? 'Pagado' : isOverdue ? 'Vencido' : !isTermActiveInMonth ? 'Inactivo' : 'Pendiente'}
                                            role="status"
                                        >
                                            {isPaid ? <CheckCircleIcon className="w-4 h-4" />
                                                : isOverdue ? <ExclamationTriangleIcon className="w-4 h-4" />
                                                    : !isTermActiveInMonth ? <Minus className="w-4 h-4" />
                                                        : <ClockIcon className="w-4 h-4" />}
                                            <span className="text-xs font-bold leading-none">
                                                {isPaid ? 'Pagado' : isOverdue ? 'Vencido' : !isTermActiveInMonth ? 'No aplica' : 'Pendiente'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Footer: Date & Context */}
                                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            <CalendarIcon className="w-3.5 h-3.5 opacity-70" />
                                            {isPaid && currentPayment?.payment_date ? (
                                                <span>Pagado el <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(currentPayment.payment_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}</span></span>
                                            ) : isOverdue ? (
                                                <span className="text-red-500 font-medium">Venció hace {daysOverdue} días</span>
                                            ) : !isTermActiveInMonth ? (
                                                <span>Sin vigencia este mes</span>
                                            ) : (
                                                <span>Vence el {new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}</span>
                                            )}
                                        </div>

                                        {/* Cuota Info or Recurrence */}
                                        {cuotaNumber && installmentsCount && installmentsCount > 1 ? (
                                            <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">
                                                {cuotaNumber}/{installmentsCount}
                                            </span>
                                        ) : (
                                            <div className="text-[10px] text-sky-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                {isTermActiveInMonth && !isPaid && "Toca para pagar"}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        );
                    }) : (
                        <div className="text-center py-20 px-6 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            {commitments.length === 0 ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-2">
                                        <Sparkles className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                            ¡Bienvenido a FinanSheet!
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6">
                                            Aún no tienes compromisos registrados. Comienza agregando tus ingresos y gastos fijos.
                                        </p>
                                        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 py-2 px-4 rounded-full inline-block">
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
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-x-hidden mt-2">
                    {/* Simplified Header - Only Tabs */}
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide mr-2">
                                Filtrar:
                            </span>
                            {availableCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`
                                        px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap
                                        transition-all duration-200
                                        ${selectedCategory === cat
                                            ? 'bg-sky-500 text-white shadow-sm'
                                            : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                        }
                                    `}
                                >
                                    {cat === 'all' ? 'Todos' : cat === 'FILTER_IMPORTANT' ? 'Importantes' : cat}
                                    <span className={`ml-1.5 text-xs ${selectedCategory === cat ? 'opacity-80' : 'opacity-50'}`}>
                                        ({cat === 'all'
                                            ? commitments.filter(c => showTerminated || !c.active_term?.effective_until || new Date(c.active_term.effective_until) >= new Date()).length
                                            : cat === 'FILTER_IMPORTANT'
                                                ? commitments.filter(c => {
                                                    const isActive = showTerminated || !c.active_term?.effective_until || new Date(c.active_term.effective_until) >= new Date();
                                                    return isActive && c.is_important;
                                                }).length
                                                : commitments.filter(c => {
                                                    const categoryName = getTranslatedCategoryName(c);
                                                    const isActive = showTerminated || !c.active_term?.effective_until || new Date(c.active_term.effective_until) >= new Date();
                                                    return isActive && categoryName === cat;
                                                }).length
                                        })
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="relative mb-2">
                        {/* Scroll Indicator - Right Edge Gradient */}
                        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/80 dark:from-slate-900/80 to-transparent pointer-events-none z-30" />

                        <div
                            ref={scrollAreaRef}
                            className="relative overflow-x-auto overflow-y-auto scrollbar-thin pr-1"
                            style={{ height: `${availableHeight}px` }}
                        >
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 shadow-sm">
                                    <tr>
                                        <th className={`sticky left-0 z-50 bg-slate-50 dark:bg-slate-800 text-left font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 ${density === 'compact' ? 'px-3 py-2 min-w-[140px] max-w-[300px] w-auto text-sm' : 'p-3 min-w-[220px]'}`}>
                                            Compromiso
                                        </th>
                                        {visibleMonths.map((month, i) => (
                                            <th
                                                key={i}
                                                id={`month-header-${i}`}
                                                className={`text-center font-semibold border-r border-slate-200 dark:border-slate-700 last:border-r-0 ${density === 'compact' ? 'px-2 py-2 min-w-[55px] text-sm' : 'p-2.5 min-w-[90px] lg:min-w-[120px]'} ${isCurrentMonth(month)
                                                    ? 'bg-blue-50/90 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-500/20 z-20'
                                                    : 'text-slate-700 dark:text-slate-300'
                                                    }`}
                                            >
                                                <div className="capitalize leading-tight">
                                                    {density === 'compact'
                                                        ? month.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }) // e.g. "ago. 26"
                                                        : month.toLocaleDateString('es-ES', { month: 'short' })
                                                    }
                                                </div>
                                                {density !== 'compact' && <div className="text-xs opacity-75">{month.getFullYear()}</div>}
                                            </th>
                                        ))}
                                    </tr>
                                    {/* Total Pagado Row */}
                                    <tr className="bg-slate-100/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                                        <th className={`sticky left-0 z-50 bg-slate-100 dark:bg-slate-800 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700 ${density === 'compact' ? 'px-3 py-1.5' : 'px-3 py-2'}`}>
                                            Total pagado
                                        </th>
                                        {visibleMonths.map((month, i) => {
                                            const monthTotals = getMonthTotals(month.getFullYear(), month.getMonth());
                                            return (
                                                <th
                                                    key={i}
                                                    className={`text-center text-xs font-mono tabular-nums border-r border-slate-200 dark:border-slate-700 last:border-r-0 ${density === 'compact' ? 'px-2 py-1.5' : 'px-2 py-2'} ${monthTotals.pagado > 0
                                                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                                        : 'text-slate-400 dark:text-slate-500'
                                                        }`}
                                                >
                                                    {monthTotals.pagado > 0 ? formatClp(monthTotals.pagado) : '—'}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedCommitments.map(({ category, commitments: catCommitments }) => (
                                        <React.Fragment key={category}>
                                            {/* Category row - only show in non-compact modes */}
                                            {density !== 'compact' && (
                                                <tr className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-slate-800/80 dark:via-slate-800/50 dark:to-slate-800/80">
                                                    <td className="sticky left-0 z-25 bg-slate-100 dark:bg-slate-800/80 p-3 font-semibold text-slate-700 dark:text-slate-200 border-b border-r border-slate-200 dark:border-slate-700/50 min-w-[220px]">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-slate-200/80 dark:bg-slate-700/50 flex items-center justify-center text-slate-500 dark:text-slate-400">
                                                                {getCategoryIcon(category)}
                                                            </div>
                                                            <span className="text-sm font-bold uppercase tracking-wide">{category}</span>
                                                        </div>
                                                    </td>
                                                    {visibleMonths.map((_, mi) => (
                                                        <td key={mi} className="bg-slate-100/50 dark:bg-slate-800/30 border-b border-r border-slate-200 dark:border-slate-700/50 last:border-r-0" />
                                                    ))}
                                                </tr>
                                            )}

                                            {/* Commitment rows */}
                                            {catCommitments.map(commitment => {
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
                                                            border-b border-slate-100 dark:border-slate-800
                                                            transition-all duration-200 ease-out
                                                            bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800
                                                            hover:bg-slate-50/80 dark:hover:bg-slate-800/50
                                                            ${terminated ? 'opacity-60 grayscale-[0.5]' : ''}
                                                        `}
                                                    >
                                                        {/* Name cell with flow-type accent - Merged with Category for Compact */}
                                                        <td
                                                            onClick={() => onEditCommitment(commitment)}
                                                            className={`
                                                            sticky left-0 z-20 
                                                            ${terminated ? 'bg-slate-50/95 dark:bg-slate-900/95' : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm'} 
                                                            group-hover:bg-slate-50 dark:group-hover:bg-slate-800
                                                            border-r border-slate-100 dark:border-slate-800
                                                            cursor-pointer
                                                            ${density === 'compact' ? 'px-3 py-3 min-w-[140px] max-w-[300px] w-auto' : pad}
                                                        `}>
                                                            {/* Flow Type Pill Indicator */}
                                                            <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full ${commitment.flow_type === 'INCOME' ? 'bg-emerald-400' : 'bg-rose-400'} opacity-80`} />
                                                            {density === 'compact' ? (
                                                                /* Compact: Single Line Layout -> Name (Left) ... Details (Right) + ACTIONS */
                                                                <div
                                                                    className="flex items-center justify-between gap-3 relative pr-8 cursor-pointer group/compact h-full min-h-[32px]"
                                                                >
                                                                    {/* Left: Name */}
                                                                    <div className="min-w-0 flex-1 flex items-center">
                                                                        <span
                                                                            className={`font-medium text-sm truncate flex items-center gap-1.5 hover:text-sky-600 ${terminated ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}
                                                                            title={`${commitment.name} - Click para editar`}
                                                                        >
                                                                            <span className="truncate">{commitment.name}</span>
                                                                            {/* Important Star */}
                                                                            {commitment.is_important && (
                                                                                <StarIcon className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                                                            )}
                                                                            {/* Linked Icon */}
                                                                            {commitment.linked_commitment_id && (
                                                                                <Link2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                                                            )}
                                                                            {/* New Item Badge */}
                                                                            {((new Date().getTime() - new Date(commitment.created_at).getTime()) < 5 * 60 * 1000) && (
                                                                                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 animate-pulse">
                                                                                    NUEVO
                                                                                </span>
                                                                            )}
                                                                            {/* Status Badges - Differentiated by termination reason */}
                                                                            {terminationReason === 'PAUSED' && (
                                                                                <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100/50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20">
                                                                                    <PauseIcon className="w-2.5 h-2.5" />
                                                                                    PAUSADO
                                                                                </span>
                                                                            )}
                                                                            {(!showTerminated && (isGloballyTerminated || terminationReason === 'PAUSED')) && (
                                                                                <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100/50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-500/20" title="Visible por actividad en el periodo">
                                                                                    <InfoIcon className="w-2.5 h-2.5" />
                                                                                    PENDIENTE
                                                                                </span>
                                                                            )}
                                                                            {terminationReason === 'COMPLETED_INSTALLMENTS' && (
                                                                                <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                                                                                    <CheckCircleIcon className="w-2.5 h-2.5" />
                                                                                    COMPLETADO
                                                                                </span>
                                                                            )}
                                                                            {terminationReason === 'TERMINATED' && (
                                                                                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                                                                                    TERMINADO
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    </div>

                                                                    {/* Right: Category + Amount + Icon */}
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-slate-100 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 uppercase tracking-wider border border-slate-200 dark:border-slate-600/50">
                                                                            {getTranslatedCategoryName(commitment)}
                                                                        </span>
                                                                        <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700/50">
                                                                            <span>
                                                                                {formatClp(
                                                                                    commitment.active_term
                                                                                        ? Math.round(getPerPeriodAmount(commitment.active_term, true))
                                                                                        : 0
                                                                                )}
                                                                            </span>
                                                                            {/* Icon Logic */}
                                                                            {(commitment.active_term?.frequency === 'ONCE' || (commitment.active_term?.installments_count && commitment.active_term.installments_count > 1))
                                                                                ? <CalendarIcon className="w-3 h-3 text-slate-400" />
                                                                                : commitment.active_term?.frequency === 'MONTHLY'
                                                                                    ? <InfinityIcon className="w-3 h-3 text-slate-400" />
                                                                                    : null
                                                                            }
                                                                        </div>
                                                                    </div>

                                                                    {/* Actions (Absolute positioned, visible on hover) using DropdownMenu */}
                                                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-l pl-1" onClick={e => e.stopPropagation()}>
                                                                        <DropdownMenu.Root>
                                                                            <DropdownMenu.Trigger asChild>
                                                                                <button
                                                                                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                                                                                >
                                                                                    <MoreVertical className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </DropdownMenu.Trigger>
                                                                            <DropdownMenu.Portal>
                                                                                <DropdownMenu.Content
                                                                                    className="min-w-[180px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-200"
                                                                                    sideOffset={5}
                                                                                    align="end"
                                                                                    onCloseAutoFocus={(e) => e.preventDefault()}
                                                                                >
                                                                                    <DropdownMenu.Item
                                                                                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer outline-none"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onEditCommitment(commitment);
                                                                                        }}
                                                                                    >
                                                                                        <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500">
                                                                                            <EditIcon className="w-4 h-4" />
                                                                                        </div>
                                                                                        Editar
                                                                                    </DropdownMenu.Item>

                                                                                    <DropdownMenu.Item
                                                                                        className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer outline-none ${terminationReason === 'COMPLETED_INSTALLMENTS' ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                                                                        <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-500">
                                                                                            <PauseIcon className="w-4 h-4" />
                                                                                        </div>
                                                                                        {(() => {
                                                                                            const hasEndDate = !!commitment.active_term?.effective_until;
                                                                                            if (terminationReason === 'COMPLETED_INSTALLMENTS') return 'Completado';
                                                                                            if (hasEndDate || terminationReason === 'PAUSED' || terminationReason === 'TERMINATED') return 'Reanudar';
                                                                                            return 'Pausar';
                                                                                        })()}
                                                                                    </DropdownMenu.Item>

                                                                                    <DropdownMenu.Separator className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                                                                                    <DropdownMenu.Item
                                                                                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/10 cursor-pointer outline-none"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onDeleteCommitment(commitment.id);
                                                                                        }}
                                                                                    >
                                                                                        <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500">
                                                                                            <TrashIcon className="w-4 h-4" />
                                                                                        </div>
                                                                                        Eliminar
                                                                                    </DropdownMenu.Item>
                                                                                </DropdownMenu.Content>
                                                                            </DropdownMenu.Portal>
                                                                        </DropdownMenu.Root>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                /* Full: All details */
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div
                                                                        className="flex-grow cursor-pointer"
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            {commitment.flow_type === 'INCOME' ? (
                                                                                <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
                                                                            ) : (
                                                                                <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />
                                                                            )}
                                                                            <span className={`font-medium ${terminated ? 'line-through text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>{commitment.name}</span>
                                                                            {(!showTerminated && (isGloballyTerminated || terminationReason === 'PAUSED')) && (
                                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100/50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-500/20" title="Visible por actividad en el periodo">
                                                                                    <InfoIcon className="w-2.5 h-2.5" />
                                                                                    PENDIENTE
                                                                                </span>
                                                                            )}
                                                                            {commitment.is_important && <StarIcon className="w-4 h-4 text-amber-500" />}
                                                                            {commitment.linked_commitment_id && (() => {
                                                                                const linkedCommitment = commitments.find(c => c.id === commitment.linked_commitment_id);
                                                                                if (!linkedCommitment) return null;

                                                                                // Get current month for calculating actual NET
                                                                                const now = new Date();
                                                                                // currentPeriod removed (we use robust date matching now)

                                                                                // Get actual amount for this commitment (payment or projected)
                                                                                // myPayments removed (unused)
                                                                                const myStatus = getPaymentStatus(commitment.id, now, commitment.active_term?.due_day_of_month ?? 1);
                                                                                const myPayment = myStatus.payment;
                                                                                const myAmount = myPayment?.amount_in_base ?? (commitment.active_term ? getPerPeriodAmount(commitment.active_term, true) : 0);

                                                                                // Get actual amount for linked commitment
                                                                                // linkedPayments removed (unused)
                                                                                const linkedStatus = getPaymentStatus(linkedCommitment.id, now, linkedCommitment.active_term?.due_day_of_month ?? 1);
                                                                                const linkedPayment = linkedStatus.payment;
                                                                                const linkedAmount = linkedPayment?.amount_in_base ?? (linkedCommitment.active_term ? getPerPeriodAmount(linkedCommitment.active_term, true) : 0);

                                                                                const netAmount = Math.abs(myAmount - linkedAmount);
                                                                                const netType = myAmount >= linkedAmount ? commitment.flow_type : linkedCommitment.flow_type;
                                                                                return (
                                                                                    <span
                                                                                        className="relative group"
                                                                                        title={`Vinculado con ${linkedCommitment.name}`}
                                                                                    >
                                                                                        <Link2 className="w-3.5 h-3.5 text-sky-500" />
                                                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1.5 text-xs bg-slate-800 dark:bg-slate-700 text-white rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                                                                                            <span className="block font-medium">Compensado con {linkedCommitment.name}</span>
                                                                                            <span className="block text-slate-300">
                                                                                                Neto este mes: <span className={`tabular-nums ${netType === 'EXPENSE' ? 'text-red-400' : 'text-green-400'}`}>
                                                                                                    {netType === 'EXPENSE' ? '-' : '+'}${netAmount.toLocaleString('es-CL')}
                                                                                                </span>
                                                                                            </span>
                                                                                        </span>
                                                                                    </span>
                                                                                );
                                                                            })()}
                                                                            {/* Status Badges - Differentiated */}
                                                                            {terminationReason === 'PAUSED' && (
                                                                                <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded flex items-center gap-1">
                                                                                    <PauseIcon className="w-3 h-3" />
                                                                                    Pausado
                                                                                </span>
                                                                            )}
                                                                            {terminationReason === 'COMPLETED_INSTALLMENTS' && (
                                                                                <span className="text-xs px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded flex items-center gap-1">
                                                                                    <CheckCircleIcon className="w-3 h-3" />
                                                                                    Completado
                                                                                </span>
                                                                            )}
                                                                            {terminationReason === 'TERMINATED' && (
                                                                                <span className="text-xs px-1.5 py-0.5 bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded">
                                                                                    Terminado
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                                            {/* Icon Logic: Mutually Exclusive */}
                                                                            {(commitment.active_term?.frequency === 'ONCE' || (commitment.active_term?.installments_count && commitment.active_term?.installments_count > 1))
                                                                                ? <CalendarIcon className="w-4 h-4" />
                                                                                : commitment.active_term?.frequency === 'MONTHLY'
                                                                                    ? (commitment.active_term.effective_until ? <ClockIcon className="w-4 h-4 text-amber-500" /> : <InfinityIcon className="w-4 h-4" />)
                                                                                    : null
                                                                            }

                                                                            {!commitment.active_term && (
                                                                                <span className="text-amber-600 dark:text-amber-400">Expirado</span>
                                                                            )}
                                                                            {commitment.active_term && (
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span>
                                                                                        {commitment.active_term.installments_count && commitment.active_term.installments_count > 1
                                                                                            ? (commitment.active_term.is_divided_amount ? 'En cuotas' : 'Definido')
                                                                                            : commitment.active_term.frequency === 'MONTHLY'
                                                                                                ? (commitment.active_term.effective_until ? (() => {
                                                                                                    const [y, m] = commitment.active_term.effective_until.substring(0, 7).split('-');
                                                                                                    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                                                                                    return `Hasta ${months[parseInt(m) - 1]} ${y}`;
                                                                                                })() : 'Indefinido')
                                                                                                : commitment.active_term.frequency}
                                                                                    </span>
                                                                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                                                                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                                                                        {formatClp(Math.round(getPerPeriodAmount(commitment.active_term, true)))}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {/* Actions using DropdownMenu */}
                                                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                                                        <DropdownMenu.Root>
                                                                            <DropdownMenu.Trigger asChild>
                                                                                <button
                                                                                    className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                                                    onClick={(e) => e.stopPropagation()} // Prevent triggering edit modal
                                                                                >
                                                                                    <MoreVertical className="w-4 h-4" />
                                                                                </button>
                                                                            </DropdownMenu.Trigger>
                                                                            <DropdownMenu.Portal>
                                                                                <DropdownMenu.Content
                                                                                    className="min-w-[180px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-200"
                                                                                    sideOffset={5}
                                                                                    align="end"
                                                                                >
                                                                                    <DropdownMenu.Item
                                                                                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer outline-none"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onEditCommitment(commitment);
                                                                                        }}
                                                                                    >
                                                                                        <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500">
                                                                                            <EditIcon className="w-4 h-4" />
                                                                                        </div>
                                                                                        Editar
                                                                                    </DropdownMenu.Item>

                                                                                    <DropdownMenu.Item
                                                                                        className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer outline-none ${terminationReason === 'COMPLETED_INSTALLMENTS' ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                                                                        <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-500">
                                                                                            <PauseIcon className="w-4 h-4" />
                                                                                        </div>
                                                                                        {(() => {
                                                                                            const hasEndDate = !!commitment.active_term?.effective_until;
                                                                                            if (terminationReason === 'COMPLETED_INSTALLMENTS') return 'Completado';
                                                                                            if (hasEndDate || terminationReason === 'PAUSED' || terminationReason === 'TERMINATED') return 'Reanudar';
                                                                                            return 'Pausar';
                                                                                        })()}
                                                                                    </DropdownMenu.Item>

                                                                                    <DropdownMenu.Separator className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                                                                                    <DropdownMenu.Item
                                                                                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/10 cursor-pointer outline-none"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onDeleteCommitment(commitment.id);
                                                                                        }}
                                                                                    >
                                                                                        <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500">
                                                                                            <TrashIcon className="w-4 h-4" />
                                                                                        </div>
                                                                                        Eliminar
                                                                                    </DropdownMenu.Item>
                                                                                </DropdownMenu.Content>
                                                                            </DropdownMenu.Portal>
                                                                        </DropdownMenu.Root>
                                                                    </div>
                                                                </div>
                                                            )}
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
                                                            return (
                                                                <td
                                                                    key={mi}
                                                                    className={`
                                                                        text-right border-r border-slate-100 dark:border-slate-800 last:border-r-0 
                                                                        cursor-pointer transition-all duration-150 ease-out group/cell
                                                                        hover:ring-2 hover:ring-inset hover:ring-indigo-500/50 dark:hover:ring-indigo-400/50
                                                                        ${isCurrentMonth(monthDate) ? 'bg-blue-50/30 dark:bg-blue-900/10 ring-1 ring-inset ring-blue-500/10' : ''}
                                                                        ${isDisabled ? 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0' : ''}
                                                                        ${isGap ? 'bg-slate-100/60 dark:bg-slate-900/50' : ''}
                                                                        ${isOverdue ? 'bg-red-50/30 dark:bg-red-950/20' : ''}
                                                                        ${isPending ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''}
                                                                        ${isPaid ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''}
                                                                    `}
                                                                    onClick={() => onRecordPayment(commitment.id, monthDate.getFullYear(), monthDate.getMonth())}
                                                                >
                                                                    {/* GAP: No term for this period */}
                                                                    {!term && !isPaid ? (
                                                                        <div className="flex items-center justify-center h-full w-full text-slate-300 dark:text-slate-700 select-none" title="Sin término activo en este período">
                                                                            <Minus className="w-4 h-4 opacity-50" />
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
                                                                                                    <CheckCircleIcon className="w-3 h-3" />
                                                                                                    Pagado
                                                                                                </span>
                                                                                            ) : isOverdue ? (
                                                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 ring-1 ring-inset ring-red-500/20 px-2 py-0.5 rounded-full">
                                                                                                    <ExclamationTriangleIcon className="w-3 h-3" />
                                                                                                    Vencido
                                                                                                </span>
                                                                                            ) : isDisabled ? (
                                                                                                <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                                                                                                    <CalendarIcon className="w-3 h-3" />
                                                                                                    Futuro
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                                                                                                    <ClockIcon className="w-3 h-3" />
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
                                                                                                    `Venció hace ${daysOverdue} días`
                                                                                                ) : daysRemaining === 0 ? (
                                                                                                    'Vence hoy'
                                                                                                ) : isCurrentMonth(monthDate) ? (
                                                                                                    `Vence en ${daysRemaining} días`
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
                                                                                <div className="relative flex justify-center items-center h-full">
                                                                                    {isPaid ? (
                                                                                        <div
                                                                                            className="relative flex items-center justify-center w-full h-full cursor-pointer group/paid"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                onRecordPayment(commitment.id, monthDate.getFullYear(), monthDate.getMonth());
                                                                                            }}
                                                                                        >
                                                                                            {/* Check Icon (Default) - Scales down on hover */}
                                                                                            <div className={`
                                                                                                flex items-center justify-center transition-all duration-300 group-hover/cell:scale-0 group-hover/cell:opacity-0
                                                                                                ${paidOnTime ? 'text-emerald-400' : 'text-emerald-500'}
                                                                                            `}>
                                                                                                <CheckCircleIcon className="w-5 h-5" />
                                                                                            </div>

                                                                                            {/* Edit Icon (Hover) - Scales up */}
                                                                                            <div className="absolute inset-0 flex items-center justify-center transition-all duration-300 scale-0 opacity-0 group-hover/cell:scale-100 group-hover/cell:opacity-100 text-slate-500 dark:text-slate-400">
                                                                                                <EditIcon className="w-5 h-5" />
                                                                                            </div>
                                                                                        </div>
                                                                                    ) : (
                                                                                        /* For unpaid items, we show status icon that transforms to + on hover */
                                                                                        <div
                                                                                            className="relative flex items-center justify-center w-full h-full cursor-pointer"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                onRecordPayment(commitment.id, monthDate.getFullYear(), monthDate.getMonth());
                                                                                            }}
                                                                                        >
                                                                                            {/* Original Icon - Scales down on hover */}
                                                                                            <div className={`transition-all duration-300 group-hover/cell:scale-0 group-hover/cell:opacity-0 flex items-center justify-center
                                                                                                ${isOverdue ? 'text-red-500 animate-pulse' :
                                                                                                    isPending ? 'text-amber-500' :
                                                                                                        (installmentsCount && installmentsCount > 1) ? 'text-slate-500 dark:text-slate-400' :
                                                                                                            (hasPaymentRecord) ? 'text-slate-500 dark:text-slate-400' :
                                                                                                                'text-slate-700 dark:text-slate-600'}
                                                                                            `}>
                                                                                                {isOverdue ? <ExclamationTriangleIcon className="w-5 h-5" /> :
                                                                                                    isPending ? <ClockIcon className="w-5 h-5" /> :
                                                                                                        (installmentsCount && installmentsCount > 1) ? <CalendarIcon className="w-4 h-4" /> :
                                                                                                            <ClockIcon className={`w-5 h-5 ${!hasPaymentRecord ? 'opacity-40' : ''}`} />
                                                                                                }
                                                                                            </div>

                                                                                            {/* Plus Icon - Scales up on hover (siempre sky para acción) */}
                                                                                            <div className="absolute inset-0 flex items-center justify-center transition-all duration-300 scale-0 opacity-0 group-hover/cell:scale-100 group-hover/cell:opacity-100 text-sky-500">
                                                                                                <PlusIcon className="w-6 h-6 stroke-2" />
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </CompactTooltip>
                                                                        ) : (
                                                                            /* === FULL VIEW: All details === */
                                                                            <div
                                                                                className={`${pad} relative space-y-1 h-full flex flex-col justify-center cursor-pointer`}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (isPaid) {
                                                                                        onRecordPayment(commitment.id, monthDate.getFullYear(), monthDate.getMonth());
                                                                                    } else {
                                                                                        onRecordPayment(commitment.id, monthDate.getFullYear(), monthDate.getMonth());
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {/* Main amount - neutral colors */}
                                                                                <div className="font-semibold font-mono tabular-nums text-base text-slate-800 dark:text-slate-100">
                                                                                    {formatClp(displayAmount)}
                                                                                </div>
                                                                                {/* Original currency */}
                                                                                {showOriginalCurrency && (
                                                                                    <div className="text-xs text-slate-500 tabular-nums">
                                                                                        {originalCurrency} {perPeriodOriginal.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                    </div>
                                                                                )}
                                                                                {/* Due date */}
                                                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                                    {isPaid && currentPayment?.payment_date ?
                                                                                        `Pagado: ${new Date(currentPayment.payment_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}` :
                                                                                        `Vence: ${new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
                                                                                    }
                                                                                </div>
                                                                                {/* Cuota / Payment number info */}
                                                                                {cuotaNumber && installmentsCount && installmentsCount > 1 ? (
                                                                                    <div className="text-xs text-slate-500">
                                                                                        {term?.is_divided_amount ? 'Cuota' : 'Pago'} {cuotaNumber}/{installmentsCount}
                                                                                    </div>
                                                                                ) : term && term.effective_from && term.frequency === 'MONTHLY' && (!installmentsCount || installmentsCount <= 1) ? (
                                                                                    <div className="text-xs text-slate-500">
                                                                                        Pago {(() => {
                                                                                            // Parse date parts directly to avoid timezone issues
                                                                                            const [startYear, startMonth] = term.effective_from.split('-').map(Number);
                                                                                            const paymentNumber = (monthDate.getFullYear() - startYear) * 12 +
                                                                                                (monthDate.getMonth() + 1 - startMonth) + 1; // +1 for 0-indexed month
                                                                                            return paymentNumber > 0 ? paymentNumber : 1;
                                                                                        })()}/∞
                                                                                    </div>
                                                                                ) : null}
                                                                                {/* Status badge - enhanced styling */}
                                                                                {/* Status badge - enhanced styling with hover animation */}
                                                                                <div className="flex items-center justify-end min-h-[20px]">
                                                                                    {isPaid ? (
                                                                                        <div className="grid grid-cols-1 items-center justify-items-end group/badge">
                                                                                            {/* Default: Paid */}
                                                                                            <div className="col-start-1 row-start-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400
                                                                                                transition-all duration-300 group-hover/cell:opacity-0 group-hover/cell:scale-95 whitespace-nowrap">
                                                                                                {paidOnTime && <Sparkles className="w-3 h-3" />}
                                                                                                <CheckCircleIcon className="w-3.5 h-3.5" />
                                                                                                <span className="text-xs font-medium">Pagado</span>
                                                                                            </div>
                                                                                            {/* Hover: Edit */}
                                                                                            <div className="col-start-1 row-start-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300
                                                                                                transition-all duration-300 opacity-0 scale-95 group-hover/cell:opacity-100 group-hover/cell:scale-100 whitespace-nowrap">
                                                                                                <EditIcon className="w-3.5 h-3.5" />
                                                                                                <span className="text-xs font-medium">Editar</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    ) : isOverdue ? (
                                                                                        <div className="grid grid-cols-1 items-center justify-items-end group/badge">
                                                                                            {/* Default: Overdue */}
                                                                                            <div className="col-start-1 row-start-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100/80 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse
                                                                                                transition-all duration-300 group-hover/cell:opacity-0 group-hover/cell:scale-95 whitespace-nowrap">
                                                                                                <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                                                                                <span className="text-xs font-medium">Vencido ({daysOverdue}d)</span>
                                                                                            </div>
                                                                                            {/* Hover: Pay */}
                                                                                            <div className="col-start-1 row-start-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300
                                                                                                transition-all duration-300 opacity-0 scale-95 group-hover/cell:opacity-100 group-hover/cell:scale-100 whitespace-nowrap">
                                                                                                <PlusIcon className="w-3.5 h-3.5" />
                                                                                                <span className="text-xs font-medium">Registrar</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    ) : isPending && (isCurrentMonth(monthDate) || daysRemaining <= 45) ? (
                                                                                        <div className="grid grid-cols-1 items-center justify-items-end group/badge">
                                                                                            {/* Default: Pending */}
                                                                                            <div className="col-start-1 row-start-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100/80 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400
                                                                                                transition-all duration-300 group-hover/cell:opacity-0 group-hover/cell:scale-95 whitespace-nowrap">
                                                                                                <ClockIcon className="w-3.5 h-3.5" />
                                                                                                <span className="text-xs font-medium">{daysRemaining === 0 ? 'Vence hoy' : `En ${daysRemaining}d`}</span>
                                                                                            </div>
                                                                                            {/* Hover: Pay */}
                                                                                            <div className="col-start-1 row-start-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400
                                                                                                transition-all duration-300 opacity-0 scale-95 group-hover/cell:opacity-100 group-hover/cell:scale-100 whitespace-nowrap">
                                                                                                <PlusIcon className="w-3.5 h-3.5" />
                                                                                                <span className="text-xs font-medium">Registrar</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    ) : (
                                                                                        /* Future / Programado */
                                                                                        <div className="grid grid-cols-1 items-center justify-items-end group/badge">
                                                                                            {/* Default: Programado */}
                                                                                            <div className="col-start-1 row-start-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700
                                                                                                transition-all duration-300 group-hover/cell:opacity-0 group-hover/cell:scale-95 whitespace-nowrap">
                                                                                                <CalendarIcon className="w-3.5 h-3.5" />
                                                                                                <span className="text-xs font-medium">Programado</span>
                                                                                            </div>
                                                                                            {/* Hover: Register */}
                                                                                            <div className="col-start-1 row-start-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300
                                                                                                transition-all duration-300 opacity-0 scale-95 group-hover/cell:opacity-100 group-hover/cell:scale-100 whitespace-nowrap">
                                                                                                <PlusIcon className="w-3.5 h-3.5" />
                                                                                                <span className="text-xs font-medium">Registrar</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    ) : (
                                                                        <div className="text-slate-300 dark:text-slate-600">—</div>
                                                                    )}
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
                            <div className="flex items-center gap-1.5" title="Recurrente indefinido">
                                <InfinityIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                <span>Indefinido</span>
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
