
export enum ExpenseType {
  RECURRING = 'RECURRING',    // Gasto recurrente (se repite periódicamente)
  INSTALLMENT = 'INSTALLMENT', // Gasto en cuotas (monto total dividido)
  VARIABLE = 'VARIABLE'        // Gasto único/variable
}

export type Currency = 'USD' | 'CLP';
export type PaymentUnit = Currency | 'UF' | 'UTM';

export type View = 'table' | 'graph' | 'calendar';

export enum PaymentFrequency {
  ONCE = 'ONCE',
  MONTHLY = 'MONTHLY',
  BIMONTHLY = 'BIMONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMIANNUALLY = 'SEMIANNUALLY',
  ANNUALLY = 'ANNUALLY',
}

export interface Expense {
  id: string;
  name: string;
  category: string;
  amountInClp: number; // The final, calculated amount in CLP
  type: ExpenseType;
  startDate: string; // YYYY-MM-DD
  installments: number; // Number of payments
  paymentFrequency: PaymentFrequency;
  isImportant: boolean;
  dueDate: number; // Day of the month (1-31)
  created_at?: string;

  // New currency and amount fields
  expenseDate: string; // YYYY-MM-DD
  originalAmount: number;
  originalCurrency: PaymentUnit; // The original currency or unit (CLP, USD, UF, UTM)
  exchangeRate: number; // The exchange rate applied at the time of creation
}

export interface PaymentDetails {
    paid: boolean;
    paymentDate?: number; // timestamp
    overriddenAmount?: number;
    overriddenDueDate?: number; // Day of month, 1-31
}

// To track payment status separately. Key is `expense.id`.
// The inner key is a string like "YYYY-M" (e.g., "2024-0" for Jan 2024)
export type PaymentStatus = Record<string, Record<string, PaymentDetails>>;
