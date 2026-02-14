import { useCurrency } from './useCurrency';
import type { CommitmentWithTerm, Payment } from '../types.v2';
import { getPerPeriodAmount } from '../utils/financialUtils.v2';

export const useCommitmentValue = () => {
    const { convertAmount, getFxRateToBase } = useCurrency();

    /**
     * Get the effective value of a commitment/term in the target currency (default CLP).
     * 
     * Logic:
     * 1. If paid (payment provided), use the stored value from the payment record (historical rate).
     * 2. If unpaid, use the live current exchange rate.
     * 
     * @param amountOriginal The original amount in the source currency.
     * @param currencyOriginal The source currency (e.g., 'UF', 'USD').
     * @param payment Optional payment record. if present, its stored value is used.
     * @param targetCurrency The target currency to convert to (default 'CLP').
     */
    const getDisplayValue = (
        amountOriginal: number | null,
        currencyOriginal: string,
        payment?: Payment | null,
        targetCurrency: 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM' = 'CLP'
    ): number => {
        if (amountOriginal === null || amountOriginal === undefined) return 0;

        // If paid, use stored rate from payment record
        if (payment && payment.amount_in_base) {
            // We assume amount_in_base is always in CLP for now, 
            // or whatever the system base currency is.
            // If target is not CLP, we would need to convert back, 
            // but current requirements are always to display in CLP.
            if (targetCurrency === 'CLP') {
                return payment.amount_in_base;
            }
            // Fallback for non-CLP target from stored CLP base (approximate)
            // This path is likely unused but kept for safety
            const rateToTarget = getFxRateToBase(targetCurrency);
            return payment.amount_in_base / rateToTarget;
        }

        // If unpaid, use live rate
        if (currencyOriginal === targetCurrency) return amountOriginal;

        // Special handling: if currency matches target, no conversion needed
        // (Handled by convertAmount implicitly but explicit check is faster)

        return convertAmount(amountOriginal, currencyOriginal as any, targetCurrency);
    };

    /**
     * Helper to get value directly from a Commitment object.
     * Automatically determines amount from active term or payment.
     */
    const getCommitmentDisplayValue = (
        commitment: CommitmentWithTerm,
        payment?: Payment | null,
        targetCurrency: 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM' = 'CLP'
    ) => {
        // If paid, the payment record has the definitive historical value
        if (payment) {
            return getDisplayValue(0, 'CLP', payment, targetCurrency);
        }

        const term = commitment.active_term;
        if (!term) return 0;

        // Get amount in original currency (e.g. 1 UF or 0.5 UF if installments)
        // We use 'false' to get the original currency amount, NOT the stored base amount
        const amountOriginal = getPerPeriodAmount(term, false);
        const currencyOriginal = term.currency_original || 'CLP';

        return getDisplayValue(amountOriginal, currencyOriginal, null, targetCurrency);
    };

    return { getDisplayValue, getCommitmentDisplayValue };
};
