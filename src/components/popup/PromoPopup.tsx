'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { promotions } from '@/lib/mock-data';

interface PromoPopupProps {
  onDismiss: () => void;
}

function getActivePromotion() {
  const active = promotions.find((p) => p.isActive);
  if (active) {
    return {
      title: active.title,
      subtitle: active.subtitle,
      promoCode: active.promoCode ?? 'GLAM20',
      validUntil: active.validUntil
        ? `Valid until ${new Date(active.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : 'Limited time offer',
      ctaLink: active.ctaLink,
      discountLabel:
        active.discountType === 'percentage'
          ? `${active.discountValue}% Off`
          : active.discountValue
            ? `Flat Rs ${active.discountValue} Off`
            : 'Special Offer',
    };
  }

  return {
    title: 'Flat 20% Off on All Facials',
    subtitle: 'Book any facial service and save big!',
    promoCode: 'GLAM20',
    validUntil: 'Limited time offer',
    ctaLink: '/offers',
    discountLabel: '20% Off',
  };
}

export default function PromoPopup({ onDismiss }: PromoPopupProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const promo = getActivePromotion();

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  const handleCtaClick = useCallback(() => {
    router.push(promo.ctaLink);
    onDismiss();
  }, [router, promo.ctaLink, onDismiss]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onDismiss]);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div>
      {/* Backdrop. Purely decorative: it must never intercept pointer events
          because it stretches across the full viewport and sits above page
          CTAs. Users dismiss the popup via the close (X) button, Escape, or
          the "Grab This Offer" CTA below. Allowing the dimmer to capture
          clicks silently swallowed every home-screen tap (see S2 baseline
          evidence). */}
      <div
        className={cn(
          'pointer-events-none fixed inset-0 z-[70] bg-black/50 transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden="true"
      />

      {/* Bottom sheet card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Promotional offer"
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[71] rounded-t-3xl bg-white transition-transform duration-300 ease-out',
          isVisible ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ maxHeight: '70vh' }}
        onClick={handleCardClick}
      >
        <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
          {/* Close button */}
          <button
            onClick={onDismiss}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
            aria-label="Close promotional popup"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Gradient header */}
          <div className="bg-gradient-to-r from-rose-500 to-amber-500 px-6 pb-6 pt-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Introducing
            </p>
            <h2 className="mt-1 text-2xl font-bold text-white">TODAY&apos;S SPECIAL</h2>
            <p className="mt-2 text-sm font-medium text-white/90">{promo.discountLabel}</p>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <h3 className="text-lg font-bold text-gray-900">{promo.title}</h3>
            <p className="mt-1 text-sm text-gray-600">{promo.subtitle}</p>

            {/* Promo code box */}
            <div className="mt-4 rounded-xl border-2 border-dashed border-brand-maroon-500/30 bg-brand-maroon-500/5 px-4 py-3 text-center">
              <p className="text-xs font-medium text-gray-500">Use code</p>
              <p className="mt-1 text-lg font-bold tracking-widest text-brand-maroon-600">
                {promo.promoCode}
              </p>
            </div>

            <p className="mt-3 text-center text-xs text-gray-400">{promo.validUntil}</p>

            {/* CTA button */}
            <button
              onClick={handleCtaClick}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-brand-maroon-600 to-brand-maroon-500 px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg transition-all hover:from-brand-maroon-700 hover:to-brand-maroon-600 hover:shadow-xl active:scale-[0.98]"
            >
              Grab This Offer
            </button>
          </div>

          {/* Bottom safe area */}
          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
