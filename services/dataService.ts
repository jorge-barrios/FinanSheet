import { Expense, ExpenseType, PaymentStatus, PaymentDetails } from '../types';

/**
 * Service for managing expense versioning, particularly for recurring expenses.
 * Implements the versioning system that preserves historical data when editing recurring expenses.
 */
export class ExpenseVersioningService {
  
  /**
   * Creates a new version of a recurring expense without modifying the original.
   * This preserves the historical data while allowing changes from the current date forward.
   * 
   * @param originalExpense The original expense to create a version of
   * @param updatedFields The fields to update in the new version
   * @param effectiveDate The date from which the new version becomes effective (defaults to today)
   * @returns The new expense version
   */
  static createExpenseVersion(
    originalExpense: Expense,
    updatedFields: Partial<Expense>,
    effectiveDate: string = new Date().toISOString().split('T')[0]
  ): Expense {
    // Only allow versioning for recurring expenses
    if (originalExpense.type !== ExpenseType.RECURRING) {
      throw new Error('Versioning is only supported for recurring expenses');
    }

    // Note: The original expense should be updated separately to set its end date
    // This is typically done by the calling code to maintain data consistency

    // Create new version
    const newVersion: Expense = {
      ...originalExpense,
      ...updatedFields,
      id: this.generateVersionId(originalExpense.id),
      parentId: originalExpense.parentId || originalExpense.id,
      versionDate: effectiveDate,
      endDate: undefined, // New version has no end date initially
      isActive: true,
      created_at: new Date().toISOString()
    };

    return newVersion;
  }

  /**
   * Generates a unique ID for a new expense version
   */
  private static generateVersionId(originalId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `${originalId}_v${timestamp}_${random}`;
  }

  /**
   * Gets all versions of an expense, including the original
   * @param expenses Array of all expenses
   * @param expenseId ID of the expense to get versions for
   * @returns Array of expense versions sorted by version date
   */
  static getExpenseVersions(expenses: Expense[], expenseId: string): Expense[] {
    const versions = expenses.filter(expense => 
      expense.id === expenseId || 
      expense.parentId === expenseId ||
      (expense.parentId && expense.parentId === expenseId)
    );

    return versions.sort((a, b) => {
      const dateA = a.versionDate || a.startDate;
      const dateB = b.versionDate || b.startDate;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  }

  /**
   * Gets the active version of an expense for a specific date
   * @param expenses Array of all expenses
   * @param expenseId ID of the expense
   * @param targetDate Date to check (YYYY-MM-DD)
   * @returns The active expense version for that date
   */
  static getActiveVersionForDate(expenses: Expense[], expenseId: string, targetDate: string): Expense | null {
    const versions = this.getExpenseVersions(expenses, expenseId);
    
    for (let i = versions.length - 1; i >= 0; i--) {
      const version = versions[i];
      const versionStart = version.versionDate || version.startDate;
      const versionEnd = version.endDate;
      
      const targetDateTime = new Date(targetDate).getTime();
      const startDateTime = new Date(versionStart).getTime();
      const endDateTime = versionEnd ? new Date(versionEnd).getTime() : Infinity;
      
      if (targetDateTime >= startDateTime && targetDateTime < endDateTime) {
        return version;
      }
    }
    
    return null;
  }

  /**
   * Calculates the amount for a specific month considering expense versions
   * @param expenses Array of all expenses
   * @param expenseId ID of the expense
   * @param year Year
   * @param month Month (0-based)
   * @returns The amount for that month or null if no version applies
   */
  static getAmountForMonth(expenses: Expense[], expenseId: string, year: number, month: number): number | null {
    const targetDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const activeVersion = this.getActiveVersionForDate(expenses, expenseId, targetDate);
    
    return activeVersion ? activeVersion.amountInClp : null;
  }

  /**
   * Checks if an expense should appear in a specific month considering versions
   * @param expenses Array of all expenses
   * @param expenseId ID of the expense
   * @param year Year
   * @param month Month (0-based)
   * @returns True if the expense should appear in that month
   */
  static shouldShowInMonth(expenses: Expense[], expenseId: string, year: number, month: number): boolean {
    const activeVersion = this.getActiveVersionForDate(expenses, expenseId, `${year}-${String(month + 1).padStart(2, '0')}-01`);
    return activeVersion !== null;
  }

  /**
   * Gets payment details for a specific month, ensuring it's associated with the correct version
   * @param paymentStatus Payment status object
   * @param expenses Array of all expenses
   * @param expenseId ID of the expense
   * @param year Year
   * @param month Month (0-based)
   * @returns Payment details for that month
   */
  static getPaymentDetailsForMonth(
    paymentStatus: PaymentStatus,
    expenses: Expense[],
    expenseId: string,
    year: number,
    month: number
  ): PaymentDetails | null {
    const activeVersion = this.getActiveVersionForDate(expenses, expenseId, `${year}-${String(month + 1).padStart(2, '0')}-01`);
    
    if (!activeVersion) return null;
    
    const monthKey = `${year}-${month}`;
    const expensePayments = paymentStatus[activeVersion.id];
    
    return expensePayments?.[monthKey] || null;
  }

  /**
   * Updates payment status ensuring it's associated with the correct expense version
   * @param paymentStatus Current payment status
   * @param expenses Array of all expenses
   * @param expenseId ID of the expense
   * @param year Year
   * @param month Month (0-based)
   * @param paymentDetails Payment details to set
   * @returns Updated payment status
   */
  static updatePaymentStatus(
    paymentStatus: PaymentStatus,
    expenses: Expense[],
    expenseId: string,
    year: number,
    month: number,
    paymentDetails: PaymentDetails
  ): PaymentStatus {
    const activeVersion = this.getActiveVersionForDate(expenses, expenseId, `${year}-${String(month + 1).padStart(2, '0')}-01`);
    
    if (!activeVersion) {
      throw new Error(`No active version found for expense ${expenseId} in ${year}-${month + 1}`);
    }
    
    const monthKey = `${year}-${month}`;
    const updatedStatus = { ...paymentStatus };
    
    if (!updatedStatus[activeVersion.id]) {
      updatedStatus[activeVersion.id] = {};
    }
    
    updatedStatus[activeVersion.id][monthKey] = paymentDetails;
    
    return updatedStatus;
  }

  /**
   * Gets the correct amount to display for a specific month, considering expense versions
   * This ensures historical amounts are preserved and new amounts are shown from the effective date
   * @param expenses Array of all expenses
   * @param expense The expense to get the amount for
   * @param year Year
   * @param month Month (0-based)
   * @returns The amount that should be displayed for that month
   */
  static getAmountForDisplay(expenses: Expense[], expense: Expense, year: number, month: number): number {
    // For non-recurring expenses, always return the expense amount
    if (expense.type !== 'RECURRING') {
      return expense.amountInClp;
    }

    // For recurring expenses, find the correct version for this date
    const baseId = expense.parentId || expense.id;
    const targetDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const activeVersion = this.getActiveVersionForDate(expenses, baseId, targetDate);
    
    return activeVersion ? activeVersion.amountInClp : expense.amountInClp;
  }

  /**
   * Gets a consolidated view of an expense showing all its versions
   * This is useful for displaying the expense history in the UI
   */
  static getExpenseHistory(expenses: Expense[], expenseId: string): {
    original: Expense;
    versions: Expense[];
    timeline: Array<{
      version: Expense;
      startDate: string;
      endDate?: string;
      isActive: boolean;
    }>;
  } {
    const versions = this.getExpenseVersions(expenses, expenseId);
    const original = versions[0];
    const versionHistory = versions.slice(1);
    
    const timeline = versions.map((version) => ({
      version,
      startDate: version.versionDate || version.startDate,
      endDate: version.endDate,
      isActive: !version.endDate
    }));
    
    return {
      original,
      versions: versionHistory,
      timeline
    };
  }
}
