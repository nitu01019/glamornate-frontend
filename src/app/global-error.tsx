'use client';

import * as Sentry from '@sentry/nextjs';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-brand-maroon-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-brand-maroon-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-500 text-sm mb-6">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-brand-maroon-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-maroon-600 transition-colors"
          >
            Try Again
          </button>
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces the root layout, so next/link is unavailable */}
            <a
              href="/"
              className="text-sm text-brand-maroon-500 hover:text-brand-maroon-600 font-medium transition-colors"
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
