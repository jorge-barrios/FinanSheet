import React, { useState } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { PlusIcon, EditIcon, TrashIcon, CheckIcon, XMarkIcon } from './icons';

interface CategoryManagerProps {
    isOpen: boolean;
    onClose: () => void;
    categories: string[];
    onAdd: (newCategory: string) => void;
    onEdit: (oldName: string, newName: string) => void;
    onDelete: (category: string) => void;
}

const formInputClasses = "w-full bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all";

const CategoryManager: React.FC<CategoryManagerProps> = ({ isOpen, onClose, categories, onAdd, onEdit, onDelete }) => {
    const { t } = useLocalization();
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState('');

    const handleAdd = () => {
        if (newCategoryName.trim()) {
            onAdd(newCategoryName.trim());
            setNewCategoryName('');
        }
    };

    const handleStartEdit = (category: string) => {
        setEditingCategory(category);
        setEditingValue(category);
    };
    
    const handleCancelEdit = () => {
        setEditingCategory(null);
        setEditingValue('');
    };

    const handleSaveEdit = () => {
        if (editingCategory && editingValue.trim()) {
            onEdit(editingCategory, editingValue.trim());
        }
        handleCancelEdit();
    };


    if (!isOpen) return null;
    
    const uncategorizedLabel = t('grid.uncategorized');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="category-manager-title">
            <div className="bg-slate-50 dark:bg-slate-850 rounded-xl shadow-2xl p-6 w-full max-w-md ring-1 ring-slate-200 dark:ring-slate-700/50" onClick={e => e.stopPropagation()}>
                <h2 id="category-manager-title" className="text-xl font-bold mb-4 text-slate-900 dark:text-white">{t('category.managerTitle')}</h2>
                
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 mb-4">
                    {categories.map(cat => (
                        <div key={cat} className="flex items-center justify-between bg-slate-100 dark:bg-slate-700/50 p-2 rounded-md transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
                            {editingCategory === cat ? (
                                <>
                                    <input 
                                        type="text"
                                        value={editingValue}
                                        onChange={e => setEditingValue(e.target.value)}
                                        className="flex-grow bg-slate-200 dark:bg-slate-600 border-slate-400 dark:border-slate-500 text-slate-900 dark:text-white rounded-md p-1 focus:ring-teal-500 focus:border-teal-500"
                                        autoFocus
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleSaveEdit();
                                            if (e.key === 'Escape') handleCancelEdit();
                                        }}
                                    />
                                    <div className="flex items-center ml-2">
                                        <button onClick={handleSaveEdit} className="p-1 text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300" aria-label={t('category.save')}><CheckIcon /></button>
                                        <button onClick={handleCancelEdit} className="p-1 text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300" aria-label={t('category.cancel')}><XMarkIcon /></button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span className="text-slate-800 dark:text-slate-200">{cat}</span>
                                    <div className="flex items-center">
                                        <button onClick={() => handleStartEdit(cat)} className="p-1 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400" aria-label={`${t('form.editTitle')} ${cat}`}><EditIcon className="w-4 h-4" /></button>
                                        {cat !== uncategorizedLabel && (
                                           <button onClick={() => onDelete(cat)} className="p-1 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400" aria-label={`Delete ${cat}`}><TrashIcon className="w-4 h-4" /></button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                    <h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-300">{t('category.addNew')}</h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder={t('category.placeholder')}
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            className={formInputClasses}
                        />
                        <button
                            onClick={handleAdd}
                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 dark:hover:bg-teal-400 text-white transition-colors font-medium"
                        >
                            <PlusIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">{t('category.add')}</span>
                        </button>
                    </div>
                </div>

                 <div className="flex justify-end pt-6 mt-2">
                    <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium">{t('form.cancel')}</button>
                </div>
            </div>
        </div>
    );
};
export default CategoryManager;