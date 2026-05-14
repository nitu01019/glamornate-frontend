import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// 2026-05-11 (Lens-D1 / T3-F1): PII scrubber for Sentry events. Mirrors
// the PII_KEYS regex from `src/lib/logger.ts:84-99`. Firebase auth errors
// can carry `error.customData.email` (cross-provider conflict) and the raw
// `error.message` sometimes includes the email being probed — without
// this, the email lands in Sentry verbatim. The scrubber walks
// `event.extra`, `event.request.data`, and the exception messages.
const PII_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'authorization',
  'cookie',
  'creditcard',
  'cardnumber',
  'cvv',
  'ssn',
  'phone',
  'email',
  'privatekey',
]);

function scrubObj(obj: unknown, depth = 0): unknown {
  if (depth > 8 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => scrubObj(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (PII_KEYS.has(key.toLowerCase().replace(/[_-]/g, ''))) {
      out[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      out[key] = scrubObj(value, depth + 1);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Redact email-shaped strings from error messages.
function scrubMessage(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED-EMAIL]');
}

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
  ignoreErrors: ['Decoding the base64 bloom filter', 'bloom filter'],
  beforeBreadcrumb(breadcrumb) {
    // Drop Firestore SDK's verbose bloom-filter and base64 logs.
    // The SDK falls back to full re-query on bloom filter decode failures (benign noise).
    if (breadcrumb.message?.startsWith('Firestore (')) {
      return null;
    }
    if (breadcrumb.data) {
      breadcrumb.data = scrubObj(breadcrumb.data) as typeof breadcrumb.data;
    }
    return breadcrumb;
  },
  beforeSend(event) {
    if (event.extra) {
      event.extra = scrubObj(event.extra) as typeof event.extra;
    }
    if (event.request?.data) {
      event.request.data = scrubObj(event.request.data) as typeof event.request.data;
    }
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map((ex) => ({
        ...ex,
        value: scrubMessage(ex.value),
      }));
    }
    if (event.message && typeof event.message === 'string') {
      event.message = scrubMessage(event.message) ?? event.message;
    }
    return event;
  },
});
