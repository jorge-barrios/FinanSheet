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

import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import usePersistentState from '../hooks/usePersistentState';
import { useCommitments } from '../context/CommitmentsContext';
import { CommitmentService, PaymentService, getCurrentUserId } from '../services/dataService.v2';
import {
    EditIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon,
    CheckCircleIcon, ExclamationTriangleIcon, ClockIcon,
    CalendarIcon, InfinityIcon, HomeIcon, TransportIcon, DebtIcon, HealthIcon,
    SubscriptionIcon, MiscIcon, CategoryIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    StarIcon, IconProps, PauseIcon, PlusIcon, EyeIcon, EyeSlashIcon
} from './icons';
import type { CommitmentWithTerm, Payment, FlowType, Term } from '../types.v2';
import { periodToString } from '../types.v2';
import { parseDateString, extractYearMonth, getPerPeriodAmount } from '../utils/financialUtils.v2';
import { Sparkles, Link2, MoreVertical, Home } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================
const CompactTooltip = ({ children, content, triggerClassName, sideOffset = 5 }: { children: React.ReactNode, content: React.ReactNode, triggerClassName?: string, sideOffset?: number }) => (
    <Tooltip.Provider delayDuration={500} skipDelayDuration={0}>
        <Tooltip.Root disableHoverableContent={true}>
            <Tooltip.Trigger asChild>
                {/* Wrap in span to ensure ref passing if child is composite */}
                <span className={`h-full w-full block outline-none cursor-default ${triggerClassName || ''}`}>{children}</span>
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
    onRecordPayment: (commitmentId: string, year: number, month: number) => void;
    onFocusedDateChange?: (date: Date) => void;
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

/**
 * Get the active term for a commitment in a specific period/month
 * Supports multi-term commitments (paused/resumed, changed amounts, etc.)
 * 
 * FIX: Compares only year-month, ignoring day to avoid off-by-one month errors
 * when effective_from has day > 1 (e.g., "2025-12-09" should match Dec 2025)
 */
const getTermForPeriod = (commitment: CommitmentWithTerm, monthDate: Date): Term | null => {
    const all_terms = commitment.all_terms || [];
    if (all_terms.length === 0) return commitment.active_term; // Fallback

    // Extract year-month from target period (ignore day)
    const periodYearMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

    // Find term where start year-month <= period year-month <= end year-month
    const term = all_terms.find(t => {
        const termStartYearMonth = t.effective_from.substring(0, 7); // "2025-12"
        const termEndYearMonth = t.effective_until?.substring(0, 7) || null; // "2026-06" or null

        const startMatches = termStartYearMonth <= periodYearMonth;
        const endMatches = termEndYearMonth === null || termEndYearMonth >= periodYearMonth;

        return startMatches && endMatches;
    });

    return term || null;
};


// =============================================================================
// COMPONENT
// =============================================================================

const ExpenseGridVirtual2: React.FC<ExpenseGridV2Props> = ({
    focusedDate,
    onEditCommitment,
    onDeleteCommitment,
    onPauseCommitment,
    onRecordPayment,
    onFocusedDateChange,
    preloadedCommitments,
    preloadedPayments,
}) => {
    const { t, language } = useLocalization();
    const { getMonthTotals } = useCommitments();

    // State - use preloaded data if available for instant rendering
    const [commitments, setCommitments] = useState<CommitmentWithTerm[]>(preloadedCommitments || []);
    const [payments, setPayments] = useState<Map<string, Payment[]>>(preloadedPayments || new Map());
    const [loading, setLoading] = useState(!preloadedCommitments); // Not loading if preloaded
    const [error, setError] = useState<string | null>(null);

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

    const pad = useMemo(() =>
        density === 'compact' ? 'p-1' : 'p-3',
        [density]
    );

    // Layout refs
    const scrollAreaRef = useRef<HTMLDivElement | null>(null);
    const [availableHeight, setAvailableHeight] = useState<number>(400);
    const footerRef = useRef<HTMLDivElement | null>(null);

    // ==========================================================================
    // DATA FETCHING - PROGRESSIVE LOADING
    // ==========================================================================

    // Track loaded data to avoid unnecessary refetches
    const lastLoadedYearRef = useRef<number | null>(null);
    const fullYearLoadedRef = useRef<boolean>(false);

    useEffect(() => {
        const currentYear = focusedDate.getFullYear();
        const currentMonth = focusedDate.getMonth();

        // Use preloaded data from App.tsx if available
        // This also reacts to changes in preloaded data (hot reload after mutations)
        if (preloadedCommitments && preloadedCommitments.length > 0) {
            setCommitments(preloadedCommitments);
            if (preloadedPayments) {
                setPayments(preloadedPayments);
            }
            setLoading(false);
            fullYearLoadedRef.current = true;
            lastLoadedYearRef.current = currentYear;
            return;
        }

        // Skip if we already loaded this year's data fully (only when not using preloaded)
        if (lastLoadedYearRef.current === currentYear && commitments.length > 0 && fullYearLoadedRef.current) {
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                const userId = await getCurrentUserId();
                if (!userId) {
                    setError('No user logged in');
                    return;
                }

                // === PHASE 1: Load commitments + visible months only (FAST) ===
                const commitmentsData = await CommitmentService.getCommitmentsWithTerms(userId);
                setCommitments(commitmentsData);

                // Calculate visible months range (current month ± 3 months for initial load)
                const visibleStart = new Date(currentYear, currentMonth - 3, 1);
                const visibleEnd = new Date(currentYear, currentMonth + 4, 1);
                const startDate = `${visibleStart.getFullYear()}-${String(visibleStart.getMonth() + 1).padStart(2, '0')}-01`;
                const endDate = `${visibleEnd.getFullYear()}-${String(visibleEnd.getMonth() + 1).padStart(2, '0')}-01`;

                const visiblePayments = await PaymentService.getPaymentsByDateRange(userId, startDate, endDate);

                // Group payments by commitment_id
                const paymentsByCommitment = new Map<string, Payment[]>();
                visiblePayments.forEach(p => {
                    const existing = paymentsByCommitment.get(p.commitment_id) || [];
                    paymentsByCommitment.set(p.commitment_id, [...existing, p]);
                });

                setPayments(paymentsByCommitment);
                setLoading(false); // Show UI immediately
                lastLoadedYearRef.current = currentYear;

                // === PHASE 2: Load full year in background (DEFERRED) ===
                setTimeout(async () => {
                    try {
                        const yearStart = `${currentYear}-01-01`;
                        const yearEnd = `${currentYear + 1}-01-01`;

                        const allPayments = await PaymentService.getPaymentsByDateRange(userId, yearStart, yearEnd);

                        const fullPaymentsByCommitment = new Map<string, Payment[]>();
                        allPayments.forEach(p => {
                            const existing = fullPaymentsByCommitment.get(p.commitment_id) || [];
                            fullPaymentsByCommitment.set(p.commitment_id, [...existing, p]);
                        });

                        setPayments(fullPaymentsByCommitment);
                        fullYearLoadedRef.current = true;
                    } catch (err) {
                        console.error('Background fetch error:', err);
                        // Don't set error - we already have visible data
                    }
                }, 100); // Small delay to let UI render first

            } catch (err) {
                console.error('Grid v2 fetch error:', err);
                setError(err instanceof Error ? err.message : 'Failed to load data');
                setLoading(false);
            }
        };

        fetchData();
    }, [focusedDate.getFullYear(), preloadedCommitments, preloadedPayments]);

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
        const periodStr = periodToString({ year: monthDate.getFullYear(), month: monthDate.getMonth() + 1 });

        const payment = commitmentPayments.find(p => {
            const pPeriod = p.period_date.substring(0, 7);
            return pPeriod === periodStr;
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
                paidOnTime
            };
        }

        return { isPaid: false, amount: null, paymentDate: null, paidOnTime: false };
    }, [payments]);

    // Smart Sort Function
    const getCommitmentSortData = useCallback((c: CommitmentWithTerm, monthDate: Date) => {
        const term = getTermForPeriod(c, monthDate);
        const dueDay = term?.due_day_of_month ?? 32; // 32 = end of list if no active term
        const { isPaid, amount: paidAmount } = getPaymentStatus(c.id, monthDate, dueDay);

        const today = new Date();
        const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);

        // Check for recently created (Last 5 minutes)
        // This ensures the user sees what they just created
        const createdAt = new Date(c.created_at);
        const isRecentlyCreated = (today.getTime() - createdAt.getTime()) < 5 * 60 * 1000; // 5 mins

        // Status Priority:
        // -2: Recently Created (Immediate Feedback)
        // -1: Important (User flagged)
        // 0: Overdue (Critical) - Not Paid, Past Due, Current/Past Month
        // 1: Pending (Actionable) - Not Paid, Future Due or Current Month
        // 2: Paid (Done)

        let statusPriority = 1; // Default to Pending

        if (isRecentlyCreated && !isPaid) {
            statusPriority = -2; // Top Priority (New)
        } else if (c.is_important && !isPaid) {
            statusPriority = -1; // Second Priority (Important)
        } else if (isPaid) {
            statusPriority = 2;
        } else if (dueDate < today && monthDate <= today) {
            statusPriority = 0; // Overdue
        }

        // Amount for sorting (Descending importance)
        const amount = paidAmount ?? term?.amount_in_base ?? term?.amount_original ?? 0;

        return { statusPriority, dueDay, amount, name: c.name };
    }, [getPaymentStatus]);

    const performSmartSort = useCallback((a: CommitmentWithTerm, b: CommitmentWithTerm) => {
        const dataA = getCommitmentSortData(a, focusedDate);
        const dataB = getCommitmentSortData(b, focusedDate);

        // 1. Status Priority (Ascending: 0=Overdue, 1=Pending, 2=Paid)
        if (dataA.statusPriority !== dataB.statusPriority) {
            return dataA.statusPriority - dataB.statusPriority;
        }

        // 2. Due Day (Ascending)
        if (dataA.dueDay !== dataB.dueDay) {
            return dataA.dueDay - dataB.dueDay;
        }

        // 3. Amount (Descending - Higher value first)
        // Only if amount differs significantly
        if (Math.abs(dataA.amount - dataB.amount) > 0.01) {
            return dataB.amount - dataA.amount;
        }

        // 4. Name (Alphabetical)
        return dataA.name.localeCompare(b.name, language === 'es' ? 'es' : 'en');
    }, [getCommitmentSortData, focusedDate, language]);

    // Group commitments by category (for grid view)
    // Hybrid Strategy:
    // - Compact View: Treat as flat list (single 'All' group) to enforce strict Priority Sorting (Overdue > Pending)
    // - Detailed View: Maintain Category Grouping, but sort Groups by Urgency
    const groupedCommitments = useMemo(() => {
        // 1. Filter active terms & selected category
        const activeItems: CommitmentWithTerm[] = [];

        commitments.forEach(c => {
            const term = c.active_term;
            // Check if commitment is active or should be shown (terminated toggle)
            const isActive = showTerminated || !term?.effective_until || new Date(term.effective_until) >= new Date();

            if (!isActive) return;

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
                    ? Math.min(...sortedItems.map(c => getCommitmentSortData(c, focusedDate).statusPriority))
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
    }, [commitments, showTerminated, selectedCategory, t, language, performSmartSort, getCommitmentSortData, focusedDate, density]);

    // Available categories for filter tabs (derived from all non-terminated commitments)
    const availableCategories = useMemo(() => {
        const categorySet = new Set<string>();
        const nonTerminated = commitments.filter(c => {
            const term = c.active_term;
            if (!term?.effective_until) return true;
            const endDate = new Date(term.effective_until);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return endDate >= today;
        });
        nonTerminated.forEach(c => {
            categorySet.add(getTranslatedCategoryName(c));
        });
        const hasImportant = nonTerminated.some(c => c.is_important);
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

    // Check if commitment is terminated (has effective_until in the past)
    const isCommitmentTerminated = (commitment: CommitmentWithTerm): boolean => {
        const term = commitment.active_term;
        if (!term?.effective_until) return false;
        const endDate = new Date(term.effective_until);
        const today = new Date();
        return endDate < today;
    };

    // Check if commitment is paused/scheduled to end (manually paused, not installments or fixed-term)
    const isCommitmentPaused = (commitment: CommitmentWithTerm): boolean => {
        const term = commitment.active_term;
        if (!term?.effective_until) return false;

        // Exclude installment-based commitments (they naturally have an end date)
        if (term.installments_count && term.installments_count > 1) return false;

        // Exclude one-time payments (frequency ONCE)
        if (term.frequency === 'ONCE') return false;

        // For MONTHLY with no installments, having effective_until means it was paused
        const endDate = new Date(term.effective_until);
        const today = new Date();
        return endDate >= today; // Has end date but hasn't passed yet = paused
    };

    // Check if commitment is active in a given month based on frequency
    const isActiveInMonth = (commitment: CommitmentWithTerm, monthDate: Date): boolean => {
        const term = commitment.active_term;
        if (!term) return false;

        // Use extractYearMonth to avoid timezone issues
        const { year: startYear, month: startMonth } = extractYearMonth(term.effective_from);
        const startDate = new Date(startYear, startMonth - 1, 1);
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

        if (startDate > monthEnd) return false;
        if (term.effective_until) {
            const { year: endYear, month: endMonth } = extractYearMonth(term.effective_until);
            const endDate = new Date(endYear, endMonth - 1, 1);
            if (endDate < monthStart) return false;
        }

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
    };


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
            <div className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/50 shadow-sm transition-all duration-200">
                {/* Single Row Layout: Navigation | Totals (lg only) | Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 md:p-4">
                    {/* Left: Navigation Group */}
                    <div className="flex items-center gap-2">
                        {/* Today button - Visible en mobile también */}
                        <button
                            onClick={() => onFocusedDateChange && onFocusedDateChange(new Date())}
                            disabled={isCurrentMonth(focusedDate)}
                            className={`flex items-center justify-center px-2.5 sm:px-3 py-2 rounded-lg text-sm font-medium transition-all ${isCurrentMonth(focusedDate)
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
                                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 ring-1 ring-slate-200 dark:ring-slate-600 shadow-sm active:scale-95'
                                }`}
                            title="Ir a hoy"
                        >
                            <Home className="w-4 h-4" />
                            <span className="hidden sm:inline ml-2">Hoy</span>
                        </button>

                        {/* Unified Month + Year Navigator */}
                        <div className="flex items-center bg-white dark:bg-slate-700 rounded-lg ring-1 ring-slate-200 dark:ring-slate-600 shadow-sm">
                            <button
                                onClick={() => {
                                    const newDate = new Date(focusedDate);
                                    newDate.setMonth(newDate.getMonth() - 1);
                                    onFocusedDateChange && onFocusedDateChange(newDate);
                                }}
                                className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-l-lg transition-colors active:scale-95"
                            >
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                            <div className="px-3 sm:px-4 py-2 text-center min-w-[100px] sm:min-w-[140px] border-x border-slate-200 dark:border-slate-600">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                                    {focusedDate.toLocaleDateString('es-ES', { month: 'short' })} {focusedDate.getFullYear()}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    const newDate = new Date(focusedDate);
                                    newDate.setMonth(newDate.getMonth() + 1);
                                    onFocusedDateChange && onFocusedDateChange(newDate);
                                }}
                                className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-r-lg transition-colors active:scale-95"
                            >
                                <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Terminated Toggle (Mobile only in nav row) */}
                        {terminatedCount > 0 && (
                            <button
                                onClick={() => setShowTerminated(!showTerminated)}
                                className={`
                                    lg:hidden flex items-center justify-center px-2.5 py-2 rounded-lg text-xs font-medium transition-all
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
                    <div className="hidden lg:flex items-center gap-2">
                        {/* Terminated Toggle (Desktop - grouped with density) */}
                        {terminatedCount > 0 && (
                            <button
                                onClick={() => setShowTerminated(!showTerminated)}
                                className={`
                                    flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all
                                    ${showTerminated
                                        ? 'bg-slate-800 text-white shadow-md ring-1 ring-slate-700'
                                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                                    }
                                `}
                                title={showTerminated ? 'Ocultar terminados' : 'Mostrar terminados'}
                            >
                                {showTerminated ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
                                <span>{showTerminated ? 'Ocultar' : 'Ver'} terminados ({terminatedCount})</span>
                            </button>
                        )}

                        {/* Density Selector */}
                        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 shadow-inner">
                            {(['compact', 'medium'] as const).map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setDensity(d)}
                                    className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 ${density === d
                                        ? 'bg-sky-500 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                >
                                    {d === 'compact' ? 'Compacta' : 'Detallada'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Row 2: KPIs Mobile Redesign (< lg) - Pendiente como héroe */}
                {(() => {
                    const totals = getMonthTotals(focusedDate.getFullYear(), focusedDate.getMonth());
                    return (
                        <div className="lg:hidden px-4 py-4 bg-gradient-to-b from-slate-50/80 to-white/60 dark:from-slate-800/80 dark:to-slate-900/60 border-t border-slate-200/50 dark:border-slate-700/50">
                            {/* KPI Héroe: Pendiente */}
                            <div className="text-center mb-4">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                                    Pendiente
                                </p>
                                <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                                    {formatClp(totals.pendiente)}
                                </p>
                            </div>

                            {/* KPIs Secundarios */}
                            <div className="flex items-center justify-center gap-3 mb-4">
                                <div className="flex-1 bg-white/60 dark:bg-slate-800/60 rounded-xl px-3 py-2 text-center border border-slate-200/50 dark:border-slate-700/50">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Comprometido</p>
                                    <p className="text-sm font-bold font-mono tabular-nums text-slate-700 dark:text-slate-200">
                                        {formatClp(totals.comprometido)}
                                    </p>
                                </div>
                                <div className="flex-1 bg-white/60 dark:bg-slate-800/60 rounded-xl px-3 py-2 text-center border border-slate-200/50 dark:border-slate-700/50">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pagado</p>
                                    <p className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                                        {formatClp(totals.pagado)}
                                    </p>
                                </div>
                            </div>

                            {/* Filtros de categoría con scroll horizontal */}
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                                {availableCategories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`
                                            flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap
                                            transition-all duration-200
                                            ${selectedCategory === cat
                                                ? 'bg-sky-500 text-white shadow-sm'
                                                : 'bg-white/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200/50 dark:ring-slate-600/50'
                                            }
                                        `}
                                    >
                                        {cat === 'all' ? 'Todos' : cat === 'FILTER_IMPORTANT' ? 'Importantes' : cat}
                                        <span className={`ml-1 ${selectedCategory === cat ? 'opacity-80' : 'opacity-50'}`}>
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
                    );
                })()}
            </div>

            {/* Mobile View */}
            <div className="lg:hidden p-4 space-y-4">
                {(() => {
                    // Filter commitments for mobile (same logic as desktop groupedCommitments)
                    const checkTerminated = (c: CommitmentWithTerm): boolean => {
                        const term = c.active_term;
                        if (!term) return true; // No active term = effectively terminated/expired
                        if (!term.effective_until) return false; // Infinite term
                        const endDate = new Date(term.effective_until);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return endDate < today;
                    };

                    const filteredCommitments = (showTerminated
                        ? commitments
                        : commitments.filter(c => !checkTerminated(c))
                    ).filter(c => {
                        // Aplicar filtro de categoría
                        if (selectedCategory === 'all') return true;
                        if (selectedCategory === 'FILTER_IMPORTANT') return c.is_important;
                        return getTranslatedCategoryName(c) === selectedCategory;
                    }).sort(performSmartSort);

                    return filteredCommitments.length > 0 ? filteredCommitments.map(c => {
                        // Sync logic with desktop cells
                        const monthDate = focusedDate;
                        const term = getTermForPeriod(c, monthDate);
                        const dueDay = term?.due_day_of_month ?? 1;
                        const { isPaid, amount: paidAmount } = getPaymentStatus(c.id, monthDate, dueDay);

                        const commitmentPayments = payments.get(c.id) || [];
                        const periodStr = periodToString({ year: monthDate.getFullYear(), month: monthDate.getMonth() + 1 });
                        const hasPaymentRecord = commitmentPayments.some(p => p.period_date.substring(0, 7) === periodStr);

                        // Calculation logic exactly like desktop
                        const totalAmount = term?.amount_in_base ?? term?.amount_original ?? 0;
                        const installmentsCount = term?.installments_count ?? null;
                        const perPeriodAmount = term?.is_divided_amount && installmentsCount && installmentsCount > 1
                            ? totalAmount / installmentsCount
                            : totalAmount;

                        const amount = (hasPaymentRecord && paidAmount !== null) ? paidAmount : perPeriodAmount;

                        const today = new Date();
                        const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
                        const isOverdue = !isPaid && dueDate < today && monthDate <= today;

                        // Cálculos consistentes con tooltip desktop
                        const daysOverdue = isOverdue
                            ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                            : 0;
                        const daysRemaining = !isOverdue
                            ? Math.max(0, Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
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

                        // Payment record para fecha de pago
                        const currentPayment = commitmentPayments.find(p => p.period_date.substring(0, 7) === periodStr);

                        return (
                            <div
                                key={c.id}
                                onClick={() => !isPaid && onRecordPayment(c.id, monthDate.getFullYear(), monthDate.getMonth())}
                                className={`
                                    relative overflow-hidden rounded-2xl
                                    transition-all duration-300
                                    ${!isPaid ? 'active:scale-[0.98] cursor-pointer' : ''}

                                    /* Finance Premium: Base "Liquid Glass" */
                                    bg-white/90 dark:bg-slate-800/80
                                    backdrop-blur-md
                                    border border-white/50 dark:border-white/10
                                    shadow-sm dark:shadow-lg dark:shadow-slate-900/20

                                    /* Flujo via borde izquierdo (3px) */
                                    border-l-[3px]
                                    ${c.flow_type === 'INCOME' ? 'border-l-emerald-500' : 'border-l-rose-500'}

                                    hover:shadow-md hover:-translate-y-0.5
                                `}
                            >
                                <div className="p-4 pl-3.5">
                                    {/* Header: Nombre + Categoría + Menu */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-slate-900 dark:text-white truncate">
                                                    {c.name}
                                                    {/* New Item Badge Mobile */}
                                                    {((new Date().getTime() - new Date(c.created_at).getTime()) < 5 * 60 * 1000) && (
                                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 animate-pulse">
                                                            NUEVO
                                                        </span>
                                                    )}
                                                </span>
                                                {c.is_important && <StarIcon className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                                            </div>
                                            {/* Categoría + Cuota info */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-800 dark:text-slate-200 font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700/80 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600/50">
                                                    {getTranslatedCategoryName(c)}
                                                </span>
                                                {cuotaNumber && installmentsCount && installmentsCount > 1 && (
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                                        {term?.is_divided_amount ? 'Cuota' : 'Pago'} {cuotaNumber}/{installmentsCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Mobile Actions Menu */}
                                        <div className="ml-2 shrink-0">
                                            <DropdownMenu.Root>
                                                <DropdownMenu.Trigger asChild>
                                                    <button
                                                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>
                                                </DropdownMenu.Trigger>
                                                <DropdownMenu.Portal>
                                                    <DropdownMenu.Content
                                                        className="z-[100] min-w-[160px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-1.5 animate-in fade-in zoom-in duration-200"
                                                        align="end"
                                                        sideOffset={5}
                                                    >
                                                        <DropdownMenu.Item
                                                            className="group flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer outline-none transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onEditCommitment(c);
                                                            }}
                                                        >
                                                            <EditIcon className="w-4 h-4 text-slate-400 group-hover:text-sky-500" />
                                                            Editar compromiso
                                                        </DropdownMenu.Item>

                                                        <DropdownMenu.Item
                                                            className="group flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer outline-none transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onPauseCommitment(c);
                                                            }}
                                                        >
                                                            <PauseIcon className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                                                            Pausar / Terminar
                                                        </DropdownMenu.Item>

                                                        <DropdownMenu.Separator className="h-px bg-slate-200 dark:bg-slate-700 my-1.5" />

                                                        <DropdownMenu.Item
                                                            className="group flex items-center gap-2 px-3 py-2.5 text-sm text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer outline-none transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onDeleteCommitment(c.id);
                                                            }}
                                                        >
                                                            <TrashIcon className="w-4 h-4 text-rose-400 group-hover:text-rose-600" />
                                                            Eliminar
                                                        </DropdownMenu.Item>
                                                    </DropdownMenu.Content>
                                                </DropdownMenu.Portal>
                                            </DropdownMenu.Root>
                                        </div>
                                    </div>

                                    {/* Centro: Badge prominente + Monto (consistente con Dashboard/Grid) */}
                                    <div className="flex items-center justify-between">
                                        {/* Badge de estado - estilo Grid Full View: text-xs font-medium, rounded-full */}
                                        <div
                                            className={`
                                                flex items-center gap-1 px-2 py-0.5 rounded-full
                                                ${isPaid
                                                    ? 'bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                                    : isOverdue
                                                        ? 'bg-red-100/80 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                                        : 'bg-amber-100/80 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}
                                            `}
                                            aria-label={isPaid ? 'Pagado' : isOverdue ? 'Vencido' : 'Pendiente'}
                                            role="status"
                                        >
                                            {isPaid ? <CheckCircleIcon className="w-3.5 h-3.5" />
                                                : isOverdue ? <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                                    : <ClockIcon className="w-3.5 h-3.5" />}
                                            <span className="text-xs font-medium">
                                                {isPaid ? 'Pagado' : isOverdue ? 'Vencido' : 'Pendiente'}
                                            </span>
                                        </div>

                                        {/* Monto - protagonista, más grande que grid */}
                                        <div className="text-right">
                                            <p className="text-lg font-bold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                                                {formatClp(amount ?? 0)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Footer: Fecha relativa + CTA corto */}
                                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {isPaid && currentPayment?.payment_date ? (
                                                `Pagado: ${new Date(currentPayment.payment_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
                                            ) : isOverdue ? (
                                                `Venció hace ${daysOverdue} días`
                                            ) : daysRemaining === 0 ? (
                                                'Vence hoy'
                                            ) : (
                                                `Vence en ${daysRemaining} días`
                                            )}
                                        </span>
                                        {!isPaid && (
                                            <span className="text-xs text-sky-500 dark:text-sky-400 font-medium">
                                                Registrar →
                                            </span>
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
            </div>

            {/* Desktop View Content */}
            <div className="hidden lg:block px-4">
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
                                <thead className="sticky top-0 z-40 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm border-b-2 border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className={`sticky left-0 z-50 bg-slate-50 dark:bg-slate-800 text-left font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 ${density === 'compact' ? 'px-3 py-2 min-w-[140px] max-w-[300px] w-auto text-sm' : 'p-3 min-w-[220px]'}`}>
                                            Compromiso
                                        </th>
                                        {visibleMonths.map((month, i) => (
                                            <th
                                                key={i}
                                                id={`month-header-${i}`}
                                                className={`text-center font-semibold border-r border-slate-200 dark:border-slate-700 last:border-r-0 ${density === 'compact' ? 'px-2 py-2 min-w-[55px] text-sm' : 'p-2.5 min-w-[120px]'} ${isCurrentMonth(month)
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
                                                const terminated = isCommitmentTerminated(commitment);
                                                const paused = isCommitmentPaused(commitment);
                                                const flowColor = commitment.flow_type === 'INCOME' ? 'border-l-emerald-500' : 'border-l-red-500';
                                                return (
                                                    <tr
                                                        key={commitment.id}
                                                        className={`
                                                            group
                                                            border-b border-slate-200/80 dark:border-slate-700/50 
                                                            transition-all duration-200 ease-out
                                                            
                                                            ${terminated ? 'bg-slate-50/50 dark:bg-slate-800/30 opacity-60' : ''}
                                                        `}
                                                    >
                                                        {/* Name cell with flow-type accent - Merged with Category for Compact */}
                                                        <td className={`
                                                            sticky left-0 z-20 border-l-3 ${flowColor}
                                                            ${terminated ? 'bg-slate-50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-900'} 
                                                            group-hover:bg-blue-50 dark:group-hover:bg-slate-800 cursor-pointer
                                                            border-r border-slate-200 dark:border-slate-700/50
                                                            ${density === 'compact' ? 'px-3 py-2 min-w-[140px] max-w-[300px] w-auto' : pad}
                                                        `}>
                                                            {density === 'compact' ? (
                                                                /* Compact: Single Line Layout -> Name (Left) ... Details (Right) + ACTIONS */
                                                                <div
                                                                    className="flex items-center justify-between gap-3 relative pr-8 cursor-pointer group/compact h-full min-h-[32px]"
                                                                    onClick={() => onEditCommitment(commitment)}
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
                                                                            {/* Paused Badge */}
                                                                            {paused && !terminated && (
                                                                                <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                                                                                    <PauseIcon className="w-2.5 h-2.5" />
                                                                                    PAUSADO
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
                                                                                    className="min-w-[160px] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                                                                                    sideOffset={5}
                                                                                    align="end"
                                                                                    onCloseAutoFocus={(e) => e.preventDefault()}
                                                                                >
                                                                                    <DropdownMenu.Item
                                                                                        className="group flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer outline-none"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onEditCommitment(commitment);
                                                                                        }}
                                                                                    >
                                                                                        <EditIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                                                                                        Editar
                                                                                    </DropdownMenu.Item>

                                                                                    <DropdownMenu.Item
                                                                                        className="group flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer outline-none"
                                                                                        disabled={terminated}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onPauseCommitment(commitment);
                                                                                        }}
                                                                                    >
                                                                                        <PauseIcon className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                                                                                        {terminated ? 'Terminado' : 'Pausar'}
                                                                                    </DropdownMenu.Item>

                                                                                    <DropdownMenu.Separator className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

                                                                                    <DropdownMenu.Item
                                                                                        className="group flex items-center gap-2 px-2 py-1.5 text-sm text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer outline-none"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onDeleteCommitment(commitment.id);
                                                                                        }}
                                                                                    >
                                                                                        <TrashIcon className="w-4 h-4 group-hover:text-red-600" />
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
                                                                        onClick={() => onEditCommitment(commitment)}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            {commitment.flow_type === 'INCOME' ? (
                                                                                <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
                                                                            ) : (
                                                                                <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />
                                                                            )}
                                                                            <span className={`font-medium ${terminated ? 'line-through text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>{commitment.name}</span>
                                                                            {commitment.is_important && <StarIcon className="w-4 h-4 text-amber-500" />}
                                                                            {commitment.linked_commitment_id && (() => {
                                                                                const linkedCommitment = commitments.find(c => c.id === commitment.linked_commitment_id);
                                                                                if (!linkedCommitment) return null;

                                                                                // Get current month for calculating actual NET
                                                                                const now = new Date();
                                                                                const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                                                                                // Get actual amount for this commitment (payment or projected)
                                                                                const myPayments = payments.get(commitment.id) || [];
                                                                                const myPayment = myPayments.find(p => p.period_date.substring(0, 7) === currentPeriod);
                                                                                const myAmount = myPayment?.amount_in_base ?? (commitment.active_term ? getPerPeriodAmount(commitment.active_term, true) : 0);

                                                                                // Get actual amount for linked commitment
                                                                                const linkedPayments = payments.get(linkedCommitment.id) || [];
                                                                                const linkedPayment = linkedPayments.find(p => p.period_date.substring(0, 7) === currentPeriod);
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
                                                                            {paused && !terminated && (
                                                                                <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded flex items-center gap-1">
                                                                                    <PauseIcon className="w-3 h-3" />
                                                                                    Pausado
                                                                                </span>
                                                                            )}
                                                                            {terminated && (
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
                                                                                    ? <InfinityIcon className="w-4 h-4" />
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
                                                                                                ? 'Indefinido'
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
                                                                                    className="min-w-[160px] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                                                                                    sideOffset={5}
                                                                                    align="end"
                                                                                >
                                                                                    <DropdownMenu.Item
                                                                                        className="group flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer outline-none"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onEditCommitment(commitment);
                                                                                        }}
                                                                                    >
                                                                                        <EditIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                                                                                        Editar
                                                                                    </DropdownMenu.Item>

                                                                                    <DropdownMenu.Item
                                                                                        className="group flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer outline-none"
                                                                                        disabled={terminated}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onPauseCommitment(commitment);
                                                                                        }}
                                                                                    >
                                                                                        <PauseIcon className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                                                                                        {terminated ? 'Terminado' : 'Pausar'}
                                                                                    </DropdownMenu.Item>

                                                                                    <DropdownMenu.Separator className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

                                                                                    <DropdownMenu.Item
                                                                                        className="group flex items-center gap-2 px-2 py-1.5 text-sm text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer outline-none"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onDeleteCommitment(commitment.id);
                                                                                        }}
                                                                                    >
                                                                                        <TrashIcon className="w-4 h-4 group-hover:text-red-600" />
                                                                                        Eliminar {commitment.flow_type === 'INCOME' ? 'Ingreso' : 'Gasto'}
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
                                                            const { isPaid, amount: paidAmount, paidOnTime } = getPaymentStatus(commitment.id, monthDate, dueDay);

                                                            // Check if there's a payment record (even if not marked as paid)
                                                            // Check if there's a payment record (even if not marked as paid)
                                                            const commitmentPayments = payments.get(commitment.id) || [];
                                                            const periodStr = periodToString({ year: monthDate.getFullYear(), month: monthDate.getMonth() + 1 });
                                                            const currentPayment = commitmentPayments.find(p => p.period_date.substring(0, 7) === periodStr);
                                                            const hasPaymentRecord = !!currentPayment;

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
                                                            const isOverdue = !isPaid && dueDate < today && monthDate <= today;
                                                            const isPending = !isPaid && !isOverdue && isCurrentMonth(monthDate);

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
                                                                        text-right border-r border-slate-200/80 dark:border-slate-700/50 last:border-r-0 
                                                                        cursor-pointer transition-all duration-150 ease-out group/cell
                                                                        hover:ring-2 hover:ring-inset hover:ring-indigo-500/50 dark:hover:ring-indigo-400/50
                                                                        ${isCurrentMonth(monthDate) ? 'bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-inset ring-blue-500/10' : ''}
                                                                        ${isDisabled ? 'opacity-25 grayscale hover:opacity-100 hover:grayscale-0' : ''}
                                                                        ${isOverdue ? 'bg-red-50/50 dark:bg-red-950/20' : ''}
                                                                        ${isPending ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}
                                                                        ${isPaid ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''}
                                                                    `}
                                                                    onClick={() => onRecordPayment(commitment.id, monthDate.getFullYear(), monthDate.getMonth())}
                                                                >
                                                                    {/* GAP: No term for this period */}
                                                                    {!term && !isPaid ? (
                                                                        <div className="text-slate-400 dark:text-slate-600 font-mono tabular-nums text-base" title="Sin término activo en este período">
                                                                            —
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
                                                                                                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">
                                                                                                    <CheckCircleIcon className="w-3 h-3" />
                                                                                                    Pagado
                                                                                                </span>
                                                                                            ) : isOverdue ? (
                                                                                                <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-100/80 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full">
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
