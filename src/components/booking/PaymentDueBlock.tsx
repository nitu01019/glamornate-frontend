'use client';

/**
 * Pay-at-spa amount-due card.
 *
 * Phase 4.5 (Booking Flow Fix v3.1, 2026-05-02): the booking detail page
 * removes the "online checkout" mental model entirely, so the customer
 * needs an unmissable answer to two questions: how much do I owe, and
 * where do I pay it. This card is the primary visual hierarchy under the
 * status banner.
 */
import * as React from 'react';
import { PAY_AT_SPA, NO_PAYMENT_TAKEN } from '@/lib/booking/copy';

export interface PaymentDueBlockProps {
  amountRupees: number;
}

export function PaymentDueBlock({ amountRupees }: PaymentDueBlockProps) {
  return (
    <section
      role="region"
      aria-label="Payment due"
      className="rounded-2xl border border-brand-maroon-200 bg-brand-maroon-50 p-5 shadow-sm"
    >
      <div className="text-3xl font-semibold text-brand-maroon-900">₹{amountRupees}</div>
      <div className="mt-2 text-sm font-medium text-brand-maroon-800">
        {PAY_AT_SPA(amountRupees).replace(`₹${amountRupees} `, '')}
        — cash, UPI, or card
      </div>
      <div className="mt-3 text-xs text-brand-maroon-700/80">{NO_PAYMENT_TAKEN}</div>
    </section>
  );
}
