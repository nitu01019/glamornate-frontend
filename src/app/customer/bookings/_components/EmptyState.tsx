'use client';

/**
 * Patch DR-6 (Booking Flow Fix v3.1, 2026-05-02): centralised (tab × state)
 * matrix for the bookings list. Loading is omitted — caller renders its own
 * skeleton in the !authResolved branch.
 */
import Link from 'next/link';
import {
  EMPTY_UPCOMING,
  EMPTY_PAST,
  EMPTY_CANCELLED,
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
export type BookingsEmptyState =
  | 'empty_ok'
  | 'empty_unlinked'
  | 'error_app_check'
  | 'error_other';

export interface EmptyStateProps {
  tab: BookingsTab;
  state: BookingsEmptyState;
  onRetry?: () => void;
}

const EMPTY_COPY: Record<BookingsTab, string> = {
  upcoming: EMPTY_UPCOMING,
  past: EMPTY_PAST,
  cancelled: EMPTY_CANCELLED,
};

function UnlinkedBanner() {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
      <h3 className="font-semibold text-blue-900">{LINK_ACCOUNTS_TITLE}</h3>
      <p className="mt-2 text-sm text-blue-800">{LINK_ACCOUNTS_BODY}</p>
      <Link
        href="/customer/account/link"
        className="mt-3 inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
      >
        {LINK_ACCOUNTS_CTA}
      </Link>
    </div>
  );
}

function EmptyOk({ tab }: { tab: BookingsTab }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <p className="text-base font-medium text-gray-700">{EMPTY_COPY[tab]}</p>
      {tab === 'upcoming' && (
        <Link
          href="/spas"
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand-maroon-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-maroon-600"
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
        className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
      >
        <h3 className="font-semibold text-amber-900">{APP_CHECK_HELP_TITLE}</h3>
        <p className="mt-2 text-sm text-amber-800">{APP_CHECK_HELP_BODY}</p>
        <div className="mt-3 flex gap-2">
          <Link
            href="/help#app-check"
            className="inline-flex items-center justify-center rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
          >
            {APP_CHECK_HELP_CTA}
          </Link>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900"
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
        className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm"
      >
        <h3 className="font-semibold text-red-900">{SUBMIT_GENERIC_ERROR}</h3>
        <p className="mt-2 text-sm text-red-800">Failed to load bookings.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center justify-center rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
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
