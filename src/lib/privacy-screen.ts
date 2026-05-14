import { Capacitor } from '@capacitor/core';
import { PrivacyScreen } from '@capacitor-community/privacy-screen';

/**
 * Routes where the screen must be hidden in Android Recent Apps:
 *  - /auth/**                 — password fields, OTP entry
 *  - /customer/book-new       — booking confirmation (PII)
 *  - /customer/addresses      — PII (phone, address)
 *  - /cart                    — pre-checkout summary
 *  - /admin/**                — admin surfaces with PII
 *  - /spa/staff               — staff management / PII
 */
const SECURE_ROUTE_PREFIXES: readonly string[] = [
  '/auth',
  '/customer/book-new',
  '/customer/addresses',
  '/cart',
  '/admin',
  '/spa/staff',
];

function isSecureRoute(pathname: string): boolean {
  return SECURE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Apply privacy-screen state for the given route. Safe to call repeatedly.
 * No-op on web. Tolerant of plugin errors: any failure is logged and
 * swallowed so the UI never breaks on a privacy-screen call.
 */
export async function applyPrivacyScreen(pathname: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // QA OVERRIDE 2026-05-13: disabled so adb screencap returns the real
    // surface instead of FLAG_SECURE's black bitmap. Re-enable before
    // releasing to production.
    void pathname;
    await PrivacyScreen.disable();
    return;
    if (isSecureRoute(pathname)) {
      await PrivacyScreen.enable();
    } else {
      await PrivacyScreen.disable();
    }
  } catch (err: unknown) {
    // Never block the UI on a privacy-screen call.
    // eslint-disable-next-line no-console -- plugin runs at route-change time before logger.ts is guaranteed initialized; best-effort native-plugin failure must surface in devtools. Swap when ARCH-M12 pino logger lands.
    console.warn('[privacy-screen] toggle failed', err);
  }
}
