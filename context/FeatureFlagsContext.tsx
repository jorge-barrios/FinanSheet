/**
 * Feature Flags Context
 * 
 * Manages feature flags for gradual v2 rollout.
 * Allows toggling between v1 and v2 UI components.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface FeatureFlags {
    useV2UI: boolean;
    useV2Commitments: boolean;
    useV2Payments: boolean;
    useV2Dashboard: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
    useV2UI: true, // Master switch for v2
    useV2Commitments: true,
    useV2Payments: true,
    useV2Dashboard: true, // V2 is now the default experience
};

interface FeatureFlagsContextType {
    flags: FeatureFlags;
    setFlag: (key: keyof FeatureFlags, value: boolean) => void;
    resetFlags: () => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [flags, setFlags] = useState<FeatureFlags>(() => {
        // Load from localStorage if available
        const stored = localStorage.getItem('featureFlags');
        if (stored) {
            try {
                return { ...DEFAULT_FLAGS, ...JSON.parse(stored) };
            } catch (e) {
                console.error('Error parsing stored feature flags:', e);
            }
        }
        return DEFAULT_FLAGS;
    });

    // Persist to localStorage whenever flags change
    useEffect(() => {
        localStorage.setItem('featureFlags', JSON.stringify(flags));
    }, [flags]);

    const setFlag = (key: keyof FeatureFlags, value: boolean) => {
        setFlags(prev => ({ ...prev, [key]: value }));
    };

    const resetFlags = () => {
        setFlags(DEFAULT_FLAGS);
        localStorage.removeItem('featureFlags');
    };

    return (
        <FeatureFlagsContext.Provider value={{ flags, setFlag, resetFlags }}>
            {children}
        </FeatureFlagsContext.Provider>
    );
};

export const useFeatureFlags = () => {
    const context = useContext(FeatureFlagsContext);
    if (context === undefined) {
        throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
    }
    return context;
};

/**
 * Hook to check if a specific feature is enabled
 */
export const useFeature = (feature: keyof FeatureFlags): boolean => {
    const { flags } = useFeatureFlags();
    // If master v2 switch is off, all v2 features are off
    if (!flags.useV2UI && feature !== 'useV2UI') {
        return false;
    }
    return flags[feature];
};
