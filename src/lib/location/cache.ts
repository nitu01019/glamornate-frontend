'use client';

/**
 * lastKnown location cache (Step 1 — Glamornate Location System).
 *
 * One-tap warm-cache paint: when a user has tapped "Use Current Location"
 * within the last 5 minutes, we paint the cached address *synchronously*
 * on the next tap so the form fields land in < 300 ms. The bridge + backend
 * reverse-geocode still run in parallel, but the user already sees a
 * useful result instead of a spinner.
 *
 * Storage: `localStorage` (works synchronously inside the Capacitor WebView;
 * Capacitor Preferences is async and would defeat the "instant paint"
 * promise). The key is versioned (`_v1`) so a future schema change can
 * clear the slot atomically by bumping to `_v2`.
 *
 * Privacy: we never log the coords. The shape persisted to disk is
 * deliberately minimal — `{ coords, address, capturedAt }` — and contains
 * only data the user already chose to share with the app.
 */

const STORAGE_KEY = 'glamornate_location_cache_v1';
// 15 min — reverse-geocode results are static for a given coord cell;
// matches the Swiggy/Zomato range and reduces repeated callable hits on
// quick re-entries to the home screen.
const DEFAULT_MAX_AGE_MS = 15 * 60_000;

export interface CachedLocation {
  readonly coords: { readonly lat: number; readonly lng: number };
  readonly address: {
    readonly formatted: string;
    readonly line1?: string;
    readonly city?: string;
    readonly state?: string;
    readonly pincode?: string;
  };
  readonly capturedAt: number;
}

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isCachedLocation(value: unknown): value is CachedLocation {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.capturedAt !== 'number' || !Number.isFinite(v.capturedAt)) return false;
  const coords = v.coords as Record<string, unknown> | undefined;
  if (
    !coords ||
    typeof coords.lat !== 'number' ||
    typeof coords.lng !== 'number' ||
    !Number.isFinite(coords.lat) ||
    !Number.isFinite(coords.lng)
  ) {
    return false;
  }
  // Plausibility range — per red-team T-A5 finding, a tampered localStorage
  // entry on a shared device profile could paint arbitrary "addresses" if
  // we only checked Number.isFinite. Real geocoordinates live within the
  // standard WGS84 ranges; anything outside is malformed (or hostile) and
  // must NOT hydrate the in-memory state. The bridge will fetch a fresh
  // fix instead.
  if (coords.lat < -90 || coords.lat > 90) return false;
  if (coords.lng < -180 || coords.lng > 180) return false;
  // capturedAt must be a recent past timestamp — reject far-future
  // timestamps (a tampered entry could pin "freshness" forever) and
  // pre-2020 timestamps (clearly bogus).
  const now = Date.now();
  if (v.capturedAt > now + 60_000) return false; // > 60s in the future
  if (v.capturedAt < 1577836800000) return false; // pre-2020-01-01 UTC
  const address = v.address as Record<string, unknown> | undefined;
  if (!address || typeof address.formatted !== 'string') return false;
  return true;
}

/**
 * Read the cached lastKnown location if it is still fresh.
 *
 * Returns `null` when:
 *   - we're running on the server (no localStorage),
 *   - the slot is empty or malformed,
 *   - the entry is older than `maxAgeMs` (default 5 min).
 *
 * Never throws — any parse / storage failure resolves to `null` so callers
 * can fall through to the GPS path without try/catch.
 */
export function readCachedLocation(maxAgeMs: number = DEFAULT_MAX_AGE_MS): CachedLocation | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isCachedLocation(parsed)) return null;
    const age = Date.now() - parsed.capturedAt;
    if (age < 0 || age > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Persist a fresh location to the cache slot. Silently no-ops on SSR or
 * storage failure (storage may be disabled in private-browsing /
 * locked-down WebViews).
 */
export function writeCachedLocation(value: CachedLocation): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore — best-effort cache
  }
}

/**
 * Drop the cached entry. Useful when the user signs out or revokes
 * location permission and we don't want a stale address paint on the
 * next sign-in.
 */
export function clearCachedLocation(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
