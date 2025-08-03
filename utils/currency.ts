
import { Currency, PaymentUnit } from '../types';

export const BASE_CURRENCY: Currency = 'USD';

export const INITIAL_EXCHANGE_RATES: Record<Currency, number> = {
    'USD': 1,
    'CLP': 950, // Static exchange rate: 1 USD = 950 CLP
};

export const INITIAL_USD_EQUIVALENT_PER_UNIT: Record<PaymentUnit, number> = {
    'USD': 1,
    'CLP': 1 / INITIAL_EXCHANGE_RATES.CLP,
    'UF': 40,  // Approx. 1 UF = 40 USD
    'UTM': 70, // Approx. 1 UTM = 70 USD
};

/**
 * Converts an amount from a given payment unit to the base currency (USD).
 * @param amount The amount in the specified unit.
 * @param unit The payment unit ('USD', 'CLP', 'UF', 'UTM').
 * @param unitRates A record of the USD equivalent for each payment unit.
 * @returns The equivalent amount in the base currency (USD).
 */
export function convertFromPaymentUnitToBase(amount: number, unit: PaymentUnit, unitRates: Record<PaymentUnit, number>): number {
    return amount * unitRates[unit];
}


/**
 * Converts an amount from the display currency to the base currency (USD).
 * @param amountInDisplay The amount in the currently selected display currency (e.g., CLP).
 * @param displayCurrency The currency of the amount being provided.
 * @param exchangeRates A record of exchange rates relative to the base currency.
 * @returns The equivalent amount in the base currency.
 */
export function convertToBaseCurrency(amountInDisplay: number, displayCurrency: Currency, exchangeRates: Record<Currency, number>): number {
    if (!exchangeRates[displayCurrency] || exchangeRates[displayCurrency] === 0) {
        return amountInDisplay;
    }
    return amountInDisplay / exchangeRates[displayCurrency];
}

/**
 * Converts an amount from the base currency (USD) to the target display currency.
 * @param amountInBase The amount in the base currency.
 * @param displayCurrency The target currency for display.
 * @param exchangeRates A record of exchange rates relative to the base currency.
 * @returns The equivalent amount in the display currency.
 */
export function convertToDisplayCurrency(amountInBase: number, displayCurrency: Currency, exchangeRates: Record<Currency, number>): number {
    return amountInBase * exchangeRates[displayCurrency];
}


/**
 * Formats a given amount into a currency string, assuming the amount is already in the target currency.
 * This function handles locale-specific formatting (e.g., decimal points, currency symbol).
 * @param amount The amount to format (expected to be in the `currency` provided).
 * @param currency The currency to format for (e.g., 'USD', 'CLP').
 * @param lang The language for locale-specific formatting ('en' or 'es').
 * @returns A formatted currency string.
 */
export const formatCurrency = (amount: number, currency: Currency, lang: 'en' | 'es'): string => {
    const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency,
    };

    if (currency === 'CLP') {
        options.minimumFractionDigits = 0;
        options.maximumFractionDigits = 0;
    } else { // USD
        options.minimumFractionDigits = 2;
        options.maximumFractionDigits = 2;
    }
    
    const locale = lang === 'es' ? 'es-CL' : 'en-US';

    return new Intl.NumberFormat(locale, options).format(amount);
};
