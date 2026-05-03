/**
 * /api/v1/cart/validate (DEPRECATED — alias for /api/v1/cart/preview)
 *
 * Original semantics matched preview exactly per the canonical comment in
 * preview/route.ts. This file is kept for URL stability while clients
 * (Capacitor WebView, web) migrate to /preview.
 *
 * Sunset: 2026-11-03 per RFC 8594.
 *
 * After Sunset, this route may be removed in a major release.
 */
export { POST } from '../preview/route';

import type { NextRequest } from 'next/server';

// We can't add response headers to a re-exported handler directly without
// wrapping. If sunset signaling matters at runtime, swap to the wrapper
// below — keep export shape stable for callers.
//
// export async function POST(req: NextRequest) {
//   const { POST: previewPost } = await import('../preview/route');
//   const res = await previewPost(req);
//   res.headers.set('Sunset', 'Sun, 03 Nov 2026 00:00:00 GMT');
//   res.headers.set('Deprecation', 'true');
//   res.headers.set('Link', '</api/v1/cart/preview>; rel="successor-version"');
//   return res;
// }
