'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, Copy, Check, User } from 'lucide-react';

export interface SpaBookingCustomerCardProps {
  customer: {
    name?: string;
    phone?: string;
  };
}

export function SpaBookingCustomerCard({ customer }: SpaBookingCustomerCardProps) {
  const [copied, setCopied] = useState(false);
  const phone = customer.phone?.trim();
  const name = customer.name?.trim() || 'Guest';

  const onCopy = async () => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — fail silently in UI; tap-to-call still works.
    }
  };

  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-maroon-100 rounded-xl flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-brand-maroon-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p>
            <p className="font-semibold text-gray-900 truncate">{name}</p>
          </div>
        </div>

        {phone && (
          <div className="border-t border-gray-100 pt-4 flex items-center gap-2">
            <a
              href={`tel:${phone}`}
              data-testid="spa-booking-call-cta"
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-brand-maroon-500 text-white text-sm font-medium hover:bg-brand-maroon-600 active:scale-95 transition-all"
            >
              <Phone className="w-4 h-4" />
              Call {phone}
            </a>
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy phone number"
              data-testid="spa-booking-copy-phone"
              className="inline-flex items-center justify-center h-11 w-11 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
