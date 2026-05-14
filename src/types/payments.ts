/**
 * Payment method types used by the customer payments surface.
 *
 * Saved cards and UPI handles are referenced by the Payments Methods
 * page. Card numbers are stored ONLY as last-4 + brand + tokenized id —
 * never the PAN.
 */

export type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'rupay'
  | 'diners'
  | 'jcb'
  | 'unknown';

export interface SavedCard {
  id: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName?: string;
  isDefault: boolean;
  createdAt?: string;
}

export interface UpiHandle {
  id: string;
  vpa: string;
  label?: string;
  isDefault: boolean;
  createdAt?: string;
}

export interface PaymentMethodsState {
  cards: SavedCard[];
  upiHandles: UpiHandle[];
}
