import React, { useState, useEffect } from 'react';
import { calculate50_30_20, suggestGoalAllocations } from '../../utils/financeRules';
import { useGoals } from '../../hooks/useGoals';
import { X, ArrowRight, Check } from 'lucide-react';
import { useLocalization } from '../../hooks/useLocalization';

interface IncomeAllocationWizardProps {
    isOpen: boolean;
    onClose: () => void;
    incomeAmount: number;
    onApply: (allocations: Record<string, number>) => Promise<void>;
}

export const IncomeAllocationWizard: React.FC<IncomeAllocationWizardProps> = ({
    isOpen, onClose, incomeAmount, onApply
}) => {
    const { formatClp } = useLocalization();
    const { goals } = useGoals();
    const [step, setStep] = useState(1);

    // Calculated breakdown
    const breakdown = calculate50_30_20(incomeAmount);

    // Savings breakdown
    const [allocations, setAllocations] = useState<Record<string, number>>({});

    useEffect(() => {
        if (isOpen && goals.length > 0) {
            setAllocations(suggestGoalAllocations(breakdown.savings, goals));
        }
    }, [isOpen, goals, breakdown.savings]); // Add breakdown.savings to dependency

    if (!isOpen) return null;

    const handleApply = async () => {
        await onApply(allocations);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">💰 Asistente de Distribución Inteligente</h2>
                    <button onClick={onClose} className="text-white/80 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6">
                    {step === 1 ? (
                        <div className="space-y-6">
                            <p className="text-slate-600 dark:text-slate-300 text-lg">
                                ¡Nuevo ingreso detectado de <span className="font-bold text-green-600">{formatClp(incomeAmount)}</span>!
                                Basado en la regla 50/30/20, te sugerimos esta distribución:
                            </p>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                                    <div className="text-sm text-slate-500 mb-1">Necesidades (50%)</div>
                                    <div className="text-2xl font-bold text-slate-800 dark:text-white">{formatClp(breakdown.needs)}</div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                                    <div className="text-sm text-slate-500 mb-1">Deseos (30%)</div>
                                    <div className="text-2xl font-bold text-slate-800 dark:text-white">{formatClp(breakdown.wants)}</div>
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl border-2 border-indigo-500 text-center transform scale-105 shadow-lg">
                                    <div className="text-sm text-indigo-600 dark:text-indigo-300 font-bold mb-1">Ahorro (20%)</div>
                                    <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-200">{formatClp(breakdown.savings)}</div>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                            >
                                Distribuir Ahorros <ArrowRight size={20} />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold dark:text-white">Distribuyendo {formatClp(breakdown.savings)} en tus Metas</h3>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                {Object.keys(allocations).length === 0 ? (
                                    <p className="text-slate-500 italic">No tienes metas activas. Crea una meta primero.</p>
                                ) : (
                                    Object.entries(allocations).map(([goalId, amount]) => {
                                        const goal = goals.find(g => g.id === goalId);
                                        if (!goal) return null;
                                        return (
                                            <div key={goalId} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: goal.color || '#ccc' }}>
                                                        {goal.name.charAt(0)}
                                                    </div>
                                                    <span className="font-medium dark:text-white">{goal.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={amount}
                                                        onChange={(e) => setAllocations({ ...allocations, [goalId]: parseFloat(e.target.value) || 0 })}
                                                        className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-right"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-3 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Atrás
                                </button>
                                <button
                                    onClick={handleApply}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                                    disabled={Object.keys(allocations).length === 0}
                                >
                                    Confirmar y Aplicar <Check size={20} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
