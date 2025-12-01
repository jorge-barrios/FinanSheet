import { describe, it, expect } from 'vitest';
import {
  convertFromPaymentUnitToBase,
  convertToBaseCurrency,
  convertToDisplayCurrency,
  formatCurrency,
  INITIAL_EXCHANGE_RATES,
  INITIAL_USD_EQUIVALENT_PER_UNIT,
} from '../../utils/currency';
import { Currency, PaymentUnit } from '../../types';

describe('currency utils', () => {
  describe('convertFromPaymentUnitToBase', () => {
    it('should convert USD to USD (1:1)', () => {
      const result = convertFromPaymentUnitToBase(100, 'USD', INITIAL_USD_EQUIVALENT_PER_UNIT);
      expect(result).toBe(100);
    });

    it('should convert CLP to USD', () => {
      const result = convertFromPaymentUnitToBase(950, 'CLP', INITIAL_USD_EQUIVALENT_PER_UNIT);
      // 950 CLP * (1/950) = 1 USD
      expect(result).toBe(1);
    });

    it('should convert UF to USD', () => {
      const result = convertFromPaymentUnitToBase(10, 'UF', INITIAL_USD_EQUIVALENT_PER_UNIT);
      // 10 UF * 40 = 400 USD
      expect(result).toBe(400);
    });

    it('should convert UTM to USD', () => {
      const result = convertFromPaymentUnitToBase(5, 'UTM', INITIAL_USD_EQUIVALENT_PER_UNIT);
      // 5 UTM * 70 = 350 USD
      expect(result).toBe(350);
    });
  });

  describe('convertToBaseCurrency', () => {
    it('should convert USD to USD (base)', () => {
      const result = convertToBaseCurrency(100, 'USD', INITIAL_EXCHANGE_RATES);
      expect(result).toBe(100);
    });

    it('should convert CLP to USD', () => {
      const result = convertToBaseCurrency(950, 'CLP', INITIAL_EXCHANGE_RATES);
      // 950 CLP / 950 = 1 USD
      expect(result).toBe(1);
    });

    it('should handle zero exchange rate gracefully', () => {
      const customRates: Record<Currency, number> = {
        'USD': 1,
        'CLP': 0,
      };
      const result = convertToBaseCurrency(100, 'CLP', customRates);
      // Should return original amount if exchange rate is 0
      expect(result).toBe(100);
    });
  });

  describe('convertToDisplayCurrency', () => {
    it('should convert USD to USD (1:1)', () => {
      const result = convertToDisplayCurrency(100, 'USD', INITIAL_EXCHANGE_RATES);
      expect(result).toBe(100);
    });

    it('should convert USD to CLP', () => {
      const result = convertToDisplayCurrency(1, 'CLP', INITIAL_EXCHANGE_RATES);
      // 1 USD * 950 = 950 CLP
      expect(result).toBe(950);
    });

    it('should handle large amounts correctly', () => {
      const result = convertToDisplayCurrency(1000, 'CLP', INITIAL_EXCHANGE_RATES);
      // 1000 USD * 950 = 950,000 CLP
      expect(result).toBe(950000);
    });
  });

  describe('formatCurrency', () => {
    describe('USD formatting', () => {
      it('should format USD with 2 decimals in English', () => {
        const result = formatCurrency(1234.56, 'USD', 'en');
        expect(result).toBe('$1,234.56');
      });

      it('should format USD with 2 decimals in Spanish', () => {
        const result = formatCurrency(1234.56, 'USD', 'es');
        // Spanish locale uses different formatting
        expect(result).toContain('1');
        expect(result).toContain('234');
        expect(result).toContain('56');
      });

      it('should handle zero correctly', () => {
        const result = formatCurrency(0, 'USD', 'en');
        expect(result).toBe('$0.00');
      });

      it('should handle negative amounts', () => {
        const result = formatCurrency(-100.50, 'USD', 'en');
        expect(result).toContain('-');
        expect(result).toContain('100');
      });
    });

    describe('CLP formatting', () => {
      it('should format CLP with 0 decimals in English', () => {
        const result = formatCurrency(1234567, 'CLP', 'en');
        // CLP doesn't use decimals
        expect(result).not.toContain('.00');
        expect(result).toContain('1');
        expect(result).toContain('234');
        expect(result).toContain('567');
      });

      it('should format CLP with 0 decimals in Spanish', () => {
        const result = formatCurrency(950000, 'CLP', 'es');
        expect(result).not.toContain(',00');
        expect(result).toContain('950');
      });

      it('should round CLP amounts', () => {
        const result = formatCurrency(1234.56, 'CLP', 'en');
        // Should round to 1235
        expect(result).toContain('1');
        expect(result).toContain('235');
      });
    });
  });

  describe('Round trip conversions', () => {
    it('should preserve value when converting USD -> CLP -> USD', () => {
      const original = 100;
      const inCLP = convertToDisplayCurrency(original, 'CLP', INITIAL_EXCHANGE_RATES);
      const backToUSD = convertToBaseCurrency(inCLP, 'CLP', INITIAL_EXCHANGE_RATES);
      expect(backToUSD).toBeCloseTo(original, 2);
    });

    it('should handle precision correctly with payment units', () => {
      const original = 10; // 10 UF
      const inUSD = convertFromPaymentUnitToBase(original, 'UF', INITIAL_USD_EQUIVALENT_PER_UNIT);
      // 10 UF should be 400 USD
      expect(inUSD).toBe(400);

      // Convert to CLP for display
      const inCLP = convertToDisplayCurrency(inUSD, 'CLP', INITIAL_EXCHANGE_RATES);
      // 400 USD should be 380,000 CLP
      expect(inCLP).toBe(380000);
    });
  });

  describe('Edge cases', () => {
    it('should handle very small amounts', () => {
      const result = convertFromPaymentUnitToBase(0.01, 'USD', INITIAL_USD_EQUIVALENT_PER_UNIT);
      expect(result).toBeCloseTo(0.01);
    });

    it('should handle very large amounts', () => {
      const result = convertFromPaymentUnitToBase(1000000, 'CLP', INITIAL_USD_EQUIVALENT_PER_UNIT);
      expect(result).toBeCloseTo(1052.63, 2);
    });

    it('should format large CLP amounts correctly', () => {
      const result = formatCurrency(123456789, 'CLP', 'es');
      // Should contain the digits without decimals
      expect(result).not.toContain(',00');
    });
  });
});
