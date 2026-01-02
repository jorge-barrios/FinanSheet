import React from 'react';
import { useGoals } from '../../hooks/useGoals';
import GoalCard from './GoalCard';
import { Plus } from 'lucide-react';
import { Goal } from '../../types.v2';

interface GoalListProps {
    onAddGoal?: () => void;
    onDelete?: (id: string) => void;
}

const GoalList: React.FC<GoalListProps> = ({ onAddGoal, onDelete }) => {
    const { goals, isLoading, error } = useGoals();

    if (isLoading) {
        return (
            <div className="flex gap-4 overflow-x-auto pb-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="min-w-[240px] h-32 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-xl" />
                ))}
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500">Error loading goals</div>;
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4">
                {/* Add Goal Button / Card */}
                <button
                    onClick={onAddGoal}
                    className="min-w-[240px] min-h-[140px] rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors bg-zinc-50/50 dark:bg-zinc-900/50"
                >
                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2">
                        <Plus className="w-5 h-5" />
                    </div>
                    <span className="font-medium">Crear Nueva Meta</span>
                </button>

                {goals.map((goal: Goal) => (
                    <div key={goal.id} className="w-full sm:w-auto">
                        <GoalCard goal={goal} onDelete={() => onDelete?.(goal.id)} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GoalList;
