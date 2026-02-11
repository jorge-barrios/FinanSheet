import React from 'react';
import { TrendingUp, Wallet, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { type MonthTotals } from '../../types.v2';

export type KPIType = 'ingresos' | 'comprometido' | 'pagado' | 'pendiente' | 'vencido';

interface KPISelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    totals: MonthTotals;
    currentKPI: KPIType;
    onSelect: (kpi: KPIType) => void;
}

const formatClp = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

export const KPISelectorModal: React.FC<KPISelectorModalProps> = ({
    isOpen,
    onClose,
    totals,
    currentKPI,
    onSelect
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Bottom Sheet */}
            <div className="relative w-full bg-white dark:bg-slate-900 rounded-t-3xl p-4 animate-in slide-in-from-bottom duration-300">
                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-3 text-slate-900 dark:text-white">Seleccionar Métrica</h3>

                <div className="grid grid-cols-2 gap-2">
                    {(() => {
                        const kpiOptions = [
                            { id: 'ingresos' as KPIType, label: 'Ingresos', value: totals.ingresos, icon: TrendingUp, color: 'emerald' },
                            { id: 'comprometido' as KPIType, label: 'Comprometido', value: totals.comprometido, icon: Wallet, color: 'sky' },
                            { id: 'pagado' as KPIType, label: 'Pagado', value: totals.pagado, icon: CheckCircle, color: 'emerald' },
                            { id: 'pendiente' as KPIType, label: 'Pendiente', value: totals.pendiente, icon: Clock, color: 'amber' },
                            ...(totals.vencido > 0 ? [{ id: 'vencido' as KPIType, label: 'Vencido', value: totals.vencido, icon: AlertTriangle, color: 'rose' }] : [])
                        ];

                        return kpiOptions.map((kpi) => {
                            const Icon = kpi.icon;
                            const isSelected = kpi.id === currentKPI;
                            return (
                                <button
                                    key={kpi.id}
                                    onClick={() => onSelect(kpi.id)}
                                    className={`p-3 rounded-xl border-2 transition-all ${isSelected
                                        ? `bg-${kpi.color}-500/10 dark:bg-${kpi.color}-500/20 border-${kpi.color}-500/50`
                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 text-${kpi.color}-500 mb-1`} />
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">{kpi.label}</p>
                                    <p className="text-sm font-mono text-slate-700 dark:text-slate-300">{formatClp(kpi.value)}</p>
                                </button>
                            );
                        });
                    })()}
                </div>
            </div>
        </div>
    );
};
