import React from 'react';
import { FunnelIcon, StarIcon } from '../icons';
import { CommitmentWithTerm } from '../../types.v2';
import { StatusFilter, ViewMode } from '../../hooks/useExpenseGridLogic';

interface FilterBarProps {
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    setSelectedStatus: (status: StatusFilter) => void;
    availableCategories: string[];
    commitments: CommitmentWithTerm[];
    viewMode: ViewMode;
    getTranslatedCategoryName: (c: CommitmentWithTerm) => string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
    selectedCategory,
    setSelectedCategory,
    setSelectedStatus,
    availableCategories,
    commitments,
    viewMode,
    getTranslatedCategoryName
}) => {
    return (
        <div className="lg:hidden sticky top-[58px] z-30 px-3 py-2 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800 transition-all">
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
    );
};
