'use client';

/**
 * Client wrapper for the backend `reverseGeocode` callable.
 *
 * This module is the single choke-point for turning `(lat, lng)` into an
 * address on the frontend. It normalizes every outcome the Phase-4 backend
 * can produce into a discriminated union so callers (useCurrentLocation,
 * LocationMapPin, location-provider) can drive UX on a simple `status` tag
 * instead of catching Firebase `HttpsError`s.
 *
 * Outcomes (from PHASE_4.md §3.3.2):
 *   - `{ status: 'ok', ... }`              — geocode succeeded.
 *   - `{ status: 'not-configured' }`       — Google Maps key not set; the
 *                                             consumer should show the
 *                                             friendly toast + expand the
 *                                             manual address form.
 *   - `{ status: 'quota' }`                — Google/rate-limit quota
 *                                             exhausted; the consumer
 *                                             should invite the user to
 *                                             enter manually or retry.
 *   - `{ status: 'no-results' }`            — valid request, zero matches.
 *   - `{ status: 'unauthenticated' }`       — caller not signed in.
 *   - `{ status: 'invalid-input' }`         — lat/lng out of range.
 *   - `{ status: 'error', message? }`       — everything else. Callers
 *                                             should show a generic error
 *                                             and let the user retry.
 *
 * IMPORTANT: this wrapper NEVER throws for the expected business outcomes
 * above. It only ever throws if the runtime itself is broken (e.g. Firebase
 * SDK blew up trying to load). Callers pick up the `{ status: 'error' }`
 * path for everything else.
 */

import { FirebaseError } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '@/lib/firebase';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'ReverseGeocodeClient' });

// ---------------------------------------------------------------------------
// Types (mirror the backend callable's response shape exactly).
// ---------------------------------------------------------------------------

export interface GeocodeComponents {
  readonly line1?: string;
  readonly city?: string;
  readonly state?: string;
  readonly pincode?: string;
  readonly country?: string;
}

export interface ReverseGeocodeOkResult {
  readonly status: 'ok';
  readonly formattedAddress: string;
  readonly components: GeocodeComponents;
  readonly placeId?: string;
  readonly cachedAt: number;
  readonly source: 'cache' | 'google';
}

export type ReverseGeocodeResult =
  | ReverseGeocodeOkResult
  | { readonly status: 'not-configured' }
  | { readonly status: 'quota' }
  | { readonly status: 'no-results' }
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'invalid-input' }
  | { readonly status: 'error'; readonly message?: string };

// ---------------------------------------------------------------------------
// Wire format — what the backend sends.
// ---------------------------------------------------------------------------

interface CallableSuccessPayload {
  formattedAddress: string;
  components: GeocodeComponents;
  placeId?: string;
  cachedAt: number;
  source: 'cache' | 'google';
}

// ---------------------------------------------------------------------------
// Callable factory (injectable for tests).
// ---------------------------------------------------------------------------

/**
 * The real callable invoker. Tests pass their own `callable` to bypass
 * Firebase entirely.
 */
export type ReverseGeocodeCallable = (payload: {
  lat: number;
  lng: number;
}) => Promise<{ data: CallableSuccessPayload }>;

function defaultCallable(): ReverseGeocodeCallable {
  const app = getFirebaseApp();
  // Keep the region in lockstep with the callable's `.region(...)` binding
  // in `backend/functions/src/callable/reverseGeocode.ts`.
  const fns = getFunctions(app, 'us-central1');
  const fn = httpsCallable<{ lat: number; lng: number }, CallableSuccessPayload>(
    fns,
    'reverseGeocode',
  );
  return async (payload) => {
    const res = await fn(payload);
    return { data: res.data };
  };
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Map a Firebase callable error onto our `ReverseGeocodeResult` union.
 *
 * Backend error contracts (PHASE_4.md §3.3.1):
 *   - `failed-precondition` + message `geocode/not-configured`     → not-configured
 *   - `failed-precondition` + message `geocode/request-denied`     → not-configured
 *     (Google rejected the key — UX treats "broken key" identically to
 *     "no key": fall back to manual entry.)
 *   - `resource-exhausted`  (message `geocode/quota` or `.../rate-limited`)
 *                                                                   → quota
 *   - `not-found`          + message `geocode/no-results`           → no-results
 *   - `unauthenticated`                                             → unauthenticated
 *   - `invalid-argument`                                            → invalid-input
 *   - anything else                                                 → error
 */
function mapFirebaseError(error: unknown): ReverseGeocodeResult {
  if (error instanceof FirebaseError) {
    // `code` will look like `functions/failed-precondition`. The message
    // carries our semantic tag.
    const code = error.code.replace(/^functions\//, '');
    const message = error.message;

    if (code === 'failed-precondition') {
      if (message === 'geocode/not-configured' || message === 'geocode/request-denied') {
        return { status: 'not-configured' };
      }
      return { status: 'error', message: 'geocode/precondition-failed' };
    }

    if (code === 'resource-exhausted') {
      return { status: 'quota' };
    }

    if (code === 'not-found' && message === 'geocode/no-results') {
      return { status: 'no-results' };
    }

    if (code === 'unauthenticated') {
      return { status: 'unauthenticated' };
    }

    if (code === 'invalid-argument') {
      return { status: 'invalid-input' };
    }

    return { status: 'error', message: `geocode/${code}` };
  }

  // Non-Firebase error (network drop, module resolution, etc.)
  return {
    status: 'error',
    message: error instanceof Error ? error.message : 'geocode/unknown',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ReverseGeocodeOptions {
  /** Override the callable invoker — used by tests. */
  readonly callable?: ReverseGeocodeCallable;
}

// ---------------------------------------------------------------------------
// In-flight dedupe
// ---------------------------------------------------------------------------
//
// Multiple consumers (HomeLocationSheet GPS row + LocationMapPin drag-end +
// pre-warm) can request the same coord cell within the same animation
// frame. Without dedupe each path hits the Firebase callable independently,
// burning quota and adding round-trips. Keying by the same 4-decimal grid
// the backend uses (cellIdForCoords) means any (lat, lng) pair that the
// server would resolve to the same cache cell shares one in-flight promise.

function cellKey(lat: number, lng: number): string {
  return `${Math.round(lat * 10000) / 10000},${Math.round(lng * 10000) / 10000}`;
}

const inFlight = new Map<string, Promise<ReverseGeocodeResult>>();

/**
 * Reverse-geocode a coordinate via the `reverseGeocode` callable.
 *
 * Always resolves; never throws for expected business outcomes. Check
 * `result.status` to drive the UI.
 *
 * In-flight requests for the same 4-decimal cell are deduped so concurrent
 * callers share a single network round-trip.
 */
export async function reverseGeocodeCoords(
  input: { lat: number; lng: number },
  options: ReverseGeocodeOptions = {},
): Promise<ReverseGeocodeResult> {
  // Lightweight client-side validation so we don't waste a round trip on
  // obviously-bad coordinates. Matches the backend Zod schema.
  if (
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng) ||
    input.lat < -90 ||
    input.lat > 90 ||
    input.lng < -180 ||
    input.lng > 180
  ) {
    return { status: 'invalid-input' };
  }

  // Tests that inject their own callable should bypass the cross-test
  // shared dedupe map; the map is process-wide and would leak state
  // between tests if we keyed test invocations into it.
  if (options.callable) {
    return runCallable(input, options.callable);
  }

  const key = cellKey(input.lat, input.lng);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      return await runCallable(input);
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}

async function runCallable(
  input: { lat: number; lng: number },
  callable?: ReverseGeocodeCallable,
): Promise<ReverseGeocodeResult> {
  let invoke: ReverseGeocodeCallable;
  try {
    invoke = callable ?? defaultCallable();
  } catch (err) {
    log.error('Could not build reverseGeocode callable', err);
    return { status: 'error', message: 'geocode/init-failed' };
  }

  try {
    const { data } = await invoke({ lat: input.lat, lng: input.lng });
    return {
      status: 'ok',
      formattedAddress: data.formattedAddress,
      components: data.components ?? {},
      ...(data.placeId ? { placeId: data.placeId } : {}),
      cachedAt: data.cachedAt,
      source: data.source,
    };
  } catch (err) {
    const mapped = mapFirebaseError(err);
    if (mapped.status === 'error') {
      log.error('reverseGeocode failed', err);
    } else {
      log.warn('reverseGeocode degraded', { status: mapped.status });
    }
    return mapped;
  }
}

/** Test-only helper: clear the in-flight dedupe map between tests. */
export function __resetReverseGeocodeInFlightForTests(): void {
  inFlight.clear();
}
