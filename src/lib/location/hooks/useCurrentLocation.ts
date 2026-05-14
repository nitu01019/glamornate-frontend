'use client';

/**
 * useCurrentLocation — the single canonical hook every "Use Current
 * Location" button across the customer surface should consume.
 *
 * Composition (top → bottom):
 *   - cache.ts                    instant warm paint, 5-min TTL
 *   - capacitor-bridge.ts         Capacitor Geolocation 3-step chain
 *   - reverse-geocode-client.ts   backend `reverseGeocode` callable
 *   - LocationRationaleModal      Android `prompt-with-rationale`
 *
 * On mount we synchronously read the cache; if it's < 5 min old we
 * publish `status: 'cache-hit'` and the address INSTANTLY, so consumers
 * paint useful UI before the GPS roundtrip starts. Then on tap (or
 * `autoRun: true`) we run the full chain, race it against a 12 s
 * ceiling, and never silently swallow — every failure mode maps to a
 * typed `LocationErrorCode` that the UI uses to render an actionable
 * inline pill.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isNative } from '@/lib/capacitor';
import { logger } from '@/lib/logger';
import {
  requestLocationWithRationale,
  LocationPermissionDeniedError,
} from '@/lib/location/capacitor-bridge';
import { reverseGeocodeCoords } from '@/lib/location/reverse-geocode-client';
import { readCachedLocation, writeCachedLocation, type CachedLocation } from '@/lib/location/cache';

const log = logger.child({ component: 'useCurrentLocation' });

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LocationStatus = 'idle' | 'cache-hit' | 'fetching' | 'success' | 'error';
export type LocationSource = 'cache' | 'gps' | 'manual';

export type LocationErrorCode =
  | 'permission-denied'
  | 'permission-permanent'
  | 'timeout'
  | 'service-down'
  | 'quota'
  | 'no-results'
  | 'unknown';

export interface UseCurrentLocationResult {
  readonly coords: { readonly lat: number; readonly lng: number } | null;
  readonly address: CachedLocation['address'] | null;
  readonly status: LocationStatus;
  readonly source: LocationSource | null;
  readonly error: LocationErrorCode | null;
  readonly isRationaleOpen: boolean;
  readonly acknowledgeRationale: () => void;
  readonly dismissRationale: () => void;
  readonly openSettings: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  /**
   * Cache-fast variant of `refresh`. If the cache has a fix newer than
   * `freshnessMs` (default 60 s), publishes it synchronously as
   * `status: 'success'` and kicks a background revalidation — closing the
   * sheet instantly on the very common "tapped within 60 s of a prior
   * fix" path. If cache is stale or absent, behaves identically to
   * `refresh()`.
   */
  readonly refreshOpportunistic: (freshnessMs?: number) => Promise<void>;
}

export interface UseCurrentLocationOptions {
  /** Fire `refresh()` once on mount. Default false — wait for the user tap. */
  readonly autoRun?: boolean;
  /** Hard wall-clock ceiling for the whole bridge call. Default 12 s. */
  readonly timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Race a promise against a timeout. The bridge's internal 3-step fallback
 * uses a 30 s per-step deadline, so without this ceiling a really cold
 * device could hang the UI for 90 s. 12 s matches BookingLocationStep's
 * existing budget and the Swiggy/Zomato perceived-latency target.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Location request timed out'));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

function isPermissionDeniedError(err: unknown): err is LocationPermissionDeniedError {
  return err instanceof LocationPermissionDeniedError;
}

function needsRationaleFlag(err: LocationPermissionDeniedError): boolean {
  return (
    (err as LocationPermissionDeniedError & { needsRationale?: boolean }).needsRationale === true
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCurrentLocation(opts: UseCurrentLocationOptions = {}): UseCurrentLocationResult {
  const { autoRun = false, timeoutMs = 12_000 } = opts;

  // Synchronously hydrate state from cache so the first render already
  // shows a useful address when one was captured in the last 5 minutes.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(() => {
    const c = readCachedLocation();
    return c ? { lat: c.coords.lat, lng: c.coords.lng } : null;
  });
  const [address, setAddress] = useState<CachedLocation['address'] | null>(
    () => readCachedLocation()?.address ?? null,
  );
  const [status, setStatus] = useState<LocationStatus>(() =>
    readCachedLocation() ? 'cache-hit' : 'idle',
  );
  const [source, setSource] = useState<LocationSource | null>(() =>
    readCachedLocation() ? 'cache' : null,
  );
  const [error, setError] = useState<LocationErrorCode | null>(null);
  const [isRationaleOpen, setIsRationaleOpen] = useState(false);

  /** Re-entry guard so rapid double-taps don't stack two fetches. */
  const inFlight = useRef(false);
  /** Track unmount so async resolves don't write into a dead component. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const runFetch = useCallback(async (): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus('fetching');
    setError(null);

    try {
      // ---- 1) Bridge: GPS with rationale-aware permission flow -----------
      let bridgeCoords;
      try {
        bridgeCoords = await withTimeout(
          requestLocationWithRationale({ timeout: timeoutMs }),
          timeoutMs,
        );
      } catch (err) {
        if (!mounted.current) return;

        if (isPermissionDeniedError(err)) {
          if (needsRationaleFlag(err)) {
            setIsRationaleOpen(true);
            setStatus('idle');
            return;
          }
          if (err.isPermanentlyDenied) {
            setError('permission-permanent');
            setStatus('error');
            return;
          }
          setError('permission-denied');
          setStatus('error');
          return;
        }

        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        if (msg.includes('timed out') || msg.includes('multiple attempts')) {
          setError('timeout');
        } else {
          setError('unknown');
        }
        setStatus('error');
        log.warn('location bridge failed', {
          action: 'bridge-error',
          reason: msg || 'unknown',
        });
        return;
      }

      // ---- 2) Backend reverse-geocode (Firebase Secret Manager key) ------
      const geocode = await reverseGeocodeCoords({
        lat: bridgeCoords.latitude,
        lng: bridgeCoords.longitude,
      });

      if (!mounted.current) return;

      if (geocode.status === 'ok') {
        const next: CachedLocation = {
          coords: { lat: bridgeCoords.latitude, lng: bridgeCoords.longitude },
          address: {
            formatted: geocode.formattedAddress,
            ...(geocode.components.line1 ? { line1: geocode.components.line1 } : {}),
            ...(geocode.components.city ? { city: geocode.components.city } : {}),
            ...(geocode.components.state ? { state: geocode.components.state } : {}),
            ...(geocode.components.pincode ? { pincode: geocode.components.pincode } : {}),
          },
          capturedAt: Date.now(),
        };
        writeCachedLocation(next);
        setCoords(next.coords);
        setAddress(next.address);
        setSource('gps');
        setError(null);
        setStatus('success');
        return;
      }

      // ---- 3) Map non-ok outcomes to typed error codes -------------------
      switch (geocode.status) {
        case 'not-configured':
          setError('service-down');
          break;
        case 'quota':
          setError('quota');
          break;
        case 'no-results':
          setError('no-results');
          break;
        // 'error' | 'invalid-input' | 'unauthenticated' all collapse to 'unknown'.
        default:
          setError('unknown');
          break;
      }
      setStatus('error');
      log.warn('location reverse-geocode degraded', {
        action: 'geocode-degraded',
        reason: geocode.status,
      });
    } finally {
      inFlight.current = false;
    }
  }, [timeoutMs]);

  const refresh = useCallback(async (): Promise<void> => {
    await runFetch();
  }, [runFetch]);

  const refreshOpportunistic = useCallback(
    async (freshnessMs: number = 60_000): Promise<void> => {
      const cached = readCachedLocation(freshnessMs);
      if (cached) {
        // Synchronously paint the cached result and close the loop.
        setCoords(cached.coords);
        setAddress(cached.address);
        setSource('cache');
        setError(null);
        setStatus('success');
        // Kick a background revalidation. We deliberately do NOT await
        // it — consumers see `success` immediately; if the background
        // fetch later produces a fresher result it overwrites in place.
        void runFetch();
        return;
      }
      await runFetch();
    },
    [runFetch],
  );

  const acknowledgeRationale = useCallback((): void => {
    setIsRationaleOpen(false);
    void runFetch();
  }, [runFetch]);

  const dismissRationale = useCallback((): void => {
    setIsRationaleOpen(false);
  }, []);

  const openSettings = useCallback(async (): Promise<void> => {
    if (!isNative()) return;
    try {
      const { App } = await import('@capacitor/app');
      await (App as unknown as { openUrl: (opts: { url: string }) => Promise<void> }).openUrl({
        url: 'package:com.glamornate.app',
      });
    } catch (err) {
      log.warn('open settings failed', {
        action: 'open-settings',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  // Optional auto-run on mount. Most consumers leave this false and wire it
  // to a button tap; some entry points (e.g. a "Find me near a salon"
  // landing page) may flip it on.
  useEffect(() => {
    if (!autoRun) return;
    void runFetch();
    // We deliberately exclude `runFetch` so toggling `timeoutMs` doesn't
    // trigger a second auto-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  return {
    coords,
    address,
    status,
    source,
    error,
    isRationaleOpen,
    acknowledgeRationale,
    dismissRationale,
    openSettings,
    refresh,
    refreshOpportunistic,
  };
}
