'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isNative } from '@/lib/capacitor';
import { useToastActions } from '@/lib/providers';

/**
 * Two-press exit window on the home route (matches typical Android app UX).
 */
const EXIT_WINDOW_MS = 2000;

/**
 * Custom event dispatched to open overlays (location picker, popups, chat,
 * cart drawer, etc.) so they can intercept the hardware back press and close
 * themselves via `event.preventDefault()` before app-level navigation fires.
 */
export const BACK_BUTTON_EVENT = 'glamornate:back-button';

/**
 * Hardware back-button handler for Android (Capacitor).
 *
 * State machine:
 *   1. Dispatches a cancelable `glamornate:back-button` CustomEvent. If any
 *      open overlay calls `preventDefault()`, we stop here and let the overlay
 *      close itself.
 *   2. If the current route is not `/`, we navigate back
 *      (`router.back()` when `canGoBack`, else fallback to `router.push('/')`).
 *   3. On `/`:
 *      - First press: show an "Press back again to exit" toast and arm a 2s
 *        window.
 *      - Second press within the window: call `App.exitApp()`.
 *      - After the window expires, the next press is treated as a first press
 *        again.
 *
 * On non-native (web) platforms this hook is a no-op so it's safe to mount
 * unconditionally.
 */
export function useAndroidBackButton(): void {
  const pathname = usePathname();
  const router = useRouter();
  const { info } = useToastActions();
  const exitArmedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isNative()) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const { App } = await import('@capacitor/app');
      const listener = await App.addListener('backButton', async (event) => {
        // 1. Give overlays a chance to intercept via preventDefault().
        const preventable = new CustomEvent(BACK_BUTTON_EVENT, { cancelable: true });
        const consumed = !window.dispatchEvent(preventable);
        if (consumed) return;

        // 2. Non-home route → normal back navigation. Patch DR-1 (Booking
        // Flow Fix v3.1, 2026-05-02): the booking surface has explicit
        // hardware-back intents that override browser history, so a user
        // who landed deep-linked on /customer/bookings/[id] does not
        // exit the app on first press. Two-tier intent:
        //   * /customer/bookings/[id]  → /customer/bookings
        //   * /customer/bookings       → /customer/dashboard
        if (pathname?.startsWith('/customer/bookings/') && pathname !== '/customer/bookings/') {
          router.push('/customer/bookings');
          return;
        }
        if (pathname === '/customer/bookings') {
          router.push('/customer/dashboard');
          return;
        }
        if (pathname !== '/') {
          if (event.canGoBack) {
            router.back();
          } else {
            router.push('/');
          }
          return;
        }

        // 3. Home route — two-press exit.
        if (exitArmedRef.current) {
          await App.exitApp();
          return;
        }

        exitArmedRef.current = true;
        info('Press back again to exit');

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          exitArmedRef.current = false;
          timeoutRef.current = null;
        }, EXIT_WINDOW_MS);
      });

      // If this effect was already torn down before the listener resolved,
      // remove it immediately so we don't leak a listener.
      if (cancelled) {
        listener.remove();
        return;
      }

      cleanup = () => {
        listener.remove();
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        exitArmedRef.current = false;
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [pathname, router, info]);
}
