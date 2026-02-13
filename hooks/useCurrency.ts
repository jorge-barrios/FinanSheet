import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import CurrencyService from '../services/currencyService';

export function useCurrency() {
  const [loading, setLoading] = useState(!CurrencyService.getSnapshot());
  const [error, setError] = useState<string | null>(null);

  // Subscribe to external store
  const subscribe = useMemo(() => (onStoreChange: () => void) => {
    return CurrencyService.subscribe(() => onStoreChange());
  }, []);

  const snapshot = useSyncExternalStore(
    subscribe,
    () => CurrencyService.getSnapshot()
  );

  // Initial load effect (still needed to trigger fetch if empty)
  useEffect(() => {
    CurrencyService.init().catch(err => {
        console.error('Currency init failed:', err);
        setError(err instanceof Error ? err.message : 'Init failed');
    }).finally(() => {
        setLoading(false);
    });
  }, []);

  const lastUpdated = useMemo(() => CurrencyService.lastUpdated(), [snapshot?.updatedAt]);

  // Convert amount from one currency to CLP
  const toUnit = (amountClp: number, unit: 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM') => CurrencyService.toUnit(amountClp, unit);
  const fromUnit = (amount: number, unit: 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM') => CurrencyService.fromUnit(amount, unit);

  /**
   * Convert an amount from one currency to another (hot conversion)
   * Uses CLP as the base for conversion.
   * 
   * @param amount - The amount to convert
   * @param fromCurrency - Source currency
   * @param toCurrency - Target currency
   * @returns Converted amount, or 0 if conversion fails
   */
  const convertAmount = (
    amount: number,
    fromCurrency: 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM',
    toCurrency: 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM'
  ): number => {
    if (fromCurrency === toCurrency) return amount;
    if (!amount || isNaN(amount)) return 0;

    // Convert to CLP first, then to target currency
    const clpValue = fromCurrency === 'CLP' ? amount : CurrencyService.fromUnit(amount, fromCurrency);
    const result = toCurrency === 'CLP' ? clpValue : CurrencyService.toUnit(clpValue, toCurrency);

    // Round appropriately: CLP = integer, others = 2 decimals
    if (!isFinite(result)) return 0;
    return toCurrency === 'CLP' ? Math.round(result) : Math.round(result * 100) / 100;
  };

  const refresh = async () => {
    setLoading(true); // Show local loading
    try {
      await CurrencyService.refresh();
    } catch (e: any) {
      setError(e?.message || 'Refresh failed');
    } finally {
      setLoading(false);
    }
  };

  return {
    snapshot,
    loading: loading && !snapshot, // If we have a snapshot, we are not effectively loading for the UI
    error,
    lastUpdated,
    toUnit,
    fromUnit,
    convertAmount,
    refresh,
    getFxRateToBase: (currency: string): number => {
      if (currency === 'CLP') return 1.0;
      return fromUnit(1, currency as any);
    }
  };
}

export default useCurrency;
