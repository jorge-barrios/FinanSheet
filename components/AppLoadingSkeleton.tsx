// No React import needed - JSX auto-transforms in modern React

/**
 * AppLoadingSkeleton
 * 
 * A branded skeleton loading screen that mimics the actual app layout.
 * Uses pulse animation on slate-colored placeholders with sky-blue accents.
 * Based on 2025 UX best practices: skeleton loaders improve perceived
 * performance by 20-30% compared to simple spinners.
 */
export function AppLoadingSkeleton() {
    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* Main content area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header skeleton */}
                <header className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-white dark:bg-slate-900/80">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500/30 to-sky-600/30 animate-pulse" />
                        <div className="w-24 h-5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    </div>

                    {/* Nav items */}
                    <div className="hidden md:flex items-center gap-4">
                        <div className="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                        <div className="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                        <div className="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-3">
                        <div className="w-32 h-9 bg-sky-500/20 rounded-xl animate-pulse" />
                        <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                    </div>
                </header>

                {/* Main content skeleton */}
                <main className="flex-1 p-4 overflow-hidden">
                    <div className="h-full flex flex-col lg:flex-row gap-4">
                        {/* Sidebar skeleton (Pagos por Vencer) */}
                        <aside className="lg:w-80 flex-shrink-0 order-last lg:order-first">
                            <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4 h-full">
                                {/* Sidebar header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-amber-500/30 rounded animate-pulse" />
                                        <div className="w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                    </div>
                                    <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                                </div>

                                {/* Payment items */}
                                <div className="space-y-3">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                                            <div className="w-2 h-8 bg-amber-500/40 rounded-full animate-pulse" />
                                            <div className="flex-1">
                                                <div className="w-24 h-3 bg-slate-200 dark:bg-slate-600 rounded animate-pulse mb-2" />
                                                <div className="w-16 h-3 bg-slate-200 dark:bg-slate-600 rounded animate-pulse" />
                                            </div>
                                            <div className="w-16 h-5 bg-sky-500/20 rounded animate-pulse" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </aside>

                        {/* Main dashboard area */}
                        <div className="flex-1 flex flex-col gap-4 min-w-0">
                            {/* Hero KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="w-20 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                            <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                        </div>
                                        <div className="w-32 h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
                                        <div className="w-16 h-3 bg-sky-500/20 rounded animate-pulse" />
                                    </div>
                                ))}
                            </div>

                            {/* Chart area */}
                            <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5 flex-1">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="w-40 h-5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                    <div className="flex gap-2">
                                        <div className="w-16 h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                        <div className="w-16 h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                    </div>
                                </div>

                                {/* Chart placeholder */}
                                <div className="h-48 flex items-end justify-between gap-2 px-4">
                                    {[60, 80, 45, 90, 70, 85, 55, 75, 65, 80, 50, 95].map((h, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 bg-gradient-to-t from-sky-500/30 to-sky-500/10 rounded-t animate-pulse"
                                            style={{ height: `${h}%`, animationDelay: `${i * 50}ms` }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Bottom cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[1, 2].map((i) => (
                                    <div key={i} className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5">
                                        <div className="w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
                                        <div className="space-y-3">
                                            {[1, 2, 3].map((j) => (
                                                <div key={j} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                                                        <div className="w-20 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                                    </div>
                                                    <div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Floating brand indicator */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/90 backdrop-blur-sm border border-sky-500/30 shadow-lg shadow-sky-500/10">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 animate-pulse" />
                <span className="text-sm text-slate-300 font-medium">Cargando FinanSheet...</span>
            </div>
        </div>
    );
}

/**
 * Inline skeleton pulse animation
 * Use this for smaller inline placeholders
 */
export function SkeletonPulse({ className = '' }: { className?: string }) {
    return (
        <div className={`bg-slate-200 dark:bg-slate-700 rounded animate-pulse ${className}`} />
    );
}

/**
 * Skeleton text line
 */
export function SkeletonText({ width = 'w-24', className = '' }: { width?: string; className?: string }) {
    return (
        <div className={`h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse ${width} ${className}`} />
    );
}

/**
 * Skeleton card
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
    return (
        <div className={`bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5 animate-pulse ${className}`}>
            <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
            <div className="w-32 h-6 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="w-16 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
    );
}
