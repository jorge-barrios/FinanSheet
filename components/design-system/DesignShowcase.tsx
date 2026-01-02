/**
 * DesignShowcase.tsx
 *
 * Showcase of enhanced UI components based on the design analysis.
 * Finance Noir aesthetic with premium fintech polish.
 *
 * Components:
 * 1. CategoryTabs - Pills with counters and animated underline
 * 2. KPICardEnhanced - Cards with varied colors and micro-animations
 * 3. UpcomingPaymentsWidget - Urgency-grouped timeline
 * 4. DonutChartEnhanced - Interactive with legend and top categories
 * 5. DashboardHeadline - Serif accents for visual weight
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface CategoryTab {
  id: string;
  label: string;
  count: number;
  icon?: React.ReactNode;
}

interface KPICardData {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  change?: number;
  variant: 'hero' | 'income' | 'expense' | 'warning' | 'neutral';
  icon: React.ReactNode;
  subtitle?: string;
}

interface UpcomingPayment {
  id: string;
  name: string;
  amount: number;
  dueDate: Date;
  category: string;
  urgency: 'overdue' | 'today' | 'thisWeek' | 'thisMonth';
  installment?: { current: number; total: number };
}

interface DonutSegment {
  label: string;
  value: number;
  color: string;
  percentage: number;
}

// =============================================================================
// 1. CATEGORY TABS - Pills with Counters
// =============================================================================

interface CategoryTabsProps {
  tabs: CategoryTab[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'default' | 'expense' | 'income';
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'default'
}) => {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Update indicator position on active tab change
  useEffect(() => {
    if (tabsRef.current) {
      const activeButton = tabsRef.current.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLButtonElement;
      if (activeButton) {
        setIndicatorStyle({
          left: activeButton.offsetLeft,
          width: activeButton.offsetWidth,
        });
      }
    }
  }, [activeTab]);

  const getVariantColors = () => {
    switch (variant) {
      case 'expense':
        return {
          active: 'text-red-500 dark:text-red-400',
          indicator: 'bg-gradient-to-r from-red-500 to-orange-400',
          countBg: 'bg-red-500/10 text-red-600 dark:text-red-400',
        };
      case 'income':
        return {
          active: 'text-emerald-500 dark:text-emerald-400',
          indicator: 'bg-gradient-to-r from-emerald-500 to-teal-400',
          countBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        };
      default:
        return {
          active: 'text-teal-600 dark:text-teal-400',
          indicator: 'bg-gradient-to-r from-teal-500 to-cyan-400',
          countBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
        };
    }
  };

  const colors = getVariantColors();

  return (
    <div className="relative">
      <div
        ref={tabsRef}
        className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl overflow-x-auto no-scrollbar"
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`
                relative flex items-center gap-2 px-4 py-2 rounded-lg
                font-medium text-sm whitespace-nowrap
                transition-all duration-200 ease-out
                ${isActive
                  ? `${colors.active} bg-white dark:bg-slate-900 shadow-sm`
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800'
                }
              `}
            >
              {tab.icon && (
                <span className="w-4 h-4 flex-shrink-0">{tab.icon}</span>
              )}
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-bold
                  transition-all duration-200
                  ${isActive ? colors.countBg : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}
                `}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Animated underline indicator */}
      <div
        className={`
          absolute bottom-0 h-0.5 rounded-full
          transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${colors.indicator}
        `}
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          transform: 'translateY(2px)',
        }}
      />
    </div>
  );
};

// =============================================================================
// 2. KPI CARDS ENHANCED - Color Variety + Micro-animations
// =============================================================================

interface KPICardEnhancedProps {
  data: KPICardData;
  formatCurrency: (value: number) => string;
  animationDelay?: number;
}

export const KPICardEnhanced: React.FC<KPICardEnhancedProps> = ({
  data,
  formatCurrency,
  animationDelay = 0
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Intersection observer for entrance animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), animationDelay);
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [animationDelay]);

  // Animate number count-up
  useEffect(() => {
    if (!isVisible) return;

    const duration = 800;
    const steps = 30;
    const stepDuration = duration / steps;
    const increment = data.value / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(data.value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.round(increment * currentStep));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [isVisible, data.value]);

  const getVariantStyles = () => {
    switch (data.variant) {
      case 'hero':
        return {
          border: 'border-teal-500/30 dark:border-teal-400/30',
          glow: 'shadow-teal-500/20 dark:shadow-teal-400/20',
          topBar: 'bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-500',
          iconBg: 'bg-gradient-to-br from-teal-500 to-cyan-600',
          iconText: 'text-white',
          valueColor: 'text-slate-900 dark:text-white',
        };
      case 'income':
        return {
          border: 'border-emerald-500/20 dark:border-emerald-400/20',
          glow: 'shadow-emerald-500/15 dark:shadow-emerald-400/15',
          topBar: 'bg-gradient-to-r from-emerald-500 to-green-400',
          iconBg: 'bg-emerald-500/15 dark:bg-emerald-400/15',
          iconText: 'text-emerald-600 dark:text-emerald-400',
          valueColor: 'text-emerald-600 dark:text-emerald-400',
        };
      case 'expense':
        return {
          border: 'border-red-500/20 dark:border-red-400/20',
          glow: 'shadow-red-500/15 dark:shadow-red-400/15',
          topBar: 'bg-gradient-to-r from-red-500 to-orange-400',
          iconBg: 'bg-red-500/15 dark:bg-red-400/15',
          iconText: 'text-red-600 dark:text-red-400',
          valueColor: 'text-red-600 dark:text-red-400',
        };
      case 'warning':
        return {
          border: 'border-amber-500/30 dark:border-amber-400/30',
          glow: 'shadow-amber-500/20 dark:shadow-amber-400/20',
          topBar: 'bg-gradient-to-r from-amber-500 to-orange-400',
          iconBg: 'bg-amber-500/15 dark:bg-amber-400/15',
          iconText: 'text-amber-600 dark:text-amber-400',
          valueColor: 'text-amber-600 dark:text-amber-400',
        };
      default:
        return {
          border: 'border-slate-200 dark:border-slate-700',
          glow: 'shadow-slate-500/10',
          topBar: 'bg-gradient-to-r from-slate-400 to-slate-500',
          iconBg: 'bg-slate-100 dark:bg-slate-800',
          iconText: 'text-slate-500 dark:text-slate-400',
          valueColor: 'text-slate-700 dark:text-slate-300',
        };
    }
  };

  const styles = getVariantStyles();
  const isHero = data.variant === 'hero';

  return (
    <div
      ref={cardRef}
      className={`
        relative overflow-hidden rounded-xl border
        bg-white dark:bg-slate-900
        transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
        ${styles.border}
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        ${isHero ? 'row-span-1 lg:col-span-1' : ''}
        hover:scale-[1.02] hover:shadow-lg hover:${styles.glow}
        group cursor-default
      `}
    >
      {/* Top gradient bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${styles.topBar}`} />

      <div className={`p-4 ${isHero ? 'p-5' : ''}`}>
        {/* Header: Label + Icon */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {data.label}
          </span>
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center
            transition-transform duration-300 group-hover:scale-110
            ${styles.iconBg}
          `}>
            <span className={`w-5 h-5 ${styles.iconText}`}>
              {data.icon}
            </span>
          </div>
        </div>

        {/* Value with count-up animation */}
        <div className={`
          font-bold tracking-tight
          font-[family-name:var(--font-display)]
          tabular-nums
          ${styles.valueColor}
          ${isHero ? 'text-3xl' : 'text-2xl'}
          transition-transform duration-200
        `}>
          {formatCurrency(displayValue)}
        </div>

        {/* Subtitle */}
        {data.subtitle && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {data.subtitle}
          </p>
        )}

        {/* Trend indicator */}
        {data.change !== undefined && (
          <div className="mt-3">
            <TrendBadge change={data.change} inverted={data.variant === 'expense'} />
          </div>
        )}
      </div>
    </div>
  );
};

// Trend Badge Component
interface TrendBadgeProps {
  change: number;
  inverted?: boolean;
}

const TrendBadge: React.FC<TrendBadgeProps> = ({ change, inverted = false }) => {
  const isPositive = change > 0;
  const isNeutral = Math.abs(change) < 0.5;
  const isGood = inverted ? !isPositive : isPositive;

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
        <span>~0%</span>
      </span>
    );
  }

  return (
    <span className={`
      inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
      transition-all duration-300
      ${isGood
        ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        : 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400'
      }
    `}>
      <svg
        className={`w-3 h-3 transition-transform duration-300 ${isPositive ? '' : 'rotate-180'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
      <span>{Math.abs(change).toFixed(0)}%</span>
    </span>
  );
};

// =============================================================================
// 3. UPCOMING PAYMENTS WIDGET - Urgency Grouped
// =============================================================================

interface UpcomingPaymentsWidgetProps {
  payments: UpcomingPayment[];
  formatCurrency: (value: number) => string;
  onPaymentClick?: (payment: UpcomingPayment) => void;
}

export const UpcomingPaymentsWidget: React.FC<UpcomingPaymentsWidgetProps> = ({
  payments,
  formatCurrency,
  onPaymentClick
}) => {
  const groupedPayments = useMemo(() => {
    const groups = {
      overdue: [] as UpcomingPayment[],
      today: [] as UpcomingPayment[],
      thisWeek: [] as UpcomingPayment[],
      thisMonth: [] as UpcomingPayment[],
    };

    payments.forEach(p => {
      groups[p.urgency].push(p);
    });

    return groups;
  }, [payments]);

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const urgencyConfig = {
    overdue: {
      label: 'Vencidos',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      color: 'text-red-500 dark:text-red-400',
      dotColor: 'bg-red-500',
      borderColor: 'border-l-red-500',
      bgHover: 'hover:bg-red-50 dark:hover:bg-red-500/10',
    },
    today: {
      label: 'Hoy',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-amber-500 dark:text-amber-400',
      dotColor: 'bg-amber-500',
      borderColor: 'border-l-amber-500',
      bgHover: 'hover:bg-amber-50 dark:hover:bg-amber-500/10',
    },
    thisWeek: {
      label: 'Esta semana',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'text-blue-500 dark:text-blue-400',
      dotColor: 'bg-blue-500',
      borderColor: 'border-l-blue-500',
      bgHover: 'hover:bg-blue-50 dark:hover:bg-blue-500/10',
    },
    thisMonth: {
      label: 'Este mes',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'text-slate-500 dark:text-slate-400',
      dotColor: 'bg-slate-400',
      borderColor: 'border-l-slate-400',
      bgHover: 'hover:bg-slate-50 dark:hover:bg-slate-800',
    },
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                Pagos por Vencer
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {payments.length} pendientes
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Payment Groups */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
        {(Object.keys(groupedPayments) as Array<keyof typeof groupedPayments>).map(urgency => {
          const group = groupedPayments[urgency];
          if (group.length === 0) return null;

          const config = urgencyConfig[urgency];

          return (
            <div key={urgency} className="py-2">
              {/* Group Header */}
              <div className={`flex items-center gap-2 px-4 py-1.5 ${config.color}`}>
                {config.icon}
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {config.label}
                </span>
                <span className="text-xs opacity-60">({group.length})</span>
              </div>

              {/* Group Items */}
              {group.map((payment, idx) => (
                <div
                  key={payment.id}
                  onClick={() => onPaymentClick?.(payment)}
                  className={`
                    relative flex items-center justify-between
                    px-4 py-3 ml-3 border-l-2
                    cursor-pointer transition-all duration-200
                    ${config.borderColor} ${config.bgHover}
                  `}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {/* Timeline dot */}
                  <div className={`
                    absolute left-[-5px] top-1/2 -translate-y-1/2
                    w-2 h-2 rounded-full ${config.dotColor}
                    ${urgency === 'overdue' ? 'animate-pulse' : ''}
                  `} />

                  <div className="flex-1 min-w-0 pl-3">
                    <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                      {payment.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(payment.dueDate)}
                      </span>
                      {payment.installment && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          Cuota {payment.installment.current}/{payment.installment.total}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="font-semibold text-sm text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}

        {payments.length === 0 && (
          <div className="py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ¡Todo al día!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// 4. DONUT CHART ENHANCED - Interactive with Legend
// =============================================================================

interface DonutChartEnhancedProps {
  segments: DonutSegment[];
  title?: string;
  formatCurrency: (value: number) => string;
  size?: number;
}

export const DonutChartEnhanced: React.FC<DonutChartEnhancedProps> = ({
  segments,
  title = 'Gastos por Categoría',
  formatCurrency,
  size = 200
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const topCategories = [...segments].sort((a, b) => b.value - a.value).slice(0, 3);

  // Entrance animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Calculate SVG paths for donut segments
  const radius = (size - 40) / 2;
  const strokeWidth = radius * 0.35;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercentage = 0;

  return (
    <div
      ref={chartRef}
      className={`
        bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800
        p-5 transition-all duration-500
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
    >
      {/* Title */}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
        {title}
      </h3>

      <div className="flex gap-6">
        {/* Chart */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-slate-100 dark:text-slate-800"
            />

            {/* Segments */}
            {segments.map((segment, index) => {
              const percentage = (segment.value / total) * 100;
              const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((cumulativePercentage / 100) * circumference);
              const currentCumulative = cumulativePercentage;
              cumulativePercentage += percentage;

              const isHovered = hoveredIndex === index;

              return (
                <circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className={`
                    transition-all duration-300 ease-out cursor-pointer
                    ${isVisible ? 'opacity-100' : 'opacity-0'}
                  `}
                  style={{
                    transitionDelay: isVisible ? `${index * 100}ms` : '0ms',
                    filter: isHovered ? 'brightness(1.1)' : 'none',
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {hoveredIndex !== null ? (
              <>
                <span className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {segments[hoveredIndex].label}
                </span>
                <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(segments[hoveredIndex].value)}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {segments[hoveredIndex].percentage.toFixed(1)}%
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Total
                </span>
                <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(total)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Legend + Top 3 */}
        <div className="flex-1 flex flex-col justify-center">
          <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
            Top Categorías
          </h4>
          <div className="space-y-3">
            {topCategories.map((cat, idx) => (
              <div
                key={cat.label}
                className={`
                  flex items-center gap-3 p-2 -mx-2 rounded-lg
                  transition-colors duration-200
                  ${hoveredIndex === segments.indexOf(cat) ? 'bg-slate-50 dark:bg-slate-800' : ''}
                `}
                onMouseEnter={() => setHoveredIndex(segments.indexOf(cat))}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300 truncate">
                    {cat.label}
                  </span>
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(cat.value)}
                </span>
              </div>
            ))}
          </div>

          {/* View all link */}
          {segments.length > 3 && (
            <button className="mt-4 text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline">
              Ver todas ({segments.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 5. DASHBOARD HEADLINE - Serif Accent for Visual Weight
// =============================================================================

interface DashboardHeadlineProps {
  primary: string;
  accent?: string;
  secondary?: string;
}

export const DashboardHeadline: React.FC<DashboardHeadlineProps> = ({
  primary,
  accent,
  secondary
}) => {
  return (
    <div className="mb-6">
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
        <span className="font-sans">{primary}</span>
        {accent && (
          <span className="
            font-serif italic
            bg-gradient-to-r from-teal-600 via-cyan-500 to-emerald-500
            dark:from-teal-400 dark:via-cyan-400 dark:to-emerald-400
            bg-clip-text text-transparent
          ">
            {' '}{accent}
          </span>
        )}
      </h1>
      {secondary && (
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {secondary}
        </p>
      )}
    </div>
  );
};

// =============================================================================
// DEMO: Full Showcase Component
// =============================================================================

export const DesignShowcase: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('all');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Sample data
  const categoryTabs: CategoryTab[] = [
    { id: 'all', label: 'Todos', count: 24 },
    { id: 'subscriptions', label: 'Suscripciones', count: 8 },
    { id: 'services', label: 'Servicios', count: 6 },
    { id: 'shopping', label: 'Compras', count: 5 },
    { id: 'food', label: 'Comida', count: 5 },
  ];

  const kpiCards: KPICardData[] = [
    {
      id: 'balance',
      label: 'Balance Mensual',
      value: 1250000,
      formattedValue: formatCurrency(1250000),
      change: 12.5,
      variant: 'hero',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      subtitle: 'Flujo neto del mes',
    },
    {
      id: 'income',
      label: 'Ingresos',
      value: 3500000,
      formattedValue: formatCurrency(3500000),
      change: 5.2,
      variant: 'income',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
        </svg>
      ),
    },
    {
      id: 'expenses',
      label: 'Gastos',
      value: 2250000,
      formattedValue: formatCurrency(2250000),
      change: -8.3,
      variant: 'expense',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
        </svg>
      ),
    },
    {
      id: 'pending',
      label: 'Por Pagar',
      value: 450000,
      formattedValue: formatCurrency(450000),
      variant: 'warning',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      subtitle: '4 pagos pendientes',
    },
  ];

  const upcomingPayments: UpcomingPayment[] = [
    {
      id: '1',
      name: 'Netflix',
      amount: 15990,
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      category: 'Suscripciones',
      urgency: 'overdue',
    },
    {
      id: '2',
      name: 'Spotify Family',
      amount: 8990,
      dueDate: new Date(),
      category: 'Suscripciones',
      urgency: 'today',
    },
    {
      id: '3',
      name: 'Dividendo',
      amount: 450000,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      category: 'Vivienda',
      urgency: 'thisWeek',
      installment: { current: 124, total: 240 },
    },
    {
      id: '4',
      name: 'Luz',
      amount: 35000,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      category: 'Servicios',
      urgency: 'thisWeek',
    },
    {
      id: '5',
      name: 'Internet',
      amount: 29990,
      dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
      category: 'Servicios',
      urgency: 'thisMonth',
    },
  ];

  const donutSegments: DonutSegment[] = [
    { label: 'Vivienda', value: 850000, color: '#0d9488', percentage: 37.8 },
    { label: 'Alimentación', value: 450000, color: '#f59e0b', percentage: 20 },
    { label: 'Transporte', value: 280000, color: '#3b82f6', percentage: 12.4 },
    { label: 'Servicios', value: 220000, color: '#8b5cf6', percentage: 9.8 },
    { label: 'Entretenimiento', value: 180000, color: '#ec4899', percentage: 8 },
    { label: 'Otros', value: 270000, color: '#64748b', percentage: 12 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Headline */}
        <DashboardHeadline
          primary="Control total de tus"
          accent="finanzas personales"
          secondary="Visualiza, organiza y optimiza tu dinero en un solo lugar."
        />

        {/* Category Tabs */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <CategoryTabs
            tabs={categoryTabs}
            activeTab={activeCategory}
            onChange={setActiveCategory}
          />
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card, idx) => (
            <KPICardEnhanced
              key={card.id}
              data={card}
              formatCurrency={formatCurrency}
              animationDelay={idx * 100}
            />
          ))}
        </div>

        {/* Bottom Row: Chart + Payments */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <DonutChartEnhanced
              segments={donutSegments}
              formatCurrency={formatCurrency}
            />
          </div>
          <div className="lg:col-span-2">
            <UpcomingPaymentsWidget
              payments={upcomingPayments}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignShowcase;
