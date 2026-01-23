import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * PWA Update Notifier Component
 * Shows a toast when a new version of the app is available,
 * with a button to reload and apply the update.
 */
export function PWAUpdateNotifier() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker
    } = useRegisterSW({
        onRegistered(r) {
            console.log('[PWA] Service Worker registered');
        },
        onRegisterError(error) {
            console.error('[PWA] Service Worker registration error:', error);
        }
    });

    const close = () => {
        setNeedRefresh(false);
    };

    if (!needRefresh) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[100] md:left-auto md:right-4 md:max-w-sm">
            <div className="bg-slate-900/95 backdrop-blur-xl border border-sky-500/30 rounded-2xl shadow-2xl shadow-sky-500/10 p-4 animate-in slide-in-from-bottom duration-300">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white">
                            Nueva versión disponible
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Hay mejoras listas para instalar
                        </p>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={close}
                        className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Action buttons */}
                <div className="mt-3 flex gap-2">
                    <button
                        onClick={() => updateServiceWorker(true)}
                        className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-900 font-semibold text-sm py-2 px-4 rounded-xl transition-colors"
                    >
                        Actualizar ahora
                    </button>
                    <button
                        onClick={close}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        Después
                    </button>
                </div>
            </div>
        </div>
    );
}
