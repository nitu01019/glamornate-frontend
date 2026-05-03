'use client';

/**
 * Next.js error boundary for /customer/book-new.
 *
 * Phase 5 (Booking Flow Fix v3.1, 2026-05-02): if the wizard's render
 * throws (selector typo, contracts drift, App Check token transient
 * failure surfaced through TanStack Query), Next routes to this
 * component instead of showing a blank screen. Customers get an honest
 * "something went wrong" with a Try-again button that calls `reset()`
 * and a Home link as the safe escape hatch.
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/logger';

export default function BookNewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error(
      'book-new/error.tsx caught render error',
      error,
      { component: 'book-new/error' },
      { digest: error.digest ?? null },
    );
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-gray-900">Something went wrong.</h1>
        <p className="mt-2 text-sm text-gray-600">
          The booking screen ran into an unexpected error. Try again, or head back to the
          home screen and start over.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Try again
          </button>
          <Link
            href="/customer/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
