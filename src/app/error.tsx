'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { logger } from '@/lib/logger';

const errorLogger = logger.child({ component: 'ErrorBoundary' });

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to structured logger — this gets written to logs/app.ndjson
    errorLogger.error('Uncaught render error', error, {
      digest: error.digest,
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
    });
  }, [error]);

  return (
    <ErrorState
      variant="fullPage"
      type="generic"
      title="Something went wrong"
      message={error.message || 'An unexpected error occurred. Please try again.'}
      showRetry
      onRetry={reset}
      secondaryAction={{
        label: 'Go Home',
        onClick: () => {
          window.location.href = '/';
        },
        variant: 'secondary',
      }}
    />
  );
}
