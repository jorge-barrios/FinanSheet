import React, { useState, useEffect, useRef } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  percentage: number;
}

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
        bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700/50
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
            {hoveredIndex !== null && segments[hoveredIndex] ? (
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
            {topCategories.map((cat) => (
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
