'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Tag, Copy, Check, Ticket, Calendar, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePromotions } from '@/hooks/useHomeData';
import { selectDealOfDay } from '@/lib/deal-of-day';
import { useApplyVoucher } from '@/hooks/useVoucher';
import { useCartStore } from '@/store/cart';
import { Skeleton } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import type { Promotion } from '@/lib/mock-data';

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
// Promo Card Skeleton
// ---------------------------------------------------------------------------

function PromoCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-card-sm overflow-hidden">
      <Skeleton className="h-40 w-full" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy Code Button
// ---------------------------------------------------------------------------

interface CopyCodeButtonProps {
  code: string;
  /** Use 'light' on dark backgrounds, 'dark' (default) on light backgrounds. */
  variant?: 'dark' | 'light';
}

function CopyCodeButton({ code, variant = 'dark' }: CopyCodeButtonProps) {
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

  const isLight = variant === 'light';

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'ml-auto flex-shrink-0 p-1.5 rounded-md transition-colors',
        isLight ? 'hover:bg-white/20' : 'hover:bg-brand-maroon-100',
      )}
      aria-label={copied ? 'Copied' : 'Copy promo code'}
      type="button"
    >
      {copied ? (
        <Check
          className={cn('w-4 h-4', isLight ? 'text-brand-green-400' : 'text-brand-green-600')}
        />
      ) : (
        <Copy className={cn('w-4 h-4', isLight ? 'text-white/80' : 'text-brand-maroon-500')} />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Promo image mapping
// ---------------------------------------------------------------------------

const PROMO_IMAGES = [
  '/images/deals/deal-spa-day.webp',
  '/images/deals/deal-hair-color.webp',
  '/images/deals/deal-facial.webp',
];

function getPromoImage(promo: Promotion, index: number): string {
  const text = (promo.title + ' ' + promo.description).toLowerCase();
  if (text.includes('hair') || text.includes('color') || text.includes('colour')) {
    return '/images/deals/deal-hair-color.webp';
  }
  if (text.includes('facial') || text.includes('skin') || text.includes('glow')) {
    return '/images/deals/deal-facial.webp';
  }
  if (text.includes('spa') || text.includes('massage') || text.includes('relax')) {
    return '/images/deals/deal-spa-day.webp';
  }
  return PROMO_IMAGES[index % PROMO_IMAGES.length];
}

// ---------------------------------------------------------------------------
// Promo Card
// ---------------------------------------------------------------------------

function PromoCard({ promo, index }: { promo: Promotion; index: number }) {
  const badgeText = formatDiscountBadge(promo);
  const bgImage = getPromoImage(promo, index);
  const expired = isExpired(promo.validUntil);

  const appliedCode = useCartStore((s) => s.voucherCode);
  const isApplied = Boolean(promo.promoCode && appliedCode === promo.promoCode);

  const applyVoucher = useApplyVoucher();
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showApplied, setShowApplied] = useState(false);

  const handleApply = useCallback(async () => {
    if (!promo.promoCode || expired || isApplied) return;
    setApplyError(null);
    try {
      await applyVoucher.mutateAsync(promo.promoCode);
      setShowApplied(true);
      setTimeout(() => setShowApplied(false), 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to apply offer';
      setApplyError(message);
      setTimeout(() => setApplyError(null), 3000);
    }
  }, [promo.promoCode, expired, isApplied, applyVoucher]);

  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-card-sm overflow-hidden hover:shadow-card-md transition-shadow',
        expired && 'opacity-60 grayscale pointer-events-none',
      )}
    >
      {/* Image header */}
      <div className="relative h-40 flex items-end p-5">
        <Image
          src={bgImage}
          alt={promo.title}
          fill
          sizes="(max-width: 512px) 100vw, 512px"
          className="object-cover"
        />
        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />

        {/* Status badges */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {expired && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-500 text-white">
              Expired
            </span>
          )}
          {isApplied && !expired && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-green-600 text-white flex items-center gap-1">
              <Check className="w-3 h-3" />
              Applied
            </span>
          )}
          {badgeText && !expired && !isApplied && (
            <span
              className={cn(
                'text-xs font-bold px-2.5 py-1 rounded-full',
                promo.discountType === 'percentage'
                  ? 'bg-brand-green-600 text-white'
                  : 'bg-brand-gold-500 text-brand-maroon-950',
              )}
            >
              {badgeText}
            </span>
          )}
        </div>

        {/* Title overlay on image */}
        <h3 className="relative z-10 text-lg font-bold text-white leading-tight drop-shadow-sm">
          {promo.title}
        </h3>
      </div>

      {/* Card body */}
      <div className="p-5 space-y-3">
        {/* Subtitle */}
        <p className="text-sm font-semibold text-gray-800">{promo.subtitle}</p>

        {/* Description */}
        <p className="text-sm text-gray-600 leading-relaxed">{promo.description}</p>

        {/* Validity */}
        {promo.validUntil && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Valid until {formatValidUntil(promo.validUntil)}</span>
          </div>
        )}

        {/* Promo code box */}
        {promo.promoCode && (
          <div className="flex items-center gap-2 border border-dashed border-brand-maroon-300 bg-brand-maroon-50 rounded-lg px-3 py-2">
            <Ticket className="w-4 h-4 text-brand-maroon-400 flex-shrink-0" />
            <span className="text-sm font-mono font-semibold text-brand-maroon-700 tracking-wide">
              {promo.promoCode}
            </span>
            <CopyCodeButton code={promo.promoCode} />
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

        {/* CTA buttons */}
        <div className="flex flex-col gap-2 md:flex-row">
          {promo.promoCode && (
            <button
              onClick={handleApply}
              disabled={expired || isApplied || applyVoucher.isPending}
              className={cn(
                'flex-1 text-center text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors active:scale-[0.98]',
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
            href={promo.ctaLink}
            className="flex-1 block text-center bg-brand-maroon-500 hover:bg-brand-maroon-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors active:scale-[0.98]"
          >
            {promo.ctaText || 'Book Now'}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deal of the Day Highlight (Offers Page)
// ---------------------------------------------------------------------------

function DealOfDayHighlight({ promotions }: { promotions: ReadonlyArray<Promotion> }) {
  const deal = selectDealOfDay(promotions);
  const appliedCode = useCartStore((s) => s.voucherCode);
  const applyVoucher = useApplyVoucher();
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showApplied, setShowApplied] = useState(false);

  if (!deal) return null;

  const badgeText = formatDiscountBadge(deal);
  const bgImage = getPromoImage(deal, 0);
  const expired = isExpired(deal.validUntil);
  const isApplied = Boolean(deal.promoCode && appliedCode === deal.promoCode);

  const handleApply = async () => {
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
  };

  return (
    <div className="mb-6">
      <div
        className={cn(
          'relative rounded-2xl overflow-hidden shadow-card-md',
          expired && 'opacity-60 grayscale',
        )}
      >
        <Image
          src={bgImage}
          alt={deal.title}
          fill
          sizes="(max-width: 512px) 100vw, 512px"
          className="object-cover"
        />
        {/* Dark gradient overlay for text readability */}
        <div className="relative bg-gradient-to-t from-black/80 via-black/50 to-black/30">
          <div className="p-6">
            {/* Label row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-gold-300" />
                <span className="text-xs font-semibold text-brand-gold-300 uppercase tracking-wider">
                  Deal of the Day
                </span>
              </div>
              <div className="flex items-center gap-2">
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
            </div>

            {/* Title and subtitle */}
            <h3 className="text-lg font-bold text-white leading-tight mb-1">{deal.title}</h3>
            <p className="text-sm text-white/80 mb-3">{deal.subtitle}</p>

            {/* Description */}
            {deal.description && (
              <p className="text-sm text-white/70 leading-relaxed mb-4">{deal.description}</p>
            )}

            {/* Promo code */}
            {deal.promoCode && (
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-sm rounded-lg px-4 py-2.5 mb-4">
                <Ticket className="w-4 h-4 text-brand-gold-300 flex-shrink-0" />
                <span className="text-sm font-mono font-semibold text-white tracking-wide">
                  {deal.promoCode}
                </span>
                <CopyCodeButton code={deal.promoCode} variant="light" />
              </div>
            )}

            {/* Applied success toast */}
            {showApplied && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-green-300 bg-brand-green-900/30 rounded-lg px-3 py-2 mb-4">
                <Check className="w-3.5 h-3.5" />
                <span>Applied!</span>
              </div>
            )}

            {/* Apply error message */}
            {applyError && (
              <p className="text-xs text-red-300 bg-red-900/30 rounded-lg px-3 py-2 mb-4">
                {applyError}
              </p>
            )}

            {/* Validity */}
            {deal.validUntil && (
              <div className="flex items-center gap-1.5 text-xs text-white/60 mb-4">
                <Calendar className="w-3.5 h-3.5" />
                <span>Valid until {formatValidUntil(deal.validUntil)}</span>
              </div>
            )}

            {/* CTA row */}
            <div className="flex flex-col gap-2 md:flex-row">
              {deal.promoCode && (
                <button
                  onClick={handleApply}
                  disabled={expired || isApplied || applyVoucher.isPending}
                  className={cn(
                    'flex-1 text-center text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors active:scale-[0.98]',
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
                  'flex-1 text-center',
                  'bg-white hover:bg-brand-gold-50',
                  'text-brand-maroon-600 text-sm font-semibold',
                  'px-6 py-2.5 rounded-lg',
                  'transition-colors active:scale-[0.98]',
                )}
              >
                {deal.ctaText || 'Book Now'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyOffers() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-maroon-50 mb-5">
        <Tag className="w-8 h-8 text-brand-maroon-300" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">No active offers right now</h3>
      <p className="text-sm text-gray-500 max-w-xs">
        Check back soon for exciting deals on premium spa services.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OffersPage() {
  const { data: promotions, isLoading, error, refetch } = usePromotions();

  return (
    <div className="min-h-screen bg-section-bg pb-16">
      {/* Header */}
      <div className="bg-white px-4 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Tag className="w-5 h-5 text-brand-maroon-500" />
          <h1 className="text-2xl font-semibold text-gray-900">All Offers &amp; Deals</h1>
        </div>
        <p className="text-sm text-gray-500">Exclusive deals on premium spa services</p>
      </div>

      {/* Content */}
      <div className="px-4 py-5">
        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <PromoCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <ErrorState
            title="Unable to Load Offers"
            message="Please check your connection and try again."
            showRetry
            onRetry={() => refetch()}
            variant="card"
          />
        )}

        {/* Promotions grid */}
        {!isLoading && !error && promotions && (
          <>
            {promotions.length > 0 ? (
              <>
                {/* Deal of the Day highlight */}
                <DealOfDayHighlight promotions={promotions} />

                {/* All promotions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {promotions.map((promo, index) => (
                    <PromoCard key={promo.id} promo={promo} index={index} />
                  ))}
                </div>
              </>
            ) : (
              <EmptyOffers />
            )}
          </>
        )}
      </div>

      {/* Bottom spacing */}
      <div className="h-4" />
    </div>
  );
}
