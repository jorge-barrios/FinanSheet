import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
    Row,
} from '@tanstack/react-table';
import { Expense, PaymentStatus, ExpenseType } from '../types';
import { getInstallmentAmount, isInstallmentInMonth, getInstallmentNumber } from '../utils/expenseCalculations';
import { IconProps, EditIcon, TrashIcon, ChevronDownIcon, HomeIcon, TransportIcon, DebtIcon, HealthIcon, SubscriptionIcon, MiscIcon, CategoryIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { useLocalization } from '../hooks/useLocalization';
import ExpenseCard from './ExpenseCard';

interface ExpenseGridProps {
    expenses: Expense[];
    paymentStatus: PaymentStatus;
    focusedDate: Date;
    onEditExpense: (expense: Expense) => void;
    onDeleteExpense: (expenseId: string) => void;
    onOpenCellEditor: (expenseId: string, year: number, month: number) => void;
    visibleMonthsCount: number;
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

const ExpenseGrid: React.FC<ExpenseGridProps> = ({ expenses, paymentStatus, focusedDate, onEditExpense, onDeleteExpense, onOpenCellEditor, visibleMonthsCount }) => {
    const { t, formatClp, language } = useLocalization();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    const viewConfig = useMemo(() => {
        switch (visibleMonthsCount) {
            case 3: return { columnWidth: 240, amountClass: 'text-lg', detailsClass: 'text-sm' };
            case 7: return { columnWidth: 200, amountClass: 'text-lg', detailsClass: 'text-xs' };
            case 25: return { columnWidth: 120, amountClass: 'text-sm', detailsClass: 'text-[10px]' };
            case 13:
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
    
    const handleLocalScroll = (direction: 'past' | 'future') => {
        if (scrollContainerRef.current) {
            const scrollAmount = viewConfig.columnWidth * 3; // Scroll by 3 columns width for a noticeable jump
            scrollContainerRef.current.scrollBy({
                left: direction === 'past' ? -scrollAmount : scrollAmount,
                behavior: 'smooth',
            });
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
                const isFixed = expense.type === ExpenseType.RECURRING;
                return (
                    <div className="flex justify-between items-center w-full h-full py-3 pl-6 pr-4">
                        <div className="flex flex-col items-start gap-1.5 truncate">
                            <div className="font-semibold text-slate-800 dark:text-white truncate w-full" title={expense.name}>{expense.name}</div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isFixed ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'}`}>
                                {t(isFixed ? 'form.type.fixed' : 'form.type.variable')}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                            <button onClick={() => onEditExpense(expense)} aria-label={`Edit ${expense.name}`} className="text-slate-500 dark:text-slate-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors p-2 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-700/50"><EditIcon /></button>
                            <button onClick={() => onDeleteExpense(expense.id)} aria-label={`Delete ${expense.name}`} className="text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-2 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-700/50"><TrashIcon /></button>
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
                    const isInMonth = isInstallmentInMonth(expense, year, monthIndex);
                    
                    const cellBgClass = isCurrentMonth ? 'bg-teal-50/30 dark:bg-teal-900/20' : '';

                    if (!isInMonth) return <div className={`text-center text-slate-300 dark:text-slate-700 h-full w-full flex items-center justify-center cursor-not-allowed select-none transition-colors ${cellBgClass}`}>-</div>;

                    const paymentDetails = paymentStatus[expense.id]?.[`${year}-${monthIndex}`];
                    const amountInBase = paymentDetails?.overriddenAmount ?? getInstallmentAmount(expense);
                    const isPaid = paymentDetails?.paid ?? false;
                    const dueDate = paymentDetails?.overriddenDueDate ?? expense.dueDate;
                    const installmentNumber = getInstallmentNumber(expense, year, monthIndex);
                    
                    const dueDateForMonth = new Date(year, monthIndex, dueDate);
                    const isOverdue = !isPaid && dueDateForMonth < today;
                    const locale = language === 'es' ? 'es-ES' : 'en-US';
                    const { borderColor, textColor, dateColor } = getStatusStyles(isPaid, isOverdue);
                    const { amountClass, detailsClass } = viewConfig;
                    
                    return (
                        <div className={`h-full w-full p-1 transition-colors ${cellBgClass}`} onClick={() => onOpenCellEditor(expense.id, year, monthIndex)}>
                            <div className={`cursor-pointer w-full h-full flex flex-col justify-between rounded-md px-3 py-2 transition-colors bg-slate-100/50 dark:bg-slate-800/40 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 border-l-4 ${borderColor}`}>
                                {/* Top part: Amount, aligned to top-right */}
                                <div className="text-right">
                                    <span className={`font-bold ${amountClass} ${textColor}`}>{formatClp(amountInBase)}</span>
                                </div>

                                {/* Bottom part: Details, aligned to bottom-left */}
                                <div className="text-left">
                                    {installmentNumber && expense.installments < 999 && (
                                        <span className={`block text-slate-500 dark:text-slate-400 ${detailsClass}`}>{`${t('grid.installment')} ${installmentNumber}/${expense.installments}`}</span>
                                    )}
                                    <span className={`block text-slate-500 dark:text-slate-500 mt-0.5 ${detailsClass}`}>{`${t('grid.dueDate')}: ${dueDate}`}</span>
                                    
                                    {/* Status info */}
                                    {(isPaid && paymentDetails?.paymentDate) ? (
                                        <span className={`block ${dateColor} mt-1 ${detailsClass}`}>{`${t('grid.paymentDate')} ${new Date(paymentDetails.paymentDate).toLocaleDateString(locale)}`}</span>
                                    ) : isOverdue ? (
                                        <span className={`block ${dateColor} font-bold mt-1 ${detailsClass}`}>{t('grid.overdue')}</span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    );
                },
                footer: () => {
                    const totalInBase = expenses.reduce((sum, expense) => {
                        if (isInstallmentInMonth(expense, year, monthIndex)) {
                             const paymentDetails = paymentStatus[expense.id]?.[`${year}-${monthIndex}`];
                             const amountInBase = paymentDetails?.overriddenAmount ?? getInstallmentAmount(expense);
                            return sum + amountInBase;
                        }
                        return sum;
                    }, 0);
                    return <div className={`text-right font-bold font-mono text-teal-600 dark:text-teal-300 py-4 px-4 transition-colors ${highlightHeaderClass}`}>{totalInBase > 0 ? formatClp(totalInBase) : '-'}</div>;
                },
                size: viewConfig.columnWidth,
            });
        });
        
        return [expenseColumn, ...monthColumns];

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
            <tr key={row.id} className="group/row border-b border-slate-200 dark:border-slate-800/80 last:border-b-0">
                {row.getVisibleCells().map((cell, index) => {
                    const isFirstColumn = index === 0;
                    return (
                        <td
                            key={cell.id}
                            className={`align-middle transition-colors h-24 ${isFirstColumn ? 'sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/50' : 'bg-white dark:bg-slate-900 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/50'}`}
                            style={{ width: cell.column.getSize(), minWidth: cell.column.getSize() }}
                        >
                            <div className={`h-full flex items-center relative ${isFirstColumn ? 'justify-start' : 'justify-center'}`}>
                                {isFirstColumn && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: stringToHslColor(cell.row.original.category, 60, 50) }}></div>
                                )}
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
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

            <div className="hidden lg:block min-w-full align-middle relative group/grid">
                <button
                    onClick={() => handleLocalScroll('past')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-lg opacity-0 group-hover/grid:opacity-100 focus:opacity-100"
                    aria-label={t('grid.nav_past')}
                >
                    <ChevronLeftIcon className="w-8 h-8 text-slate-600 dark:text-slate-300" />
                </button>
                
                <div ref={scrollContainerRef} className="overflow-auto no-scrollbar border border-slate-200/80 dark:border-slate-800/80 rounded-lg shadow-sm">
                    <div className="relative">
                        <table className="min-w-full" style={{ borderSpacing: 0 }}>
                            <thead className="sticky top-0 z-20">
                                {table.getHeaderGroups().map(headerGroup => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map((header, index) => (
                                            <th key={header.id} scope="col"
                                                className={`
                                                    text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800
                                                    ${index === 0 ? 'sticky left-0 z-20' : ''}
                                                `}
                                                style={{ width: header.column.getSize(), minWidth: header.column.getSize() }}>
                                                <div className="h-16 flex items-center justify-center">
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
                                    const categoryRows = categoryExpenses.map(exp => table.getRowModel().rows.find(r => r.original.id === exp.id)).filter(Boolean) as Row<Expense>[];

                                    return (
                                        <React.Fragment key={category}>
                                            <tr className="sticky top-16 z-10 group/catrow">
                                                <td
                                                    colSpan={columns.length}
                                                    className="text-left font-semibold text-sm text-slate-700 dark:text-slate-200 py-2 px-4 bg-slate-200/80 dark:bg-slate-800/80 backdrop-blur-sm group-hover/catrow:bg-slate-300/50 dark:group-hover/catrow:bg-slate-700/50 transition-colors cursor-pointer border-y border-slate-300 dark:border-slate-700/50"
                                                    onClick={() => toggleCategory(category)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <ChevronDownIcon className={`w-5 h-5 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                                        <div className="flex items-center gap-2">
                                                            {getCategoryIcon(category)} 
                                                            <span>{category}</span>
                                                        </div>
                                                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({categoryExpenses.length})</span>
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
                                    <tr key={footerGroup.id} className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm">
                                        {footerGroup.headers.map((header, index) => (
                                            <th key={header.id} scope="col" className={`
                                                text-lg font-semibold text-slate-800 dark:text-slate-200
                                                ${index === 0 ? 'sticky left-0 z-10' : ''}
                                            `} style={{width: header.column.getSize(), minWidth: header.column.getSize()}}>
                                                <div className="h-16 flex items-center justify-end pr-4">
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

                <button
                    onClick={() => handleLocalScroll('future')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-lg opacity-0 group-hover/grid:opacity-100 focus:opacity-100"
                    aria-label={t('grid.nav_future')}
                >
                    <ChevronRightIcon className="w-8 h-8 text-slate-600 dark:text-slate-300" />
                </button>
            </div>
        </div>
    );
};

export default ExpenseGrid;
