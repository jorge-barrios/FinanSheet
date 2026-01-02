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

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import usePersistentState from '../hooks/usePersistentState';
import { useCommitments } from '../context/CommitmentsContext';
import { CommitmentService, PaymentService, getCurrentUserId } from '../services/dataService.v2';
import {
    EditIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon,
    CheckCircleIcon, ExclamationTriangleIcon, ClockIcon,
    CalendarIcon, InfinityIcon, HomeIcon, TransportIcon, DebtIcon, HealthIcon,
    SubscriptionIcon, MiscIcon, CategoryIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    StarIcon, IconProps, PauseIcon
} from './icons';
import type { CommitmentWithTerm, Payment, FlowType, Term } from '../types.v2';
import { periodToString } from '../types.v2';
import { parseDateString, extractYearMonth, getPerPeriodAmount } from '../utils/financialUtils.v2';
import { Sparkles, Link2, MoreVertical } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================
const CompactTooltip = ({ children, content }: { children: React.ReactNode, content: React.ReactNode }) => (
    <Tooltip.Provider delayDuration={100}>
        <Tooltip.Root>
            <Tooltip.Trigger asChild>
                {/* Wrap in span to ensure ref passing if child is composite */}
                <span className="h-full w-full block outline-none">{children}</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content
                    className="z-50 rounded-lg bg-white dark:bg-slate-800 px-3 py-2 text-sm shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in-0 zoom-in-95 duration-200"
                    sideOffset={5}
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
    onRecordPayment,
    onFocusedDateChange,
    preloadedCommitments,
    preloadedPayments,
    monthlyTotals: propTotals,
}) => {
    const { t, language } = useLocalization();
    const { getMonthlyData } = useCommitments();

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
            const footerH = footerRef.current ? footerRef.current.offsetHeight : 0;
            const bottomMargin = 24 + footerH;

            const h = Math.max(300, vh - rect.top - bottomMargin);
            setAvailableHeight(h);
        };

        recalc();
        window.addEventListener('resize', recalc);
        return () => window.removeEventListener('resize', recalc);
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


    // Group commitments by category (filtered by terminated status AND category filter)
    const groupedCommitments = useMemo(() => {
        const groups: { [key: string]: { flowType: FlowType; items: CommitmentWithTerm[] } } = {};

        // Helper to check if terminated
        const checkTerminated = (c: CommitmentWithTerm): boolean => {
            const term = c.active_term;
            if (!term?.effective_until) return false;
            const endDate = new Date(term.effective_until);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return endDate < today;
        };

        // Filter commitments based on showTerminated toggle
        let filteredCommitments = showTerminated
            ? commitments
            : commitments.filter(c => !checkTerminated(c));

        // Apply category filter
        if (selectedCategory !== 'all') {
            filteredCommitments = filteredCommitments.filter(c => {
                const categoryName = getTranslatedCategoryName(c);
                return categoryName === selectedCategory;
            });
        }

        filteredCommitments.forEach(c => {
            // Use translated category name directly from i18n
            const categoryName = getTranslatedCategoryName(c);
            if (!groups[categoryName]) {
                groups[categoryName] = { flowType: c.flow_type as FlowType, items: [] };
            }
            groups[categoryName].items.push(c);
        });

        return Object.entries(groups)
            .sort((a, b) => a[0].localeCompare(b[0], language === 'es' ? 'es' : 'en'))
            .map(([category, data]) => ({
                category,
                flowType: data.flowType,
                commitments: data.items.sort((a, b) => a.name.localeCompare(b.name, language === 'es' ? 'es' : 'en'))
            }));
    }, [commitments, showTerminated, selectedCategory, t, language]);

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
        return ['all', ...Array.from(categorySet).sort((a, b) => a.localeCompare(b, language === 'es' ? 'es' : 'en'))];
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
        today.setHours(0, 0, 0, 0);
        return endDate < today;
    };

    // Calculate total paid for a specific month (across all commitments)
    const calculateMonthPaidTotal = (monthDate: Date): number => {
        let total = 0;
        const targetYear = monthDate.getFullYear();
        const targetMonth = monthDate.getMonth() + 1; // 1-based

        for (const [, commitmentPayments] of payments.entries()) {
            const payment = commitmentPayments.find(p =>
                p.period_year === targetYear &&
                p.period_month === targetMonth &&
                p.status === 'PAID'
            );
            if (payment) {
                total += payment.amount_paid || 0;
            }
        }
        return total;
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

    // Get payment status for a commitment in a month
    // Note: We use amount_original for CLP payments due to migration bug with amount_in_base
    const getPaymentStatus = (commitmentId: string, monthDate: Date, dueDay: number = 1) => {
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
    };

    // Calculate monthly totals for footer - matches dashboard logic
    // Uses getMonthlyData from context (same source as Dashboard)
    // Calculates correct index based on focusedDate, not fixed to current month
    const monthlyTotals = useMemo(() => {
        const data = getMonthlyData();
        // Calculate the index based on focusedDate relative to today
        // Dashboard uses: index 8 = displayMonth (current context month)
        // Rolling window: 8 months back, current, 3 months forward
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        const focusedYear = focusedDate.getFullYear();
        const focusedMonth = focusedDate.getMonth();

        // Calculate offset from today: focused - today
        const monthsDiff = (focusedYear - currentYear) * 12 + (focusedMonth - currentMonth);

        // Index 8 is today, so focused month index = 8 + monthsDiff
        // Clamp to valid range [0, 11]
        const targetIdx = Math.max(0, Math.min(11, 8 + monthsDiff));

        const target = data[targetIdx];
        return {
            expenses: target?.expenses ?? 0,
            income: target?.income ?? 0
        };
    }, [getMonthlyData, focusedDate]);

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
        <div className="px-4 pb-6 lg:pb-0 lg:overflow-hidden">
            {/* Mobile View */}
            <div className="lg:hidden space-y-4">
                {commitments.length > 0 ? commitments.map(c => (
                    <div key={c.id} className={`bg-white dark:bg-slate-800 rounded-xl ${pad} border border-slate-200 dark:border-slate-700 shadow-sm`}>
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    {c.flow_type === 'INCOME' ? (
                                        <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
                                    ) : (
                                        <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />
                                    )}
                                    <span className="font-medium text-slate-900 dark:text-white">{c.name}</span>
                                    {c.is_important && <StarIcon className="w-4 h-4 text-amber-500" />}
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {getTranslatedCategoryName(c)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className={`font-bold font-mono tabular-nums ${c.flow_type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                                    {c.active_term ? formatClp(c.active_term.amount_in_base ?? c.active_term.amount_original) : '-'}
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                            <button
                                onClick={() => onEditCommitment(c)}
                                className="flex-1 text-sm py-1.5 px-3 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
                            >
                                Editar
                            </button>
                            <button
                                onClick={() => onDeleteCommitment(c.id)}
                                className="text-sm py-1.5 px-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-16 text-slate-500">
                        <p className="text-lg">No hay commitments</p>
                    </div>
                )}
            </div>

            {/* Desktop View */}
            <div className="hidden lg:block">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden">
                    {/* Header - Finance Noir Style with Gradient Accent */}
                    <div className="relative p-4 border-b border-slate-200 dark:border-slate-700/50 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-800 dark:via-slate-850 dark:to-slate-800">
                        {/* Top gradient bar accent */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500" />
                        <div className="flex items-center justify-between">
                            {/* Left: Navigation */}
                            <div className="flex items-center gap-3">
                                {/* Today button */}
                                <button
                                    onClick={() => onFocusedDateChange && onFocusedDateChange(new Date())}
                                    disabled={isCurrentMonth(focusedDate)}
                                    aria-label="Ir al mes actual"
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isCurrentMonth(focusedDate)
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 ring-1 ring-slate-200 dark:ring-slate-600'
                                        }`}
                                >
                                    🏠 Hoy
                                </button>

                                {/* Unified Month + Year Navigator */}
                                <div className="flex items-center bg-white dark:bg-slate-700 rounded-lg ring-1 ring-slate-200 dark:ring-slate-600">
                                    <button
                                        onClick={() => {
                                            const newDate = new Date(focusedDate);
                                            newDate.setMonth(newDate.getMonth() - 1);
                                            onFocusedDateChange && onFocusedDateChange(newDate);
                                        }}
                                        aria-label="Periodo anterior"
                                        className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-l-lg transition-colors"
                                    >
                                        <ChevronLeftIcon className="w-5 h-5" />
                                    </button>
                                    <div className="px-6 py-2 text-center min-w-[180px] border-x border-slate-200 dark:border-slate-600">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                                            {focusedDate.toLocaleDateString('es-ES', { month: 'long' })} {focusedDate.getFullYear()}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newDate = new Date(focusedDate);
                                            newDate.setMonth(newDate.getMonth() + 1);
                                            onFocusedDateChange && onFocusedDateChange(newDate);
                                        }}
                                        aria-label="Periodo siguiente"
                                        className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-r-lg transition-colors"
                                    >
                                        <ChevronRightIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Monthly Totals Badges */}
                                <div className="flex items-center gap-2">
                                    {/* Egresos */}
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/30">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        <span className="text-xs font-medium font-mono tabular-nums text-red-600 dark:text-red-400">
                                            {formatClp((propTotals || monthlyTotals).expenses)}
                                        </span>
                                    </div>
                                    {/* Ingresos */}
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span className="text-xs font-medium font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                                            {formatClp((propTotals || monthlyTotals).income)}
                                        </span>
                                    </div>
                                    {/* Neto */}
                                    {(() => {
                                        const neto = (propTotals || monthlyTotals).income - (propTotals || monthlyTotals).expenses;
                                        const isPositive = neto >= 0;
                                        return (
                                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${isPositive
                                                ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-200/50 dark:border-sky-800/30'
                                                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/30'
                                                }`}>
                                                <span className={`text-xs font-bold font-mono tabular-nums ${isPositive ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                    {isPositive ? '+' : ''}{formatClp(neto)}
                                                </span>
                                                <span className={`text-[10px] uppercase ${isPositive ? 'text-sky-500 dark:text-sky-500' : 'text-amber-500 dark:text-amber-500'}`}>
                                                    neto
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Right: Display Options */}
                            <div className="flex items-center gap-2">
                                {/* Density Selector - Improved Active State */}
                                {/* Density Selector - Segmented Control Style */}
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
                                    {(['compact', 'medium'] as const).map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setDensity(d)}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${density === d
                                                ? 'bg-sky-500 text-white shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                                                }`}
                                        >
                                            {d === 'compact' ? 'Compacta' : 'Detallada'}
                                        </button>
                                    ))}
                                </div>

                                {/* Show Terminated Toggle */}
                                {terminatedCount > 0 && (
                                    <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700 ml-1">
                                        <button
                                            onClick={() => setShowTerminated(!showTerminated)}
                                            className="flex items-center gap-2 group cursor-pointer focus:outline-none"
                                            title={showTerminated ? 'Ocultar compromisos terminados' : 'Mostrar compromisos terminados'}
                                        >
                                            <div className={`
                                                relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2  focus-visible:ring-white/75
                                                ${showTerminated ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-700'}
                                            `}>
                                                <span
                                                    aria-hidden="true"
                                                    className={`
                                                        pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out
                                                        ${showTerminated ? 'translate-x-4' : 'translate-x-0'}
                                                    `}
                                                />
                                            </div>
                                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                                                Terminados ({terminatedCount})
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Category Filter Tabs */}
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
                                        px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap
                                        transition-all duration-200
                                        ${selectedCategory === cat
                                            ? 'bg-sky-500 text-white shadow-sm'
                                            : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                        }
                                    `}
                                >
                                    {cat === 'all' ? 'Todos' : cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="relative">
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
                                            const monthTotal = calculateMonthPaidTotal(month);
                                            return (
                                                <th
                                                    key={i}
                                                    className={`text-center text-xs font-mono tabular-nums border-r border-slate-200 dark:border-slate-700 last:border-r-0 ${density === 'compact' ? 'px-2 py-1.5' : 'px-2 py-2'} ${monthTotal > 0
                                                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                                        : 'text-slate-400 dark:text-slate-500'
                                                        }`}
                                                >
                                                    {monthTotal > 0 ? formatClp(monthTotal) : '—'}
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
                                                const flowColor = commitment.flow_type === 'INCOME' ? 'border-l-emerald-500' : 'border-l-red-500';
                                                return (
                                                    <tr
                                                        key={commitment.id}
                                                        className={`
                                                            group
                                                            border-b border-slate-200/80 dark:border-slate-700/50 
                                                            transition-all duration-200 ease-out
                                                            hover:bg-blue-50/50 dark:hover:bg-slate-800/80 hover:shadow-sm
                                                            ${terminated ? 'bg-slate-50/50 dark:bg-slate-800/30 opacity-60' : ''}
                                                        `}
                                                    >
                                                        {/* Name cell with flow-type accent - Merged with Category for Compact */}
                                                        <td className={`
                                                            sticky left-0 z-20 border-l-3 ${flowColor}
                                                            ${terminated ? 'bg-slate-50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-900'} 
                                                            group-hover:bg-blue-50/50 dark:group-hover:bg-slate-800/80
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
                                                                            className={`font-medium text-sm truncate block hover:text-sky-600 ${terminated ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}
                                                                            title={`${commitment.name} - Click para editar`}
                                                                        >
                                                                            {commitment.name}
                                                                        </span>
                                                                    </div>

                                                                    {/* Right: Category + Amount + Icon */}
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 uppercase tracking-wider border border-indigo-100 dark:border-indigo-800/50">
                                                                            {category}
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
                                                                                            alert('Pausar: Próximamente');
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
                                                                                            // onPauseCommitment(commitment); // TODO: Implement
                                                                                            alert('Pausar: Próximamente');
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
                                                            const commitmentPayments = payments.get(commitment.id) || [];
                                                            const periodStr = periodToString({ year: monthDate.getFullYear(), month: monthDate.getMonth() + 1 });
                                                            const hasPaymentRecord = commitmentPayments.some(p => {
                                                                const pPeriod = p.period_date.substring(0, 7);
                                                                return pPeriod === periodStr;
                                                            });

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
                                                            const daysRemaining = isPending
                                                                ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                                                                : 0;
                                                            return (
                                                                <td
                                                                    key={mi}
                                                                    className={`
                                                                        ${pad} text-right border-r border-slate-200/80 dark:border-slate-700/50 last:border-r-0 
                                                                        cursor-pointer transition-all duration-150 ease-out
                                                                        hover:bg-slate-100/80 dark:hover:bg-slate-800/80
                                                                        ${isCurrentMonth(monthDate) ? 'bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-inset ring-blue-500/10' : ''}
                                                                        ${isFutureMonth
                                                                            ? (hasPaymentRecord || (installmentsCount && installmentsCount > 1) ? '' : 'opacity-25 grayscale')
                                                                            : ''}
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
                                                                                content={
                                                                                    <div className="space-y-1.5 min-w-[140px] text-slate-800 dark:text-slate-100">
                                                                                        {/* Header: Date + Status */}
                                                                                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5 mb-1.5">
                                                                                            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                                                                                                {monthDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                                                                                            </span>
                                                                                            {isPaid ? (
                                                                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">PAGADO</span>
                                                                                            ) : isOverdue ? (
                                                                                                <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">VENCIDO</span>
                                                                                            ) : (
                                                                                                <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">PENDIENTE</span>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* Amount: Main + Original if differs */}
                                                                                        <div className="text-right">
                                                                                            <div className={`text-base font-bold font-mono tabular-nums ${isPaid ? 'text-emerald-600 dark:text-emerald-400' :
                                                                                                isOverdue ? 'text-red-600 dark:text-red-400' :
                                                                                                    'text-slate-700 dark:text-slate-200'
                                                                                                }`}>
                                                                                                {formatClp(displayAmount!)}
                                                                                            </div>
                                                                                            {showOriginalCurrency && (
                                                                                                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                                                                                    ({originalCurrency} {perPeriodOriginal?.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                                                                                </div>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* Payment/Cuota Progress */}
                                                                                        {cuotaNumber && installmentsCount && installmentsCount > 1 ? (
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

                                                                                        {/* Footer: Due Status */}
                                                                                        {!isPaid && (
                                                                                            <div className="text-[10px] text-right text-slate-400">
                                                                                                {isOverdue
                                                                                                    ? `Venció hace ${daysOverdue} días`
                                                                                                    : `Vence en ${daysRemaining} días`
                                                                                                }
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                }
                                                                            >
                                                                                <div className="flex justify-center items-center h-full">
                                                                                    {isPaid ? (
                                                                                        <div className={`
                                                                                        flex items-center justify-center 
                                                                                        ${paidOnTime ? 'text-emerald-400' : 'text-emerald-500'}
                                                                                    `}>
                                                                                            <CheckCircleIcon className="w-5 h-5" />
                                                                                        </div>
                                                                                    ) : isOverdue ? (
                                                                                        <div className="text-red-500 animate-pulse">
                                                                                            <ExclamationTriangleIcon className="w-5 h-5" />
                                                                                        </div>
                                                                                    ) : isPending ? (
                                                                                        <div className="text-amber-500">
                                                                                            <ClockIcon className="w-5 h-5" />
                                                                                        </div>
                                                                                    ) : (installmentsCount && installmentsCount > 1) ? (
                                                                                        /* Future Defined (Installment) -> Distinct Icon */
                                                                                        <div className="text-slate-500 dark:text-slate-400">
                                                                                            <CalendarIcon className="w-4 h-4" />
                                                                                        </div>
                                                                                    ) : (hasPaymentRecord) ? (
                                                                                        /* Future Saved Amount (Bill Received) -> Solid Clock */
                                                                                        <div className="text-slate-500 dark:text-slate-400">
                                                                                            <ClockIcon className="w-5 h-5" />
                                                                                        </div>
                                                                                    ) : (
                                                                                        /* Future Indefinite -> Faint Clock */
                                                                                        <div className="text-slate-700 dark:text-slate-600">
                                                                                            <ClockIcon className="w-5 h-5 opacity-40" />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </CompactTooltip>
                                                                        ) : (
                                                                            /* === FULL VIEW: All details === */
                                                                            <div className="space-y-1">
                                                                                {/* Main amount - neutral colors */}
                                                                                <div className="font-bold font-mono tabular-nums text-base text-slate-800 dark:text-slate-100">
                                                                                    {formatClp(displayAmount)}
                                                                                </div>
                                                                                {/* Original currency */}
                                                                                {showOriginalCurrency && (
                                                                                    <div className="text-xs text-slate-500 tabular-nums">
                                                                                        {originalCurrency} {perPeriodOriginal.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                    </div>
                                                                                )}
                                                                                {/* Due date */}
                                                                                <div className="text-xs text-slate-500">
                                                                                    Vence: {dueDay}/{monthDate.getMonth() + 1}
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
                                                                                {isPaid && (
                                                                                    <div className="flex items-center justify-end gap-1 px-2 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                                                                        {paidOnTime && <Sparkles className="w-3 h-3" />}
                                                                                        <CheckCircleIcon className="w-3.5 h-3.5" />
                                                                                        <span className="text-xs font-medium">Pagado</span>
                                                                                    </div>
                                                                                )}
                                                                                {isOverdue && (
                                                                                    <div className="flex items-center justify-end gap-1 px-2 py-0.5 rounded-full bg-red-100/80 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse">
                                                                                        <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                                                                        <span className="text-xs font-semibold">Atrasado ({daysOverdue}d)</span>
                                                                                    </div>
                                                                                )}
                                                                                {isPending && (
                                                                                    <div className="flex items-center justify-end gap-1 px-2 py-0.5 rounded-full bg-amber-100/80 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                                                                        <ClockIcon className="w-3.5 h-3.5" />
                                                                                        <span className="text-xs font-medium">{daysRemaining}d restantes</span>
                                                                                    </div>
                                                                                )}
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
