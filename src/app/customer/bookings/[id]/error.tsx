'use client';

/**
 * Next.js error boundary for /customer/bookings/[id].
 * Plan §Phase 5 + 4.5 (DR-10).
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/logger';

export default function BookingDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error(
      'bookings/[id]/error.tsx caught render error',
      error,
      { component: 'bookings/[id]/error' },
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
          We couldn&apos;t load this booking. Try again in a moment, or go back to your bookings.
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
            href="/customer/bookings"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to bookings
          </Link>
        </div>
      </div>
    </div>
  );
}
