import React, { useState, useEffect, useRef } from 'react';

export interface KPICardData {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  change?: number;
  variant: 'hero' | 'income' | 'expense' | 'warning' | 'neutral';
  icon: React.ReactNode;
  subtitle?: string;
}

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
        bg-white dark:bg-slate-800/50 backdrop-blur-sm
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
export interface TrendBadgeProps {
  change: number;
  inverted?: boolean;
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({ change, inverted = false }) => {
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
