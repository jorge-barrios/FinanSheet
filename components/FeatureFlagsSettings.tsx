/**
 * Feature Flags Settings Component
 * 
 * UI for toggling feature flags to switch between v1 and v2
 */

import React from 'react';
import { useFeatureFlags } from '../context/FeatureFlagsContext';
import { useLocalization } from '../hooks/useLocalization';

interface FeatureFlagsSettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

export const FeatureFlagsSettings: React.FC<FeatureFlagsSettingsProps> = ({ isOpen, onClose }) => {
    const { flags, setFlag, resetFlags } = useFeatureFlags();
    const { t } = useLocalization();

    if (!isOpen) return null;

    const handleMasterToggle = (checked: boolean) => {
        console.log('Master toggle clicked:', checked);
        setFlag('useV2UI', checked);
        console.log('After setFlag, flags:', flags);
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-50"
            onClick={onClose}
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
            <div
                className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        🚀 Feature Flags
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-2xl leading-none"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Master v2 Switch */}
                    <div className="p-4 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-200 dark:border-sky-800">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                                <div className="font-semibold text-slate-900 dark:text-white mb-1">
                                    Enable v2 UI (Master)
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                    Toggle all v2 features on/off
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={flags.useV2UI}
                                    onChange={(e) => {
                                        console.log('Checkbox onChange fired:', e.target.checked);
                                        handleMasterToggle(e.target.checked);
                                    }}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-300 dark:peer-focus:ring-sky-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-sky-600"></div>
                            </label>
                        </div>
                    </div>

                    {/* Individual Features */}
                    <div className="space-y-3">
                        <FeatureToggle
                            label="Commitments (v2)"
                            description="Use v2 commitment/term model"
                            flagKey="useV2Commitments"
                            disabled={!flags.useV2UI}
                        />

                        <FeatureToggle
                            label="Payments (v2)"
                            description="Use v2 payment recording"
                            flagKey="useV2Payments"
                            disabled={!flags.useV2UI}
                        />

                        <FeatureToggle
                            label="Dashboard (v2)"
                            description="Use v2 dashboard layout"
                            flagKey="useV2Dashboard"
                            disabled={!flags.useV2UI}
                        />
                    </div>
                </div>

                {/* Reset button */}
                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => {
                            if (confirm('Reset all flags to defaults?')) {
                                resetFlags();
                            }
                        }}
                        className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        Reset to Defaults
                    </button>
                </div>

                {/* Info */}
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                        ⚠️ Enabling v2 features will use the new database schema. Make sure migrations are complete.
                    </p>
                </div>
            </div>
        </div>
    );
};

const FeatureToggle: React.FC<{
    label: string;
    description: string;
    flagKey: 'useV2Commitments' | 'useV2Payments' | 'useV2Dashboard';
    disabled: boolean;
}> = ({ label, description, flagKey, disabled }) => {
    const { flags, setFlag } = useFeatureFlags();

    return (
        <div className={`flex items-center justify-between p-3 rounded-lg border gap-4 ${disabled
                ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-50'
                : 'bg-white dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 hover:border-sky-300 dark:hover:border-sky-600'
            }`}>
            <div className="flex-1">
                <div className="font-medium text-slate-900 dark:text-white">
                    {label}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                    {description}
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    checked={flags[flagKey]}
                    onChange={(e) => setFlag(flagKey, e.target.checked)}
                    disabled={disabled}
                    className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-sky-300 dark:peer-focus:ring-sky-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-sky-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
            </label>
        </div>
    );
};
