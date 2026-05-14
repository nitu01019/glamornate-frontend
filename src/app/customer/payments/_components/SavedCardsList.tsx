'use client';

import { useState } from 'react';
import { CreditCard, MoreVertical, Star, Trash2 } from 'lucide-react';
import type { CardBrand, SavedCard } from '@/types/payments';
import { EmptyCardsState } from './EmptyCardsState';

// ---------------------------------------------------------------------------
// Brand display config
//
// The actual brand SVGs live in lucide-react's generic CreditCard glyph plus a
// short text label; we do not bundle third-party brand marks. This keeps the
// shell purely visual until the backend returns real payment methods.
// ---------------------------------------------------------------------------

const BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  discover: 'Discover',
  rupay: 'RuPay',
  diners: 'Diners Club',
  jcb: 'JCB',
  unknown: 'Card',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatExpiry(month: number, year: number): string {
  const mm = String(month).padStart(2, '0');
  const yy = String(year).slice(-2);
  return `${mm}/${yy}`;
}

function formatMaskedNumber(last4: string): string {
  return `•••• •••• •••• ${last4}`;
}

// ---------------------------------------------------------------------------
// SavedCardsList
// ---------------------------------------------------------------------------

interface SavedCardsListProps {
  readonly savedCards: readonly SavedCard[];
  /** Invoked when the user taps the CTA in the empty state. */
  readonly onAddCard: () => void;
  /**
   * Invoked when the user picks "Remove" from a card's overflow menu. Stubbed
   * today; wire to a Cloud Function that detaches the PaymentMethod.
   */
  readonly onRemoveCard: (cardId: string) => void;
  /**
   * When true, empty-state CTA and per-row action menus are disabled.
   * Payments backend is not live yet.
   */
  readonly disabled?: boolean;
}

export function SavedCardsList({
  savedCards,
  onAddCard,
  onRemoveCard,
  disabled = false,
}: SavedCardsListProps) {
  if (savedCards.length === 0) {
    return <EmptyCardsState onAddCard={onAddCard} disabled={disabled} />;
  }

  return (
    <ul className="space-y-3" aria-label="Saved cards">
      {savedCards.map((card) => (
        <SavedCardRow
          key={card.id}
          card={card}
          onRemove={() => onRemoveCard(card.id)}
          disabled={disabled}
        />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// SavedCardRow
// ---------------------------------------------------------------------------

interface SavedCardRowProps {
  readonly card: SavedCard;
  readonly onRemove: () => void;
  readonly disabled: boolean;
}

function SavedCardRow({ card, onRemove, disabled }: SavedCardRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleToggleMenu = () => {
    if (disabled) return;
    setMenuOpen((open) => !open);
  };

  const handleRemoveClick = () => {
    setMenuOpen(false);
    // TODO(backend): replace with Cloud Function `detachPaymentMethod`
    onRemove();
  };

  return (
    <li className="rounded-2xl shadow-sm bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-maroon-50 flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5 text-brand-maroon-500" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {BRAND_LABEL[card.brand]}
            </span>
            {card.isDefault && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-brand-gold-50 text-brand-gold-700 border border-brand-gold-200 uppercase tracking-wider">
                <Star className="w-3 h-3 fill-brand-gold-500" aria-hidden="true" />
                Default
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 font-mono tracking-wider">
            {formatMaskedNumber(card.last4)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Exp {formatExpiry(card.expMonth, card.expYear)}
          </p>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={handleToggleMenu}
            disabled={disabled}
            aria-disabled={disabled}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Open actions for card ending ${card.last4}`}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && !disabled && (
            <div
              role="menu"
              className="absolute right-0 top-10 z-10 min-w-[160px] rounded-xl border border-gray-100 bg-white shadow-lg py-1"
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleRemoveClick}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Remove card
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
