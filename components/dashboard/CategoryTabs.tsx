import React, { useState, useEffect, useRef } from 'react';

export interface CategoryTab {
  id: string;
  label: string;
  count: number;
  icon?: React.ReactNode;
}

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
