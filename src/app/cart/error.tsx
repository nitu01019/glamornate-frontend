'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { logger } from '@/lib/logger';

const errorLogger = logger.child({ component: 'CartErrorBoundary' });

export default function CartError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    errorLogger.error('Cart route error', error, {
      digest: error.digest,
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
    });
  }, [error]);
  return (
    <ErrorState
      variant="fullPage"
      type="generic"
      title="Something went wrong"
      message={error.message || 'We had trouble loading this page. Please try again.'}
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
