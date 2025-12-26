import React, { createContext, useMemo, useCallback, ReactNode, useState, useEffect } from 'react';
import { Currency, PaymentUnit } from '../types';
import { en } from '../locales/en';
import { es } from '../locales/es';
import usePersistentState from '../hooks/usePersistentState';
import CurrencyService from '../services/currencyService';

type Language = 'en' | 'es';

interface LocalizationContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    currency: Currency;
    setCurrency: (curr: Currency) => void;
    t: (key: string, fallbackOrOptions?: string | { [key: string]: string | number }) => string;
    getLocalizedMonths: (format?: 'long' | 'short' | 'narrow') => string[];
    toBase: (amountInDisplay: number) => number;
    fromBase: (amountInBase: number) => number;
    toBaseFromUnit: (amount: number, unit: PaymentUnit) => number;
    format: (amountInBase: number) => string;
    formatClp: (amountInClp: number) => string;
    formatBase: (amountInBase: number) => string;
    exchangeRates: Record<Currency, number>;
    unitRates: Record<PaymentUnit, number>;
    lastUpdated: Date;
    updateRates: () => void;
}

const translations: Record<Language, Record<string, string>> = {
    en,
    es,
};

export const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguage] = usePersistentState<Language>('finansheet-lang', 'es');
    const [currency, setCurrency] = usePersistentState<Currency>('finansheet-curr', 'CLP');
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // Get exchange rates from CurrencyService (real API)
    const snapshot = CurrencyService.getSnapshot();
    const rates = snapshot?.rates || { CLP: 1 };

    // Build exchangeRates in old format (CLP per unit for USD)
    const exchangeRates: Record<Currency, number> = useMemo(() => ({
        'CLP': 1,
        'USD': rates.USD || 950, // Fallback
    }), [rates]);

    // Build unitRates (USD equivalent per unit)
    const unitRates: Record<PaymentUnit, number> = useMemo(() => ({
        'USD': 1,
        'CLP': rates.USD ? 1 / rates.USD : 1 / 950,
        'UF': rates.UF ? rates.UF / (rates.USD || 950) : 40,
        'UTM': rates.UTM ? rates.UTM / (rates.USD || 950) : 70,
    }), [rates]);

    // Update lastUpdated when snapshot changes
    useEffect(() => {
        if (snapshot?.updatedAt) {
            setLastUpdated(new Date(snapshot.updatedAt));
        }
    }, [snapshot?.updatedAt]);

    const updateRates = useCallback(async () => {
        await CurrencyService.refresh();
    }, []);


    const t = useMemo(() => (key: string, fallbackOrOptions?: string | { [key: string]: string | number }): string => {
        let translation = translations[language][key];

        // If no translation found, use fallback if it's a string, otherwise use the key
        if (!translation) {
            translation = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key;
        }

        // Apply interpolation if it's an object
        if (typeof fallbackOrOptions === 'object') {
            Object.keys(fallbackOrOptions).forEach(optionKey => {
                translation = translation.replace(`{{${optionKey}}}`, String(fallbackOrOptions[optionKey]));
            });
        }

        return translation;
    }, [language]);

    const getLocalizedMonths = useMemo(() => (format: 'long' | 'short' | 'narrow' = 'short'): string[] => {
        const locale = language === 'es' ? 'es-ES' : 'en-US';
        return Array.from({ length: 12 }, (_, i) => {
            const month = new Date(0, i).toLocaleString(locale, { month: format });
            return month.charAt(0).toUpperCase() + month.slice(1);
        });
    }, [language]);

    // Convert from display currency to USD base
    const toBase = useCallback((amountInDisplay: number): number => {
        if (currency === 'USD') return amountInDisplay;
        const clpAmount = CurrencyService.fromUnit(amountInDisplay, currency as any);
        return CurrencyService.toUnit(clpAmount, 'USD');
    }, [currency]);

    // Convert from USD base to display currency
    const fromBase = useCallback((amountInBase: number): number => {
        if (currency === 'USD') return amountInBase;
        const clpAmount = CurrencyService.fromUnit(amountInBase, 'USD');
        return CurrencyService.toUnit(clpAmount, currency as any);
    }, [currency]);

    // Convert from any unit to USD base
    const toBaseFromUnit = useCallback((amount: number, unit: PaymentUnit): number => {
        const clpAmount = CurrencyService.fromUnit(amount, unit as any);
        return CurrencyService.toUnit(clpAmount, 'USD');
    }, []);

    // Format currency helper
    const formatCurrencyHelper = (amount: number, curr: Currency, lang: 'en' | 'es'): string => {
        const locale = lang === 'es' ? 'es-CL' : 'en-US';
        const options: Intl.NumberFormatOptions = {
            style: 'currency',
            currency: curr,
            minimumFractionDigits: curr === 'CLP' ? 0 : 2,
            maximumFractionDigits: curr === 'CLP' ? 0 : 2,
        };
        return new Intl.NumberFormat(locale, options).format(amount);
    };

    const format = useCallback((amountInBase: number): string => {
        const convertedAmount = fromBase(amountInBase);
        return formatCurrencyHelper(convertedAmount, currency, language);
    }, [currency, language, fromBase]);

    const formatBase = useCallback((amountInBase: number): string => {
        return formatCurrencyHelper(amountInBase, 'USD', language);
    }, [language]);

    const formatClp = useCallback((amountInClp: number): string => {
        return formatCurrencyHelper(amountInClp, 'CLP', language);
    }, [language]);

    const value: LocalizationContextType = {
        language,
        setLanguage,
        currency,
        setCurrency,
        t,
        getLocalizedMonths,
        toBase,
        fromBase,
        toBaseFromUnit,
        format,
        formatClp,
        formatBase,
        exchangeRates,
        unitRates,
        lastUpdated,
        updateRates,
    };

    return (
        <LocalizationContext.Provider value={value}>
            {children}
        </LocalizationContext.Provider>
    );
};