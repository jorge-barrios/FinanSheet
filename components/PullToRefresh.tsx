import React, { useState, useRef, useCallback, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
    children: ReactNode;
    onRefresh: () => Promise<void>;
    disabled?: boolean;
    threshold?: number; // Pull distance to trigger refresh (px)
    className?: string;
}

/**
 * Pull-to-Refresh Component
 * Wraps content and adds pull-to-refresh gesture support for mobile devices.
 * 
 * Usage:
 * <PullToRefresh onRefresh={async () => await fetchData()}>
 *   <YourContent />
 * </PullToRefresh>
 */
export function PullToRefresh({
    children,
    onRefresh,
    disabled = false,
    threshold = 80,
    className = ''
}: PullToRefreshProps) {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const currentY = useRef(0);

    const canPull = useCallback(() => {
        if (disabled || isRefreshing) return false;
        const container = containerRef.current;
        if (!container) return false;
        // Only allow pull if at top of scroll
        return container.scrollTop <= 0;
    }, [disabled, isRefreshing]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!canPull()) return;
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
    }, [canPull]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling || !canPull()) return;

        currentY.current = e.touches[0].clientY;
        const delta = currentY.current - startY.current;

        if (delta > 0) {
            // Apply resistance (diminishing returns as you pull more)
            const resistance = Math.min(delta * 0.5, threshold * 1.5);
            setPullDistance(resistance);
        }
    }, [isPulling, canPull, threshold]);

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling) return;
        setIsPulling(false);

        if (pullDistance >= threshold && !isRefreshing) {
            setIsRefreshing(true);
            setPullDistance(threshold * 0.6); // Keep some height while refreshing

            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
    }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

    // Calculate visual states
    const progress = Math.min(pullDistance / threshold, 1);
    const rotation = progress * 180;
    const opacity = Math.min(progress * 1.5, 1);

    return (
        <div
            ref={containerRef}
            className={`relative overflow-y-auto ${className}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull indicator */}
            <div
                className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-10 transition-transform duration-200"
                style={{
                    transform: `translateY(${pullDistance - 48}px)`,
                    opacity: pullDistance > 10 ? opacity : 0
                }}
            >
                <div className={`
                    w-10 h-10 rounded-full 
                    bg-slate-800/90 dark:bg-slate-700/90 
                    backdrop-blur-sm 
                    flex items-center justify-center
                    shadow-lg shadow-teal-500/20
                    border border-teal-500/30
                `}>
                    <RefreshCw
                        className={`w-5 h-5 text-teal-400 ${isRefreshing ? 'animate-spin' : ''}`}
                        style={{
                            transform: isRefreshing ? 'none' : `rotate(${rotation}deg)`,
                            transition: isRefreshing ? 'none' : 'transform 0.1s ease-out'
                        }}
                    />
                </div>
            </div>

            {/* Content with pull offset */}
            <div
                className="transition-transform duration-200 ease-out"
                style={{
                    transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none',
                    transition: isPulling ? 'none' : 'transform 0.3s ease-out'
                }}
            >
                {children}
            </div>
        </div>
    );
}
