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
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md"
            onClick={handleBackdropClick}
        >
            <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 border border-slate-700/50 ring-1 ring-white/5">
                <div className="flex items-center gap-3 mb-4">
                    {isDangerous && (
                        <div className="flex-shrink-0 w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center border border-rose-500/20">
                            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                    )}
                    <h3 className="text-lg font-semibold text-white">
                        {title}
                    </h3>
                </div>

                <p className="text-slate-300 mb-6 leading-relaxed whitespace-pre-line">
                    {message}
                </p>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/50 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
                    >
                        {cancelText || t('common.cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 ${isDangerous
                                ? 'bg-rose-500 hover:bg-rose-600 focus:ring-rose-500/50 shadow-lg shadow-rose-500/20'
                                : 'bg-sky-500 hover:bg-sky-600 focus:ring-sky-500/50 shadow-lg shadow-sky-500/20'
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
