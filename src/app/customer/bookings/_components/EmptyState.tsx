'use client';

/**
 * Patch DR-6 (Booking Flow Fix v3.1, 2026-05-02): centralised (tab × state)
 * matrix for the bookings list. Loading is omitted — caller renders its own
 * skeleton in the !authResolved branch.
 */
import Link from 'next/link';
import { CalendarX, Sparkles } from 'lucide-react';
import {
  EMPTY_UPCOMING,
  EMPTY_UPCOMING_SUB,
  EMPTY_PAST,
  EMPTY_PAST_SUB,
  EMPTY_CANCELLED,
  EMPTY_CANCELLED_SUB,
  APP_CHECK_HELP_TITLE,
  APP_CHECK_HELP_BODY,
  APP_CHECK_HELP_CTA,
  LINK_ACCOUNTS_TITLE,
  LINK_ACCOUNTS_BODY,
  LINK_ACCOUNTS_CTA,
  SUBMIT_GENERIC_ERROR,
  SUBMIT_RETRY,
} from '@/lib/booking/copy';

export type BookingsTab = 'upcoming' | 'past' | 'cancelled';
export type BookingsEmptyState = 'empty_ok' | 'empty_unlinked' | 'error_app_check' | 'error_other';

export interface EmptyStateProps {
  tab: BookingsTab;
  state: BookingsEmptyState;
  onRetry?: () => void;
}

const EMPTY_COPY: Record<BookingsTab, { title: string; sub: string }> = {
  upcoming: { title: EMPTY_UPCOMING, sub: EMPTY_UPCOMING_SUB },
  past: { title: EMPTY_PAST, sub: EMPTY_PAST_SUB },
  cancelled: { title: EMPTY_CANCELLED, sub: EMPTY_CANCELLED_SUB },
};

function UnlinkedBanner() {
  return (
    <div className="rounded-2xl border border-sky-200/70 bg-sky-50/80 p-5 shadow-[0_2px_12px_rgba(2,132,199,0.08)]">
      <h3 className="text-[15px] font-semibold tracking-tight text-sky-900">
        {LINK_ACCOUNTS_TITLE}
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-sky-800/90">{LINK_ACCOUNTS_BODY}</p>
      <Link
        href="/customer/account/link"
        className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-sky-900 px-4 text-[13px] font-medium text-white transition-colors hover:bg-sky-800"
      >
        {LINK_ACCOUNTS_CTA}
      </Link>
    </div>
  );
}

function EmptyOk({ tab }: { tab: BookingsTab }) {
  const { title, sub } = EMPTY_COPY[tab];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-maroon-100/60 bg-white p-8 text-center shadow-[0_2px_12px_rgba(136,14,79,0.04)]">
      {/* Decorative spark — subtle, contextual, not generic */}
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-maroon-50 via-brand-blush/60 to-brand-gold-50 ring-1 ring-inset ring-brand-maroon-200/60">
        <Sparkles className="h-5 w-5 text-brand-maroon-500" aria-hidden />
      </div>
      <p className="font-serif text-lg font-medium tracking-tight text-stone-900">{title}</p>
      <p className="mt-1 text-[13px] italic leading-snug text-stone-500">{sub}</p>
      {tab === 'upcoming' && (
        // 2026-05-13: single-salon app — CTA goes straight to the category
        // list (`/services`) instead of the marketplace `/spas` route.
        <Link
          href="/services"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-brand-maroon-600 px-6 text-[14px] font-medium text-white shadow-[0_4px_14px_rgba(136,14,79,0.25)] transition-all hover:bg-brand-maroon-700 active:scale-[0.98]"
        >
          Book a service
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ tab, state, onRetry }: EmptyStateProps) {
  if (state === 'error_app_check') {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-5 shadow-[0_2px_12px_rgba(180,83,9,0.06)]"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 ring-1 ring-inset ring-amber-200">
            <CalendarX className="h-4.5 w-4.5 text-amber-700" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-amber-900">
              {APP_CHECK_HELP_TITLE}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-amber-800/90">
              {APP_CHECK_HELP_BODY}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2.5">
          <Link
            href="/help#app-check"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-amber-900 px-4 text-[13px] font-medium text-white transition-colors hover:bg-amber-800"
          >
            {APP_CHECK_HELP_CTA}
          </Link>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 text-[13px] font-medium text-amber-900 transition-colors hover:bg-amber-50"
            >
              {SUBMIT_RETRY}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (state === 'error_other') {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-200/70 bg-rose-50/80 p-5 shadow-[0_2px_12px_rgba(190,18,60,0.06)]"
      >
        <h3 className="text-[15px] font-semibold tracking-tight text-rose-900">
          {SUBMIT_GENERIC_ERROR}
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-rose-800/90">
          We couldn&apos;t load your bookings just now.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-rose-900 px-4 text-[13px] font-medium text-white transition-colors hover:bg-rose-800"
          >
            {SUBMIT_RETRY}
          </button>
        )}
      </div>
    );
  }

  if (state === 'empty_unlinked') {
    return (
      <div className="space-y-4">
        <UnlinkedBanner />
        <EmptyOk tab={tab} />
      </div>
    );
  }

  return <EmptyOk tab={tab} />;
}
