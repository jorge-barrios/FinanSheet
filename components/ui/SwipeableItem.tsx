import React, { useState, useRef } from 'react';

interface SwipeableItemProps {
  children: React.ReactNode;
  /** Content to show behind the item when swiping right (e.g. Pay/Pause) */
  leftAction?: React.ReactNode;
  /** Content to show behind the item when swiping left (e.g. Delete/Edit) */
  rightAction?: React.ReactNode;
  /** Triggered when swiped right beyond threshold */
  onSwipeRight?: () => void;
  /** Triggered when swiped left beyond threshold */
  onSwipeLeft?: () => void;
  className?: string;
  disabled?: boolean;
}

export const SwipeableItem: React.FC<SwipeableItemProps> = ({
  children,
  leftAction,
  rightAction,
  onSwipeRight,
  onSwipeLeft,
  className = '',
  disabled = false
}) => {
  const [offset, setOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  
  // Threshold to trigger action (px)
  const THRESHOLD = 80;
  // Limit max swipe distance
  const MAX_SWIPE = 120;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    touchStartX.current = e.targetTouches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || touchStartX.current === null) return;
    
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStartX.current;
    
    // Only allow swipe in directions that have actions defined
    if (diff > 0 && !leftAction) return;
    if (diff < 0 && !rightAction) return;

    // Apply resistance as we get closer to the limit
    const resistedDiff = diff > 0 
      ? Math.min(diff, MAX_SWIPE) 
      : Math.max(diff, -MAX_SWIPE);
      
    setOffset(resistedDiff);
  };

  const handleTouchEnd = () => {
    if (disabled) return;
    
    if (Math.abs(offset) > THRESHOLD) {
      if (offset > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (offset < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }
    
    // Reset position
    setOffset(0);
    setIsSwiping(false);
    touchStartX.current = null;
  };

  // Logic to show background colors/actions based on swipe direction
  const getBackgroundStyle = () => {
    if (offset > 0 && leftAction) return 'left';
    if (offset < 0 && rightAction) return 'right';
    return null;
  };

  const activeSide = getBackgroundStyle();

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      {/* Background Actions Layer */}
      <div className="absolute inset-0 flex items-center justify-between rounded-xl">
        {/* Left Action (Visible when swiping right) */}
        <div 
          className={`h-full flex items-center justify-start pl-4 transition-opacity duration-200 rounded-l-xl ${activeSide === 'left' ? 'opacity-100' : 'opacity-0'}`}
          style={{ width: '50%' }}
        >
          {leftAction}
        </div>
        
        {/* Right Action (Visible when swiping left) */}
        <div 
          className={`h-full flex items-center justify-end pr-4 transition-opacity duration-200 rounded-r-xl ${activeSide === 'right' ? 'opacity-100' : 'opacity-0'}`}
           style={{ width: '50%', marginLeft: 'auto' }}
        >
          {rightAction}
        </div>
      </div>

      {/* Foreground Content Layer */}
      <div
        ref={itemRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          transform: `translateX(${offset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
        className="relative bg-white dark:bg-slate-800 z-10 rounded-xl touch-pan-y"
      >
        {children}
      </div>
    </div>
  );
};
