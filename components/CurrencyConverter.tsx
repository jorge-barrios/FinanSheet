import React, { useMemo } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { useCurrency } from '../hooks/useCurrency';

interface CurrencyConverterProps {
  amountInClp: number;
  units?: Array<'UF' | 'USD' | 'UTM'>; // default ['UF']
  className?: string;
  showClpPrefix?: boolean; // default true; when false, do not render CLP part
}

const CurrencyConverter: React.FC<CurrencyConverterProps> = ({ amountInClp, units = ['UF'], className, showClpPrefix = true }) => {
  const { t, formatClp } = useLocalization();
  const { toUnit } = useCurrency();

  const parts = useMemo(() => {
    return units.map(u => {
      const v = toUnit(amountInClp, u);
      const num = u === 'USD' ? v.toFixed(2) : v.toFixed(1);
      return `${num} ${u}`;
    });
  }, [amountInClp, units, toUnit]);

  return (
    <span className={className} title={t('currency.converted') || 'Valor convertido'}>
      {showClpPrefix ? `${formatClp(amountInClp)} (${parts.join(' · ')})` : parts.join(' · ')}
    </span>
  );
};

export default CurrencyConverter;
