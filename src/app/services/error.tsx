'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { logger } from '@/lib/logger';

const errorLogger = logger.child({ component: 'ServicesErrorBoundary' });

export default function ServicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    errorLogger.error('Services route error', error, {
      digest: error.digest,
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
    });
  }, [error]);
  return (
    <ErrorState
      variant="fullPage"
      type="server"
      title="Could not load services"
      message={error.message || 'We had trouble loading the services. Please try again.'}
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
