/**
 * Format amount to currency string
 */
export function formatCurrency(
  amount: number,
  currency: string = 'INR',
  locale: string = 'en-IN',
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/**
 * Format amount to INR with rupee symbol (₹)
 */
export function formatINR(amount: number): string {
  return formatCurrency(amount, 'INR', 'en-IN');
}

/**
 * Format amount to USD with dollar sign ($)
 */
export function formatUSD(amount: number): string {
  return formatCurrency(amount, 'USD', 'en-US');
}

/**
 * Format amount without currency symbol, just number
 */
export function formatAmount(amount: number, maximumFractionDigits: number = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(amount);
}

/**
 * Calculate discounted amount
 */
export function calculateDiscount(
  originalAmount: number,
  discount: { type: 'percentage' | 'fixed'; value: number },
): number {
  if (discount.type === 'percentage') {
    return Math.round(originalAmount * (discount.value / 100));
  }
  return Math.min(discount.value, originalAmount);
}

/**
 * Calculate final amount after discount
 */
export function calculateFinalAmount(
  originalAmount: number,
  discount: { type: 'percentage' | 'fixed'; value: number },
): { discountedAmount: number; finalAmount: number } {
  const discountedAmount = calculateDiscount(originalAmount, discount);
  const finalAmount = Math.max(0, originalAmount - discountedAmount);
  return { discountedAmount, finalAmount };
}

/**
 * Calculate tax amount
 */
export function calculateTax(amount: number, taxRate: number = 0.18): number {
  return Math.round(amount * taxRate);
}

/**
 * Calculate total with tax
 */
export function calculateTotalWithTax(amount: number, taxRate: number = 0.18): number {
  const tax = calculateTax(amount, taxRate);
  return amount + tax;
}

/**
 * Split amount among people evenly
 */
export function splitAmountEvenly(amount: number, people: number): number {
  if (people <= 0) throw new Error('Number of people must be greater than 0');
  return Math.round((amount / people) * 100) / 100;
}

/**
 * Round to nearest 10
 */
export function roundToNearest(amount: number, nearest: number = 10): number {
  return Math.round(amount / nearest) * nearest;
}

/**
 * Convert between currencies (mock - use actual API in production)
 */
export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  // Mock exchange rates - use a real API in production
  const rates: Record<string, number> = {
    USD: 1,
    INR: 83.5,
    EUR: 0.92,
    GBP: 0.79,
  };

  const fromRate = rates[fromCurrency] || 1;
  const toRate = rates[toCurrency] || 1;

  return (amount / fromRate) * toRate;
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  // Remove currency symbols and spaces, then parse
  const cleaned = value.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Check if amount is zero
 */
export function isZero(amount: number): boolean {
  return Math.abs(amount) < 0.01;
}

/**
 * Format price range
 */
export function formatPriceRange(min: number, max: number, currency: string = 'INR'): string {
  if (min === max) {
    return formatCurrency(min, currency);
  }
  return `${formatCurrency(min, currency)} - ${formatCurrency(max, currency)}`;
}
