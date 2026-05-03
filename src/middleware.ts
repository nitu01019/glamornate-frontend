import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected API route prefixes that require authentication
const protectedRoutes = ['/admin', '/customer', '/spa'];

/**
 * Generate a cryptographically random per-request nonce (base64).
 *
 * `crypto.randomUUID()` is available on both Node and Edge runtimes. We base64
 * the bytes to keep the nonce token URL/header safe.
 */
function generateNonce(): string {
  const uuid = crypto.randomUUID();
  if (typeof btoa === 'function') {
    return btoa(uuid);
  }
  // Node fallback — Edge runtime always has `btoa`, but include this for
  // belt-and-braces when middleware runs on the Node runtime.
  return Buffer.from(uuid).toString('base64');
}

/**
 * Build the full Content-Security-Policy header string for a given nonce.
 *
 * Exported for test coverage — see `__tests__/middleware-csp.test.ts` which
 * asserts the policy contains zero references to Stripe domains after the
 * v3.1 Stripe removal.
 */
export function buildCsp(nonce: string, isDev: boolean = false): string {
  // Dev HMR requires eval + inline. Production uses nonce + strict-dynamic.
  // reCAPTCHA v3 (Firebase App Check on web) requires explicit allowlist of:
  //   - https://www.google.com   — recaptcha/api.js loader
  //   - https://www.gstatic.com  — recaptcha/releases/<hash>/recaptcha__en.js
  // strict-dynamic in prod technically lets a nonced loader pull dependents,
  // but the explicit hosts are kept for browsers that don't honour
  // strict-dynamic and for the dev directive (no strict-dynamic in dev).
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://apis.google.com https://accounts.google.com https://www.google.com https://www.gstatic.com`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com https://apis.google.com https://accounts.google.com https://www.google.com https://www.gstatic.com`;

  // All external domains the app connects to:
  // - *.firebaseio.com          Realtime Database / Firestore
  // - *.googleapis.com          Firestore REST, Google APIs, identity toolkit
  // - *.firebasestorage.app     Firebase Storage
  // - *.cloudfunctions.net      Firebase Cloud Functions (httpsCallable)
  // - accounts.google.com       Google OAuth
  // - securetoken.googleapis.com Firebase Auth token refresh
  // - identitytoolkit.googleapis.com Firebase Auth REST
  // - nominatim.openstreetmap.org Reverse geocoding
  const externalConnectDomains = [
    'https://*.firebaseio.com',
    'https://*.googleapis.com',
    'https://*.firebasestorage.app',
    'https://*.cloudfunctions.net',
    'https://accounts.google.com',
    'https://securetoken.googleapis.com',
    'https://identitytoolkit.googleapis.com',
    'https://nominatim.openstreetmap.org',
  ].join(' ');
  const connectSrc = isDev
    ? `connect-src 'self' ws://localhost:* wss://localhost:* ${externalConnectDomains}`
    : `connect-src 'self' ${externalConnectDomains}`;

  // S5: Narrow `img-src` to an explicit allowlist instead of the catch-all
  // `https:`. Hosts here mirror `next.config.mjs > images.remotePatterns`
  // plus the placeholder/avatar/social CDNs that components actually load.
  // Keep `data:` (inline SVG icons + base64 placeholders) and `blob:`
  // (image-cropper preview, etc.).
  const imgSrcDomains = [
    'https://firebasestorage.googleapis.com',
    'https://lh3.googleusercontent.com',
    'https://*.googleusercontent.com',
    'https://res.cloudinary.com',
    'https://images.unsplash.com',
    'https://ui-avatars.com',
  ].join(' ');
  const imgSrc = `img-src 'self' data: blob: ${imgSrcDomains}`;

  // frame-src hosts:
  //   - accounts.google.com   Google OAuth iframe
  //   - *.firebaseapp.com     Firebase Auth handler iframe (signInWithPopup)
  //   - www.google.com        reCAPTCHA v3 invisible iframe (App Check)
  return `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; font-src 'self' https://fonts.gstatic.com; ${imgSrc}; ${connectSrc}; frame-src https://accounts.google.com https://*.firebaseapp.com https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self';`
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect API routes only - page auth is handled client-side by ProtectedRoute
  if (pathname.startsWith('/api/')) {
    const isProtectedApi = protectedRoutes.some((route) => pathname.startsWith(`/api${route}`));

    if (isProtectedApi) {
      // NOTE: This check only verifies the *presence* of an auth token, not its
      // validity. Next.js middleware runs on the Edge Runtime, which cannot use
      // firebase-admin to verify tokens. Full token verification happens
      // server-side in api-auth.ts on each API route handler. This shallow check
      // is an early-reject optimization for unauthenticated requests to avoid
      // unnecessary API handler invocations.
      const authToken =
        request.headers.get('authorization') || request.cookies.get('__session')?.value;

      if (!authToken) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Nonce-based CSP (S5)
  // -----------------------------------------------------------------------
  // Next.js automatically propagates the `x-nonce` request header to its own
  // framework scripts and to `<Script>` tags rendered in Server Components.
  // See:
  //   https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
  //
  // `'strict-dynamic'` delegates trust from the nonce'd bootstrap script to
  // any script it loads (e.g. Stripe.js, GTM), so the allow-list domains are
  // kept as a safety net for browsers that do not support `strict-dynamic`.
  //
  // `style-src` retains `'unsafe-inline'` because Tailwind / CSS-in-JS
  // libraries still inject inline styles. A separate audit can migrate
  // styles to nonces once Tailwind v4's style layering lands.
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV === 'development';
  const csp = buildCsp(nonce, isDev);

  // Forward the nonce on request headers so Server Components can read it
  // via `headers()` and pass it into `<Script nonce={...}>`.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(self)',
  );
  // Cross-Origin-Opener-Policy: same-origin-allow-popups
  //
  // Required for Firebase signInWithPopup (Google OAuth) to function on
  // Chrome 109+ and other modern browsers. Chrome's DEFAULT cross-origin
  // policy blocks the opener's `window.closed` check on popups, which is
  // exactly how the Firebase Auth SDK detects when the OAuth popup has
  // completed or been dismissed. Without this header, Chrome surfaces:
  //   "Cross-Origin-Opener-Policy policy would block the window.closed call"
  // and the popup eventually times out / falls back to signInWithRedirect.
  //
  // The `allow-popups` token preserves the opener relationship for popups
  // we ourselves open (the Google OAuth window), while the rest of the page
  // remains isolated under same-origin rules — which is the security
  // posture browser vendors converged on for OAuth flows.
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/webpack-hmr (dev HMR WebSocket / SSE — must NOT pass through CSP nonce gen)
     * - __nextjs_original-stack-frame (dev source-map endpoint for the error overlay)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|_next/webpack-hmr|__nextjs_original-stack-frame|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
