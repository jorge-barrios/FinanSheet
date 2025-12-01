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

    // Auto-close animation before removal
    useEffect(() => {
        if (toast.duration && toast.duration > 0) {
            const timer = setTimeout(() => {
                setIsExiting(true);
            }, toast.duration - 300);
            return () => clearTimeout(timer);
        }
    }, [toast.duration]);

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success':
                return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
            case 'error':
                return <XCircleIcon className="w-5 h-5 text-red-500" />;
            case 'warning':
                return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
            case 'info':
            default:
                return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
        }
    };

    const getColorClasses = (type: ToastType) => {
        switch (type) {
            case 'success':
                return 'bg-emerald-50/95 dark:bg-emerald-950/90 backdrop-blur-md border-emerald-200 dark:border-emerald-800';
            case 'error':
                return 'bg-rose-50/95 dark:bg-rose-950/90 backdrop-blur-md border-rose-200 dark:border-rose-800';
            case 'warning':
                return 'bg-amber-50/95 dark:bg-amber-950/90 backdrop-blur-md border-amber-200 dark:border-amber-800';
            case 'info':
            default:
                return 'bg-sky-50/95 dark:bg-sky-950/90 backdrop-blur-md border-sky-200 dark:border-sky-800';
        }
    };

    return (
        <div
            className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg transition-all duration-300 min-w-[300px] max-w-md ${getColorClasses(toast.type)} ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
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
                <XMarkIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
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
