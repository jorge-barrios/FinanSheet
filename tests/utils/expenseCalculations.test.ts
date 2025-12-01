import { describe, it, expect } from 'vitest';
import {
  getFrequencyInMonths,
  isInstallmentInMonth,
  getInstallmentNumber,
  getInstallmentAmount,
} from '../../utils/expenseCalculations';
import { Expense, PaymentFrequency, ExpenseType } from '../../types';

describe('expenseCalculations', () => {
  describe('getFrequencyInMonths', () => {
    it('should return correct months for each frequency', () => {
      expect(getFrequencyInMonths(PaymentFrequency.MONTHLY)).toBe(1);
      expect(getFrequencyInMonths(PaymentFrequency.BIMONTHLY)).toBe(2);
      expect(getFrequencyInMonths(PaymentFrequency.QUARTERLY)).toBe(3);
      expect(getFrequencyInMonths(PaymentFrequency.SEMIANNUALLY)).toBe(6);
      expect(getFrequencyInMonths(PaymentFrequency.ANNUALLY)).toBe(12);
      expect(getFrequencyInMonths(PaymentFrequency.ONCE)).toBe(1);
    });
  });

  describe('isInstallmentInMonth', () => {
    it('should return true for one-time expense in correct month', () => {
      const expense: Expense = {
        id: '1',
        name: 'Test',
        category: 'test',
        amountInClp: 1000,
        type: ExpenseType.VARIABLE,
        startDate: '2025-01-15',
        installments: 1,
        paymentFrequency: PaymentFrequency.ONCE,
        isImportant: false,
        dueDate: 15,
        expenseDate: '2025-01-15',
        originalAmount: 1000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      expect(isInstallmentInMonth(expense, 2025, 0)).toBe(true);  // January 2025
      expect(isInstallmentInMonth(expense, 2025, 1)).toBe(false); // February 2025
      expect(isInstallmentInMonth(expense, 2024, 0)).toBe(false); // January 2024
    });

    it('should handle monthly recurring expenses correctly', () => {
      const expense: Expense = {
        id: '1',
        name: 'Netflix',
        category: 'subscriptions',
        amountInClp: 10000,
        type: ExpenseType.RECURRING,
        startDate: '2025-01-15',
        installments: 12,
        paymentFrequency: PaymentFrequency.MONTHLY,
        isImportant: false,
        dueDate: 15,
        expenseDate: '2025-01-15',
        originalAmount: 10000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      // Should appear in all 12 months
      for (let month = 0; month < 12; month++) {
        expect(isInstallmentInMonth(expense, 2025, month)).toBe(true);
      }

      // Should NOT appear in month 13 (beyond 12 installments)
      expect(isInstallmentInMonth(expense, 2026, 0)).toBe(false);
    });

    it('should handle quarterly recurring expenses correctly', () => {
      const expense: Expense = {
        id: '1',
        name: 'Insurance',
        category: 'insurance',
        amountInClp: 300000,
        type: ExpenseType.RECURRING,
        startDate: '2025-03-01', // March
        installments: 4,
        paymentFrequency: PaymentFrequency.QUARTERLY,
        isImportant: false,
        dueDate: 1,
        expenseDate: '2025-03-01',
        originalAmount: 300000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      // March, June, September, December
      expect(isInstallmentInMonth(expense, 2025, 2)).toBe(true);  // March
      expect(isInstallmentInMonth(expense, 2025, 5)).toBe(true);  // June
      expect(isInstallmentInMonth(expense, 2025, 8)).toBe(true);  // September
      expect(isInstallmentInMonth(expense, 2025, 11)).toBe(true); // December

      // Should NOT appear in other months
      expect(isInstallmentInMonth(expense, 2025, 0)).toBe(false);  // January
      expect(isInstallmentInMonth(expense, 2025, 1)).toBe(false);  // February
      expect(isInstallmentInMonth(expense, 2025, 3)).toBe(false);  // April
      expect(isInstallmentInMonth(expense, 2025, 4)).toBe(false);  // May
    });

    it('should handle infinite recurring expenses (installments = 0)', () => {
      const expense: Expense = {
        id: '1',
        name: 'Rent',
        category: 'housing',
        amountInClp: 800000,
        type: ExpenseType.RECURRING,
        startDate: '2025-01-01',
        installments: 0, // Infinite
        paymentFrequency: PaymentFrequency.MONTHLY,
        isImportant: true,
        dueDate: 1,
        expenseDate: '2025-01-01',
        originalAmount: 800000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      // Should appear in all future months
      for (let year = 2025; year <= 2030; year++) {
        for (let month = 0; month < 12; month++) {
          if (year === 2025 && month === 0) {
            // Starting from January 2025
            expect(isInstallmentInMonth(expense, year, month)).toBe(true);
          } else if (year > 2025 || (year === 2025 && month > 0)) {
            expect(isInstallmentInMonth(expense, year, month)).toBe(true);
          }
        }
      }
    });

    it('should NOT appear before start date', () => {
      const expense: Expense = {
        id: '1',
        name: 'Test',
        category: 'test',
        amountInClp: 1000,
        type: ExpenseType.RECURRING,
        startDate: '2025-06-15', // June 2025
        installments: 12,
        paymentFrequency: PaymentFrequency.MONTHLY,
        isImportant: false,
        dueDate: 15,
        expenseDate: '2025-06-15',
        originalAmount: 1000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      // Should NOT appear before June 2025
      expect(isInstallmentInMonth(expense, 2025, 0)).toBe(false); // January
      expect(isInstallmentInMonth(expense, 2025, 4)).toBe(false); // May

      // Should appear from June onwards
      expect(isInstallmentInMonth(expense, 2025, 5)).toBe(true); // June
    });
  });

  describe('getInstallmentNumber', () => {
    it('should return correct installment number for monthly expense', () => {
      const expense: Expense = {
        id: '1',
        name: 'Test',
        category: 'test',
        amountInClp: 1000,
        type: ExpenseType.RECURRING,
        startDate: '2025-01-15',
        installments: 12,
        paymentFrequency: PaymentFrequency.MONTHLY,
        isImportant: false,
        dueDate: 15,
        expenseDate: '2025-01-15',
        originalAmount: 1000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      expect(getInstallmentNumber(expense, 2025, 0)).toBe(1);  // January = 1st installment
      expect(getInstallmentNumber(expense, 2025, 1)).toBe(2);  // February = 2nd installment
      expect(getInstallmentNumber(expense, 2025, 11)).toBe(12); // December = 12th installment
    });

    it('should return correct installment number for quarterly expense', () => {
      const expense: Expense = {
        id: '1',
        name: 'Test',
        category: 'test',
        amountInClp: 1000,
        type: ExpenseType.RECURRING,
        startDate: '2025-03-01',
        installments: 4,
        paymentFrequency: PaymentFrequency.QUARTERLY,
        isImportant: false,
        dueDate: 1,
        expenseDate: '2025-03-01',
        originalAmount: 1000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      expect(getInstallmentNumber(expense, 2025, 2)).toBe(1);  // March = 1st
      expect(getInstallmentNumber(expense, 2025, 5)).toBe(2);  // June = 2nd
      expect(getInstallmentNumber(expense, 2025, 8)).toBe(3);  // September = 3rd
      expect(getInstallmentNumber(expense, 2025, 11)).toBe(4); // December = 4th
    });

    it('should return null for months where expense does not appear', () => {
      const expense: Expense = {
        id: '1',
        name: 'Test',
        category: 'test',
        amountInClp: 1000,
        type: ExpenseType.RECURRING,
        startDate: '2025-03-01',
        installments: 4,
        paymentFrequency: PaymentFrequency.QUARTERLY,
        isImportant: false,
        dueDate: 1,
        expenseDate: '2025-03-01',
        originalAmount: 1000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      expect(getInstallmentNumber(expense, 2025, 0)).toBe(null); // January
      expect(getInstallmentNumber(expense, 2025, 1)).toBe(null); // February
      expect(getInstallmentNumber(expense, 2025, 3)).toBe(null); // April
    });
  });

  describe('getInstallmentAmount', () => {
    it('should return full amount for recurring expenses', () => {
      const expense: Expense = {
        id: '1',
        name: 'Netflix',
        category: 'subscriptions',
        amountInClp: 10000,
        type: ExpenseType.RECURRING,
        startDate: '2025-01-15',
        installments: 12,
        paymentFrequency: PaymentFrequency.MONTHLY,
        isImportant: false,
        dueDate: 15,
        expenseDate: '2025-01-15',
        originalAmount: 10000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      expect(getInstallmentAmount(expense)).toBe(10000);
    });

    it('should divide total amount by installments for INSTALLMENT type', () => {
      const expense: Expense = {
        id: '1',
        name: 'Laptop',
        category: 'personal',
        amountInClp: 1200000,
        type: ExpenseType.INSTALLMENT,
        startDate: '2025-01-15',
        installments: 12,
        paymentFrequency: PaymentFrequency.MONTHLY,
        isImportant: false,
        dueDate: 15,
        expenseDate: '2025-01-15',
        originalAmount: 1200000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      expect(getInstallmentAmount(expense)).toBe(100000); // 1,200,000 / 12
    });

    it('should return 0 for INSTALLMENT with 0 installments', () => {
      const expense: Expense = {
        id: '1',
        name: 'Test',
        category: 'test',
        amountInClp: 1000,
        type: ExpenseType.INSTALLMENT,
        startDate: '2025-01-15',
        installments: 0,
        paymentFrequency: PaymentFrequency.MONTHLY,
        isImportant: false,
        dueDate: 15,
        expenseDate: '2025-01-15',
        originalAmount: 1000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      expect(getInstallmentAmount(expense)).toBe(0);
    });

    it('should return full amount for VARIABLE expenses', () => {
      const expense: Expense = {
        id: '1',
        name: 'Groceries',
        category: 'food',
        amountInClp: 50000,
        type: ExpenseType.VARIABLE,
        startDate: '2025-01-15',
        installments: 1,
        paymentFrequency: PaymentFrequency.ONCE,
        isImportant: false,
        dueDate: 15,
        expenseDate: '2025-01-15',
        originalAmount: 50000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      expect(getInstallmentAmount(expense)).toBe(50000);
    });
  });

  describe('Edge cases', () => {
    it('should handle month boundaries correctly', () => {
      const expense: Expense = {
        id: '1',
        name: 'Test',
        category: 'test',
        amountInClp: 1000,
        type: ExpenseType.RECURRING,
        startDate: '2025-01-31', // Last day of January
        installments: 12,
        paymentFrequency: PaymentFrequency.MONTHLY,
        isImportant: false,
        dueDate: 31,
        expenseDate: '2025-01-31',
        originalAmount: 1000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      expect(isInstallmentInMonth(expense, 2025, 0)).toBe(true);  // January
      expect(isInstallmentInMonth(expense, 2025, 1)).toBe(true);  // February (even though it has 28 days)
      expect(isInstallmentInMonth(expense, 2025, 2)).toBe(true);  // March
    });

    it('should handle year transitions correctly', () => {
      const expense: Expense = {
        id: '1',
        name: 'Test',
        category: 'test',
        amountInClp: 1000,
        type: ExpenseType.RECURRING,
        startDate: '2024-12-15', // December 2024
        installments: 0, // Infinite
        paymentFrequency: PaymentFrequency.MONTHLY,
        isImportant: false,
        dueDate: 15,
        expenseDate: '2024-12-15',
        originalAmount: 1000,
        originalCurrency: 'CLP',
        exchangeRate: 1,
      };

      expect(isInstallmentInMonth(expense, 2024, 11)).toBe(true); // December 2024
      expect(isInstallmentInMonth(expense, 2025, 0)).toBe(true);  // January 2025
      expect(isInstallmentInMonth(expense, 2025, 1)).toBe(true);  // February 2025
    });
  });
});
