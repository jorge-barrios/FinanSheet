/**
 * ColorPaletteShowcase.tsx
 *
 * Visual comparison between current Ocean Teal palette
 * and the recommended Identidad.md "Claridad Estructurada" palette.
 *
 * Use this to decide which colors to adopt.
 */

import React, { useState } from 'react';

interface ColorSwatch {
  name: string;
  cssVar: string;
  hex: string;
  description: string;
}

const currentPalette: ColorSwatch[] = [
  { name: 'Accent', cssVar: '--dashboard-accent', hex: '#0d9488', description: 'Teal 600 - Primary brand' },
  { name: 'Accent Light', cssVar: '--dashboard-accent-light', hex: '#ccfbf1', description: 'Teal 100 - Backgrounds' },
  { name: 'Positive', cssVar: '--dashboard-positive', hex: '#10b981', description: 'Emerald 500 - Income/Success' },
  { name: 'Negative', cssVar: '--dashboard-negative', hex: '#ef4444', description: 'Red 500 - Expenses/Error' },
  { name: 'Warning', cssVar: '--dashboard-warning', hex: '#f59e0b', description: 'Amber 500 - Pending' },
  { name: 'Surface', cssVar: '--dashboard-surface', hex: '#ffffff', description: 'White - Cards' },
  { name: 'Background', cssVar: '--dashboard-bg', hex: '#f8fafc', description: 'Slate 50 - Page bg' },
];

const currentPaletteDark: ColorSwatch[] = [
  { name: 'Accent', cssVar: '--dashboard-accent', hex: '#2dd4bf', description: 'Teal 400 - Primary brand' },
  { name: 'Accent Light', cssVar: '--dashboard-accent-light', hex: 'rgba(45, 212, 191, 0.15)', description: 'Teal transparent' },
  { name: 'Positive', cssVar: '--dashboard-positive', hex: '#34d399', description: 'Emerald 400 - Income/Success' },
  { name: 'Negative', cssVar: '--dashboard-negative', hex: '#f87171', description: 'Red 400 - Expenses/Error' },
  { name: 'Warning', cssVar: '--dashboard-warning', hex: '#fbbf24', description: 'Amber 400 - Pending' },
  { name: 'Surface', cssVar: '--dashboard-surface', hex: '#0f172a', description: 'Slate 900 - Cards' },
  { name: 'Background', cssVar: '--dashboard-bg', hex: '#020617', description: 'Slate 950 - Page bg' },
];

const identidadPalette: ColorSwatch[] = [
  { name: 'Deep Teal', cssVar: '--id-deep-teal', hex: '#00555A', description: 'Confianza + Base (Identidad.md)' },
  { name: 'Eucalyptus', cssVar: '--id-eucalyptus', hex: '#9CAF88', description: 'Calma + Fondos naturales' },
  { name: 'Hyper-Coral', cssVar: '--id-coral', hex: '#FF6F61', description: 'Acción + CTAs (warm accent)' },
  { name: 'Neo-Mint', cssVar: '--id-neo-mint', hex: '#A8E6CF', description: 'Tech + Nature (fresh)' },
  { name: 'Future Dusk', cssVar: '--id-future-dusk', hex: '#4C5578', description: 'Sophisticated dark mode' },
  { name: 'Cream', cssVar: '--id-cream', hex: '#F5F1E8', description: 'Softer than white (premium)' },
  { name: 'Alabaster', cssVar: '--id-alabaster', hex: '#FAFAF8', description: 'Warm white background' },
];

const ColorSwatchCard: React.FC<{ color: ColorSwatch; isDark?: boolean }> = ({ color, isDark }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
    <div
      className="w-12 h-12 rounded-lg shadow-inner flex-shrink-0 border border-white/10"
      style={{ backgroundColor: color.hex }}
    />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">{color.name}</span>
        <code className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 font-mono">{color.hex}</code>
      </div>
      <p className="text-xs text-slate-400 mt-0.5 truncate">{color.description}</p>
      <code className="text-[9px] text-slate-500 font-mono">{color.cssVar}</code>
    </div>
  </div>
);

export const ColorPaletteShowcase: React.FC = () => {
  const [activeTheme, setActiveTheme] = useState<'current' | 'identidad'>('current');
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleIdentidadTheme = () => {
    const html = document.documentElement;
    if (activeTheme === 'current') {
      html.classList.add('theme-identidad');
      setActiveTheme('identidad');
    } else {
      html.classList.remove('theme-identidad');
      setActiveTheme('current');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Color Palette Comparison
          </h1>
          <p className="text-slate-400">
            Compare the current Ocean Teal palette with the recommended "Claridad Estructurada" from Identidad.md
          </p>
        </div>

        {/* Theme Toggle */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={toggleIdentidadTheme}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTheme === 'identidad'
                ? 'bg-[#FF6F61] text-white shadow-lg shadow-[#FF6F61]/25'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {activeTheme === 'identidad' ? '✓ Identidad.md Active' : 'Try Identidad.md Theme'}
          </button>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="px-4 py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            {isDarkMode ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>

        {/* Palettes Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Current Palette */}
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-4 h-4 rounded-full bg-[#0d9488]" />
              <h2 className="text-xl font-semibold">Current: Ocean Teal</h2>
              {activeTheme === 'current' && (
                <span className="px-2 py-0.5 text-xs bg-teal-500/20 text-teal-400 rounded-full">Active</span>
              )}
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Inspired by Robinhood, Mint, Mercury. Modern fintech aesthetic.
            </p>
            <div className="space-y-2">
              {(isDarkMode ? currentPaletteDark : currentPalette).map((color) => (
                <ColorSwatchCard key={color.name} color={color} isDark={isDarkMode} />
              ))}
            </div>
          </div>

          {/* Identidad.md Palette */}
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-4 h-4 rounded-full bg-[#00555A]" />
              <h2 className="text-xl font-semibold">Identidad.md: Claridad Estructurada</h2>
              {activeTheme === 'identidad' && (
                <span className="px-2 py-0.5 text-xs bg-[#FF6F61]/20 text-[#FF6F61] rounded-full">Active</span>
              )}
            </div>
            <p className="text-sm text-slate-400 mb-4">
              "Confianza Tranquila" - Deep Teal + Eucalyptus + Coral. Premium eco-tech feel.
            </p>
            <div className="space-y-2">
              {identidadPalette.map((color) => (
                <ColorSwatchCard key={color.name} color={color} />
              ))}
            </div>
          </div>
        </div>

        {/* Typography Preview */}
        <div className="mt-8 bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4">Typography Preview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Geist (Current UI)</p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Geist, sans-serif' }}>
                $1,250,000
              </p>
              <p className="text-sm text-slate-400" style={{ fontFamily: 'Geist, sans-serif' }}>
                Balance Mensual
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Space Grotesk (Brand - Identidad.md)</p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                $1,250,000
              </p>
              <p className="text-sm text-slate-400" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Balance Mensual
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Instrument Serif (Headlines)</p>
              <p className="text-2xl italic" style={{ fontFamily: 'Instrument Serif, serif' }}>
                Claridad Estructurada
              </p>
              <p className="text-sm text-slate-400">
                Para títulos con personalidad
              </p>
            </div>
          </div>
        </div>

        {/* Side-by-side KPI Preview */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Style KPI */}
          <div className="rounded-2xl p-6 border" style={{
            background: isDarkMode ? '#0f172a' : '#ffffff',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
          }}>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Current Style</p>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
                Balance
              </span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #0d9488, #06b6d4)' }}>
                <span className="text-white text-lg">$</span>
              </div>
            </div>
            <p className="text-3xl font-bold" style={{ color: isDarkMode ? '#2dd4bf' : '#0d9488' }}>
              $1,250,000
            </p>
            <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
              ↑ 12%
            </span>
          </div>

          {/* Identidad Style KPI */}
          <div className="rounded-2xl p-6 border" style={{
            background: isDarkMode ? '#2a3142' : '#FAFAF8',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
          }}>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Identidad.md Style</p>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
                Balance
              </span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: '#00555A' }}>
                <span className="text-white text-lg">$</span>
              </div>
            </div>
            <p className="text-3xl font-bold" style={{
              color: isDarkMode ? '#A8E6CF' : '#00555A',
              fontFamily: 'Space Grotesk, sans-serif'
            }}>
              $1,250,000
            </p>
            <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(156, 175, 136, 0.2)', color: '#9CAF88' }}>
              ↑ 12%
            </span>
          </div>
        </div>

        {/* Recommendations */}
        <div className="mt-8 bg-gradient-to-r from-[#00555A]/20 to-[#FF6F61]/10 rounded-2xl p-6 border border-[#00555A]/30">
          <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            💡 Recommendation
          </h3>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• <strong>Keep current teal</strong> for the dashboard - it's already well-aligned with "Confianza Tranquila"</li>
            <li>• <strong>Add Coral (#FF6F61)</strong> as CTA color for buttons like "Registrar Pago"</li>
            <li>• <strong>Use Space Grotesk</strong> for the logo wordmark and marketing headlines</li>
            <li>• <strong>Consider Eucalyptus (#9CAF88)</strong> for success states as a softer alternative to bright emerald</li>
            <li>• <strong>Keep current dark mode</strong> - Slate 950 is very close to Future Dusk in feel</li>
          </ul>
        </div>

        {/* CSS Usage */}
        <div className="mt-8 bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-3">How to Use</h3>
          <div className="bg-black/30 rounded-lg p-4 font-mono text-sm">
            <p className="text-slate-400">/* Use Identidad colors anywhere: */</p>
            <p className="text-green-400">.my-button {'{'}</p>
            <p className="text-blue-300 pl-4">background: var(--id-coral);</p>
            <p className="text-blue-300 pl-4">color: white;</p>
            <p className="text-green-400">{'}'}</p>
            <br />
            <p className="text-slate-400">/* Or activate full theme on {'<html>'}: */</p>
            <p className="text-yellow-300">{'<html class="dark theme-identidad">'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorPaletteShowcase;
