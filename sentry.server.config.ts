import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

// 2026-05-11 (Lens-D1 / T3-F1): PII scrubber — mirrors client config.
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

function scrubMessage(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED-EMAIL]');
}

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
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
