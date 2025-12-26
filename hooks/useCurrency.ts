import { useEffect, useMemo, useState } from 'react';
import CurrencyService, { CurrencySnapshot } from '../services/currencyService';

export function useCurrency() {
  const [snapshot, setSnapshot] = useState<CurrencySnapshot | undefined>(() => CurrencyService.getSnapshot());
  const [loading, setLoading] = useState(!snapshot);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => { };
    let mounted = true;
    (async () => {
      try {
        const snap = await CurrencyService.init();
        if (mounted) {
          setSnapshot(snap);
          setLoading(false);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || 'Currency init failed');
          setLoading(false);
        }
      }
      unsub = CurrencyService.subscribe((s) => setSnapshot({ ...s }));
    })();
    return () => { mounted = false; unsub(); };
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
    try {
      await CurrencyService.refresh();
    } catch (e: any) {
      setError(e?.message || 'Refresh failed');
    }
  };

  return {
    snapshot,
    loading,
    error,
    lastUpdated,
    toUnit,
    fromUnit,
    convertAmount,
    refresh,
    /**
     * Get exchange rate from any currency to base (CLP)
     * Used for calculating fx_rate_to_base in terms and payments
     * @param currency Source currency
     * @returns Rate (how many CLP per 1 unit of currency)
     */
    getFxRateToBase: (currency: string): number => {
      if (currency === 'CLP') return 1.0;
      return fromUnit(1, currency as any);
    }
  };
}

export default useCurrency;
