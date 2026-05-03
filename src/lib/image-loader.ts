/**
 * Mobile (Capacitor static export) image loader.
 *
 * Next.js `output: 'export'` disables server-side image optimization, and
 * the default loader would still append a cache-busting query string that
 * prevents Capacitor WebView from reusing the underlying file. Returning
 * the raw `src` lets the WebView disk cache serve subsequent requests.
 *
 * Wired in `next.config.js` only when `BUILD_TARGET === 'mobile'`.
 */

import type { ImageLoaderProps } from 'next/image';

export default function mobileImageLoader({ src }: ImageLoaderProps): string {
  return src;
}
