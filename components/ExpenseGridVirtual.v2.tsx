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
import { CommitmentService, PaymentService, getCurrentUserId } from '../services/dataService.v2';
import {
    EditIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon,
    PlusIcon, MinusIcon, CheckCircleIcon, ExclamationTriangleIcon, ClockIcon,
    CalendarIcon, InfinityIcon, HomeIcon, TransportIcon, DebtIcon, HealthIcon,
    SubscriptionIcon, MiscIcon, CategoryIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    StarIcon, IconProps, PauseIcon
} from './icons';
import type { CommitmentWithTerm, Payment, FlowType, Frequency, Period } from '../types.v2';
import { periodToString } from '../types.v2';
import { parseDateString, extractYearMonth, getPerPeriodAmount } from '../utils/financialUtils.v2';

// =============================================================================
// TYPES
// =============================================================================

interface ExpenseGridV2Props {
    focusedDate: Date;
    visibleMonthsCount: number;
    onEditCommitment: (commitment: CommitmentWithTerm) => void;
    onDeleteCommitment: (commitmentId: string) => void;
    onRecordPayment: (commitmentId: string, year: number, month: number) => void;
    onFocusedDateChange?: (date: Date) => void;
    onVisibleMonthsCountChange?: React.Dispatch<React.SetStateAction<number>>;
    // Optional preloaded data from App.tsx for instant rendering
    preloadedCommitments?: CommitmentWithTerm[];
    preloadedPayments?: Map<string, Payment[]>;
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
    visibleMonthsCount,
    onEditCommitment,
    onDeleteCommitment,
    onRecordPayment,
    onFocusedDateChange,
    onVisibleMonthsCountChange,
    preloadedCommitments,
    preloadedPayments,
}) => {
    const { t } = useLocalization();

    // State - use preloaded data if available for instant rendering
    const [commitments, setCommitments] = useState<CommitmentWithTerm[]>(preloadedCommitments || []);
    const [payments, setPayments] = useState<Map<string, Payment[]>>(preloadedPayments || new Map());
    const [loading, setLoading] = useState(!preloadedCommitments); // Not loading if preloaded
    const [error, setError] = useState<string | null>(null);

    const [density, setDensity] = usePersistentState<'compact' | 'medium' | 'comfortable'>(
        'gridDensity',
        'medium'
    );

    // Show/hide terminated commitments (default: hidden)
    const [showTerminated, setShowTerminated] = usePersistentState<boolean>(
        'showTerminatedCommitments',
        false
    );

    const pad = useMemo(() =>
        density === 'compact' ? 'p-2' : density === 'comfortable' ? 'p-4' : 'p-3',
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

    // Visible months centered on focused date (limited to 3-12 for optimal UX)
    const visibleMonths = useMemo(() => {
        const count = Math.max(3, Math.min(visibleMonthsCount ?? 6, 12));
        const months: Date[] = [];
        const center = new Date(focusedDate);
        center.setDate(1);
        const before = Math.floor((count - 1) / 2);
        const start = new Date(center);
        start.setMonth(center.getMonth() - before);
        for (let i = 0; i < count; i++) {
            const d = new Date(start);
            d.setMonth(start.getMonth() + i);
            months.push(d);
        }
        return months;
    }, [focusedDate, visibleMonthsCount]);

    // Group commitments by category (filtered by terminated status)
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
        const filteredCommitments = showTerminated
            ? commitments
            : commitments.filter(c => !checkTerminated(c));

        filteredCommitments.forEach(c => {
            const categoryName = c.category?.name || 'Sin categoría';
            if (!groups[categoryName]) {
                groups[categoryName] = { flowType: c.flow_type as FlowType, items: [] };
            }
            groups[categoryName].items.push(c);
        });

        return Object.entries(groups)
            .sort((a, b) => a[0].localeCompare(b[0], 'es'))
            .map(([category, data]) => ({
                category,
                flowType: data.flowType,
                commitments: data.items.sort((a, b) => a.name.localeCompare(b.name, 'es'))
            }));
    }, [commitments, showTerminated]);

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
    // Priority: payment.amount_in_base > term per-period amount
    const monthlyTotals = useMemo(() => {
        let expenses = 0;
        let income = 0;

        const year = focusedDate.getFullYear();
        const month = focusedDate.getMonth();
        const periodStr = periodToString({ year, month: month + 1 });

        groupedCommitments.forEach(group => {
            group.commitments.forEach(c => {
                const term = c.active_term;
                if (!term) return;

                // Check if there's a payment for this period
                const commitmentPayments = payments.get(c.id) || [];
                const paymentForPeriod = commitmentPayments.find(p =>
                    p.period_date.substring(0, 7) === periodStr
                );

                let amount: number;
                if (paymentForPeriod && paymentForPeriod.amount_in_base) {
                    // Use actual payment amount if recorded
                    amount = paymentForPeriod.amount_in_base;
                } else {
                    // Otherwise calculate from term (divide by installments if needed)
                    const totalAmount = term.amount_in_base ?? term.amount_original;
                    const installmentsCount = term.installments_count ?? null;
                    amount = installmentsCount && installmentsCount > 1
                        ? totalAmount / installmentsCount
                        : totalAmount;
                }

                if (c.flow_type === 'EXPENSE') {
                    expenses += amount;
                } else if (c.flow_type === 'INCOME') {
                    income += amount;
                }
            });
        });

        return { expenses, income };
    }, [groupedCommitments, payments, focusedDate]);

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
                                    {c.category?.name || 'Sin categoría'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className={`font-bold ${c.flow_type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
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
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden">
                    {/* Header - Simplified (only navigation) */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
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
                            </div>

                            {/* Right: Display Options */}
                            <div className="flex items-center gap-2">
                                {/* Density Selector */}
                                <div className="flex items-stretch bg-white dark:bg-slate-700 rounded-lg ring-1 ring-slate-200 dark:ring-slate-600 text-sm">
                                    {(['compact', 'medium', 'comfortable'] as const).map((d, i) => (
                                        <button
                                            key={d}
                                            onClick={() => setDensity(d)}
                                            className={`px-3 py-1.5 ${i > 0 ? 'border-l border-slate-200 dark:border-slate-600' : ''
                                                } ${density === d
                                                    ? 'bg-slate-200 dark:bg-slate-600 text-slate-900 dark:text-white font-medium'
                                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                                                } transition-colors`}
                                        >
                                            {d === 'compact' ? 'Compacta' : d === 'medium' ? 'Media' : 'Cómoda'}
                                        </button>
                                    ))}
                                </div>

                                {/* Show Terminated Toggle */}
                                {terminatedCount > 0 && (
                                    <label className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-700 rounded-lg ring-1 ring-slate-200 dark:ring-slate-600 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-sm">
                                        <input
                                            type="checkbox"
                                            checked={showTerminated}
                                            onChange={(e) => setShowTerminated(e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-500 text-slate-600 focus:ring-slate-500"
                                        />
                                        <span className="text-slate-700 dark:text-slate-300">
                                            Terminados ({terminatedCount})
                                        </span>
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sticky Toolbar - Right above grid */}
                    <div className="sticky top-0 z-30 bg-slate-50 dark:bg-slate-800/50 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 px-4 py-2.5">
                        <div className="flex items-center justify-between">
                            {/* Left: View Mode Selector */}
                            <div className="flex items-center bg-white dark:bg-slate-700 rounded-lg ring-1 ring-slate-200 dark:ring-slate-600 text-sm shadow-sm">
                                <span className="px-3 py-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium">
                                    Vista:
                                </span>
                                {[
                                    { value: 3, label: 'Trimestre' },
                                    { value: 6, label: 'Semestre' },
                                    { value: 12, label: 'Año' }
                                ].map((preset, i) => (
                                    <button
                                        key={preset.value}
                                        onClick={() => onVisibleMonthsCountChange && onVisibleMonthsCountChange(preset.value)}
                                        className={`px-3 py-1.5 ${i > 0 ? 'border-l border-slate-200 dark:border-slate-600' : ''
                                            } ${visibleMonthsCount === preset.value
                                                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                                            } transition-colors`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                                {/* Custom value indicator */}
                                {![3, 6, 12].includes(visibleMonthsCount) && (
                                    <div className="px-3 py-1.5 border-l border-slate-200 dark:border-slate-600 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold">
                                        {visibleMonthsCount} meses
                                    </div>
                                )}
                            </div>

                            {/* Right: Summary Info */}
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                {groupedCommitments.reduce((sum, g) => sum + g.commitments.length, 0)} compromisos
                            </div>
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
                                <thead className="sticky top-0 z-40 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="sticky left-0 z-50 bg-slate-50 dark:bg-slate-800 text-left p-3 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 min-w-[220px]">
                                            Compromiso
                                        </th>
                                        {visibleMonths.map((month, i) => (
                                            <th
                                                key={i}
                                                className={`text-center p-2.5 font-semibold border-r border-slate-200 dark:border-slate-700 last:border-r-0 min-w-[120px] ${isCurrentMonth(month)
                                                    ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-l-4 border-l-sky-500'
                                                    : 'text-slate-700 dark:text-slate-300'
                                                    }`}
                                            >
                                                <div className="text-sm capitalize">{month.toLocaleDateString('es-ES', { month: 'short' })}</div>
                                                <div className="text-xs opacity-75">{month.getFullYear()}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedCommitments.map(({ category, flowType, commitments: catCommitments }) => (
                                        <React.Fragment key={category}>
                                            {/* Category row */}
                                            <tr className="bg-slate-100 dark:bg-slate-800/50">
                                                <td className="sticky left-0 z-25 bg-slate-100 dark:bg-slate-800/50 p-3 font-semibold text-slate-800 dark:text-slate-200 border-b border-r border-slate-200 dark:border-slate-700 min-w-[220px]">
                                                    <div className="flex items-center gap-2">
                                                        {getCategoryIcon(category)}
                                                        <span>{category}</span>
                                                    </div>
                                                </td>
                                                {visibleMonths.map((_, mi) => (
                                                    <td key={mi} className="bg-slate-100 dark:bg-slate-800/50 border-b border-r border-slate-200 dark:border-slate-700 last:border-r-0" />
                                                ))}
                                            </tr>

                                            {/* Commitment rows */}
                                            {catCommitments.map(commitment => {
                                                const terminated = isCommitmentTerminated(commitment);
                                                return (
                                                    <tr key={commitment.id} className={`border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 ${terminated ? 'bg-slate-100 dark:bg-slate-800/50 opacity-60' : ''}`}>
                                                        {/* Name cell */}
                                                        <td className={`sticky left-0 z-20 ${terminated ? 'bg-slate-100 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-900'} ${pad} border-r border-slate-200 dark:border-slate-700`}>
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        {commitment.flow_type === 'INCOME' ? (
                                                                            <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
                                                                        ) : (
                                                                            <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />
                                                                        )}
                                                                        <span className={`font-medium ${terminated ? 'line-through text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>{commitment.name}</span>
                                                                        {commitment.is_important && <StarIcon className="w-4 h-4 text-amber-500" />}
                                                                        {terminated && (
                                                                            <span className="text-xs px-1.5 py-0.5 bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded">
                                                                                Terminado
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                                        {commitment.active_term?.frequency === 'MONTHLY' && <InfinityIcon className="w-4 h-4" />}
                                                                        {(commitment.active_term?.frequency === 'ONCE' || (commitment.active_term?.installments_count && commitment.active_term?.installments_count > 1)) && <CalendarIcon className="w-4 h-4" />}
                                                                        {!commitment.active_term && (
                                                                            <span className="text-amber-600 dark:text-amber-400">Expirado</span>
                                                                        )}
                                                                        {commitment.active_term && (
                                                                            <span>
                                                                                {commitment.active_term.installments_count && commitment.active_term.installments_count > 1
                                                                                    ? 'Cuotas'
                                                                                    : commitment.active_term.frequency === 'MONTHLY'
                                                                                        ? 'Recurrente'
                                                                                        : commitment.active_term.frequency === 'ONCE'
                                                                                            ? 'Único'
                                                                                            : commitment.active_term.frequency}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="shrink-0 flex items-center gap-1 opacity-80 hover:opacity-100">
                                                                    <button
                                                                        onClick={() => onEditCommitment(commitment)}
                                                                        className="text-slate-500 hover:text-sky-500 p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50"
                                                                        title="Editar"
                                                                    >
                                                                        <EditIcon />
                                                                    </button>
                                                                    {/* Pause button - Coming soon */}
                                                                    {!terminated && (
                                                                        <button
                                                                            onClick={() => alert('Función en creación')}
                                                                            className="text-slate-500 hover:text-amber-500 p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50 relative group"
                                                                            title="Pausar (En creación)"
                                                                        >
                                                                            <PauseIcon className="w-4 h-4" />
                                                                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                                                En creación
                                                                            </span>
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => onDeleteCommitment(commitment.id)}
                                                                        className="text-slate-500 hover:text-rose-600 p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50"
                                                                        title="Eliminar"
                                                                    >
                                                                        <TrashIcon />
                                                                    </button>
                                                                </div>
                                                            </div>
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
                                                            const perPeriodAmount = installmentsCount && installmentsCount > 1
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
                                                            const perPeriodOriginal = installmentsCount && installmentsCount > 1
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
                                                                    className={`${pad} text-right border-r border-slate-200 dark:border-slate-700 last:border-r-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${isFutureMonth ? 'opacity-50' : ''}`}
                                                                    onClick={() => onRecordPayment(commitment.id, monthDate.getFullYear(), monthDate.getMonth())}
                                                                >
                                                                    {/* GAP: No term for this period */}
                                                                    {!term && !isPaid ? (
                                                                        <div className="text-slate-400 dark:text-slate-600 font-mono text-base" title="Sin término activo en este período">
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
                                                                        <div className="space-y-1">
                                                                            {/* Main amount - neutral colors */}
                                                                            <div className="font-bold font-mono tabular-nums text-base text-slate-800 dark:text-slate-100">
                                                                                {formatClp(displayAmount)}
                                                                            </div>
                                                                            {/* Original currency */}
                                                                            {showOriginalCurrency && (
                                                                                <div className="text-xs text-slate-500">
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
                                                                                    Cuota {cuotaNumber}/{installmentsCount}
                                                                                </div>
                                                                            ) : term && term.frequency === 'MONTHLY' && (!installmentsCount || installmentsCount <= 1) ? (
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
                                                                            {/* Status badge - icon only for paid, with different colors for on-time vs late */}
                                                                            {isPaid && (
                                                                                <div className={`flex items-center justify-end ${paidOnTime ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                                                    <CheckCircleIcon className="w-4 h-4" />
                                                                                </div>
                                                                            )}
                                                                            {isOverdue && (
                                                                                <div className="flex items-center justify-end gap-1 text-xs text-rose-600 dark:text-rose-400">
                                                                                    <ExclamationTriangleIcon className="w-4 h-4" />
                                                                                    <span>Atrasado ({daysOverdue}d)</span>
                                                                                </div>
                                                                            )}
                                                                            {isPending && (
                                                                                <div className="flex items-center justify-end gap-1 text-xs text-amber-600 dark:text-amber-400">
                                                                                    <ClockIcon className="w-4 h-4" />
                                                                                    <span>Pendiente ({daysRemaining}d)</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
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
                    </div>

                    {/* Footer */}
                    <div ref={footerRef} className="px-4 py-2.5 flex items-center justify-between text-xs border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                        <div className="text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-900 dark:text-white">
                                {commitments.length}
                            </span> compromisos
                        </div>

                        <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 dark:text-slate-500">
                                    {focusedDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}:
                                </span>
                                <span className="font-semibold text-red-600 dark:text-red-400">
                                    {formatClp(monthlyTotals.expenses)}
                                </span>
                                <span className="text-slate-400">egresos</span>
                            </div>

                            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600"></div>

                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-green-600 dark:text-green-400">
                                    {formatClp(monthlyTotals.income)}
                                </span>
                                <span className="text-slate-400">ingresos</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpenseGridVirtual2;
