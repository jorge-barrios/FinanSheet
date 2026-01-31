import React from 'react';
import { PlusIcon } from './icons';
import { useLocalization } from '../hooks/useLocalization';

interface FloatingActionButtonProps {
    onClick: () => void;
}

/**
 * Floating Action Button for mobile - used for primary actions like "Add Expense"
 * Positioned fixed at bottom-right with safe area padding for notched devices
 */
export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onClick }) => {
    const { t } = useLocalization();

    return (
        <button
            onClick={onClick}
            className="
                fixed bottom-6 right-6 z-40
                md:hidden
                flex items-center justify-center
                w-14 h-14
                rounded-full
                bg-sky-600 hover:bg-sky-500
                text-white
                shadow-lg shadow-sky-600/30
                hover:shadow-xl hover:shadow-sky-500/40
                active:scale-95
                transition-all duration-200
            "
            style={{
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
                right: 'calc(env(safe-area-inset-right, 0px) + 1.5rem)',
            }}
            aria-label={t('header.addExpense', 'Añadir gasto')}
            title={t('header.addExpense', 'Añadir gasto')}
        >
            <PlusIcon className="w-6 h-6 stroke-[2.5]" />
        </button>
    );
};

export default FloatingActionButton;
