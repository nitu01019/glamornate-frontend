'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Info, Plus, Smartphone, Star } from 'lucide-react';
import type { SavedCard, UpiHandle } from '@/types/payments';
import { SavedCardsList } from './SavedCardsList';

const DISABLED_BANNER_COPY = 'Card saving will be enabled once payments are live.';

interface PaymentMethodsPageClientProps {
  readonly initialCards?: readonly SavedCard[];
  readonly initialUpiHandles?: readonly UpiHandle[];
  readonly paymentsEnabled?: boolean;
}

export function PaymentMethodsPageClient({
  initialCards = [],
  initialUpiHandles = [],
  paymentsEnabled = false,
}: PaymentMethodsPageClientProps = {}) {
  const router = useRouter();

  // TODO(backend): replace with Cloud Function setupIntent → PaymentMethod list
  const [savedCards, setSavedCards] = useState<readonly SavedCard[]>(initialCards);
  // TODO(backend): replace with Cloud Function listing saved UPI handles
  const [upiHandles, setUpiHandles] = useState<readonly UpiHandle[]>(initialUpiHandles);

  const paymentsDisabled = !paymentsEnabled;

  const openAddCardDialog = useCallback(() => {
    if (paymentsDisabled) return;
    // TODO(backend): open <AddCardDialog /> bound to setupIntent
  }, [paymentsDisabled]);

  const openAddUpiDialog = useCallback(() => {
    if (paymentsDisabled) return;
    // TODO(backend): open UPI handle creation dialog
  }, [paymentsDisabled]);

  const handleRemoveCard = useCallback(
    (cardId: string) => {
      if (paymentsDisabled) return;
      // TODO(backend): replace with Cloud Function `detachPaymentMethod`
      setSavedCards((prev) => prev.filter((c) => c.id !== cardId));
    },
    [paymentsDisabled],
  );

  const handleRemoveUpi = useCallback(
    (upiId: string) => {
      if (paymentsDisabled) return;
      // TODO(backend): replace with Cloud Function `detachUpiHandle`
      setUpiHandles((prev) => prev.filter((u) => u.id !== upiId));
    },
    [paymentsDisabled],
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-95 transition-transform"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900 text-base">Payment Methods</h1>
          <div className="w-10" aria-hidden="true" />
        </div>
      </header>

      <main className="px-4 pt-4 max-w-lg mx-auto space-y-5">
        {paymentsDisabled && (
          <section
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
          >
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm font-medium text-amber-900">{DISABLED_BANNER_COPY}</p>
          </section>
        )}

        <section aria-labelledby="cards-heading" className="rounded-2xl shadow-sm bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 id="cards-heading" className="text-sm font-semibold text-gray-900">
              Cards
            </h2>
            {savedCards.length > 0 && (
              <button
                type="button"
                onClick={openAddCardDialog}
                disabled={paymentsDisabled}
                aria-disabled={paymentsDisabled}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-maroon-600 hover:bg-brand-maroon-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Card
              </button>
            )}
          </div>

          <SavedCardsList
            savedCards={savedCards}
            onAddCard={openAddCardDialog}
            onRemoveCard={handleRemoveCard}
            disabled={paymentsDisabled}
          />

          {savedCards.length > 0 && (
            <button
              type="button"
              onClick={openAddCardDialog}
              disabled={paymentsDisabled}
              aria-disabled={paymentsDisabled}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-brand-maroon-200 text-sm font-semibold text-brand-maroon-600 hover:bg-brand-maroon-50 active:scale-[0.98] transition-all min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Plus className="w-4 h-4" />
              Add Card
            </button>
          )}
        </section>

        <section aria-labelledby="upi-heading" className="rounded-2xl shadow-sm bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 id="upi-heading" className="text-sm font-semibold text-gray-900">
              UPI
            </h2>
          </div>

          {upiHandles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <div className="w-14 h-14 rounded-full bg-brand-maroon-50 flex items-center justify-center mb-3">
                <Smartphone className="w-7 h-7 text-brand-maroon-400" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">No UPI IDs linked</p>
              <p className="text-xs text-gray-500 max-w-[240px] mb-4">
                Link a UPI ID to pay in seconds at checkout.
              </p>
              <button
                type="button"
                onClick={openAddUpiDialog}
                disabled={paymentsDisabled}
                aria-disabled={paymentsDisabled}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-brand-maroon-200 text-sm font-semibold text-brand-maroon-600 rounded-xl hover:bg-brand-maroon-50 active:scale-[0.98] transition-all min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                <Plus className="w-4 h-4" />
                Add UPI ID
              </button>
            </div>
          ) : (
            <ul className="space-y-2" aria-label="Saved UPI IDs">
              {upiHandles.map((upi) => (
                <li
                  key={upi.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-maroon-50 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4 text-brand-maroon-500" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{upi.vpa}</p>
                  </div>
                  {upi.isDefault && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-brand-gold-50 text-brand-gold-700 border border-brand-gold-200 uppercase tracking-wider">
                      <Star className="w-3 h-3 fill-brand-gold-500" aria-hidden="true" />
                      Default
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveUpi(upi.id)}
                    disabled={paymentsDisabled}
                    aria-disabled={paymentsDisabled}
                    aria-label={`Remove ${upi.vpa}`}
                    className="text-xs font-medium text-gray-500 hover:text-brand-maroon-600 px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
