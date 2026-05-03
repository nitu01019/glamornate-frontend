/**
 * Cart error → user-facing UI mapping.
 *
 * Round 5 Team C-4: rewrites the cart "proceed to book" error handling to
 * surface specific, actionable messages rather than the generic
 * "network error" text users complained about.
 *
 * This module is intentionally framework-free: it accepts an `unknown` thrown
 * value (because `apiClient` throws `ApiError`, but DOM `AbortError`, `TypeError`,
 * and random `Error` instances may also escape) and returns a normalized
 * `CartErrorState` descriptor. The caller renders the descriptor via
 * `<CartErrorBanner />`. Keeping the mapping pure makes unit testing trivial
 * and lets us evolve copy without touching the page component.
 */

import { ApiError, isApiError } from '@/lib/api-errors';

/**
 * Variant tokens map 1:1 to a visual + CTA treatment in `CartErrorBanner`.
 * The union is exhaustive — adding a new branch requires the banner to add
 * an explicit render path (TypeScript `switch` exhaustiveness).
 */
export type CartErrorVariant =
  | 'auth-required' // 401
  | 'items-unavailable' // 400
  | 'address-required' // 403
  | 'rate-limited' // 429
  | 'connection-issue' // 5xx / network / timeout
  | 'unknown'; // default

export interface CartErrorCta {
  label: string;
  /** If set, the banner renders a `<Link>`. */
  href?: string;
  /** If set, the banner renders a `<button>` that calls this. */
  action?: 'retry' | 'refresh' | 'report';
}

export interface CartErrorState {
  variant: CartErrorVariant;
  title: string;
  message: string;
  /** Primary CTA shown in the banner. */
  primaryCta: CartErrorCta | null;
  /** Optional secondary CTA (e.g. "Report" paired with "Retry"). */
  secondaryCta: CartErrorCta | null;
  /**
   * When set, the caller should disable retry for this many ms (429 cooldown).
   * The banner ignores this — it is surfaced so the page can enforce it.
   */
  cooldownMs?: number;
  /** HTTP status from the originating `ApiError`, when available. */
  status?: number;
  /** Request id for support tickets, when available. */
  requestId?: string;
}

const RATE_LIMIT_COOLDOWN_MS = 10_000;

/**
 * Return `true` when the error looks like a transport-level failure rather
 * than an HTTP-level failure. Covers:
 *   - `ApiError` with `status === 0` (fetch threw)
 *   - `ApiTimeoutError` (code === 'timeout')
 *   - raw `TypeError` from fetch ("Failed to fetch" on Capacitor / offline)
 *   - `DOMException` with `AbortError` when not user-initiated
 */
function isNetworkOrTimeout(error: unknown): boolean {
  if (isApiError(error)) {
    if (error.status === 0) return true;
    if (error.code === 'network-error') return true;
    if (error.code === 'timeout') return true;
    if (error.isTimeout) return true;
  }
  if (error instanceof TypeError && /fetch/i.test(error.message)) return true;
  if (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  ) {
    // Only treat as network when it wasn't a user-cancel — we can't reliably
    // distinguish here, but callers that abort intentionally shouldn't call
    // into this mapper.
    return true;
  }
  return false;
}

/**
 * Map a caught error from the cart-preview request to a banner-ready
 * descriptor. Exhaustive over the HTTP branches the backend defines.
 *
 * @param error Whatever was caught — `ApiError`, raw `Error`, or `unknown`.
 * @param nextPath Where the user wanted to go; used to build the sign-in
 *   return URL so that after login they land back on /cart (or wherever).
 */
export function mapCartError(error: unknown, nextPath = '/cart'): CartErrorState {
  // 1) Transport-level first — misclassifying a network outage as a 5xx
  //    would send users down the wrong remediation path.
  if (isNetworkOrTimeout(error)) {
    return {
      variant: 'connection-issue',
      title: 'Connection issue',
      message: "We couldn't reach our servers. Please try again.",
      primaryCta: { label: 'Retry', action: 'retry' },
      secondaryCta: null,
      status: isApiError(error) ? error.status : undefined,
      requestId: isApiError(error) ? error.requestId : undefined,
    };
  }

  if (!isApiError(error)) {
    return unknownError(error);
  }

  const { status, requestId } = error;

  if (status === 401) {
    return {
      variant: 'auth-required',
      title: 'Please sign in to book',
      message: 'Your session has expired. Sign in to finish booking your cart.',
      primaryCta: {
        label: 'Sign in',
        href: `/auth/login?next=${encodeURIComponent(nextPath)}`,
      },
      secondaryCta: null,
      status,
      requestId,
    };
  }

  if (status === 403) {
    return {
      variant: 'address-required',
      title: 'Add a saved address',
      message: 'This action requires a saved service address.',
      primaryCta: { label: 'Add address', href: '/customer/addresses?new=1' },
      secondaryCta: null,
      status,
      requestId,
    };
  }

  if (status === 400) {
    return {
      variant: 'items-unavailable',
      title: 'Some items are no longer available',
      message: 'Please refresh your cart to see current prices and availability.',
      primaryCta: { label: 'Refresh cart', action: 'refresh' },
      secondaryCta: null,
      status,
      requestId,
    };
  }

  if (status === 429) {
    return {
      variant: 'rate-limited',
      title: 'Too many requests',
      message: 'Please wait a moment and try again.',
      primaryCta: null,
      secondaryCta: null,
      cooldownMs: RATE_LIMIT_COOLDOWN_MS,
      status,
      requestId,
    };
  }

  if (status >= 500 && status < 600) {
    return {
      variant: 'connection-issue',
      title: 'Connection issue',
      message: 'Something went wrong on our end. Please try again.',
      primaryCta: { label: 'Retry', action: 'retry' },
      secondaryCta: null,
      status,
      requestId,
    };
  }

  return unknownError(error);
}

function unknownError(error: unknown): CartErrorState {
  const status = isApiError(error) ? error.status : undefined;
  const requestId = isApiError(error) ? error.requestId : undefined;
  return {
    variant: 'unknown',
    title: 'Something went wrong',
    message: 'Please try again. If the issue continues, tap Report and we will look into it.',
    primaryCta: { label: 'Retry', action: 'retry' },
    secondaryCta: { label: 'Report', action: 'report' },
    status,
    requestId,
  };
}

/**
 * Dev-only helper used by the banner's "Report" CTA. Centralised so we can
 * swap in a real telemetry sink later without touching callers.
 */
export function reportCartError(state: CartErrorState, error: unknown): void {
  // eslint-disable-next-line no-console -- dev-only diagnostic for the banner "Report" CTA; swap to logger when Sentry transport lands (ARCH-M12 / D1 DSN)
  console.error('[cart] user reported error', {
    variant: state.variant,
    status: state.status,
    requestId: state.requestId,
    error: error instanceof Error ? { name: error.name, message: error.message } : error,
  });
}

/** Exposed for tests. */
export const __testing = {
  RATE_LIMIT_COOLDOWN_MS,
  isNetworkOrTimeout,
};

/**
 * Convenience alias — forces the `ApiError` import to resolve at module graph
 * time so any downstream consumer gets a predictable module identity.
 */
export type { ApiError };
