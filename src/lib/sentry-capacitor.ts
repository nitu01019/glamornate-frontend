import { Capacitor } from '@capacitor/core';
import * as Sentry from '@sentry/capacitor';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// F13 (2026-05-11): mirror the PII scrubber from sentry.client.config.ts so
// native Android/iOS Sentry events get the same redaction as web. Without
// this, native Firebase Auth errors with `.customData.email` and raw error
// messages containing the probed email were shipping unredacted to Sentry.
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
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, '');
    if (PII_KEYS.has(normalizedKey)) {
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

export function initSentryCapacitor(): void {
  if (!Capacitor.isNativePlatform()) return;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
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
}
