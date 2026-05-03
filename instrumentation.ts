import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NODE_ENV === 'development') return;
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Skip Sentry's request-error hook in dev. Without a DSN it's dead overhead,
// and any failure in the capture transport surfaces as an unhandled rejection
// that can take down the dev server.
export const onRequestError =
  process.env.NODE_ENV === 'development' ? undefined : Sentry.captureRequestError;
