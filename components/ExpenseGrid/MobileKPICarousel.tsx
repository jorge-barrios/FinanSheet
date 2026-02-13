import React, { useCallback, useRef } from 'react';
import { TrendingUp, Wallet, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { type MonthTotals } from '../../types.v2';
import { type KPIType } from './KPISelectorModal';
import { useLocalization } from '../../hooks/useLocalization';

interface MobileKPICarouselProps {
    totals: MonthTotals;
    currentKPI: KPIType;
    onKPIChange: (kpi: KPIType) => void;
    onSelectorOpen: () => void;
}

const formatClp = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

export const MobileKPICarousel: React.FC<MobileKPICarouselProps> = ({
    totals,
    currentKPI,
    onKPIChange,
    onSelectorOpen
}) => {
    const { t } = useLocalization();
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    // Tap handler: rotate to next KPI
    const handleKPITap = useCallback(() => {
        const kpiOrder: KPIType[] = ['ingresos', 'comprometido', 'pagado', 'pendiente', 'vencido'];
        const currentIndex = kpiOrder.indexOf(currentKPI);
        const nextIndex = (currentIndex + 1) % kpiOrder.length;
        onKPIChange(kpiOrder[nextIndex]);
    }, [currentKPI, onKPIChange]);

    // Long-press handlers: open KPI selector
    const handleTouchStart = useCallback(() => {
        longPressTimer.current = setTimeout(() => {
            onSelectorOpen();
            // Haptic feedback (if supported)
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500); // 500ms for long-press
    }, [onSelectorOpen]);

    const handleTouchEnd = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }, []);

    // KPI data structure
    const kpiData = [
        {
            id: 'ingresos' as KPIType,
            label: t('kpi.ingresos'),
            value: totals.ingresos,
            icon: TrendingUp,
            bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
            borderColor: 'border-emerald-500/50',
            textColor: 'text-emerald-600 dark:text-emerald-400',
            iconColor: 'text-emerald-500',
            ringColor: 'ring-emerald-500/30'
        },
        {
            id: 'comprometido' as KPIType,
            label: t('kpi.comprometido'),
            value: totals.comprometido,
            icon: Wallet,
            bgColor: 'bg-sky-500/10 dark:bg-sky-500/20',
            borderColor: 'border-sky-500/50',
            textColor: 'text-sky-600 dark:text-sky-400',
            iconColor: 'text-sky-500',
            ringColor: 'ring-sky-500/30'
        },
        {
            id: 'pagado' as KPIType,
            label: t('kpi.pagado'),
            value: totals.pagado,
            icon: CheckCircle,
            bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
            borderColor: 'border-emerald-500/50',
            textColor: 'text-emerald-600 dark:text-emerald-400',
            iconColor: 'text-emerald-500',
            ringColor: 'ring-emerald-500/30'
        },
        {
            id: 'pendiente' as KPIType,
            label: t('kpi.porPagar'),
            value: totals.pendiente,
            icon: Clock,
            bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
            borderColor: 'border-amber-500/50',
            textColor: 'text-amber-600 dark:text-amber-400',
            iconColor: 'text-amber-500',
            ringColor: 'ring-amber-500/30'
        }
    ];

    // Add vencido only if there's overdue amount
    if (totals.vencido && totals.vencido > 0) {
        kpiData.push({
            id: 'vencido' as KPIType,
            label: t('kpi.vencido'),
            value: totals.vencido,
            icon: AlertTriangle,
            bgColor: 'bg-rose-500/10 dark:bg-rose-500/20',
            borderColor: 'border-rose-500/50',
            textColor: 'text-rose-600 dark:text-rose-400',
            iconColor: 'text-rose-500',
            ringColor: 'ring-rose-500/30'
        });
    }

    const currentKPIData = kpiData.find(k => k.id === currentKPI) || kpiData[1];
    const Icon = currentKPIData.icon;

    return (
        <div className="lg:hidden">
            <button
                onClick={handleKPITap}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseUp={handleTouchEnd}
                className={`
                    w-full p-4 rounded-2xl backdrop-blur-xl transition-all duration-300
                    active:scale-[0.98]
                    ${currentKPIData.bgColor}
                    border-2 ${currentKPIData.borderColor}
                    shadow-lg ring-1 ${currentKPIData.ringColor}
                `}
            >
                <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${currentKPIData.iconColor}`} />
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${currentKPIData.textColor}`}>
                        {currentKPIData.label}
                    </p>
                </div>
                <p className={`text-2xl font-black font-mono tabular-nums tracking-tight ${currentKPIData.textColor}`}>
                    {formatClp(currentKPIData.value)}
                </p>
            </button>

            {/* Indicators */}
            <div className="flex justify-center gap-1.5 mt-2">
                {kpiData.map((kpi) => (
                    <div
                        key={kpi.id}
                        className={`h-1.5 rounded-full transition-all duration-300 ${kpi.id === currentKPI
                            ? 'w-6 bg-sky-500'
                            : 'w-1.5 bg-slate-300 dark:bg-slate-600'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
};
