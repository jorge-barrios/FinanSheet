/**
 * BentoGrid.tsx
 *
 * Modular grid layout system inspired by Bento box design.
 * Supports variable-sized cards with responsive columns.
 */

import React from 'react';

export interface BentoSpan {
    /** Number of columns to span (1 or 2) */
    cols?: 1 | 2;
    /** Number of rows to span (1 or 2) */
    rows?: 1 | 2;
}

export interface BentoItem {
    /** Unique identifier */
    id: string;
    /** How many grid cells this item spans */
    span?: BentoSpan;
    /** The content to render */
    content: React.ReactNode;
    /** Optional className for the grid cell */
    className?: string;
}

interface BentoGridProps {
    /** Array of items to display in the grid */
    items: BentoItem[];
    /** Number of columns (responsive default: 2 mobile, 3-4 desktop) */
    columns?: 2 | 3 | 4;
    /** Gap between items */
    gap?: 'sm' | 'md' | 'lg';
    /** Additional className for the grid container */
    className?: string;
}

const gapSizes = {
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
};

const columnClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
};

function getSpanClasses(span?: BentoSpan): string {
    const classes: string[] = [];

    if (span?.cols === 2) {
        classes.push('col-span-2');
    }
    if (span?.rows === 2) {
        classes.push('row-span-2');
    }

    return classes.join(' ');
}

export function BentoGrid({
    items,
    columns = 2,
    gap = 'md',
    className = '',
}: BentoGridProps) {
    return (
        <div
            className={`
                grid auto-rows-auto
                ${columnClasses[columns]}
                ${gapSizes[gap]}
                ${className}
            `.trim().replace(/\s+/g, ' ')}
        >
            {items.map((item, index) => (
                <div
                    key={item.id}
                    className={`
                        ${getSpanClasses(item.span)}
                        ${item.className || ''}
                        animate-fade-in-up
                    `.trim().replace(/\s+/g, ' ')}
                    style={{
                        animationDelay: `${index * 50}ms`,
                        animationFillMode: 'both',
                    }}
                >
                    {item.content}
                </div>
            ))}
        </div>
    );
}

/**
 * Helper hook to create BentoItems from data.
 * Simplifies the pattern of mapping data to grid items.
 */
export function useBentoItems<T>(
    data: T[],
    getId: (item: T) => string,
    renderItem: (item: T, index: number) => React.ReactNode,
    getSpan?: (item: T, index: number) => BentoSpan | undefined
): BentoItem[] {
    return data.map((item, index) => ({
        id: getId(item),
        content: renderItem(item, index),
        span: getSpan?.(item, index),
    }));
}

export default BentoGrid;
