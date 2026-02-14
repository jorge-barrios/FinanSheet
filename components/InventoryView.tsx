import React, { useState, useMemo } from 'react';
import { CommitmentWithTerm, Category, Payment } from '../types.v2';
import { SearchIcon, TrashIcon, PauseIcon, ArrowPathIcon, EditIcon, PlayIcon } from './icons';
import { Sparkles } from 'lucide-react';
import { SwipeableItem } from './ui/SwipeableItem';
import { useLocalization } from '../hooks/useLocalization';
import {
    getCommitmentStatus,
    getCommitmentSummary,
    filterByLifecycle,
    type LifecycleFilter
} from '../utils/commitmentStatusUtils';
import { CommitmentCard } from './CommitmentCard';

// Helper: Convert Payment[] to Map<string, Payment[]> for filterByLifecycle
function paymentsToMap(payments: Payment[]): Map<string, Payment[]> {
    const map = new Map<string, Payment[]>();
    for (const p of payments) {
        const existing = map.get(p.commitment_id) || [];
        existing.push(p);
        map.set(p.commitment_id, existing);
    }
    return map;
}

interface InventoryViewProps {
    commitments: CommitmentWithTerm[];
    categories: Category[];
    payments: Payment[];
    lastPaymentsMap?: Map<string, Payment>;
    onEditCommitment: (commitment: CommitmentWithTerm) => void;
    onDetailCommitment: (commitment: CommitmentWithTerm) => void;  // NEW: Opens detail modal
    onDeleteCommitment: (id: string) => void;
    onPauseCommitment: (commitment: CommitmentWithTerm) => void;
    onResumeCommitment: (commitment: CommitmentWithTerm) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
}

const InventoryView: React.FC<InventoryViewProps> = ({
    commitments,
    categories,
    payments,
    lastPaymentsMap,
    onEditCommitment,
    onDetailCommitment,
    onDeleteCommitment,
    onPauseCommitment,
    onResumeCommitment,
    searchTerm,
    onSearchChange
}) => {
    const { t } = useLocalization();
    // searchTerm state removed (lifted)
    // Note: 'terminated' maps to 'paused' in the new unified lifecycle filter (INACTIVE state)
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused' | 'terminated'>('all');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // Convert payments array to map for centralized filter function
    const paymentsMap = useMemo(() => paymentsToMap(payments), [payments]);

    const filteredCommitments = useMemo(() => {
        // Map old filter values to new LifecycleFilter type
        // 'terminated' → 'paused' (both map to INACTIVE lifecycle)
        const lifecycleFilter: LifecycleFilter = filterStatus === 'terminated' ? 'paused' : filterStatus as LifecycleFilter;

        // Step 1: Apply lifecycle filter (using centralized logic)
        const lifecycleFiltered = filterByLifecycle(commitments, paymentsMap, lifecycleFilter);

        // Step 2: Apply search filter
        if (!searchTerm) return lifecycleFiltered;

        return lifecycleFiltered.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [commitments, searchTerm, filterStatus, paymentsMap]);

    // Use centralized getCommitmentSummary for all commitment details
    // This fixes the is_divided_amount bug and removes 140 lines of duplicated logic
    const getCommitmentDetails = (commitment: CommitmentWithTerm) => {
        const summary = getCommitmentSummary(commitment, payments, lastPaymentsMap);
        return {
            displayAmount: summary.perPeriodAmount,
            totalPaid: summary.totalPaid,
            paymentCount: summary.paymentCount,
            estado: summary.estado,
            estadoDetail: summary.estadoDetail,
            overdueCount: summary.overdueCount,
            nextPaymentDate: summary.nextPaymentDate,
            lastPayment: summary.lastPayment,
        };
    };

    const sortedCommitments = useMemo(() => {
        let sortableItems = [...filteredCommitments];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                if (sortConfig.key === 'amount') {
                    aValue = a.active_term?.amount_in_base ?? 0;
                    bValue = b.active_term?.amount_in_base ?? 0;
                } else if (sortConfig.key === 'category') {
                    aValue = (categories.find(c => c.id === a.category_id)?.name || '').toLowerCase();
                    bValue = (categories.find(c => c.id === b.category_id)?.name || '').toLowerCase();
                } else if (sortConfig.key === 'estado') {
                    // Helper to get status priority (overdue > pending > ok)
                    const getStatusPriority = (c: CommitmentWithTerm) => {
                        const { estado } = getCommitmentDetails(c);
                        if (estado === 'overdue') return 0;
                        if (estado === 'pending') return 1;
                        if (estado === 'ok') return 2;
                        return 3;
                    };
                    aValue = getStatusPriority(a);
                    bValue = getStatusPriority(b);
                } else {
                    aValue = (a as any)[sortConfig.key];
                    bValue = (b as any)[sortConfig.key];
                    if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                    if (typeof bValue === 'string') bValue = bValue.toLowerCase();
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredCommitments, sortConfig, categories, payments, lastPaymentsMap]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const formatClp = (amount: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };



    return (
        <div className="flex flex-col min-h-0 bg-slate-50 dark:bg-slate-900/50">
            {/* Toolbar - Desktop only (mobile uses MobileControlBar) */}
            <div className="hidden lg:block sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between max-w-7xl mx-auto w-full">

                    {/* Search & Filter */}
                    <div className="flex flex-1 w-full sm:w-auto gap-3">
                        {/* Search Input - Hidden on Mobile (Moved to Top Bar) */}
                        <div className="hidden lg:block relative flex-1">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar compromisos..."
                                value={searchTerm}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                            />
                        </div>

                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            {[
                                { id: 'all', label: 'Todos', icon: 'List' },
                                { id: 'active', label: 'Activos', icon: 'CheckCircle' },
                                { id: 'terminated', label: 'Inactivos', icon: 'Archive' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setFilterStatus(opt.id as any)}
                                    className={`
                                        px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                                        ${filterStatus === opt.id
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}
                                     `}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area - scroll handled by parent <main> */}
            <div className="flex-1 min-h-0 p-4">
                <div className="max-w-7xl mx-auto">
                    {sortedCommitments.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
                            <p className="text-lg font-medium">No se encontraron compromisos</p>
                            <p className="text-sm mt-1">Intenta cambiar los filtros o agrega uno nuevo.</p>
                        </div>
                    ) : (
                        <>
                            {/* MOBILE: CARDS VIEW (< lg) */}
                            <div className="lg:hidden space-y-3">
                                {sortedCommitments.map((commitment) => {
                                    // Determine Swipe Actions
                                    const activeTerm = commitment.active_term;
                                    const { estado } = getCommitmentDetails(commitment);
                                    const isPaid = estado !== 'pending' && estado !== 'overdue';
                                    const isTerminated = !activeTerm || (activeTerm.effective_until && activeTerm.effective_until < new Date().toISOString().split('T')[0]);
                                    
                                    // Swipe Logic Redesign (Consistent with Dashboard)
                                    // Swipe Right -> Details (Blue)
                                    // Swipe Left -> Edit (Slate)

                                    // Left Action (Revealed on Swipe Right) -> Details
                                    const leftActionNode = (
                                        <div className="flex flex-col items-center justify-center h-full w-20 bg-sky-500 text-white">
                                            <Sparkles className="w-6 h-6 mb-1" />
                                            <span className="text-xs font-bold">Detalles</span>
                                        </div>
                                    );
                                    const onSwipeRightAction = () => {
                                         if (onDetailCommitment) {
                                             onDetailCommitment(commitment);
                                         } else {
                                             onEditCommitment(commitment);
                                         }
                                    };

                                    // Right Action (Revealed on Swipe Left) -> Edit
                                    const rightActionNode = (
                                        <div className="flex flex-col items-center justify-center h-full w-20 bg-slate-500 text-white">
                                            <EditIcon className="w-6 h-6 mb-1" />
                                            <span className="text-xs font-bold">Editar</span>
                                        </div>
                                    );
                                    const onSwipeLeftAction = () => onEditCommitment(commitment);

                                    return (
                                        <SwipeableItem
                                            key={commitment.id}
                                            leftAction={leftActionNode}
                                            rightAction={rightActionNode}
                                            onSwipeLeft={onSwipeLeftAction}
                                            onSwipeRight={onSwipeRightAction}
                                            className="mb-3"
                                        >
                                            <CommitmentCard
                                                commitment={commitment}
                                                payments={payments}
                                                lastPaymentsMap={lastPaymentsMap}
                                                mode="inventory"
                                                categoryName={categories.find(c => c.id === commitment.category_id)?.name}
                                                formatAmount={formatClp}
                                                onClick={() => {
                                                    if (onDetailCommitment) {
                                                        onDetailCommitment(commitment);
                                                    } else {
                                                        onEditCommitment(commitment);
                                                    }
                                                }}
                                                onEdit={() => onEditCommitment(commitment)}
                                                onDetail={onDetailCommitment ? () => onDetailCommitment(commitment) : undefined}
                                                onPause={() => onPauseCommitment(commitment)}
                                                onResume={() => onResumeCommitment(commitment)}
                                                onDelete={() => onDeleteCommitment(commitment.id)}
                                                translateFrequency={(freq) => t(`frequency.${freq}`) || freq}
                                            />
                                        </SwipeableItem>
                                    );
                                })}
                            </div>

                            {/* DESKTOP: TABLE VIEW (>= lg) */}
                            <div className="hidden lg:block bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            <th className="px-6 py-4 w-12 text-center"></th>
                                            <th className="px-6 py-4 cursor-pointer hover:text-sky-600" onClick={() => requestSort('name')}>Nombre</th>
                                            <th className="px-6 py-4 cursor-pointer hover:text-sky-600" onClick={() => requestSort('category')}>Categoría</th>
                                            <th className="px-6 py-4 cursor-pointer hover:text-sky-600" onClick={() => requestSort('estado')}>Estado</th>
                                            <th className="px-6 py-4">Situación</th>
                                            <th className="px-6 py-4">Hito</th>
                                            <th className="px-6 py-4 text-right cursor-pointer hover:text-sky-600" onClick={() => requestSort('amount')}>Monto</th>
                                            <th className="px-6 py-4 w-32 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {sortedCommitments.map(commitment => {
                                            const activeTerm = commitment.active_term;
                                            const { displayAmount, estado, estadoDetail, nextPaymentDate, lastPayment } = getCommitmentDetails(commitment);
                                            const isTerminated = !activeTerm || (activeTerm.effective_until && activeTerm.effective_until < new Date().toISOString().split('T')[0]);

                                            // Split Status Logic (Lifecycle vs Financial)
                                            const lifecycleStatus = getCommitmentStatus(commitment);

                                            // 1. Lifecycle Badge (Identity) - "Estado" Column
                                            let lifecycleBadge = {
                                                label: 'Inactivo',
                                                bg: 'bg-slate-100 dark:bg-slate-800',
                                                text: 'text-slate-500 dark:text-slate-400'
                                            };

                                            switch (lifecycleStatus) {
                                                case 'ACTIVE':
                                                    lifecycleBadge = {
                                                        label: 'Activo',
                                                        bg: 'bg-sky-500/10 dark:bg-sky-900/20',
                                                        text: 'text-sky-600 dark:text-sky-400'
                                                    };
                                                    break;
                                                case 'COMPLETED':
                                                    lifecycleBadge = {
                                                        label: 'Completado', // Grouped visually as Inactive (Gray), but explicit label
                                                        bg: 'bg-slate-100 dark:bg-slate-800',
                                                        text: 'text-slate-500 dark:text-slate-400'
                                                    };
                                                    break;
                                                case 'INACTIVE':
                                                default:
                                                    lifecycleBadge = {
                                                        label: 'Pausado',
                                                        bg: 'bg-slate-100 dark:bg-slate-800',
                                                        text: 'text-slate-500 dark:text-slate-400'
                                                    };
                                                    break;
                                            }

                                            // 2. Financial Badge (Health) - "Situación" Column
                                            let financialBadge = null;
                                            // 3. Date Detail - "Fechas" Column
                                            let dateDetail = '-';

                                            if (estado === 'overdue') {
                                                financialBadge = {
                                                    label: 'Vencido',
                                                    bg: 'bg-transparent',
                                                    text: 'text-rose-600 dark:text-rose-400',
                                                    dot: 'bg-rose-500'
                                                };
                                                dateDetail = estadoDetail;
                                            } else if (estado === 'pending') {
                                                financialBadge = {
                                                    label: 'Pendiente',
                                                    bg: 'bg-transparent',
                                                    text: 'text-amber-600 dark:text-amber-400',
                                                    dot: 'bg-amber-500'
                                                };
                                                // Show next payment date for pending (more useful than generic detail)
                                                if (nextPaymentDate) {
                                                    const dateObj = new Date(nextPaymentDate);
                                                    const dateStr = dateObj.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
                                                    dateDetail = `Vence: ${dateStr}`;
                                                } else {
                                                    dateDetail = estadoDetail;
                                                }
                                            } else if (estado === 'ok' && lifecycleStatus === 'ACTIVE') {
                                                // Active and OK -> Show "Al día" and Next Payment
                                                financialBadge = {
                                                    label: 'Al día',
                                                    bg: 'bg-transparent',
                                                    text: 'text-emerald-600 dark:text-emerald-400',
                                                    dot: 'bg-emerald-500'
                                                };

                                                if (nextPaymentDate) {
                                                    const dateObj = new Date(nextPaymentDate);
                                                    const dateStr = dateObj.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
                                                    dateDetail = `Próx: ${dateStr}`;
                                                }
                                            } else if (lifecycleStatus !== 'ACTIVE') {
                                                // Inactive logic for dates
                                                if (lastPayment) {
                                                    const dateObj = new Date(lastPayment.payment_date || lastPayment.period_date);
                                                    const dateStr = dateObj.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
                                                    dateDetail = `Último: ${dateStr}`;
                                                }
                                            }

                                            // Row Styling
                                            const isInactiveCommitment = lifecycleStatus !== 'ACTIVE';
                                            const rowOpacityClass = isInactiveCommitment ? 'opacity-50 grayscale hover:opacity-80 hover:grayscale-0 transition-all duration-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors';

                                            return (
                                                <tr
                                                    key={commitment.id}
                                                    className={`border-b border-slate-100 dark:border-slate-800 group ${rowOpacityClass}`}
                                                >
                                                    {/* Type Icon */}
                                                    <td className="px-6 py-4">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                                                            ${commitment.flow_type === 'INCOME' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30'}
                                                        `}>
                                                            {commitment.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    </td>

                                                    {/* Name */}
                                                    {/* Name + Frequency Badge */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-slate-900 dark:text-white">{commitment.name}</span>
                                                                {activeTerm?.frequency && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase tracking-wide border border-slate-200 dark:border-slate-700">
                                                                        {t(`frequency.${activeTerm.frequency.toLowerCase()}`) || activeTerm.frequency}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {commitment.notes && <div className="text-[10px] text-slate-400 italic mt-0.5 line-clamp-1">{commitment.notes}</div>}
                                                        </div>
                                                    </td>

                                                    {/* Category */}
                                                    <td className="px-6 py-4">
                                                        <span className="bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300">
                                                            {categories.find(c => c.id === commitment.category_id)?.name || 'Sin categoría'}
                                                        </span>
                                                    </td>

                                                    {/* Column 1: Estado (Lifecycle) */}
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${lifecycleBadge.bg} ${lifecycleBadge.text}`}>
                                                            {lifecycleBadge.label}
                                                        </span>
                                                    </td>

                                                    {/* Column 2: Situación (Financial Health) */}
                                                    <td className="px-6 py-4">
                                                        {financialBadge ? (
                                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${financialBadge.bg} ${financialBadge.text}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${financialBadge.dot}`}></span>
                                                                {financialBadge.label}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">Sin deuda</span>
                                                        )}
                                                    </td>

                                                    {/* Column 3: Fechas (Timeline) */}
                                                    <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                        {dateDetail}
                                                    </td>

                                                    {/* Amount */}
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="font-bold font-mono text-slate-900 dark:text-white">
                                                            {displayAmount !== null ? formatClp(displayAmount) : '-'}
                                                        </div>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {(() => {
                                                                const hasEndDate = !!activeTerm?.effective_until;
                                                                const isPausedOrTerminated = hasEndDate || isTerminated;
                                                                return (
                                                                    <button
                                                                        onClick={() => isPausedOrTerminated ? onResumeCommitment(commitment) : onPauseCommitment(commitment)}
                                                                        className={`p-1.5 rounded-lg transition-colors ${isPausedOrTerminated
                                                                            ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                                                            : 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                                                            }`}
                                                                        title={isPausedOrTerminated ? "Reanudar" : "Pausar"}
                                                                    >
                                                                        {isPausedOrTerminated ? <ArrowPathIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />}
                                                                    </button>
                                                                );
                                                            })()}
                                                            <button
                                                                onClick={() => onEditCommitment(commitment)}
                                                                className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                                                                title="Editar"
                                                            >
                                                                <EditIcon className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => onDeleteCommitment(commitment.id)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                                                title="Eliminar"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InventoryView;
