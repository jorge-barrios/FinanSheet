/**
 * KPIBentoCard.tsx
 *
 * Individual KPI card for the Bento Grid layout.
 * Follows Identidad.md principles: Bento Grid, Quiet Confidence, Claridad Estructurada.
 *
 * Design Philosophy:
 * - All cards share the same neutral base style when inactive
 * - Active card shows semantic color (emerald, teal, amber, rose)
 * - Vencido alert shows subtle indicator (colored icon/amount + badge) without breaking consistency
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
    // Active state (selected)
    activeBg: string;
    activeBorder: string;
    activeRing: string;
    // Colors
    accentColor: string;
    accentColorDark: string;
}> = {
    ingresos: {
        icon: <TrendingUp className="w-4 h-4" />,
        activeBg: 'bg-emerald-500/10',
        activeBorder: 'border-emerald-500/30',
        activeRing: 'ring-2 ring-emerald-500/20',
        accentColor: 'text-emerald-600',
        accentColorDark: 'dark:text-emerald-400',
    },
    pagado: {
        icon: <CheckCircleIcon className="w-4 h-4" />,
        activeBg: 'bg-teal-500/10',
        activeBorder: 'border-teal-500/30',
        activeRing: 'ring-2 ring-teal-500/20',
        accentColor: 'text-teal-600',
        accentColorDark: 'dark:text-teal-400',
    },
    pendiente: {
        icon: <ClockIcon className="w-4 h-4" />,
        activeBg: 'bg-amber-500/10',
        activeBorder: 'border-amber-500/30',
        activeRing: 'ring-2 ring-amber-500/20',
        accentColor: 'text-amber-600',
        accentColorDark: 'dark:text-amber-400',
    },
    vencido: {
        icon: <ExclamationTriangleIcon className="w-4 h-4" />,
        activeBg: 'bg-rose-500/10',
        activeBorder: 'border-rose-500/30',
        activeRing: 'ring-2 ring-rose-500/20',
        accentColor: 'text-rose-600',
        accentColorDark: 'dark:text-rose-400',
    },
    comprometido: {
        icon: <TrendingUp className="w-4 h-4" />,
        activeBg: 'bg-sky-500/10',
        activeBorder: 'border-sky-500/30',
        activeRing: 'ring-2 ring-sky-500/20',
        accentColor: 'text-sky-600',
        accentColorDark: 'dark:text-sky-400',
    },
};

// Shared neutral style for all inactive cards (Bento consistency)
const NEUTRAL_CARD = 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50';
const NEUTRAL_HOVER = 'hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-600/50';
const NEUTRAL_ICON = 'text-slate-400 dark:text-slate-500';
const NEUTRAL_AMOUNT = 'text-slate-600 dark:text-slate-300';

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
    const isVencidoWithAlert = type === 'vencido' && hasAlert && amount > 0;

    // Card classes - consistent bento style
    const getCardClasses = () => {
        const baseClasses = 'relative flex-1 min-w-0 h-14 px-3 rounded-xl border flex items-center gap-3 transition-all duration-200 cursor-pointer shadow-sm';

        if (isActive) {
            // Active: semantic color
            return `${baseClasses} ${config.activeBg} ${config.activeBorder} ${config.activeRing}`;
        }

        // Inactive: neutral (same for all cards - Bento consistency)
        return `${baseClasses} ${NEUTRAL_CARD} ${NEUTRAL_HOVER}`;
    };

    // Icon classes
    const getIconClasses = () => {
        if (isActive) {
            return `${config.accentColor} ${config.accentColorDark}`;
        }
        // Vencido alert: show red icon even when inactive
        if (isVencidoWithAlert) {
            return `${config.accentColor} ${config.accentColorDark}`;
        }
        return NEUTRAL_ICON;
    };

    // Amount classes
    const getAmountClasses = () => {
        if (isActive) {
            return `${config.accentColor} ${config.accentColorDark}`;
        }
        // Vencido alert: show red amount even when inactive
        if (isVencidoWithAlert) {
            return `${config.accentColor} ${config.accentColorDark}`;
        }
        return NEUTRAL_AMOUNT;
    };

    return (
        <button
            onClick={onClick}
            className={getCardClasses()}
            title={`Filtrar por ${label}`}
        >
            {/* Alert Badge - subtle indicator for vencido */}
            {isVencidoWithAlert && !isActive && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                </span>
            )}

            {/* Icon Container */}
            <div className={`flex-shrink-0 transition-colors duration-200 ${getIconClasses()}`}>
                {config.icon}
            </div>

            {/* Label & Amount */}
            <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none font-medium">
                    {label}
                </span>
                <span className={`text-sm font-semibold font-mono leading-tight truncate transition-colors duration-200 ${getAmountClasses()}`}>
                    {formatClp(amount)}
                </span>
            </div>
        </button>
    );
};

export default KPIBentoCard;
