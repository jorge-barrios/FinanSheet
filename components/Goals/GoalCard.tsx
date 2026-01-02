import React from 'react';
import { Goal } from '../../types.v2';
import * as Icons from 'lucide-react';
// import { TrendingUp } from 'lucide-react'; // Example, we will dynamic load or use a specific one

interface GoalCardProps {
    goal: Goal;
    onDelete?: () => void;
}

const GoalCard: React.FC<GoalCardProps> = ({ goal, onDelete }) => {
    const { name, current_amount, target_amount, icon, color } = goal;
    const progress = target_amount ? Math.min((current_amount / target_amount) * 100, 100) : 0;

    // Dynamic icon rendering (simplified)
    const IconComponent = (icon && (Icons as any)[icon]) ? (Icons as any)[icon] : Icons.Target;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-3 min-w-[240px] relative group">
            {/* Delete Button - Visual on hover */}
            {onDelete && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="absolute top-2 right-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                    title="Eliminar meta"
                >
                    <Icons.Trash2 size={16} />
                </button>
            )}

            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: color || '#3b82f6' }}
                    >
                        <IconComponent size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{name}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Objetivo: {target_amount ? formatCurrency(target_amount) : 'Sin límite'}</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-1 mt-2">
                <div className="flex justify-between text-sm">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatCurrency(current_amount)}</span>
                    <span className="text-zinc-500">{target_amount ? `${Math.round(progress)}%` : ''}</span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                    <div
                        className="h-2.5 rounded-full transition-all duration-500 ease-out"
                        style={{
                            width: `${progress}%`,
                            backgroundColor: color || '#3b82f6'
                        }}
                    ></div>
                </div>
            </div>

            {goal.target_date && (
                <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                    <Icons.Calendar size={12} />
                    <span>Fecha límite: {new Date(goal.target_date).toLocaleDateString()}</span>
                </div>
            )}
        </div>
    );
};

export default GoalCard;
