import React from 'react';
import { View } from '../types';
import { useLocalization } from '../hooks/useLocalization';
import { PlusIcon, ChartBarIcon, ViewColumnsIcon, CalendarIcon, Cog6ToothIcon } from './icons';

interface BottomNavBarProps {
    currentView: View;
    onViewChange: (view: View) => void;
    onAddExpense: () => void;
    onOpenSettings: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onViewChange, onAddExpense, onOpenSettings }) => {
    const { t } = useLocalization();

    return (
        <div 
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))' }}
        >
            <div className="flex items-center justify-around h-16 px-1 relative">
                
                {/* Grilla Tab */}
                <button
                    onClick={() => onViewChange('table')}
                    className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${currentView === 'table' ? 'text-sky-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                >
                    <ViewColumnsIcon className="w-5 h-5" />
                    <span className="text-[10px] font-medium leading-none">Grilla</span>
                </button>

                {/* Dashboard Tab */}
                <button
                    onClick={() => onViewChange('graph')}
                    className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${currentView === 'graph' ? 'text-sky-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                >
                    <ChartBarIcon className="w-5 h-5" />
                    <span className="text-[10px] font-medium leading-none">Resume</span>
                </button>

                {/* FAB (Add Button) Center Spacer */}
                <div className="relative flex-1 flex justify-center items-center pointer-events-none">
                    {/* The actual button is rendered below to overlap properly */}
                </div>

                {/* Calendar Tab */}
                <button
                    onClick={() => onViewChange('calendar')}
                    className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${currentView === 'calendar' ? 'text-sky-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                >
                    <CalendarIcon className="w-5 h-5" />
                    <span className="text-[10px] font-medium leading-none">Fechas</span>
                </button>

                {/* Ajustes Tab */}
                <button
                    onClick={onOpenSettings}
                    className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200`}
                >
                    <Cog6ToothIcon className="w-5 h-5" />
                    <span className="text-[10px] font-medium leading-none">Ajustes</span>
                </button>

                {/* FAB (Add Button) Absolutely Positioned */}
                <button
                    onClick={onAddExpense}
                    className="
                        absolute left-1/2 -ml-7 -top-6
                        flex items-center justify-center
                        w-14 h-14
                        rounded-full
                        bg-sky-600 hover:bg-sky-500
                        text-white
                        shadow-lg shadow-sky-600/30
                        active:scale-95
                        transition-all duration-200
                        z-10
                    "
                    aria-label={t('header.addExpense', 'Añadir gasto')}
                >
                    <PlusIcon className="w-6 h-6 stroke-[2.5]" />
                </button>

            </div>
        </div>
    );
};
