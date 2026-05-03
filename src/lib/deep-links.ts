import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Phase 3 / M1: Android App Links + iOS Universal Links handler.
 *
 * Registers a `appUrlOpen` listener with the `@capacitor/app` plugin so
 * taps on `https://glamornate.com/<path>` from outside the app are routed
 * into the in-app Next.js router instead of punting the user to the
 * browser. The manifest declares `autoVerify="true"` for the domain so
 * Android 12+ will bind the activity as the default handler after
 * verifying `https://glamornate.com/.well-known/assetlinks.json` on first
 * install.
 *
 * Call once from client boot. Safe to call multiple times — Capacitor
 * de-duplicates listeners by reference, but we no-op on web anyway.
 */
const ALLOWED_HOSTS = ['glamornate.com', 'www.glamornate.com'] as const;

type RouterLike = {
  push: (path: string) => void;
};

export function installDeepLinks(router: RouterLike): void {
  if (!Capacitor.isNativePlatform()) return;

  App.addListener('appUrlOpen', (event: { url: string }) => {
    try {
      const url = new URL(event.url);
      const isAllowedHost = ALLOWED_HOSTS.some((host) => url.hostname === host);
      if (!isAllowedHost) return;

      const target = url.pathname + url.search + url.hash;
      // Fall back to "/" for a bare https://glamornate.com/ open.
      router.push(target || '/');
    } catch {
      // Malformed URL — silently ignore; nothing safe to route.
    }
  }).catch(() => {
    // Listener registration failed — probably running inside a stripped
    // environment. Nothing actionable; swallow to avoid crashing boot.
  });
}
