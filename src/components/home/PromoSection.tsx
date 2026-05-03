'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Copy, Check, Ticket, Calendar, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePromotions } from '@/hooks/useHomeData';
import { selectDealOfDay } from '@/lib/deal-of-day';
import { useApplyVoucher } from '@/hooks/useVoucher';
import { useCartStore } from '@/store/cart';
import type { Promotion } from '@/lib/mock-data';
import { Skeleton } from '@/components/ui/LoadingState';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDiscountBadge(promo: Promotion): string | null {
  if (!promo.discountType || promo.discountValue == null) return null;
  if (promo.discountType === 'percentage') return `${promo.discountValue}% OFF`;
  return `Flat Rs ${promo.discountValue} OFF`;
}

function formatValidUntil(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isExpired(validUntil?: string): boolean {
  if (!validUntil) return false;
  return new Date(validUntil).getTime() < Date.now();
}

// ---------------------------------------------------------------------------
// Copy Code Button
// ---------------------------------------------------------------------------

function PromoCodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: ignore silently in non-HTTPS contexts
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-auto flex-shrink-0 p-1.5 rounded-md hover:bg-brand-maroon-100 transition-colors"
      aria-label={copied ? 'Copied' : 'Copy promo code'}
      type="button"
    >
      {copied ? (
        <Check className="w-4 h-4 text-brand-green-600" />
      ) : (
        <Copy className="w-4 h-4 text-brand-maroon-500" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DealOfDaySkeleton() {
  return (
    <section className="px-4 py-4">
      <div className="rounded-2xl overflow-hidden bg-white shadow-card-sm">
        {/* Gradient header skeleton */}
        <div className="relative p-6 pb-5">
          <Skeleton className="h-6 w-16 rounded-full mb-3" />
          <Skeleton className="h-7 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        {/* Body skeleton */}
        <div className="px-6 pb-6 space-y-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Deal image mapping – maps deal titles (lowercased keywords) to images
// ---------------------------------------------------------------------------

const DEAL_IMAGES = [
  '/images/deals/deal-spa-day.webp',
  '/images/deals/deal-hair-color.webp',
  '/images/deals/deal-facial.webp',
];

function getDealImage(deal: Promotion): string {
  const title = (deal.title + ' ' + deal.description).toLowerCase();
  if (title.includes('hair') || title.includes('color') || title.includes('colour')) {
    return '/images/deals/deal-hair-color.webp';
  }
  if (title.includes('facial') || title.includes('skin') || title.includes('glow')) {
    return '/images/deals/deal-facial.webp';
  }
  // Default: spa day image, or cycle through based on id hash
  const hash = deal.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return DEAL_IMAGES[hash % DEAL_IMAGES.length];
}

// ---------------------------------------------------------------------------
// Deal Card
// ---------------------------------------------------------------------------

interface DealCardProps {
  deal: Promotion;
}

function DealCard({ deal }: DealCardProps) {
  const badgeText = formatDiscountBadge(deal);
  const bgImage = getDealImage(deal);
  const expired = isExpired(deal.validUntil);

  const appliedCode = useCartStore((s) => s.voucherCode);
  const isApplied = Boolean(deal.promoCode && appliedCode === deal.promoCode);

  const applyVoucher = useApplyVoucher();
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showApplied, setShowApplied] = useState(false);

  const handleApply = useCallback(async () => {
    if (!deal.promoCode || expired || isApplied) return;
    setApplyError(null);
    try {
      await applyVoucher.mutateAsync(deal.promoCode);
      setShowApplied(true);
      setTimeout(() => setShowApplied(false), 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to apply offer';
      setApplyError(message);
      setTimeout(() => setApplyError(null), 3000);
    }
  }, [deal.promoCode, expired, isApplied, applyVoucher]);

  return (
    <section className="px-4 py-4">
      <div
        className={cn(
          'rounded-2xl overflow-hidden shadow-card-md',
          expired && 'opacity-60 grayscale',
        )}
      >
        {/* Image header with deal info */}
        <div className="relative p-6 pb-5 min-h-[200px] flex flex-col justify-end">
          <Image
            src={bgImage}
            alt={deal.title}
            fill
            sizes="(max-width: 512px) 100vw, 512px"
            className="object-cover"
          />
          {/* Dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/20" />

          {/* Content over the image */}
          <div className="relative z-10">
            {/* Status / discount badges */}
            <div className="absolute -top-2 right-0 flex items-center gap-2">
              {expired && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-gray-500 text-white">
                  Expired
                </span>
              )}
              {isApplied && !expired && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-brand-green-500 text-white flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Applied
                </span>
              )}
              {badgeText && !expired && !isApplied && (
                <span
                  className={cn(
                    'text-xs font-bold px-3 py-1 rounded-full',
                    deal.discountType === 'percentage'
                      ? 'bg-brand-green-500 text-white'
                      : 'bg-brand-gold-400 text-brand-maroon-950',
                  )}
                >
                  {badgeText}
                </span>
              )}
            </div>

            {/* Rotation indicator */}
            <div className="flex items-center gap-1.5 mb-3">
              <Clock className="w-3.5 h-3.5 text-brand-gold-300" />
              <span className="text-xs font-medium text-brand-gold-300">Refreshes daily</span>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-white leading-tight mb-1">{deal.title}</h3>

            {/* Subtitle */}
            <p className="text-sm font-medium text-white/80">{deal.subtitle}</p>

            {/* Description */}
            {deal.description && (
              <p className="text-sm text-white/70 mt-2 leading-relaxed">{deal.description}</p>
            )}
          </div>
        </div>

        {/* Card body */}
        <div className="bg-white px-6 py-5 space-y-4">
          {/* Promo code box */}
          {deal.promoCode && (
            <div className="flex items-center gap-2 border border-dashed border-brand-maroon-300 bg-brand-maroon-50 rounded-lg px-4 py-3">
              <Ticket className="w-4 h-4 text-brand-maroon-400 flex-shrink-0" />
              <span className="text-sm font-mono font-semibold text-brand-maroon-700 tracking-wide">
                {deal.promoCode}
              </span>
              <PromoCodeCopyButton code={deal.promoCode} />
            </div>
          )}

          {/* Applied success toast */}
          {showApplied && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-green-600 bg-brand-green-50 rounded-lg px-3 py-2">
              <Check className="w-3.5 h-3.5" />
              <span>Applied!</span>
            </div>
          )}

          {/* Apply error message */}
          {applyError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{applyError}</p>
          )}

          {/* Validity */}
          {deal.validUntil && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>Valid until {formatValidUntil(deal.validUntil)}</span>
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex flex-col gap-2 md:flex-row">
            {deal.promoCode && (
              <button
                onClick={handleApply}
                disabled={expired || isApplied || applyVoucher.isPending}
                className={cn(
                  'flex-1 text-center text-sm font-semibold px-5 py-3 rounded-lg transition-colors active:scale-[0.98]',
                  isApplied
                    ? 'bg-brand-green-100 text-brand-green-700 cursor-default'
                    : 'bg-brand-gold-500 hover:bg-brand-gold-600 text-brand-maroon-950',
                  (expired || applyVoucher.isPending) && 'opacity-50 cursor-not-allowed',
                )}
                type="button"
              >
                {applyVoucher.isPending ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Applying...
                  </span>
                ) : isApplied ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    Applied
                  </span>
                ) : (
                  'Apply Offer'
                )}
              </button>
            )}
            <Link
              href={deal.ctaLink}
              className={cn(
                'flex-1 block text-center',
                'bg-brand-maroon-500 hover:bg-brand-maroon-600',
                'text-white text-sm font-semibold',
                'px-5 py-3 rounded-lg',
                'transition-colors active:scale-[0.98]',
              )}
            >
              {deal.ctaText || 'Book Now'}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PromoSection (Public)
// ---------------------------------------------------------------------------

const LOAD_TIMEOUT_MS = 10_000;

export default function PromoSection() {
  const { data: promotions, isLoading, isError, refetch } = usePromotions();
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading) {
      timerRef.current = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setTimedOut(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoading]);

  if (isLoading && !timedOut) {
    return <DealOfDaySkeleton />;
  }

  if (isError || timedOut) {
    return (
      <section className="px-4 py-4">
        <div className="rounded-2xl bg-white shadow-card-sm px-6 py-5 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-gray-500">Unable to load deal. Please try again.</p>
          <button
            onClick={() => {
              setTimedOut(false);
              void refetch();
            }}
            className="text-sm font-semibold text-brand-maroon-500 underline"
            type="button"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  const promosCount = promotions?.length ?? 0;
  const activePromos = (promotions ?? []).filter((p) => {
    const withStatus = p as Promotion & { active?: boolean; isActive?: boolean };
    if (withStatus.active === false) return false;
    if (withStatus.isActive === false) return false;
    if (p.validUntil && !isExpired(p.validUntil)) return true;
    return !p.validUntil;
  }).length;

  const deal = promotions ? selectDealOfDay(promotions) : null;

  if (!deal) {
    // Intentional debug log — not a console.log; fired only on the
    // empty path to aid diagnosis of S4-style regressions.
    console.debug('[deal-of-day]', {
      promosCount,
      activePromos,
      result: null,
    });

    return (
      <section className="px-4 py-4">
        <div className="rounded-2xl bg-white shadow-card-sm px-6 py-5 flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-semibold text-gray-900">No deal available today</p>
          <p className="text-xs text-gray-500">Check back tomorrow for a fresh offer.</p>
          <Link href="/offers" className="text-sm font-semibold text-brand-maroon-500 underline">
            Browse all offers
          </Link>
        </div>
      </section>
    );
  }

  return <DealCard deal={deal} />;
}
