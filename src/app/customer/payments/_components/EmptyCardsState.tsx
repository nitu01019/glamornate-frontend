'use client';

import { CreditCard } from 'lucide-react';

// ---------------------------------------------------------------------------
// EmptyCardsState
//
// Rendered by SavedCardsList when the customer has zero saved cards. Matches
// the visual rhythm of the Addresses empty state (same circle size, same
// heading/subhead cadence, same gradient CTA).
// ---------------------------------------------------------------------------

interface EmptyCardsStateProps {
  /** Invoked when the primary CTA is pressed; opens the (stub) AddCardDialog. */
  readonly onAddCard: () => void;
  /**
   * When true, the CTA is rendered but non-interactive. Used while the
   * payments backend is disabled so customers see the aspirational UI
   * without being able to submit.
   */
  readonly disabled?: boolean;
}

export function EmptyCardsState({ onAddCard, disabled = false }: EmptyCardsStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-brand-maroon-50 flex items-center justify-center mb-4">
        <CreditCard className="w-8 h-8 text-brand-maroon-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">No saved cards yet</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-[260px]">Add a card for faster checkout.</p>
      <button
        type="button"
        onClick={onAddCard}
        disabled={disabled}
        aria-disabled={disabled}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-gold-500 to-brand-maroon-500 text-white text-sm font-semibold rounded-xl shadow-sm active:scale-[0.98] transition-all min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
      >
        Add Your First Card
      </button>
    </div>
  );
}
