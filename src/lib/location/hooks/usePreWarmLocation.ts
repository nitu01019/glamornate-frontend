'use client';

/**
 * usePreWarmLocation
 * ------------------
 * Opportunistically kicks the canonical GPS+geocode pipeline on the home
 * surface IF the user has already granted location permission, so by the
 * time they tap the address bar the cache already has a fresh fix.
 *
 * Three gates, all of which must hold for the bridge+geocode round-trip
 * to fire — otherwise the hook is a true no-op:
 *
 *   1. Mount-once-per-session: a module-scoped flag survives StrictMode
 *      double-mount and route re-entries.
 *   2. Permission gate: only fires when `checkLocationPermission()`
 *      resolves to `'granted'`. We never trigger an OS prompt.
 *   3. Cache-staleness gate: skip the bridge call when `readCachedLocation`
 *      returns a fix within the 60 s opportunistic-freshness window
 *      (same threshold `refreshOpportunistic` uses). On Slow 3G this is
 *      the difference between a wasted ~1–3 KB callable round-trip and a
 *      genuine no-op for users with a recent fix.
 *
 * Network-quality awareness: when `navigator.connection.saveData` is true
 * OR the effective connection type is `'slow-2g'` / `'2g'`, we skip the
 * pre-warm entirely — the user is on a metered or extremely slow link and
 * the marginal latency win of pre-warming is not worth the bandwidth tax.
 *
 * Silent failure: errors are swallowed; pre-warm is a best-effort latency
 * optimisation, not a correctness path.
 *
 * Mount inside `HomeLocationRow` (the home customer address bar). The hook
 * has zero render output — it just consumes `useCurrentLocation` and may
 * call `refresh()` once when all three gates pass.
 */

import { useEffect, useRef } from 'react';
import { checkLocationPermission } from '@/lib/location/capacitor-bridge';
import { useCurrentLocation } from '@/lib/location/hooks/useCurrentLocation';
import { readCachedLocation } from '@/lib/location/cache';

// Module-scoped flag — survives across StrictMode double-mount and across
// route re-entries within the same browser tab session.
let warmedThisSession = false;

// Skip pre-warm when the connection looks too slow to justify the
// ~1–3 KB round-trip. `navigator.connection` is a Chromium-only API and
// undefined on Safari + Firefox; we treat undefined as "good enough to
// try" since most desktop / iOS users fall into that bucket.
function isConnectionTooSlow(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;
  if (!conn) return false;
  if (conn.saveData === true) return true;
  const t = conn.effectiveType;
  return t === 'slow-2g' || t === '2g';
}

export function usePreWarmLocation(): void {
  const loc = useCurrentLocation();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || warmedThisSession) return;
    ranRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        // Gate 1 — connection quality.
        if (isConnectionTooSlow()) return;

        // Gate 2 — cache freshness. The home sheet's `refreshOpportunistic`
        // uses 60 s; matching it means the user gets the same UX whether
        // they tap immediately or wait for the pre-warm. If the cache is
        // still fresh, the bridge+callable round-trip is pure waste.
        const FRESHNESS_MS = 60_000;
        if (readCachedLocation(FRESHNESS_MS)) {
          warmedThisSession = true;
          return;
        }

        // Gate 3 — permission. Never triggers an OS prompt; this checks
        // the existing grant state only.
        const state = await checkLocationPermission();
        if (cancelled) return;
        if (state !== 'granted') return;

        warmedThisSession = true;
        await loc.refresh();
      } catch {
        // Pre-warm is best-effort — swallow errors so we never surface
        // anything to the user from this code path.
      }
    })();
    return () => {
      cancelled = true;
    };
    // `loc.refresh` is stable from the hook's perspective (useCallback with
    // a stable dep list), but we deliberately exclude it so a re-entry
    // doesn't trigger a second fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Test-only helper: reset the session-scoped guard between tests. */
export function __resetPreWarmGuardForTests(): void {
  warmedThisSession = false;
}
