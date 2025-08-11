// services/exchangeRateService.ts

import { PaymentUnit } from '../types';

/**
 * Fetches the exchange rate for a given currency/unit against CLP for a specific date.
 * Uses the mindicador.cl API.
 * @param unit The currency or unit (e.g., 'dolar', 'uf', 'utm').
 * @param date The date in 'DD-MM-YYYY' format.
 * @returns The value of the unit in CLP.
 * @throws An error if the API call fails or no data is found for the given date.
 */
export async function getExchangeRate(unit: PaymentUnit, date: string): Promise<number> {
    // The API uses specific codes for each unit.
    const apiUnitCode = {
        'USD': 'dolar',
        'EUR': 'euro',
        'UF': 'uf',
        'UTM': 'utm',
        'CLP': 'clp', // Although the rate will be 1, we handle it for completeness
    }[unit];

    if (unit === 'CLP') {
        return 1;
    }

    if (!apiUnitCode) {
        throw new Error(`Unsupported currency unit: ${unit}`);
    }

    const url = `https://mindicador.cl/api/${apiUnitCode}/${date}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }

        const data = await response.json();

        // The API returns an empty `serie` array if there's no data for that date (e.g., a holiday).
        if (!data.serie || data.serie.length === 0) {
            // We could implement a fallback here to check the previous day, but for now, we'll throw an error.
            throw new Error(`No exchange rate data found for ${unit} on ${date}. It might be a holiday.`);
        }

        return data.serie[0].valor;

    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        // Re-throw the error so the calling function can handle it (e.g., show a message to the user).
        throw error;
    }
}
