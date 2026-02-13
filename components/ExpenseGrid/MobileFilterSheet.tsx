/**
 * MobileFilterSheet.tsx
 *
 * Bottom sheet for mobile filter selection (category + status).
 * Same visual pattern as KPISelectorModal.
 */

import React from 'react';
import { Star, X } from 'lucide-react';
import type { StatusFilter } from '../../hooks/useExpenseGridLogic';
import { useLocalization } from '../../hooks/useLocalization';

interface MobileFilterSheetProps {
    isOpen: boolean;
    onClose: () => void;
    categories: string[];
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    selectedStatus: StatusFilter;
    onStatusChange: (status: StatusFilter) => void;
}

export const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({
    isOpen,
    onClose,
    categories,
    selectedCategory,
    onCategoryChange,
    selectedStatus,
    onStatusChange,
}) => {
    const { t } = useLocalization();

    // Status options with i18n labels (fintech aligned terminology)
    const statusOptions: { id: StatusFilter; label: string }[] = [
        { id: 'all', label: t('filter.all') },
        { id: 'pendiente', label: t('filter.porPagar') },
        { id: 'pagado', label: t('filter.pagado') },
        { id: 'ingresos', label: t('filter.ingresos') },
    ];

    if (!isOpen) return null;

    const hasActiveFilter = selectedCategory !== 'all' || selectedStatus !== 'all';

    const handleClear = () => {
        onCategoryChange('all');
        onStatusChange('all');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Bottom Sheet */}
            <div className="relative w-full bg-white dark:bg-slate-900 rounded-t-3xl p-4 pb-8 animate-in slide-in-from-bottom duration-300 max-h-[70vh] overflow-y-auto">
                {/* Handle */}
                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Filtros</h3>
                    <div className="flex items-center gap-2">
                        {hasActiveFilter && (
                            <button
                                onClick={handleClear}
                                className="text-xs font-medium text-sky-500 hover:text-sky-600 dark:text-sky-400 px-2 py-1 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                            >
                                Limpiar
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Status Section */}
                <div className="mb-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                        Estado
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {statusOptions.map((option) => {
                            const isActive = selectedStatus === option.id;
                            return (
                                <button
                                    key={option.id}
                                    onClick={() => {
                                        onStatusChange(option.id);
                                        onClose();
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${isActive
                                        ? 'bg-sky-500 text-white shadow-sm'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Category Section */}
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                        Categoría
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => {
                            const isActive = selectedCategory === cat;
                            const isImportant = cat === 'FILTER_IMPORTANT';
                            const label = isImportant ? 'Importantes' : cat === 'all' ? 'Todas' : cat;

                            return (
                                <button
                                    key={cat}
                                    onClick={() => {
                                        onCategoryChange(cat);
                                        onClose();
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${isActive
                                        ? 'bg-sky-500 text-white shadow-sm'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {isImportant && <Star className={`w-3.5 h-3.5 ${isActive ? 'fill-white' : 'fill-amber-500 text-amber-500'}`} />}
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
