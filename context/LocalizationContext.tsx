import React, { createContext, useMemo, useCallback, ReactNode } from 'react';
import { Currency, PaymentUnit } from '../types';
import { en } from '../locales/en';
import { es } from '../locales/es';
import usePersistentState from '../hooks/usePersistentState';
import { 
    convertToBaseCurrency, 
    convertToDisplayCurrency, 
    formatCurrency,
    INITIAL_EXCHANGE_RATES,
    INITIAL_USD_EQUIVALENT_PER_UNIT,
    convertFromPaymentUnitToBase
} from '../utils/currency';

type Language = 'en' | 'es';

interface LocalizationContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    currency: Currency;
    setCurrency: (curr: Currency) => void;
    t: (key: string, options?: { [key: string]: string | number }) => string;
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
    
    const [exchangeRates, setExchangeRates] = usePersistentState<Record<Currency, number>>('finansheet-exchange-rates', INITIAL_EXCHANGE_RATES);
    const [unitRates, setUnitRates] = usePersistentState<Record<PaymentUnit, number>>('finansheet-unit-rates', INITIAL_USD_EQUIVALENT_PER_UNIT);
    const [lastUpdated, setLastUpdated] = usePersistentState<string>('finansheet-rates-timestamp', new Date().toISOString());

    const updateRates = useCallback(() => {
        // Simulate fetching new rates by applying a small random variation
        const newCLP = Math.round(INITIAL_EXCHANGE_RATES.CLP + (Math.random() - 0.5) * 40); // +/- 20
        const newUF = parseFloat((INITIAL_USD_EQUIVALENT_PER_UNIT.UF + (Math.random() - 0.5) * 2).toFixed(2)); // +/- 1
        const newUTM = parseFloat((INITIAL_USD_EQUIVALENT_PER_UNIT.UTM + (Math.random() - 0.5) * 4).toFixed(2)); // +/- 2
    
        const newExchangeRates = { ...exchangeRates, CLP: newCLP };
        const newUnitRates = { 
            ...unitRates, 
            CLP: 1 / newCLP,
            UF: newUF,
            UTM: newUTM,
        };
        
        setExchangeRates(newExchangeRates);
        setUnitRates(newUnitRates);
        setLastUpdated(new Date().toISOString());
    }, [exchangeRates, unitRates, setExchangeRates, setUnitRates, setLastUpdated]);
    

    const t = useMemo(() => (key: string, options?: { [key: string]: string | number }): string => {
        let translation = translations[language][key] || key;
        if (options) {
            Object.keys(options).forEach(optionKey => {
                translation = translation.replace(`{{${optionKey}}}`, String(options[optionKey]));
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

    const toBase = useCallback((amountInDisplay: number): number => {
        return convertToBaseCurrency(amountInDisplay, currency, exchangeRates);
    }, [currency, exchangeRates]);

    const fromBase = useCallback((amountInBase: number): number => {
        return convertToDisplayCurrency(amountInBase, currency, exchangeRates);
    }, [currency, exchangeRates]);

    const toBaseFromUnit = useCallback((amount: number, unit: PaymentUnit): number => {
        return convertFromPaymentUnitToBase(amount, unit, unitRates);
    }, [unitRates]);
    
    const format = useCallback((amountInBase: number): string => {
        const convertedAmount = convertToDisplayCurrency(amountInBase, currency, exchangeRates);
        return formatCurrency(convertedAmount, currency, language);
    }, [currency, language, exchangeRates]);

    const formatBase = useCallback((amountInBase: number): string => {
        return formatCurrency(amountInBase, 'USD', language);
    }, [language]);

    const formatClp = useCallback((amountInClp: number): string => {
        return formatCurrency(amountInClp, 'CLP', language);
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
        lastUpdated: new Date(lastUpdated),
        updateRates,
    };

    return (
        <LocalizationContext.Provider value={value}>
            {children}
        </LocalizationContext.Provider>
    );
};