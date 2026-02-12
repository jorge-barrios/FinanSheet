/**
 * KPIBentoCard.tsx
 *
 * Individual KPI card for the Bento Grid layout.
 * Follows Identidad.md principles: Bento Grid, Quiet Confidence, Claridad Estructurada.
 */

import React from 'react';
import { TrendingUp } from 'lucide-react';
import { CheckCircleIcon, ExclamationTriangleIcon, ClockIcon } from '../icons';
import type { KPIType } from './KPISelectorModal';

interface KPIBentoCardProps {
    type: KPIType;
    label: string;
    amount: number;
    isActive: boolean;
    hasAlert?: boolean; // For vencido when > 0
    onClick: () => void;
    formatClp: (amount: number) => string;
}

const kpiConfig: Record<KPIType, {
    icon: React.ReactNode;
    activeClasses: string;
    alertClasses?: string;
    iconActiveClass: string;
    iconDefaultClass: string;
    amountActiveClass: string;
    amountAlertClass?: string;
}> = {
    ingresos: {
        icon: <TrendingUp className="w-4 h-4" />,
        activeClasses: 'bg-emerald-500/10 border-emerald-500/30 ring-2 ring-emerald-500/20',
        iconActiveClass: 'text-emerald-500 dark:text-emerald-400',
        iconDefaultClass: 'text-slate-400 dark:text-slate-500',
        amountActiveClass: 'text-emerald-600 dark:text-emerald-400',
    },
    pagado: {
        icon: <CheckCircleIcon className="w-4 h-4" />,
        activeClasses: 'bg-teal-500/10 border-teal-500/30 ring-2 ring-teal-500/20',
        iconActiveClass: 'text-teal-500 dark:text-teal-400',
        iconDefaultClass: 'text-slate-400 dark:text-slate-500',
        amountActiveClass: 'text-teal-600 dark:text-teal-400',
    },
    pendiente: {
        icon: <ClockIcon className="w-4 h-4" />,
        activeClasses: 'bg-amber-500/10 border-amber-500/30 ring-2 ring-amber-500/20',
        iconActiveClass: 'text-amber-500 dark:text-amber-400',
        iconDefaultClass: 'text-slate-400 dark:text-slate-500',
        amountActiveClass: 'text-amber-600 dark:text-amber-400',
    },
    vencido: {
        icon: <ExclamationTriangleIcon className="w-4 h-4" />,
        activeClasses: 'bg-rose-500/10 border-rose-500/30 ring-2 ring-rose-500/20',
        alertClasses: 'bg-rose-500/15 border-rose-500/40 animate-pulse',
        iconActiveClass: 'text-rose-500 dark:text-rose-400',
        iconDefaultClass: 'text-slate-400 dark:text-slate-500',
        amountActiveClass: 'text-rose-600 dark:text-rose-400',
        amountAlertClass: 'text-rose-500 dark:text-rose-400',
    },
    comprometido: {
        icon: <TrendingUp className="w-4 h-4" />,
        activeClasses: 'bg-slate-500/10 border-slate-500/30 ring-2 ring-slate-500/20',
        iconActiveClass: 'text-slate-500 dark:text-slate-400',
        iconDefaultClass: 'text-slate-400 dark:text-slate-500',
        amountActiveClass: 'text-slate-600 dark:text-slate-400',
    },
};

export const KPIBentoCard: React.FC<KPIBentoCardProps> = ({
    type,
    label,
    amount,
    isActive,
    hasAlert = false,
    onClick,
    formatClp,
}) => {
    const config = kpiConfig[type];
    const isVencidoWithAlert = type === 'vencido' && hasAlert;

    // Determine classes based on state
    const getCardClasses = () => {
        const baseClasses = 'flex-1 h-12 px-3 rounded-lg border flex items-center gap-3 transition-all cursor-pointer';

        if (isActive) {
            return `${baseClasses} ${config.activeClasses}`;
        }

        if (isVencidoWithAlert) {
            return `${baseClasses} ${config.alertClasses}`;
        }

        return `${baseClasses} bg-slate-100 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/50 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600/50`;
    };

    // Icon color classes
    const getIconClasses = () => {
        if (isActive || isVencidoWithAlert) {
            return config.iconActiveClass;
        }
        return config.iconDefaultClass;
    };

    // Amount color classes
    const getAmountClasses = () => {
        if (isActive) {
            return config.amountActiveClass;
        }
        if (isVencidoWithAlert && config.amountAlertClass) {
            return config.amountAlertClass;
        }
        return 'text-slate-500 dark:text-slate-300';
    };

    return (
        <button
            onClick={onClick}
            className={getCardClasses()}
            title={`Filtrar ${label}`}
        >
            {/* Icon */}
            <div className={`flex-shrink-0 ${getIconClasses()}`}>
                {config.icon}
            </div>

            {/* Label & Amount */}
            <div className="flex flex-col items-start min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none">
                    {label}
                </span>
                <span className={`text-sm font-semibold font-mono leading-tight truncate ${getAmountClasses()}`}>
                    {formatClp(amount)}
                </span>
            </div>
        </button>
    );
};

export default KPIBentoCard;
