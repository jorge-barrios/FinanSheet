import React, { useState, useRef, useEffect } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { PlusIcon, EditIcon, TrashIcon, CheckIcon, XMarkIcon, CategoryIcon } from './icons';
import { getCategoryIcon } from '../utils/categoryIcons';
import type { Category } from '../services/categoryService.v2';
import * as Dialog from '@radix-ui/react-dialog';

interface CategoryManagerProps {
    isOpen: boolean;
    onClose: () => void;
    categories: Category[];
    onAdd: (newCategory: string) => void;
    onEdit: (oldName: string, newName: string) => void;
    onDelete: (category: string) => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ isOpen, onClose, categories, onAdd, onEdit, onDelete }) => {
    const { t } = useLocalization();
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when adding
    useEffect(() => {
        if (isAdding && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isAdding]);

    const handleAdd = () => {
        if (newCategoryName.trim()) {
            onAdd(newCategoryName.trim());
            setNewCategoryName('');
            setIsAdding(false);
        }
    };

    const handleStartEdit = (category: string) => {
        setEditingCategory(category);
        setEditingValue(category);
    };

    const handleSaveEdit = () => {
        if (editingCategory && editingValue.trim() && editingValue.trim() !== editingCategory) {
            onEdit(editingCategory, editingValue.trim());
        }
        setEditingCategory(null);
        setEditingValue('');
    };

    // Sort: Custom first, then Base (Global) - user preference usually to see their own stuff or most used?
    // Actually, let's keep alphabetical but maybe group globals? 
    // For now, simple alphabetical sort is fine as per existing logic, but let's make sure Global ones are visually distinct.
    const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

    if (!isOpen) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                {/* Backdrop with sophisticated blur */}
                <Dialog.Overlay className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 animate-in fade-in duration-200" />

                <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-50 w-full max-w-3xl focus:outline-none p-4">
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 ring-1 ring-slate-900/5 overflow-hidden flex flex-col max-h-[85vh]">

                        {/* Header */}
                        <div className="p-6 pb-4 border-b border-slate-200/50 dark:border-slate-800/50 flex justify-between items-center">
                            <div>
                                <Dialog.Title className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {t('category.managerTitle', 'Categorías')}
                                </Dialog.Title>
                                <Dialog.Description className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                                    Gestiona tus etiquetas para organizar gastos
                                </Dialog.Description>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Scrollable Grid Area */}
                        <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">

                                {/* "Add New" Card - Always first or prominent */}
                                <div
                                    onClick={() => setIsAdding(true)}
                                    className={`
                                        aspect-square rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 
                                        flex flex-col items-center justify-center gap-3 cursor-pointer group transition-all duration-200
                                        ${isAdding ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-400 dark:border-sky-500' : 'hover:border-sky-400 dark:hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                                    `}
                                >
                                    {isAdding ? (
                                        <div className="w-full px-4 flex flex-col items-center gap-2 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                            <span className="text-xs font-bold uppercase text-sky-600 dark:text-sky-400 tracking-wider">Nueva</span>
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={newCategoryName}
                                                onChange={e => setNewCategoryName(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleAdd();
                                                    if (e.key === 'Escape') setIsAdding(false);
                                                }}
                                                onBlur={() => !newCategoryName && setIsAdding(false)}
                                                className="w-full bg-transparent border-b-2 border-sky-500 text-center text-sm font-bold text-slate-900 dark:text-white focus:outline-none pb-1"
                                                placeholder="Nombre..."
                                            />
                                            <div className="flex gap-2 mt-1">
                                                <button onClick={handleAdd} disabled={!newCategoryName.trim()} className="p-1.5 bg-sky-500 text-white rounded-full hover:bg-sky-600 shadow-lg shadow-sky-500/30 disabled:opacity-50 disabled:shadow-none">
                                                    <CheckIcon className="w-3 h-3" />
                                                </button>
                                                <button onClick={() => setIsAdding(false)} className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600">
                                                    <XMarkIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 group-hover:bg-sky-100 dark:group-hover:bg-sky-900/30 text-slate-400 group-hover:text-sky-500 transition-all">
                                                <PlusIcon className="w-6 h-6" />
                                            </div>
                                            <span className="font-semibold text-slate-500 dark:text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">Crear Nueva</span>
                                        </>
                                    )}
                                </div>

                                {/* Category Cards */}
                                {sortedCategories.map(cat => {
                                    const Icon = getCategoryIcon(cat.name);
                                    const isEditing = editingCategory === cat.name;

                                    return (
                                        <div
                                            key={cat.id}
                                            className="group relative aspect-square rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center gap-3 transition-all hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-600 overflow-hidden"
                                        >
                                            {/* Global Badge */}
                                            {cat.isBase && !isEditing && (
                                                <div className="absolute top-2 right-2">
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 uppercase tracking-wider backdrop-blur-sm">
                                                        Global
                                                    </span>
                                                </div>
                                            )}

                                            {isEditing ? (
                                                <div className="w-full px-4 flex flex-col items-center gap-2 z-10 animate-in zoom-in-95">
                                                    <input
                                                        type="text"
                                                        value={editingValue}
                                                        onChange={e => setEditingValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleSaveEdit();
                                                            if (e.key === 'Escape') setEditingCategory(null);
                                                        }}
                                                        autoFocus
                                                        className="w-full bg-transparent border-b-2 border-indigo-500 text-center text-sm font-bold text-slate-900 dark:text-white focus:outline-none pb-1"
                                                    />
                                                    <div className="flex gap-2 mt-1">
                                                        <button onClick={handleSaveEdit} className="p-1.5 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 shadow-lg shadow-indigo-500/30">
                                                            <CheckIcon className="w-3 h-3" />
                                                        </button>
                                                        <button onClick={() => setEditingCategory(null)} className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600">
                                                            <XMarkIcon className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Icon - Large & Centered */}
                                                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:scale-110 transition-transform duration-300">
                                                        <Icon className="w-7 h-7" />
                                                    </div>

                                                    {/* Name */}
                                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200 text-center px-2 line-clamp-1">
                                                        {cat.name}
                                                    </span>

                                                    {/* Hover Actions Overlay (Only for custom categories or if we allow editing globals locally?) 
                                                        Usually globals are locked. Let's assume locked for now but maybe allow rename locally if supported?
                                                        Code says !cat.isBase for buttons.
                                                    */}
                                                    {!cat.isBase && (
                                                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
                                                            <button
                                                                onClick={() => handleStartEdit(cat.name)}
                                                                className="p-3 bg-white text-slate-900 rounded-full hover:scale-110 active:scale-95 transition-all shadow-xl"
                                                                title={t('form.editTitle')}
                                                            >
                                                                <EditIcon className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => onDelete(cat.name)}
                                                                className="p-3 bg-rose-500 text-white rounded-full hover:scale-110 active:scale-95 transition-all shadow-xl shadow-rose-500/30"
                                                                title="Eliminar"
                                                            >
                                                                <TrashIcon className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer Hint */}
                        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200/50 dark:border-slate-800/50 text-center">
                            <p className="text-xs text-slate-400 font-medium">
                                {sortedCategories.length} categorías disponibles
                            </p>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default CategoryManager;