import React, { useEffect, useState } from 'react';
import { useToast, Toast, ToastType } from '../context/ToastContext';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, ExclamationTriangleIcon, XMarkIcon } from './icons';

const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
    const { removeToast } = useToast();
    const [isExiting, setIsExiting] = useState(false);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => removeToast(toast.id), 300);
    };

    // Auto-close animation before removal (skip for loading toasts)
    useEffect(() => {
        if (toast.type === 'loading') return; // Loading toasts don't auto-close
        if (toast.duration && toast.duration > 0) {
            const timer = setTimeout(() => {
                setIsExiting(true);
            }, toast.duration - 300);
            return () => clearTimeout(timer);
        }
    }, [toast.duration, toast.type]);

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success':
                return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
            case 'error':
                return <XCircleIcon className="w-5 h-5 text-red-500" />;
            case 'warning':
                return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
            case 'loading':
                return <span className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />;
            case 'info':
            default:
                return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
        }
    };

    const getColorClasses = (type: ToastType) => {
        // Base classes unified for Navy Ocean aesthetic
        const baseClasses = 'bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 border-r border-t border-b border-white/10 text-slate-200';

        // Accent border logic (Left border only)
        switch (type) {
            case 'success':
                return `${baseClasses} border-l-4 border-l-emerald-500`;
            case 'error':
                return `${baseClasses} border-l-4 border-l-rose-500`;
            case 'warning':
                return `${baseClasses} border-l-4 border-l-amber-500`;
            case 'loading':
                return `${baseClasses} border-l-4 border-l-sky-500`;
            case 'info':
            default:
                return `${baseClasses} border-l-4 border-l-blue-500`;
        }
    };

    return (
        <div
            className={`flex items-start gap-4 p-4 rounded-r-lg rounded-l-none border-l-[3px] shadow-2xl transition-all duration-300 min-w-[320px] max-w-md ${getColorClasses(toast.type)} ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
                }`}
            role="alert"
        >
            <div className="flex-shrink-0 mt-0.5">
                {getIcon(toast.type)}
            </div>
            <p className="flex-1 text-sm text-slate-800 dark:text-slate-200 font-medium">
                {toast.message}
            </p>
            <button
                onClick={handleClose}
                className="flex-shrink-0 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                aria-label="Cerrar notificación"
            >
                <XMarkIcon className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>
        </div>
    );
};

const ToastContainer: React.FC = () => {
    const { toasts } = useToast();

    return (
        <div
            className="fixed top-20 right-4 z-[60] flex flex-col gap-3 pointer-events-none"
            aria-live="polite"
            aria-atomic="true"
        >
            {toasts.map(toast => (
                <div key={toast.id} className="pointer-events-auto">
                    <ToastItem toast={toast} />
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
