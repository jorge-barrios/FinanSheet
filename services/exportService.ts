
import { Expense, PaymentStatus, ExpenseType, Currency } from '../types';
import { getInstallmentAmount, isInstallmentInMonth } from '../utils/expenseCalculations';
import { convertToDisplayCurrency, convertToBaseCurrency, formatCurrency } from '../utils/currency';

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
    // amountInClp is stored in CLP; convert to base (USD) first, then to display
    const amountInBase = convertToBaseCurrency(expense.amountInClp, 'CLP', exchangeRates);
    const totalAmountInDisplay = convertToDisplayCurrency(amountInBase, displayCurrency, exchangeRates);
    
    const row: { [key: string]: string | number } = {
      [t('grid.expense')]: expense.name,
      [t('form.typeLabel')]: t(
        expense.type === ExpenseType.RECURRING
          ? 'form.type.recurring'
          : expense.type === ExpenseType.INSTALLMENT
          ? 'form.type.installment'
          : 'form.type.variable'
      ),
      [t('grid.totalAmount')]: totalAmountInDisplay, // Export in display currency
      [t('grid.installments')]: expense.installments,
      [t('grid.startDate')]: (() => {
        // expense.startDate is 'YYYY-MM-DD'
        const [y, m] = expense.startDate.split('-').map(Number);
        const monthIdx = (m || 1) - 1; // 0-based
        return `${monthNames[monthIdx]}/${y}`;
      })(),
    };

    monthNames.forEach((monthName, monthIndex) => {
      const isInMonth = isInstallmentInMonth(expense, year, monthIndex);
      if (isInMonth) {
        const amountInClp = getInstallmentAmount(expense);
        const paymentDetails = paymentStatus[expense.id]?.[`${year}-${monthIndex}`];
        const isPaid = paymentDetails?.paid ?? false;
        
        const finalAmountInClp = paymentDetails?.overriddenAmount ?? amountInClp;
        const finalAmountInBase = convertToBaseCurrency(finalAmountInClp, 'CLP', exchangeRates);
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
       const totalInClp = expenses.reduce((sum, expense) => {
            if (isInstallmentInMonth(expense, year, monthIndex)) {
                const paymentDetails = paymentStatus[expense.id]?.[`${year}-${monthIndex}`];
                const amountInClp = paymentDetails?.overriddenAmount ?? getInstallmentAmount(expense);
                return sum + amountInClp;
            }
            return sum;
        }, 0);
      const totalInBase = convertToBaseCurrency(totalInClp, 'CLP', exchangeRates);
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
