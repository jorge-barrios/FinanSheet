import React from 'react';
import { useLocalization } from '../../hooks/useLocalization';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
    const { t } = useLocalization();

    return (
        <div className="min-h-screen w-full flex">
            {/* Left Side - Visual & Branding (wider for more visual impact) */}
            <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative bg-slate-900 overflow-hidden">
                {/* Base gradient - Future Dusk inspired */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

                {/* Mesh gradient background with Eucalyptus/Teal accents */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_20%_-20%,rgba(14,165,233,0.15),transparent)]" />
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_60%_60%_at_80%_120%,rgba(20,184,166,0.12),transparent)]" />
                </div>

                {/* BENTO GRID PATTERN - "Sheet" DNA */}
                <div className="absolute inset-0 opacity-[0.08]" style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
                                      linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                    backgroundSize: '60px 60px'
                }} />

                {/* Content - Logo and Tagline */}
                <div className="relative z-20 flex flex-col justify-center items-center w-full h-full p-12 text-white">
                    {/* Centered Logo and Brand */}
                    <div className="flex flex-col items-center justify-center space-y-8 max-w-md">
                        {/* Logo with enhanced glow */}
                        <div className="w-32 h-32 flex items-center justify-center relative">
                            <div className="absolute inset-0 bg-sky-500/20 rounded-full blur-3xl animate-pulse" />
                            <img src="/finansheet-mark-512.png" alt="FinanSheet Logo" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_40px_rgba(56,189,248,0.5)]" />
                        </div>

                        {/* Brand text */}
                        <div className="text-center space-y-4">
                            <h1 className="text-4xl font-bold tracking-tight text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                FinanSheet
                            </h1>
                            <p className="text-xl text-slate-200/90 max-w-xs leading-relaxed" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic' }}>
                                {t('auth.promo.title')}
                            </p>
                        </div>

                        {/* Feature highlights with Eucalyptus/Coral accents */}
                        <div className="flex items-center gap-6 mt-4 text-slate-400 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>Seguro</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                <span>Simple</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                                <span>Gratis</span>
                            </div>
                        </div>
                    </div>

                    {/* Decorative line */}
                    <div className="absolute bottom-12 left-12 right-12">
                        <div className="h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
                        <p className="mt-4 text-center text-xs text-slate-500 font-medium">
                            {t('login.footer')}
                        </p>
                    </div>
                </div>

                {/* Corner accent */}
                <div className="absolute -top-16 -right-16 w-64 h-64">
                    <div className="absolute top-24 right-24 w-40 h-40 border border-slate-700/20 rounded-full" />
                    <div className="absolute top-28 right-28 w-32 h-32 border border-slate-700/15 rounded-full" />
                </div>
            </div>

            {/* Right Side - Form (narrower, more focused) */}
            <div className="w-full lg:w-[45%] xl:w-[40%] flex items-center justify-center p-6 lg:p-12 relative bg-slate-900 text-white">
                {/* Subtle background effects for form side */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-[100px]" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px]" />
                </div>

                {/* Form Container Box - LIQUID GLASS EFFECT */}
                <div className="w-full max-w-md relative z-10 flex flex-col gap-4">
                    {/* Tile 1: Header with Liquid Glass */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/30 text-center lg:text-left relative overflow-hidden">
                        {/* Inner glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                        <div className="relative z-10">
                            <h2 className="text-2xl font-bold tracking-tight text-white">
                                {title}
                            </h2>
                            <p className="mt-2 text-sm text-slate-300">
                                {subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Tile 2: Form with Enhanced Liquid Glass */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/40 relative overflow-hidden">
                        {/* Inner glow and subtle gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-sky-500/5 pointer-events-none" />
                        <div className="relative z-10">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
