import { Capacitor } from '@capacitor/core';
import * as Sentry from '@sentry/capacitor';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function initSentryCapacitor(): void {
  if (!Capacitor.isNativePlatform()) return;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
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
}
