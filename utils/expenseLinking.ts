import { Expense, PaymentStatus } from '../types';
import { getAmountForMonth } from './expenseCalculations';

/**
 * Determina si un expense debe contar en los totales de ingresos/gastos
 * @param expense - El expense a evaluar
 * @returns true si debe contar, false si es secundario y debe excluirse
 */
export const shouldCountInTotals = (expense: Expense): boolean => {
  // Los expenses 'secondary' NO cuentan en totales
  if (expense.linkRole === 'secondary') {
    return false;
  }

  // Todos los demás (primary o sin link) SÍ cuentan
  return true;
};

/**
 * Calcula el monto neto para un expense vinculado
 * @param expense - Expense primario
 * @param linkedExpense - Expense secundario vinculado
 * @param year - Año del cálculo
 * @param month - Mes del cálculo (0-11)
 * @param paymentStatus - Estado de pago de todos los expenses
 * @returns Monto neto (ingreso - gasto)
 */
export const calculateNetAmount = (
  expense: Expense,
  linkedExpense: Expense | undefined,
  year: number,
  month: number,
  paymentStatus: PaymentStatus
): number => {
  // Si no hay link, devolver el monto normal
  if (!linkedExpense) {
    const details = paymentStatus[expense.id]?.[`${year}-${month}`];
    return getAmountForMonth(expense, year, month, details);
  }

  // Calcular ambos montos
  const primaryDetails = paymentStatus[expense.id]?.[`${year}-${month}`];
  const primaryAmount = getAmountForMonth(expense, year, month, primaryDetails);

  const secondaryDetails = paymentStatus[linkedExpense.id]?.[`${year}-${month}`];
  const secondaryAmount = getAmountForMonth(linkedExpense, year, month, secondaryDetails);

  // Caso arriendoGH (ingreso negativo) vinculado con dividendo (gasto positivo)
  // arriendoGH = -$1M, dividendo = +$700K
  // Neto = -$1M - (+$700K) = -$300K (ingreso neto de $300K)

  // Caso genérico: primaryAmount - secondaryAmount
  // Si primary es ingreso (-): resultado es ingreso neto (-)
  // Si primary es gasto (+): resultado es gasto neto (+)
  return primaryAmount - secondaryAmount;
};

/**
 * Encuentra el expense vinculado para un expense dado
 * @param expenses - Array de todos los expenses
 * @param expenseId - ID del expense a buscar
 * @returns Expense vinculado o undefined
 */
export const findLinkedExpense = (
  expenses: Expense[],
  expenseId: string
): Expense | undefined => {
  const expense = expenses.find(e => e.id === expenseId);
  if (!expense?.linkedExpenseId) return undefined;

  return expenses.find(e => e.id === expense.linkedExpenseId);
};

/**
 * Valida si dos expenses pueden vincularse
 * @param expense1 - Primer expense
 * @param expense2 - Segundo expense
 * @returns { valid: boolean, reason?: string }
 */
export const canLinkExpenses = (
  expense1: Expense,
  expense2: Expense
): { valid: boolean; reason?: string } => {
  // No puede vincularse consigo mismo
  if (expense1.id === expense2.id) {
    return { valid: false, reason: 'No puedes vincular un gasto consigo mismo' };
  }

  // Uno debe ser ingreso y otro gasto
  const isExpense1Income = expense1.amountInClp < 0;
  const isExpense2Income = expense2.amountInClp < 0;

  if (isExpense1Income === isExpense2Income) {
    return { valid: false, reason: 'Debes vincular un ingreso con un gasto' };
  }

  // Deben tener la misma frecuencia para que tenga sentido
  if (expense1.paymentFrequency !== expense2.paymentFrequency) {
    return {
      valid: false,
      reason: 'Los gastos vinculados deben tener la misma frecuencia de pago'
    };
  }

  // No pueden estar ya vinculados con otros
  if (expense1.linkedExpenseId || expense2.linkedExpenseId) {
    return {
      valid: false,
      reason: 'Uno de los gastos ya está vinculado con otro'
    };
  }

  return { valid: true };
};
