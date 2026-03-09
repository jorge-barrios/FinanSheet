import React, { useState, useEffect, useRef } from 'react';

export interface FilterTab {
    id: string; // The category string or special identifier
    label: string;
    icon?: React.ReactNode;
}

interface MobileFilterTabsProps {
    tabs: FilterTab[];
    activeTab: string;
    onChange: (id: string) => void;
}

export const MobileFilterTabs: React.FC<MobileFilterTabsProps> = ({
    tabs,
    activeTab,
    onChange
}) => {
    const tabsRef = useRef<HTMLDivElement>(null);
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

    // Update indicator position when the active tab changes or window resizes
    useEffect(() => {
        const updateIndicator = () => {
             if (tabsRef.current) {
                const activeButton = tabsRef.current.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLButtonElement;
                if (activeButton) {
                    setIndicatorStyle({
                        left: activeButton.offsetLeft,
                        width: activeButton.offsetWidth,
                    });
                }
            }
        };

        updateIndicator();
        // Give time for layout calculations, especially if fonts are loading
        const timer = setTimeout(updateIndicator, 50);

        window.addEventListener('resize', updateIndicator);
        return () => {
            window.removeEventListener('resize', updateIndicator);
            clearTimeout(timer);
        }
    }, [activeTab, tabs]);

    // Ensure the active tab scrolls into view if it's off-screen
    useEffect(() => {
         if (tabsRef.current) {
             const activeButton = tabsRef.current.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLButtonElement;
             if (activeButton) {
                  // behavior: smooth makes the scroll visible, center tries to center it
                 activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
             }
         }
    }, [activeTab]);

    return (
        <div className="relative w-full overflow-hidden no-scrollbar bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <div
                ref={tabsRef}
                className="flex gap-2 px-3 py-2 overflow-x-auto no-scrollbar snap-x snap-mandatory relative z-10"
                style={{ WebkitOverflowScrolling: 'touch' }}
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
                                relative flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full
                                font-medium text-[13px] whitespace-nowrap snap-center shrink-0
                                transition-all duration-200 ease-out z-10
                                ${isActive
                                    ? 'text-sky-700 dark:text-sky-300 font-semibold'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                                }
                            `}
                        >
                            {tab.icon && (
                                <span className={`w-3.5 h-3.5 flex-shrink-0 ${isActive && tab.id === 'FILTER_IMPORTANT' ? 'text-amber-500' : ''}`}>
                                    {tab.icon}
                                </span>
                            )}
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Pill Indicator (background of active tab) */}
            <div className="absolute top-0 bottom-0 left-0 pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] z-0 py-2"
                 style={{
                     transform: `translateX(${indicatorStyle.left}px)`,
                 }}
            >
                <div 
                    className="h-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200/60 dark:border-slate-700/60 rounded-full transition-all duration-300"
                    style={{ width: `${indicatorStyle.width}px` }} 
                />
            </div>
            
            {/* Fade Edges for Scroll affordance */}
            <div className="absolute top-0 right-0 bottom-0 w-6 bg-gradient-to-l from-slate-50 dark:from-slate-900 pointer-events-none z-20" />
            <div className="absolute top-0 left-0 bottom-0 w-6 bg-gradient-to-r from-slate-50 dark:from-slate-900 pointer-events-none z-20" />
        </div>
    );
};
