import React, { useState } from 'react';
import GoalList from './GoalList';
import { useGoals } from '../../hooks/useGoals';
import { Wallet, X, Sparkles } from 'lucide-react';
import { IncomeAllocationWizard } from '../Wizards/IncomeAllocationWizard';

export const GoalsSection: React.FC = () => {
    const { goals, createGoal, updateGoal, deleteGoal } = useGoals();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Wizard State
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardIncome, setWizardIncome] = useState<number>(0);
    const [showIncomeInput, setShowIncomeInput] = useState(false);

    // New Goal Form State
    const [newName, setNewName] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [newColor, setNewColor] = useState('#3b82f6'); // Default color (blue)

    const handleCreateGoal = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createGoal.mutateAsync({
                name: newName,
                target_amount: newTarget ? parseFloat(newTarget) : null,
                current_amount: 0,
                icon: 'PiggyBank',
                color: newColor,
                is_archived: false
            });
            setIsAddModalOpen(false);
            setNewName('');
            setNewTarget('');
        } catch (error) {
            console.error('Failed to create goal', error);
            alert('Failed to create goal');
        }
    };

    const handleDeleteGoal = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar esta meta?')) {
            try {
                await deleteGoal.mutateAsync(id);
            } catch (error) {
                console.error('Failed to delete goal', error);
            }
        }
    };

    const startWizard = () => {
        const income = prompt("Ingresa el monto del ingreso para calcular el reparto (CLP):");
        if (income && !isNaN(parseFloat(income))) {
            setWizardIncome(parseFloat(income));
            setIsWizardOpen(true);
        }
    };

    const handleAllocationApply = async (allocations: Record<string, number>) => {
        try {
            const promises = Object.entries(allocations).map(async ([goalId, amount]) => {
                const goal = goals.find(g => g.id === goalId);
                if (!goal) return;

                // Add allocated amount to current amount
                const newAmount = (goal.current_amount || 0) + amount;
                await updateGoal.mutateAsync({
                    id: goalId,
                    current_amount: newAmount
                });
            });

            await Promise.all(promises);
            // Optional: Show success toast/notification
        } catch (error) {
            console.error("Error applying allocations:", error);
            alert("Error al aplicar la distribución.");
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-indigo-500" />
                    Metas de Ahorro (Smart Buckets)
                </h3>
                <button
                    onClick={startWizard}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                    <Sparkles className="w-4 h-4" />
                    Asistente 50/30/20
                </button>
            </div>

            <GoalList
                onAddGoal={() => setIsAddModalOpen(true)}
                onDelete={handleDeleteGoal}
            />

            {/* Simple Add Goal Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md p-6 shadow-xl border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold dark:text-white">Nueva Meta</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateGoal} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Ej. Vacaciones, Auto Nuevo..."
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monto Objetivo (Opcional)</label>
                                <input
                                    type="number"
                                    value={newTarget}
                                    onChange={(e) => setNewTarget(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="0"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Color</label>
                                <div className="flex gap-2">
                                    {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'].map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setNewColor(color)}
                                            className={`w-8 h-8 rounded-full border-2 ${newColor === color ? 'border-zinc-900 dark:border-white scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors mt-2"
                            >
                                Crear Meta
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Income Allocation Wizard */}
            <IncomeAllocationWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                incomeAmount={wizardIncome}
                onApply={handleAllocationApply}
            />
        </div>
    );
};
