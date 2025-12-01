import React from 'react';
import { useLocalization } from '../hooks/useLocalization';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDangerous?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    isDangerous = false
}) => {
    const { t } = useLocalization();

    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onCancel();
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
        >
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 ring-1 ring-slate-200 dark:ring-slate-700/50">
                <div className="flex items-center gap-3 mb-4">
                    {isDangerous && (
                        <div className="flex-shrink-0 w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                    )}
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {title}
                    </h3>
                </div>
                
                <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                    {message}
                </p>
                
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                        {cancelText || t('common.cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                            isDangerous 
                                ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500' 
                                : 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500'
                        }`}
                    >
                        {confirmText || t('common.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
