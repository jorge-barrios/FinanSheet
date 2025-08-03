
import { Expense, PaymentStatus, ExpenseType, Currency, PaymentUnit } from '../types';
import { getInstallmentAmount, isInstallmentInMonth } from '../utils/expenseCalculations';
import { convertToDisplayCurrency, formatCurrency } from '../utils/currency';

// This function relies on the global 'XLSX' object provided by the script in index.html
declare var XLSX: any;

export const exportToExcel = (
    expenses: Expense[],
    paymentStatus: PaymentStatus,
    year: number,
    t: (key: string) => string,
    monthNames: string[],
    displayCurrency: Currency,
    language: 'en' | 'es',
    exchangeRates: Record<Currency, number>
) => {
  const dataForSheet = expenses.map(expense => {
    const totalAmountInDisplay = convertToDisplayCurrency(expense.totalAmount, displayCurrency, exchangeRates);
    
    const row: { [key: string]: string | number } = {
      [t('grid.expense')]: expense.name,
      [t('form.typeLabel')]: t(expense.type === ExpenseType.FIXED ? 'form.type.fixed' : 'form.type.variable'),
      [t('grid.totalAmount')]: totalAmountInDisplay, // Export in display currency
      [t('grid.installments')]: expense.installments,
      [t('grid.startDate')]: `${monthNames[expense.startDate.month]}/${expense.startDate.year}`,
    };

    monthNames.forEach((monthName, monthIndex) => {
      const isInMonth = isInstallmentInMonth(expense, year, monthIndex);
      if (isInMonth) {
        const amountInBase = getInstallmentAmount(expense);
        const paymentDetails = paymentStatus[expense.id]?.[`${year}-${monthIndex}`];
        const isPaid = paymentDetails?.paid ?? false;
        
        const finalAmountInBase = paymentDetails?.overriddenAmount ?? amountInBase;
        const finalAmountInDisplay = convertToDisplayCurrency(finalAmountInBase, displayCurrency, exchangeRates);
        
        const formatted = formatCurrency(finalAmountInDisplay, displayCurrency, language);
        row[monthName] = `${formatted} ${isPaid ? `(${t('grid.paid')})` : ''}`;
      } else {
        row[monthName] = '-';
      }
    });

    return row;
  });

  // Calculate totals in display currency
  const totalsRow: { [key: string]: string | number } = {
      [t('grid.expense')]: t('grid.monthlyTotal'),
      [t('form.typeLabel')]: '',
      [t('grid.totalAmount')]: '',
      [t('grid.installments')]: '',
      [t('grid.startDate')]: '',
  };

  monthNames.forEach((monthName, monthIndex) => {
       const totalInBase = expenses.reduce((sum, expense) => {
            if (isInstallmentInMonth(expense, year, monthIndex)) {
                const paymentDetails = paymentStatus[expense.id]?.[`${year}-${monthIndex}`];
                const amountInBase = paymentDetails?.overriddenAmount ?? getInstallmentAmount(expense);
                return sum + amountInBase;
            }
            return sum;
        }, 0);
      const totalInDisplay = convertToDisplayCurrency(totalInBase, displayCurrency, exchangeRates);
      totalsRow[monthName] = totalInDisplay > 0 ? formatCurrency(totalInDisplay, displayCurrency, language) : '-';
  });
  dataForSheet.push(totalsRow);

  const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Expenses ${year}`);

  // Auto-size columns
  if (dataForSheet.length > 0) {
    const colWidths = Object.keys(dataForSheet[0]).map(key => ({
      wch: Math.max(
        key.length,
        ...dataForSheet.map(row => row[key]?.toString().length ?? 0)
      ) + 2 // add padding
    }));
    worksheet['!cols'] = colWidths;
  }

  XLSX.writeFile(workbook, `FinanSheet_${year}.xlsx`);
};
