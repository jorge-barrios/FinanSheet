import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
    Row,
} from '@tanstack/react-table';
import { Expense, PaymentStatus, ExpenseType } from '../types';
import { isInstallmentInMonth, isInstallmentInMonthWithVersioning, getInstallmentNumber } from '../utils/expenseCalculations';
import { IconProps, EditIcon, TrashIcon, ChevronDownIcon, HomeIcon, TransportIcon, DebtIcon, HealthIcon, SubscriptionIcon, MiscIcon, CategoryIcon } from './icons';
import { useLocalization } from '../hooks/useLocalization';
import ExpenseCard from './ExpenseCard';
import Sparkline from './Sparkline';

interface ExpenseGridProps {
    expenses: Expense[];
    paymentStatus: PaymentStatus;
    focusedDate: Date;
    onEditExpense: (expense: Expense) => void;
    onDeleteExpense: (expenseId: string) => void;
    onOpenCellEditor: (expenseId: string, year: number, month: number) => void;
    visibleMonthsCount: number;
    onFocusedDateChange?: (date: Date) => void;
}

const columnHelper = createColumnHelper<Expense>();

export const categoryIcons: Record<string, React.ReactElement<IconProps>> = {
    'Hogar': <HomeIcon />,
    'Transporte': <TransportIcon />,
    'Deudas y Préstamos': <DebtIcon />,
    'Salud y Bienestar': <HealthIcon />,
    'Suscripciones': <SubscriptionIcon />,
    'Varios': <MiscIcon />,
};

export const getCategoryIcon = (category: string) => {
    const icon = categoryIcons[category] || <CategoryIcon />;
    return React.cloneElement(icon, { className: 'w-5 h-5' });
};

const stringToHslColor = (str: string, s: number, l: number) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, ${s}%, ${l}%)`;
};

const ExpenseGrid: React.FC<ExpenseGridProps> = ({ expenses, paymentStatus, focusedDate, onEditExpense, onDeleteExpense, onOpenCellEditor, visibleMonthsCount, onFocusedDateChange }) => {
    const { t, formatClp, language, getLocalizedMonths } = useLocalization();
    const monthOptions = useMemo(() => getLocalizedMonths('long'), [getLocalizedMonths]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    const viewConfig = useMemo(() => {
        switch (visibleMonthsCount) {
            case 3: return { columnWidth: 240, amountClass: 'text-lg', detailsClass: 'text-sm' };
            case 6: return { columnWidth: 200, amountClass: 'text-base', detailsClass: 'text-xs' };
            case 7: return { columnWidth: 180, amountClass: 'text-base', detailsClass: 'text-xs' };
            case 12: return { columnWidth: 140, amountClass: 'text-sm', detailsClass: 'text-xs' };
            case 13: return { columnWidth: 140, amountClass: 'text-sm', detailsClass: 'text-xs' };
            case 25: return { columnWidth: 120, amountClass: 'text-sm', detailsClass: 'text-[10px]' };
            default: return { columnWidth: 140, amountClass: 'text-base', detailsClass: 'text-xs' };
        }
    }, [visibleMonthsCount]);
    
    const visibleMonths = useMemo(() => {
        const monthsToShow = visibleMonthsCount;
        const centerIndex = Math.floor(monthsToShow / 2);
        return Array.from({ length: monthsToShow }, (_, i) => {
            const monthOffset = i - centerIndex;
            return new Date(focusedDate.getFullYear(), focusedDate.getMonth() + monthOffset, 1);
        });
    }, [focusedDate, visibleMonthsCount]);
    
    const groupedExpenses = useMemo(() => {
        return expenses.reduce((acc, expense) => {
            const category = expense.category || t('grid.uncategorized');
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(expense);
            return acc;
        }, {} as Record<string, Expense[]>);
    }, [expenses, t]);

    useEffect(() => {
        setExpandedCategories(prev => {
            const newExpandedState = { ...prev };
            Object.keys(groupedExpenses).forEach(category => {
                if (newExpandedState[category] === undefined) newExpandedState[category] = true;
            });
            Object.keys(prev).forEach(category => {
                if (!groupedExpenses[category]) delete newExpandedState[category];
            });
            return newExpandedState;
        });
    }, [groupedExpenses]);

    const handleExpandAll = () => {
        const allExpanded = Object.keys(groupedExpenses).reduce((acc, category) => {
            acc[category] = true;
            return acc;
        }, {} as Record<string, boolean>);
        setExpandedCategories(allExpanded);
    };

    const handleCollapseAll = () => {
        const allCollapsed = Object.keys(groupedExpenses).reduce((acc, category) => {
            acc[category] = false;
            return acc;
        }, {} as Record<string, boolean>);
        setExpandedCategories(allCollapsed);
    };

    const getStatusStyles = (isPaid: boolean, isOverdue: boolean) => {
        if (isPaid) return { borderColor: 'border-l-teal-400', textColor: 'text-teal-500 dark:text-teal-300', dateColor: 'text-teal-600 dark:text-teal-400' };
        if (isOverdue) return { borderColor: 'border-l-rose-500', textColor: 'text-rose-500 dark:text-rose-400', dateColor: 'text-rose-500 dark:text-rose-400' };
        return { borderColor: 'border-l-amber-500', textColor: 'text-amber-600 dark:text-amber-400', dateColor: 'text-slate-500 dark:text-slate-500' };
    };
    
    const handleNavigation = (direction: 'past' | 'future') => {
        if (!scrollContainerRef.current) return;
        
        const container = scrollContainerRef.current;
        const containerWidth = container.clientWidth;
        const scrollWidth = container.scrollWidth;
        
        // Determine if we should use range navigation or horizontal scroll
        const hasHorizontalOverflow = scrollWidth > containerWidth + 10; // Add small buffer
        
        console.log(`Navigation debug: direction=${direction}, visibleMonths=${visibleMonthsCount}, containerWidth=${containerWidth}, scrollWidth=${scrollWidth}, hasOverflow=${hasHorizontalOverflow}`);
        
        if (hasHorizontalOverflow) {
            // Horizontal scroll: scroll within the current range when there's actual overflow
            const scrollAmount = containerWidth * 0.8;
            container.scrollBy({
                left: direction === 'future' ? scrollAmount : -scrollAmount,
                behavior: 'smooth',
            });
            console.log(`Using horizontal scroll: ${direction}`);
        } else {
            // Range navigation: change the focused date to show different months
            if (onFocusedDateChange) {
                const newFocusedDate = new Date(focusedDate);
                const monthsToMove = Math.max(1, Math.floor(visibleMonthsCount / 3)); // Move fewer months for larger views
                
                if (direction === 'future') {
                    newFocusedDate.setMonth(newFocusedDate.getMonth() + monthsToMove);
                } else {
                    newFocusedDate.setMonth(newFocusedDate.getMonth() - monthsToMove);
                }
                
                onFocusedDateChange(newFocusedDate);
                console.log(`Using range navigation: ${direction}, moving ${monthsToMove} months`);
            } else {
                // Fallback: log a message if no callback is provided
                console.log(`Navigation ${direction} requested but no onFocusedDateChange callback provided`);
                console.log('To fix this, add onFocusedDateChange prop to ExpenseGrid component');
            }
        }
    };

    const columns = useMemo(() => {
        const today = new Date();
        const expenseColumn = columnHelper.accessor('name', {
            header: () => (
                 <div className="text-left py-3 px-4 flex justify-between items-center w-full">
                    <span>{t('grid.expense')}</span>
                    {Object.keys(groupedExpenses).length > 0 && (
                        <div className="flex items-center gap-1.5">
                             <button
                                onClick={handleCollapseAll}
                                className="text-[11px] px-2 py-1 rounded-md font-medium text-slate-600 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                                title={t('grid.collapseAll')}
                            >
                                {t('grid.collapseAll')}
                            </button>
                            <button
                                onClick={handleExpandAll}
                                className="text-[11px] px-2 py-1 rounded-md font-medium text-slate-600 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                                title={t('grid.expandAll')}
                            >
                                {t('grid.expandAll')}
                            </button>
                        </div>
                    )}
                </div>
            ),
            cell: info => {
                const expense = info.row.original;
                const getTypeInfo = (type: ExpenseType) => {
                    switch (type) {
                        case ExpenseType.VARIABLE:
                            return {
                                label: t('form.type.variable'),
                                className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                            };
                        case ExpenseType.RECURRING:
                            return {
                                label: t('form.type.recurring'),
                                className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                            };
                        case ExpenseType.INSTALLMENT:
                            return {
                                label: t('form.type.installment'),
                                className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
                            };
                        default:
                            return {
                                label: t('form.type.variable'),
                                className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'
                            };
                    }
                };
                const typeInfo = getTypeInfo(expense.type);
                return (
                    <div className="flex justify-between items-center w-full h-full py-3 pl-6 pr-4">
                        <div className="flex flex-col items-start gap-1.5 truncate">
                            <div className="font-semibold text-slate-800 dark:text-white truncate w-full" title={expense.name}>{expense.name}</div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeInfo.className}`}>
                                {typeInfo.label}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                            <button onClick={() => onEditExpense(expense)} aria-label={`Edit ${expense.name}`} className="text-slate-500 dark:text-slate-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors p-2 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-700/50"><EditIcon /></button>
                            <button onClick={() => { console.log('Delete button clicked for expense:', expense.id); onDeleteExpense(expense.id); }} aria-label={`Delete ${expense.name}`} className="text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-2 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-700/50"><TrashIcon /></button>
                        </div>
                    </div>
                );
            },
            footer: () => <div className="text-left font-bold py-4 px-4">{t('grid.monthlyTotal')}</div>,
            size: 300,
        });

        const monthColumns = visibleMonths.map(date => {
            const year = date.getFullYear();
            const monthIndex = date.getMonth();
            const monthName = date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short' });
            const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
            const highlightHeaderClass = isCurrentMonth ? 'bg-teal-100 dark:bg-teal-900/40' : '';
            
            return columnHelper.display({
                id: `${year}-${monthIndex}`,
                header: () => (
                    <div className={`text-center py-3 h-full flex flex-col justify-center transition-colors ${highlightHeaderClass}`}>
                        <span className="capitalize">{monthName}</span>
                        <br />
                        <span className="text-xs text-slate-500 dark:text-slate-500">{year}</span>
                    </div>
                ),
                cell: ({ row }) => {
                    const expense = row.original;
                    // Use versioning logic for recurring expenses to ensure correct version is shown
                    const isInMonth = expense.type === ExpenseType.RECURRING 
                        ? isInstallmentInMonthWithVersioning(expenses, expense, year, monthIndex)
                        : isInstallmentInMonth(expense, year, monthIndex);
                    
                    const cellBgClass = isCurrentMonth ? 'bg-teal-50/30 dark:bg-teal-900/20' : '';

                    // Special handling for VARIABLE expenses
                    if (expense.type === ExpenseType.VARIABLE) {
                        const paymentDetails = paymentStatus[expense.id]?.[`${year}-${monthIndex}`];
                        const hasPayment = paymentDetails && (paymentDetails.paid !== undefined || paymentDetails.overriddenAmount !== undefined);
                        
                        // For VARIABLE expenses: always show "Add" button if no payment in this specific month
                        // This allows multiple independent occurrences across different months
                        if (!hasPayment) {
                            return (
                                <div className={`h-full w-full p-1 transition-colors ${cellBgClass}`}>
                                    <div 
                                        className="cursor-pointer w-full h-full flex items-center justify-center rounded-md px-3 py-2 transition-colors bg-slate-50/50 dark:bg-slate-800/20 hover:bg-teal-100/60 dark:hover:bg-teal-900/40 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-teal-400 dark:hover:border-teal-500"
                                        onClick={() => onOpenCellEditor(expense.id, year, monthIndex)}
                                        title={`Agregar ${expense.name} en ${monthOptions[monthIndex]} ${year}`}
                                    >
                                        <div className="text-center">
                                            <div className="text-2xl text-slate-400 dark:text-slate-500 hover:text-teal-500 dark:hover:text-teal-400 transition-colors mb-1">+</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{t('grid.addOccurrence')}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        // If has payment in this month, continue to show payment details below
                    } else if (!isInMonth) {
                        // For non-variable expenses, show empty cell if not in month
                        return <div className={`text-center text-slate-300 dark:text-slate-700 h-full w-full flex items-center justify-center cursor-not-allowed select-none transition-colors ${cellBgClass}`}>-</div>;
                    }

                    // ID ESTABLE: Con la nueva arquitectura, el ID nunca cambia, por lo que los pagos siempre están asociados correctamente
                    const paymentDetails = paymentStatus[expense.id]?.[`${year}-${monthIndex}`];
                    
                    // Para gastos en cuotas, calcular el valor por cuota
                    let baseAmount = expense.amountInClp || 0; // PROTEGER CONTRA NaN
                    if (expense.type === ExpenseType.INSTALLMENT && expense.installments > 0) {
                        baseAmount = (expense.amountInClp || 0) / expense.installments;
                    }
                    
                    // Payment-first logic: if payment exists, use paid amount; otherwise use calculated amount
                    const amountInBase = paymentDetails?.overriddenAmount ?? baseAmount;
                    
                    // VALIDACIÓN CRÍTICA: Asegurar que amountInBase sea un número válido
                    const safeAmount = isNaN(amountInBase) || amountInBase === null || amountInBase === undefined ? 0 : amountInBase;
                    const isPaid = paymentDetails?.paid ?? false;
                    

                    const dueDate = paymentDetails?.overriddenDueDate ?? expense.dueDate;
                    const installmentNumber = getInstallmentNumber(expense, year, monthIndex);
                    
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const dueDateForMonth = new Date(year, monthIndex, dueDate);
                    const isOverdue = !isPaid && dueDateForMonth < today;
                    const locale = language === 'es' ? 'es-ES' : 'en-US';
                    const { borderColor, textColor, dateColor } = getStatusStyles(isPaid, isOverdue);
                    const { amountClass, detailsClass } = viewConfig;
                    
                    // Check if this is the current month for special styling
                    const currentDate = new Date();
                    const isThisCurrentMonth = currentDate.getFullYear() === year && currentDate.getMonth() === monthIndex;
                    const borderWidth = isThisCurrentMonth ? 'border-l-8' : 'border-l-4';
                    
                    return (
                        <div className={`h-full w-full p-1 transition-colors ${cellBgClass}`} onClick={() => onOpenCellEditor(expense.id, year, monthIndex)}>
                            <div className={`cursor-pointer w-full h-full flex flex-col justify-between rounded-md px-3 py-2 transition-colors bg-slate-100/50 dark:bg-slate-800/40 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 ${borderWidth} ${borderColor}`}>
                                {/* Top part: Amount, aligned to top-right */}
                                <div className="text-right">
                                    <span className={`font-bold ${amountClass} ${textColor}`}>{formatClp(safeAmount)}</span>
                                </div>

                                {/* Bottom part: Details, aligned to bottom-left */}
                                <div className="text-left">
                                    {installmentNumber && expense.installments < 999 && (
                                        <span className={`block text-slate-500 dark:text-slate-400 ${detailsClass}`}>{`${t('grid.installment')} ${installmentNumber}/${expense.installments}`}</span>
                                    )}
                                    {expense.installments >= 999 && expense.type === ExpenseType.RECURRING && (
                                        <span className={`block font-medium ${detailsClass} ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                            ∞ Recurrente
                                        </span>
                                    )}
                                    <span className={`block text-slate-500 dark:text-slate-500 mt-0.5 ${detailsClass}`}>
                                        {`${t('grid.dueDate')}: ${dueDate}/${monthIndex + 1}`}
                                    </span>
                                    
                                    {/* Status info */}
                                    {(isPaid && paymentDetails?.paymentDate) ? (
                                        <div className={`block ${dateColor} mt-1 ${detailsClass} flex items-center gap-1 ${isThisCurrentMonth ? 'font-bold' : ''}`}>
                                            <span>{`Pagado ${new Date(paymentDetails.paymentDate).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })}`}</span>
                                            {(() => {
                                                const paymentDate = new Date(paymentDetails.paymentDate);
                                                const wasOnTime = paymentDate <= dueDateForMonth;
                                                return wasOnTime ? <span className="text-yellow-500" title="Pagado a tiempo">⭐</span> : null;
                                            })()}
                                        </div>
                                    ) : isOverdue ? (
                                        <span className={`block ${dateColor} mt-1 ${detailsClass} ${isThisCurrentMonth ? 'font-bold' : ''}`}>
                                            {(() => {
                                                const daysOverdue = Math.floor((today.getTime() - dueDateForMonth.getTime()) / (1000 * 60 * 60 * 24));
                                                return `Atrasado (${daysOverdue} día${daysOverdue !== 1 ? 's' : ''})`;
                                            })()}
                                        </span>
                                    ) : isCurrentMonth ? (
                                        <span className={`block text-amber-600 dark:text-amber-400 mt-1 ${detailsClass} ${isThisCurrentMonth ? 'font-bold' : ''}`}>
                                            {(() => {
                                                const daysUntilDue = Math.floor((dueDateForMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                                return daysUntilDue >= 0 
                                                    ? `Pendiente (${daysUntilDue} día${daysUntilDue !== 1 ? 's' : ''} restantes)` 
                                                    : `Pendiente`;
                                            })()}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    );
                },
                footer: () => {
                    const totalInBase = expenses.reduce((sum, expense) => {
                        const isInMonth = expense.type === ExpenseType.RECURRING 
                            ? isInstallmentInMonthWithVersioning(expenses, expense, year, monthIndex)
                            : isInstallmentInMonth(expense, year, monthIndex);
                        
                        if (isInMonth) {
                             // ID ESTABLE: Con la nueva arquitectura, el ID nunca cambia
                             const paymentDetails = paymentStatus[expense.id]?.[`${year}-${monthIndex}`];
                             
                             // Para gastos en cuotas, calcular el valor por cuota
                             let baseAmount = expense.amountInClp || 0; // PROTEGER CONTRA NaN
                             if (expense.type === ExpenseType.INSTALLMENT && expense.installments > 0) {
                                 baseAmount = (expense.amountInClp || 0) / expense.installments;
                             }
                             
                             // Payment-first logic: if payment exists, use paid amount; otherwise use calculated amount
                             const amountInBase = paymentDetails?.overriddenAmount ?? baseAmount;
                             
                             // VALIDACIÓN: Solo sumar si es un número válido
                             const safeAmount = isNaN(amountInBase) || amountInBase === null || amountInBase === undefined ? 0 : amountInBase;
                            return sum + safeAmount;
                        }
                        return sum;
                    }, 0);
                    return <div className={`text-right font-bold font-mono text-teal-600 dark:text-teal-300 py-4 px-4 transition-colors ${highlightHeaderClass}`}>{totalInBase > 0 ? formatClp(totalInBase) : '-'}</div>;
                },
                size: viewConfig.columnWidth,
            });
        });
        
        // Crear columna de tendencia con sparklines
        const trendColumn = columnHelper.display({
            id: 'trend',
            header: () => (
                <div className="trend-column text-center py-3 h-full flex flex-col justify-center">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Tendencia</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">6M</span>
                </div>
            ),
            cell: ({ row }) => {
                const expense = row.original;
                
                // Obtener datos de los últimos 6 meses para el sparkline
                const sparklineData: number[] = [];
                const currentDate = new Date();
                
                for (let i = 5; i >= 0; i--) {
                    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
                    const year = targetDate.getFullYear();
                    const monthIndex = targetDate.getMonth();
                    
                    const isInMonth = expense.type === ExpenseType.RECURRING 
                        ? isInstallmentInMonthWithVersioning(expenses, expense, year, monthIndex)
                        : isInstallmentInMonth(expense, year, monthIndex);
                    
                    if (isInMonth) {
                        const paymentDetails = paymentStatus[expense.id]?.[`${year}-${monthIndex}`];
                        
                        let baseAmount = expense.amountInClp;
                        if (expense.type === ExpenseType.INSTALLMENT && expense.installments > 0) {
                            baseAmount = expense.amountInClp / expense.installments;
                        }
                        
                        const amountInBase = paymentDetails?.overriddenAmount ?? baseAmount;
                        sparklineData.push(amountInBase);
                    } else {
                        sparklineData.push(0);
                    }
                }
                
                return (
                    <div className="sparkline-container trend-column">
                        <Sparkline 
                            data={sparklineData}
                            width={100}
                            height={28}
                            showTrend={true}
                            className=""
                        />
                    </div>
                );
            },
            footer: () => (
                <div className="trend-column text-center py-4 px-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Análisis</span>
                </div>
            ),
            size: 140,
        });
        
        return [expenseColumn, ...monthColumns, trendColumn];

    }, [visibleMonths, expenses, paymentStatus, onDeleteExpense, onEditExpense, onOpenCellEditor, t, formatClp, language, groupedExpenses, viewConfig]);

    const table = useReactTable({ data: expenses, columns, getCoreRowModel: getCoreRowModel() });

    useEffect(() => {
        // This effect centers the view on the focused month when the date changes.
        if (scrollContainerRef.current && table.getAllLeafColumns().length > 1) {
            const container = scrollContainerRef.current;
            const allColumns = table.getAllLeafColumns();
            
            const centerColumnIndex = 1 + Math.floor(visibleMonthsCount / 2); // Expense col + half of visible months

            if (allColumns.length > centerColumnIndex) {
                const centerColumn = allColumns[centerColumnIndex];
                const centerColumnWidth = centerColumn.getSize();

                let offsetToCenterColumn = 0;
                for (let i = 0; i < centerColumnIndex; i++) {
                    offsetToCenterColumn += allColumns[i].getSize();
                }
                
                // To center the column, we find its middle point and subtract half the container width
                const scrollLeft = offsetToCenterColumn - (container.clientWidth / 2) + (centerColumnWidth / 2);
                
                container.scrollTo({
                    left: scrollLeft > 0 ? scrollLeft : 0,
                    behavior: 'smooth',
                });
            }
        }
    }, [focusedDate, table, visibleMonthsCount]); // Dependency on table ensures it runs after table is initialized.

    const toggleCategory = (category: string) => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));

    const renderRow = (row: Row<Expense>) => {
        return (
            <tr key={row.id} className="group/row border-b border-slate-200 dark:border-slate-700 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                {row.getVisibleCells().map((cell, index) => {
                    const isFirstColumn = index === 0;
                    return (
                        <td
                            key={cell.id}
                            className={`align-middle transition-colors h-24 ${
                                isFirstColumn 
                                    ? 'sticky left-0 z-10 !bg-white dark:!bg-slate-900 group-hover/row:!bg-slate-50 dark:group-hover/row:!bg-slate-800' 
                                    : '!bg-white dark:!bg-slate-900 group-hover/row:!bg-slate-50 dark:group-hover/row:!bg-slate-800'
                            }`}
                            style={{ width: cell.column.getSize(), minWidth: cell.column.getSize() }}
                        >
                            <div className={`h-full flex items-center relative ${
                                isFirstColumn ? 'justify-start pl-6' : 'justify-end pr-4'
                            }`}>
                                {isFirstColumn && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: stringToHslColor(cell.row.original.category, 60, 50) }}></div>
                                )}
                                <div className={`${isFirstColumn ? 'text-left !text-slate-900 dark:!text-white' : 'text-right numeric-cell !text-slate-900 dark:!text-white'}`}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </div>
                            </div>
                        </td>
                    );
                })}
            </tr>
        );
    };

    return (
        <div className="px-4 pb-8">
            <div className="lg:hidden space-y-4">
                {expenses.length > 0 ? expenses.map(expense => (
                     <ExpenseCard
                        key={expense.id}
                        expense={expense}
                        paymentStatus={paymentStatus}
                        currentYear={new Date().getFullYear()}
                        onEditExpense={onEditExpense}
                        onDeleteExpense={onDeleteExpense}
                        onOpenCellEditor={onOpenCellEditor}
                    />
                )) : (
                    <div className="text-center py-16 text-slate-500"><p className="text-lg">{t('grid.noMatch')}</p></div>
                )}
            </div>

            <div className="hidden lg:block">
                {/* Month range indicator header */}
                <div className="text-center mb-4">
                    <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {/* Month range indicator */}
                        {(() => {
                            if (visibleMonths.length === 0) return '';
                            
                            const firstMonth = visibleMonths[0];
                            const lastMonth = visibleMonths[visibleMonths.length - 1];
                            
                            const firstMonthName = monthOptions[firstMonth.getMonth()];
                            const lastMonthName = monthOptions[lastMonth.getMonth()];
                            const firstYear = firstMonth.getFullYear();
                            const lastYear = lastMonth.getFullYear();
                            
                            if (firstMonth.getTime() === lastMonth.getTime()) {
                                return `${firstMonthName} ${firstYear}`;
                            }
                            
                            if (firstYear === lastYear) {
                                return `${firstMonthName} - ${lastMonthName} ${firstYear}`;
                            } else {
                                return `${firstMonthName} ${firstYear} - ${lastMonthName} ${lastYear}`;
                            }
                        })()}
                    </div>
                </div>
                
                <div className="relative">
                    {/* Enhanced Temporal Navigation */}
                    <div className="fixed top-4 right-4 z-50 temporal-navigation">
                        <button
                            onClick={() => {
                                if (onFocusedDateChange) {
                                    const newDate = new Date(focusedDate);
                                    newDate.setMonth(newDate.getMonth() - 3);
                                    onFocusedDateChange(newDate);
                                }
                            }}
                            className="temporal-nav-button"
                            title="Retroceder 3 meses"
                        >
                            -3M
                        </button>
                        <button
                            onClick={() => handleNavigation('past')}
                            className="temporal-nav-button"
                            title="Mes anterior"
                        >
                            ←
                        </button>
                        <button
                            onClick={() => {
                                if (onFocusedDateChange) {
                                    onFocusedDateChange(new Date());
                                }
                            }}
                            className="temporal-nav-button active"
                            title="Ir al mes actual"
                        >
                            Hoy
                        </button>
                        <button
                            onClick={() => handleNavigation('future')}
                            className="temporal-nav-button"
                            title="Mes siguiente"
                        >
                            →
                        </button>
                        <button
                            onClick={() => {
                                if (onFocusedDateChange) {
                                    const newDate = new Date(focusedDate);
                                    newDate.setMonth(newDate.getMonth() + 3);
                                    onFocusedDateChange(newDate);
                                }
                            }}
                            className="temporal-nav-button"
                            title="Avanzar 3 meses"
                        >
                            +3M
                        </button>
                        <button
                            onClick={() => {
                                if (onFocusedDateChange) {
                                    const newDate = new Date(focusedDate);
                                    newDate.setFullYear(newDate.getFullYear() + 1);
                                    onFocusedDateChange(newDate);
                                }
                            }}
                            className="temporal-nav-button"
                            title="Avanzar 1 año"
                        >
                            +1A
                        </button>
                    </div>
                    
                    <div className="min-w-full align-middle">
                        <div ref={scrollContainerRef} className="expense-grid-container overflow-auto no-scrollbar border border-slate-200/80 dark:border-slate-800/80 rounded-lg shadow-sm">
                            <div className="relative">
                        <table className="expense-grid w-full border-collapse">
                            <thead className="sticky top-0 !z-25 !bg-slate-50 dark:!bg-slate-800" style={{position: 'sticky', top: 0, zIndex: 25}}>
                                {table.getHeaderGroups().map(headerGroup => (
                                    <tr key={headerGroup.id} className="border-b-2 border-slate-300 dark:border-slate-600">
                                        {headerGroup.headers.map((header, index) => (
                                             <th key={header.id} scope="col" className={`
                                                text-sm font-bold !text-slate-800 dark:!text-slate-200
                                                ${index === 0 
                                                    ? 'sticky left-0 !z-50 !bg-slate-50 dark:!bg-slate-800 text-left !opacity-100' 
                                                    : 'text-right !bg-slate-50 dark:!bg-slate-800 !z-25'
                                                }
                                            `} style={{width: header.column.getSize(), minWidth: header.column.getSize(), position: index === 0 ? 'sticky' : undefined, zIndex: index === 0 ? 50 : 25}}>
                                                <div className={`h-16 flex items-center px-4 ${index === 0 ? 'justify-start' : 'justify-end'}`}>
                                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                                </div>
                                             </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {Object.keys(groupedExpenses).length > 0 ? Object.keys(groupedExpenses).sort().map((category) => {
                                    const isExpanded = expandedCategories[category] ?? true;
                                    const categoryExpenses = groupedExpenses[category];
                                    const categoryRows = table.getRowModel().rows.filter(row => categoryExpenses.some(exp => exp.id === row.original.id));

                                    return (
                                        <React.Fragment key={category}>
                                            <tr className="sticky top-16 z-30 group/catrow">
                                                <td
                                                    colSpan={columns.length}
                                                    className="text-center font-bold text-sm text-slate-800 dark:text-slate-100 py-4 px-4 bg-slate-100 dark:bg-slate-800 group-hover/catrow:bg-slate-200 dark:group-hover/catrow:bg-slate-700 transition-colors cursor-pointer border-y-2 border-slate-300 dark:border-slate-600 sticky left-0 z-25 shadow-sm"
                                                    onClick={() => toggleCategory(category)}
                                                >
                                                    <div className="flex items-center justify-center gap-3">
                                                        <ChevronDownIcon className={`w-5 h-5 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                                        <div className="flex items-center gap-2">
                                                            {getCategoryIcon(category)} 
                                                            <span className="font-semibold">{category}</span>
                                                        </div>
                                                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-300 dark:bg-slate-600 px-2 py-1 rounded-full">({categoryExpenses.length})</span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && categoryRows.map(row => renderRow(row))}
                                        </React.Fragment>
                                    )
                                }) : (
                                    <tr><td colSpan={columns.length} className="text-center py-16 text-slate-500"><p className="text-lg">{t('grid.noMatch')}</p></td></tr>
                                )}
                            </tbody>
                            <tfoot className="sticky bottom-0 z-20">
                                {table.getFooterGroups().map(footerGroup => (
                                    <tr key={footerGroup.id} className="border-t-2 border-slate-400 dark:border-slate-600 !bg-slate-100 dark:!bg-slate-800">
                                        {footerGroup.headers.map((header, index) => (
                                            <th key={header.id} scope="col" className={`
                                                text-lg font-bold !text-slate-900 dark:!text-slate-100
                                                ${index === 0 
                                                    ? 'sticky left-0 z-30 !bg-slate-100 dark:!bg-slate-800 text-left' 
                                                    : 'text-right !bg-slate-100 dark:!bg-slate-800'
                                                }
                                            `} style={{width: header.column.getSize(), minWidth: header.column.getSize()}}>
                                                <div className={`h-16 flex items-center numeric-cell !text-slate-900 dark:!text-white ${
                                                    index === 0 ? 'justify-start pl-6' : 'justify-end pr-4'
                                                }`}>
                                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </tfoot>
                        </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpenseGrid;
