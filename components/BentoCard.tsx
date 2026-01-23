/**
 * BentoCard.tsx
 *
 * Individual card component with Hybrid styling (Solid Structure + Glass Accents).
 * Used within BentoGrid for modular layouts.
 * 
 * Features:
 * - Hybrid background: Gradient + Subtle Transparency (95% opacity)
 * - Glassmorphism: backdrop-blur-xl for depth
 * - Structure: Rounded-xl, defined borders from dashboard theme
 * - Variants: Support for Hero (stronger gradient) and standard states
 */

import React from 'react';

export type BentoCardVariant = 'default' | 'positive' | 'negative' | 'accent' | 'warning' | 'neutral' | 'hero';

interface BentoCardProps {
    children: React.ReactNode;
    variant?: BentoCardVariant;
    className?: string;
    onClick?: () => void;
    /** Whether this card can be interacted with (shows hover effects) */
    interactive?: boolean;
    /** Custom header content (icon, label) */
    header?: React.ReactNode;
    /** Card title */
    title?: string;
    /** Subtitle or meta info */
    subtitle?: string;
    /** Compact mode - reduced padding for mobile cards */
    compact?: boolean;
}

const variantStyles: Record<BentoCardVariant, {
    border: string;
    background: string;
    topAccentClass?: string;
    accentText: string;
}> = {
    default: {
        border: 'border-[var(--dashboard-border)]',
        background: 'bg-gradient-to-br from-[var(--dashboard-surface)] via-[var(--dashboard-surface)] to-[var(--dashboard-surface-elevated)]',
        accentText: 'text-[var(--dashboard-text-primary)]',
    },
    hero: {
        border: 'border-[var(--dashboard-border)]',
        // Stronger gradient for Hero: Darker/Richer in dark mode, defined in CSS usually but approximated here with util classes
        background: 'bg-gradient-to-br from-[var(--dashboard-surface)] to-[var(--dashboard-surface-elevated)]',
        topAccentClass: 'bg-gradient-to-r from-[var(--dashboard-accent)] to-[var(--dashboard-positive)]',
        accentText: 'text-[var(--dashboard-accent)]',
    },
    positive: {
        border: 'border-[var(--dashboard-border)]',
        background: 'bg-gradient-to-br from-[var(--dashboard-surface)] to-[var(--dashboard-positive-light)]',
        topAccentClass: 'bg-[var(--dashboard-positive)]',
        accentText: 'text-[var(--dashboard-positive)]',
    },
    negative: {
        border: 'border-[var(--dashboard-border)]',
        background: 'bg-gradient-to-br from-[var(--dashboard-surface)] to-[var(--dashboard-negative-light)]',
        topAccentClass: 'bg-[var(--dashboard-negative)]',
        accentText: 'text-[var(--dashboard-negative)]',
    },
    accent: {
        border: 'border-[var(--dashboard-border)]',
        background: 'bg-gradient-to-br from-[var(--dashboard-surface)] to-[var(--dashboard-accent-light)]',
        topAccentClass: 'bg-[var(--dashboard-accent)]',
        accentText: 'text-[var(--dashboard-accent)]',
    },
    warning: {
        border: 'border-[var(--dashboard-border)]',
        background: 'bg-gradient-to-br from-[var(--dashboard-surface)] to-[var(--dashboard-warning-light)]',
        topAccentClass: 'bg-[var(--dashboard-warning)]',
        accentText: 'text-[var(--dashboard-warning)]',
    },
    neutral: {
        border: 'border-[var(--dashboard-border)]',
        background: 'bg-gradient-to-br from-[var(--dashboard-surface)] to-[var(--dashboard-neutral-light)]',
        topAccentClass: 'bg-[var(--dashboard-neutral)]',
        accentText: 'text-[var(--dashboard-neutral)]',
    },
};

export function BentoCard({
    children,
    variant = 'default',
    className = '',
    onClick,
    interactive = false,
    header,
    title,
    subtitle,
    compact = false,
}: BentoCardProps) {
    const styles = variantStyles[variant];
    const isClickable = onClick || interactive;

    return (
        <div
            onClick={onClick}
            className={`
                group relative overflow-hidden rounded-xl
                ${styles.background}
                border ${styles.border}
                backdrop-blur-xl
                transition-all duration-200 ease-out
                ${isClickable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--dashboard-border-strong)]' : ''}
                ${className}
            `.trim().replace(/\s+/g, ' ')}
            style={{
                backgroundBlendMode: 'overlay', // Helps blend the gradient with the base surface color
                boxShadow: isClickable ? 'var(--dashboard-shadow-sm)' : undefined
            }}
        >
            {/* Top Accent Bar - DISABLED: Using left lateral bar instead (see CommitmentCard) */}
            {/* Note: Left lateral status indicator is now handled by the parent component */}

            {/* Glass shine effect on hover (optional, enhances hybrid feel) */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-tr from-white/0 via-white/5 to-white/0" />

            {/* Content - Responsive padding */}
            <div className={`relative ${compact ? 'p-3' : 'p-4'}`}>
                {(header || title) && (
                    <div className="mb-3">
                        {header && <div className="mb-2">{header}</div>}
                        {title && (
                            <h3 className={`font-semibold text-sm ${styles.accentText}`}>
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p className="text-xs text-[var(--dashboard-text-muted)] mt-1">
                                {subtitle}
                            </p>
                        )}
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}

export default BentoCard;
