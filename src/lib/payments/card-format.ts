import type { CardBrand } from '@/types/payments';

const BRAND_PATTERNS: ReadonlyArray<{ brand: CardBrand; pattern: RegExp }> = [
  { brand: 'visa', pattern: /^4\d{6,}$/ },
  {
    brand: 'mastercard',
    pattern: /^(5[1-5]\d{5,}|2(2[2-9]\d{4,}|[3-6]\d{6,}|7[01]\d{5,}|720\d{5,}))$/,
  },
  { brand: 'amex', pattern: /^3[47]\d{5,}$/ },
  { brand: 'discover', pattern: /^(6011|65\d{2}|64[4-9]\d)\d{3,}$/ },
  { brand: 'rupay', pattern: /^(508[5-9]|6069|607[0-9]|608[0-5])\d{3,}$/ },
  { brand: 'diners', pattern: /^3(0[0-5]|[68]\d)\d{4,}$/ },
  { brand: 'jcb', pattern: /^35(2[89]|[3-8]\d)\d{3,}$/ },
];

export function detectBrand(pan: string): CardBrand {
  const digits = pan.replace(/\D/g, '');
  for (const { brand, pattern } of BRAND_PATTERNS) {
    if (pattern.test(digits)) return brand;
  }
  return 'unknown';
}

export function formatPanWithSpaces(pan: string): string {
  const digits = pan.replace(/\D/g, '').slice(0, 19);
  const brand = detectBrand(digits);
  if (brand === 'amex') {
    return digits.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(' '),
    );
  }
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

export function luhnCheck(pan: string): boolean {
  const digits = pan.replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return false;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export interface ParsedExpiry {
  month: number;
  year: number;
}

export function parseExpiry(input: string): ParsedExpiry | null {
  const cleaned = input.replace(/[^\d]/g, '');
  if (cleaned.length < 3 || cleaned.length > 6) return null;
  const month = Number(cleaned.slice(0, 2));
  const yearPart = cleaned.slice(2);
  if (month < 1 || month > 12) return null;
  let year: number;
  if (yearPart.length === 2) {
    year = 2000 + Number(yearPart);
  } else if (yearPart.length === 4) {
    year = Number(yearPart);
  } else {
    return null;
  }
  if (!Number.isFinite(year) || year < 2000 || year > 2099) return null;
  return { month, year };
}

export function isExpiryInFuture(month: number, year: number, now: Date = new Date()): boolean {
  if (month < 1 || month > 12) return false;
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  if (year > currentYear) return true;
  if (year < currentYear) return false;
  return month >= currentMonth;
}

const UPI_VPA_REGEX = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,64}$/i;

export function isValidUpiVpa(vpa: string): boolean {
  if (typeof vpa !== 'string') return false;
  const trimmed = vpa.trim();
  if (trimmed.length < 5 || trimmed.length > 256) return false;
  return UPI_VPA_REGEX.test(trimmed);
}
