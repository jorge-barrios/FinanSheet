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
import type { CommitmentWithTerm, Payment, FlowType } from '../types.v2';
import { periodToString } from '../types.v2';
import { parseDateString, extractYearMonth, getPerPeriodAmount } from '../utils/financialUtils.v2';
import { findTermForPeriod } from '../utils/termUtils';
import { Sparkles, Link2, MoreVertical, Home, Minus } from 'lucide-react';
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
                const commitmentPayments = payments.get(c.id) || [];
                const hasPaymentInRange = visibleMonths.some(m => {
                    const periodStr = periodToString({ year: m.getFullYear(), month: m.getMonth() + 1 });
                    return commitmentPayments.some(p => p.period_date.substring(0, 7) === periodStr);
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
            const commitmentPayments = payments.get(c.id) || [];
            const hasPaymentInRange = visibleMonths.some(m => {
                const periodStr = periodToString({ year: m.getFullYear(), month: m.getMonth() + 1 });
                return commitmentPayments.some(p => p.period_date.substring(0, 7) === periodStr);
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

                {/* Row 2: KPIs Mobile Redesign (< lg) - Bento Style */}
                {(() => {
                    const totals = getMonthTotals(focusedDate.getFullYear(), focusedDate.getMonth());
                    return (
                        <div className="lg:hidden px-6 py-6 space-y-6">
                            {/* KPI Héroe: Pendiente - Glass Card */}
                            <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 to-orange-500/5 dark:from-amber-900/40 dark:to-orange-900/10 rounded-3xl border border-amber-100/50 dark:border-amber-500/20 p-6 text-center shadow-lg backdrop-blur-xl">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <ClockIcon className="w-24 h-24 text-amber-500" />
                                </div>
                                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2">
                                    Pendiente por pagar
                                </p>
                                <p className="text-4xl font-black font-mono tracking-tighter text-amber-600 dark:text-amber-300 drop-shadow-sm">
                                    {formatClp(totals.pendiente)}
                                </p>
                            </div>

                            {/* KPIs Secundarios - Bento Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 text-center border border-white/50 dark:border-white/10 shadow-sm">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Comprometido</p>
                                    <p className="text-lg font-bold font-mono text-slate-700 dark:text-slate-200">
                                        {formatClp(totals.comprometido)}
                                    </p>
                                </div>
                                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 backdrop-blur-md rounded-2xl p-4 text-center border border-emerald-100/50 dark:border-emerald-500/10 shadow-sm">
                                    <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider mb-1">Pagado</p>
                                    <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                                        {formatClp(totals.pagado)}
                                    </p>
                                </div>
                            </div>

                            {/* Filtros de categoría con scroll horizontal mejorado */}
                            <div className="-mx-6 px-6">
                                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
                                    {availableCategories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setSelectedCategory(cat)}
                                            className={`
                                                flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap
                                                transition-all duration-300 ease-out border
                                                ${selectedCategory === cat
                                                    ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105'
                                                    : 'bg-white/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-white/20 dark:border-white/5 hover:bg-white hover:shadow-sm'
                                                }
                                                backdrop-blur-sm
                                            `}
                                        >
                                            {cat === 'all' ? 'Todos' : cat === 'FILTER_IMPORTANT' ? 'Importantes' : cat}
                                            {selectedCategory === cat && (
                                                <span className="ml-1.5 opacity-70 font-normal">
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
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Mobile View */}
            <div className="lg:hidden p-4 space-y-4">
                {(() => {
                    const periodStr = periodToString({ year: focusedDate.getFullYear(), month: focusedDate.getMonth() + 1 });

                    const filteredCommitments = commitments.filter(c => {
                        // 1. Siempre mostrar si "Ver terminados" está activo
                        if (showTerminated) return true;

                        // 2. Verificar si hay un registro de pago en el mes enfocado
                        const commitmentPayments = payments.get(c.id) || [];
                        const hasPaymentRecord = commitmentPayments.some(p => p.period_date.substring(0, 7) === periodStr);
                        if (hasPaymentRecord) return true;

                        // 3. Verificar si está activo según su término en el mes enfocado
                        return isActiveInMonth(c, focusedDate);
                    }).filter(c => {
                        // Aplicar filtro de categoría
                        if (selectedCategory === 'all') return true;
                        if (selectedCategory === 'FILTER_IMPORTANT') return c.is_important;
                        return getTranslatedCategoryName(c) === selectedCategory;
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
                        // Validation: Must have active term to be overdue
                        const isOverdue = isTermActiveInMonth && !isPaid && dueDate < today && monthDate <= today;

                        // Cálculos consistentes con tooltip desktop
                        const daysOverdue = isOverdue
                            ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                            : 0;
                        const daysRemaining = !isOverdue && isTermActiveInMonth
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

                        // Determinar si se debe mostrar como tachado (terminated)
                        const isGloballyTerminated = isCommitmentTerminated(c);
                        const wasActiveInMonth = getTermForPeriod(c, monthDate) !== null;
                        const terminated = isGloballyTerminated && wasActiveInMonth && isPaid;

                        const terminationReason = getTerminationReason(c);

                        // Payment record para fecha de pago
                        const currentPayment = commitmentPayments.find(p => p.period_date.substring(0, 7) === periodStr);

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
                                            ? 'bg-white/80 dark:bg-slate-900/60 border-red-200 dark:border-red-900/30'
                                            : !isTermActiveInMonth
                                                ? 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800'
                                                : 'bg-white/80 dark:bg-slate-900/60 border-white/50 dark:border-white/5 shadow-sm'
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
                                                const paused = terminationReason === 'PAUSED';
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
                                                                                        className={`group flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer outline-none ${terminationReason === 'COMPLETED_INSTALLMENTS' ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                                                                        <PauseIcon className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                                                                                        {(() => {
                                                                                            const hasEndDate = !!commitment.active_term?.effective_until;
                                                                                            if (terminationReason === 'COMPLETED_INSTALLMENTS') return 'Completado';
                                                                                            if (hasEndDate || terminationReason === 'PAUSED' || terminationReason === 'TERMINATED') return 'Reanudar';
                                                                                            return 'Pausar';
                                                                                        })()}
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
                                                                                        className={`group flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer outline-none ${terminationReason === 'COMPLETED_INSTALLMENTS' ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                                                                        <PauseIcon className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                                                                                        {(() => {
                                                                                            const hasEndDate = !!commitment.active_term?.effective_until;
                                                                                            if (terminationReason === 'COMPLETED_INSTALLMENTS') return 'Completado';
                                                                                            if (hasEndDate || terminationReason === 'PAUSED' || terminationReason === 'TERMINATED') return 'Reanudar';
                                                                                            return 'Pausar';
                                                                                        })()}
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
                                                                        ${isGap ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''}
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
