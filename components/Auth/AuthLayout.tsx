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
            {/* Left Side - Visual & Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 z-10" />

                {/* Abstract Background Shapes */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
                    <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-sky-400/15 blur-3xl" />
                    <div className="absolute top-[40%] -right-[10%] w-[60%] h-[60%] rounded-full bg-cyan-400/15 blur-3xl" />
                    <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[50%] rounded-full bg-blue-400/15 blur-3xl" />
                </div>

                {/* Content - Logo and Tagline prominently displayed */}
                <div className="relative z-20 flex flex-col justify-center items-center w-full h-full p-12 text-white">
                    {/* Centered Logo and Brand */}
                    <div className="flex flex-col items-center justify-center space-y-6 max-w-sm">
                        {/* Logo with Screen Blend Mode for Transparency */}
                        <div className="w-32 h-32 flex items-center justify-center">
                            <img src="/logo-icon.png" alt="FinanSheet Logo" className="w-full h-full object-contain mix-blend-screen drop-shadow-[0_0_15px_rgba(14,165,233,0.5)]" />
                        </div>
                        <div className="text-center space-y-3">
                            <h1 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-sky-100">FinanSheet</h1>
                            <p className="text-lg text-slate-300 font-light">
                                {t('auth.promo.title')}
                            </p>
                        </div>
                    </div>

                    {/* Floating Bubbles & Glow Effects */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {/* Ambient Glows */}
                        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-600/20 rounded-full blur-[100px] mix-blend-screen" />
                        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] mix-blend-screen" />

                        {/* Wave/Smoke Effect (CSS Radial Gradients) */}
                        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-sky-900/30 to-transparent opacity-50" />

                        {/* Sharp & Blurred Bubbles (Bokeh Effect) */}
                        {/* Top Left Cluster */}
                        <div className="absolute top-[15%] left-[10%] w-4 h-4 rounded-full bg-sky-400/60 shadow-[0_0_10px_rgba(56,189,248,0.5)] animate-pulse" />
                        <div className="absolute top-[20%] left-[15%] w-2 h-2 rounded-full bg-cyan-300/80 blur-[1px]" />

                        {/* Center/Right Flow */}
                        <div className="absolute top-[40%] right-[20%] w-12 h-12 rounded-full bg-gradient-to-br from-sky-400/30 to-blue-500/30 backdrop-blur-sm border border-white/10" />
                        <div className="absolute top-[35%] right-[15%] w-3 h-3 rounded-full bg-sky-300/50 blur-[2px]" />

                        {/* Bottom Left Large Orb */}
                        <div className="absolute bottom-[25%] left-[15%] w-24 h-24 rounded-full bg-gradient-to-tr from-sky-500/20 to-cyan-400/20 backdrop-blur-md border border-white/5 shadow-[0_0_30px_rgba(14,165,233,0.2)] animate-pulse" style={{ animationDuration: '4s' }} />

                        {/* Bottom Right Cluster */}
                        <div className="absolute bottom-[20%] right-[25%] w-6 h-6 rounded-full bg-sky-400/40 blur-[1px]" />
                        <div className="absolute bottom-[15%] right-[10%] w-16 h-16 rounded-full bg-blue-500/10 blur-[20px]" />

                        {/* Random Particles */}
                        <div className="absolute top-[60%] left-[30%] w-2 h-2 rounded-full bg-white/40 blur-[1px] animate-bounce" style={{ animationDuration: '3s' }} />
                        <div className="absolute top-[30%] right-[40%] w-1.5 h-1.5 rounded-full bg-cyan-300/60" />
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative bg-white text-slate-900">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                            {title}
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                            {subtitle}
                        </p>
                    </div>

                    {children}
                </div>
            </div>
        </div>
    );
};
