import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Mobile (Capacitor static export) builds skip Session Replay entirely.
// Replay adds ~150KB to the bundle and is not useful inside a WebView.
// Native crash/error reporting on mobile is handled by @sentry/capacitor.
const isMobile = process.env.BUILD_TARGET === 'mobile';

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  // privacy-first: no default session replay
  replaysSessionSampleRate: 0,
  // On web only: capture replay for 50% of error sessions.
  // On mobile: 0 to ensure the Replay integration tree-shakes from the bundle.
  replaysOnErrorSampleRate: isMobile ? 0 : 0.5,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  ignoreErrors: [
    'Decoding the base64 bloom filter',
    'bloom filter',
  ],
  beforeBreadcrumb(breadcrumb) {
    // Drop Firestore SDK's verbose bloom-filter and base64 logs.
    // The SDK falls back to full re-query on bloom filter decode failures (benign noise).
    if (breadcrumb.message?.startsWith('Firestore (')) {
      return null;
    }
    return breadcrumb;
  },
});
