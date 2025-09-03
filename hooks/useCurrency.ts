import { useEffect, useMemo, useState } from 'react';
import CurrencyService, { CurrencySnapshot } from '../services/currencyService';

export function useCurrency() {
  const [snapshot, setSnapshot] = useState<CurrencySnapshot | undefined>(() => CurrencyService.getSnapshot());
  const [loading, setLoading] = useState(!snapshot);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => {};
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

  const toUnit = (amountClp: number, unit: 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM') => CurrencyService.toUnit(amountClp, unit);
  const fromUnit = (amount: number, unit: 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM') => CurrencyService.fromUnit(amount, unit);

  const refresh = async () => {
    try {
      await CurrencyService.refresh();
    } catch (e: any) {
      setError(e?.message || 'Refresh failed');
    }
  };

  return { snapshot, loading, error, lastUpdated, toUnit, fromUnit, refresh };
}

export default useCurrency;
