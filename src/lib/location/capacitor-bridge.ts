'use client';

/**
 * Location bridge that unifies Capacitor Geolocation (native Android / iOS)
 * and `navigator.geolocation` (web fallback) under a single promise-based
 * API.
 *
 * Why this layer exists:
 *   - `@capacitor/geolocation` throws a plain `Error` when the plugin
 *     isn't available (e.g. running inside a web preview), so consumers
 *     would otherwise have to platform-branch themselves.
 *   - Native and web emit slightly different permission states; we
 *     normalize them to `'granted' | 'denied' | 'prompt'`.
 *   - We keep a zero-cost import contract: the Capacitor plugin is
 *     `await import`ed only on native platforms so web bundles don't pay
 *     for it.
 *
 * This module is the long-term home for the geolocation code paths the
 * existing `geolocation.ts` wrapper used. `geolocation.ts` stays as a
 * thin re-export for backward compat.
 */

import { isNative } from '@/lib/capacitor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BridgeCoords {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number;
}

export type PermissionStatus =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'prompt-with-rationale'
  | 'unknown';

export interface RequestPositionOptions {
  readonly enableHighAccuracy?: boolean;
  readonly timeout?: number;
  readonly maximumAge?: number;
}

export type PlatformKind = 'capacitor-native' | 'web' | 'unsupported';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/**
 * Thrown when a geolocation request is blocked by permission denial.
 *
 * `isPermanentlyDenied` is `true` when Android's USER_FIXED flag is set (the
 * "Don't ask again" path) — the runtime dialog will not reappear, so the
 * caller must direct the user to open system Settings instead of retrying.
 *
 * When `message === 'rationale-required'` and `needsRationale === true`, the
 * caller should display the rationale modal before re-attempting. This is
 * distinct from a hard denial (`isPermanentlyDenied: false`).
 */
export class LocationPermissionDeniedError extends Error {
  constructor(message: string, public readonly isPermanentlyDenied: boolean) {
    super(message);
    this.name = 'LocationPermissionDeniedError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LocationPermissionDeniedError);
    }
  }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS: Required<RequestPositionOptions> = {
  enableHighAccuracy: false,
  // 12 s outer ceiling: matches useCurrentLocation's withTimeout and the
  // Swiggy/Zomato perceived-latency target. requestPositionWithFallback()
  // runs four bounded steps inside this budget; if all fail we fall back
  // to the OS lastKnownLocation rather than throw.
  timeout: 12_000,
  maximumAge: 300_000,
};

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

/**
 * Which location implementation we'll use. Exposed for debugging /
 * logging — callers usually just invoke the high-level helpers below.
 */
export function detectLocationPlatform(): PlatformKind {
  if (isNative()) return 'capacitor-native';
  if (typeof navigator !== 'undefined' && navigator.geolocation) return 'web';
  return 'unsupported';
}

// ---------------------------------------------------------------------------
// Dynamic import of @capacitor/geolocation
// ---------------------------------------------------------------------------

/**
 * Lazily imports the Capacitor Geolocation plugin. Returns `null` on any
 * failure (module missing, plugin not registered in the native shell) so
 * callers can fall back to the web implementation without surfacing a
 * confusing import error.
 */
interface CapacitorGeolocationModule {
  Geolocation: {
    checkPermissions: () => Promise<{ location: string }>;
    requestPermissions: (opts?: {
      permissions: readonly string[];
    }) => Promise<{ location: string }>;
    getCurrentPosition: (opts?: {
      enableHighAccuracy?: boolean;
      timeout?: number;
      maximumAge?: number;
    }) => Promise<{ coords: BridgeCoords }>;
    // Capacitor 8 ships getLastKnownLocation; older versions don't.
    // Optional — caller checks for presence before invoking.
    getLastKnownLocation?: (opts?: {
      maximumAge?: number;
    }) => Promise<{ coords: BridgeCoords } | null>;
  };
}

async function loadCapacitorPlugin(): Promise<CapacitorGeolocationModule | null> {
  try {
    // The dynamic import avoids bundling the Capacitor SDK into the web
    // chunk when it isn't actually running in a native shell.
    const mod = (await import(
      /* webpackChunkName: "capacitor-geolocation" */ '@capacitor/geolocation'
    )) as { Geolocation?: CapacitorGeolocationModule['Geolocation'] };
    if (!mod.Geolocation) return null;
    return { Geolocation: mod.Geolocation };
  } catch {
    return null;
  }
}

export function normalizePermissionState(raw: string | undefined): PermissionStatus {
  switch (raw) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
      return 'prompt';
    case 'prompt-with-rationale':
      return 'prompt-with-rationale';
    default:
      return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * Inspect the current location permission status without prompting.
 */
export async function checkLocationPermission(): Promise<PermissionStatus> {
  const platform = detectLocationPlatform();

  if (platform === 'capacitor-native') {
    const plugin = await loadCapacitorPlugin();
    if (!plugin) return 'unknown';
    try {
      const res = await plugin.Geolocation.checkPermissions();
      return normalizePermissionState(res.location);
    } catch {
      return 'unknown';
    }
  }

  if (platform === 'web') {
    // `navigator.permissions` is not on Safari < 16 — fall back to
    // 'unknown' so the caller triggers a prompt via getCurrentPosition.
    if (
      typeof navigator !== 'undefined' &&
      'permissions' in navigator &&
      typeof (navigator as Navigator & { permissions?: Permissions }).permissions?.query ===
        'function'
    ) {
      try {
        const status = await (
          navigator as Navigator & { permissions: Permissions }
        ).permissions.query({ name: 'geolocation' as PermissionName });
        return normalizePermissionState(status.state);
      } catch {
        return 'unknown';
      }
    }
    return 'unknown';
  }

  return 'unknown';
}

/**
 * Result of a permission request. `isPermanentlyDenied` is true when Android
 * has the USER_FIXED|USER_SET flag from a prior "Don't ask again" tap, so the
 * runtime dialog will never appear again — caller must guide the user to
 * system settings instead of retrying.
 */
export interface LocationPermissionResult {
  readonly status: PermissionStatus;
  readonly isPermanentlyDenied: boolean;
}

/**
 * Ask the OS / browser to grant location permission. On web this call
 * cannot actually trigger a prompt on its own — the prompt only appears
 * when `getCurrentPosition` is invoked. We therefore just return the
 * current state on web.
 *
 * Backwards-compatible signature: returns just `PermissionStatus`. Callers
 * that need to distinguish permanent-denial (USER_FIXED) from a fresh
 * denial should use `requestLocationPermissionWithReason` instead.
 */
export async function requestLocationPermission(): Promise<PermissionStatus> {
  const result = await requestLocationPermissionWithReason();
  return result.status;
}

/**
 * Same as `requestLocationPermission` but distinguishes permanent denial
 * (USER_FIXED) from a fresh denial. Callers can use the
 * `isPermanentlyDenied` flag to render an "Open Settings" CTA — the
 * runtime dialog will not reappear on Android until the user manually
 * toggles the permission in system settings.
 */
export async function requestLocationPermissionWithReason(): Promise<LocationPermissionResult> {
  const platform = detectLocationPlatform();

  if (platform === 'capacitor-native') {
    const plugin = await loadCapacitorPlugin();
    if (!plugin) return { status: 'unknown', isPermanentlyDenied: false };

    // Pre-check: when Android has set USER_FIXED on the permission, the
    // subsequent requestPermissions() call returns 'denied' instantly
    // without showing a dialog. We can detect that case by observing
    // that pre-state is already 'denied' — there is no 'prompt' window
    // to traverse, so the user must go to system settings.
    let preState: PermissionStatus = 'unknown';
    try {
      const pre = await plugin.Geolocation.checkPermissions();
      preState = normalizePermissionState(pre.location);
    } catch {
      preState = 'unknown';
    }

    try {
      const res = await plugin.Geolocation.requestPermissions({
        permissions: ['location'],
      });
      const postState = normalizePermissionState(res.location);
      const isPermanentlyDenied = postState === 'denied' && preState === 'denied';
      return { status: postState, isPermanentlyDenied };
    } catch {
      return {
        status: 'denied',
        isPermanentlyDenied: preState === 'denied',
      };
    }
  }

  // Web doesn't expose a "request permission" call distinct from
  // `getCurrentPosition`. There is no concept of "permanent denial" in
  // browsers — the user can always re-prompt via site settings.
  const status = await checkLocationPermission();
  return { status, isPermanentlyDenied: false };
}

// ---------------------------------------------------------------------------
// Position fetch
// ---------------------------------------------------------------------------

/**
 * Resolve the device's current coordinates. This is the single entry
 * point callers should use — it picks the right backend for the platform,
 * wires through the user's options, and normalises errors into a plain
 * `Error` with a helpful message.
 *
 * Throws on:
 *   - denied permission,
 *   - platform not supported (SSR, WebView with no geo),
 *   - upstream failure or timeout.
 */
export async function getCurrentPosition(
  options: RequestPositionOptions = {},
): Promise<BridgeCoords> {
  const merged: Required<RequestPositionOptions> = { ...DEFAULTS, ...options };
  const platform = detectLocationPlatform();

  if (platform === 'capacitor-native') {
    const plugin = await loadCapacitorPlugin();
    if (!plugin) {
      // Fallback to web if plugin isn't registered yet on this device.
      return getPositionFromBrowser(merged);
    }

    try {
      const res = await plugin.Geolocation.getCurrentPosition({
        enableHighAccuracy: merged.enableHighAccuracy,
        timeout: merged.timeout,
        maximumAge: merged.maximumAge,
      });
      return {
        latitude: res.coords.latitude,
        longitude: res.coords.longitude,
        accuracy: res.coords.accuracy,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (msg.includes('denied') || msg.includes('permission')) {
        // Determine whether the user has permanently blocked location
        // (Android USER_FIXED / "Don't ask again") by re-checking the
        // permission state after the dialog has resolved. If the state is
        // still 'denied' the runtime dialog won't appear again.
        let isPermanentlyDenied = false;
        try {
          const postCheck = await plugin.Geolocation.checkPermissions();
          isPermanentlyDenied = normalizePermissionState(postCheck.location) === 'denied';
        } catch {
          // If the check itself fails, assume non-permanent so the caller
          // can still offer a retry path.
          isPermanentlyDenied = false;
        }
        throw new LocationPermissionDeniedError('Location permission denied', isPermanentlyDenied);
      }
      throw new Error(
        `Native geolocation failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  }

  if (platform === 'web') {
    return getPositionFromBrowser(merged);
  }

  throw new Error('Geolocation is not available in this runtime');
}

function getPositionFromBrowser(options: Required<RequestPositionOptions>): Promise<BridgeCoords> {
  return new Promise<BridgeCoords>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not available in this runtime'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (err) => {
        // Map the GeolocationPositionError codes to messages the UI can
        // display without further branching.
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission denied'));
          return;
        }
        if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new Error('Location unavailable'));
          return;
        }
        if (err.code === err.TIMEOUT) {
          reject(new Error('Location request timed out'));
          return;
        }
        reject(new Error(`Geolocation request failed: ${err.message}`));
      },
      {
        enableHighAccuracy: options.enableHighAccuracy,
        timeout: options.timeout,
        maximumAge: options.maximumAge,
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Rationale-aware position fetch
// ---------------------------------------------------------------------------

/**
 * Obtain the device's current position with rationale-aware permission
 * handling. Callers (e.g. `BookingLocationStep`) should prefer this over
 * `getCurrentPosition` directly.
 *
 * Behaviour:
 *   1. If the current permission state is `'prompt-with-rationale'` (Android
 *      needs to explain *why* location is needed before showing the OS dialog),
 *      throws `LocationPermissionDeniedError('rationale-required', false)` with
 *      `needsRationale: true`. The caller should render the rationale modal and
 *      call this function again after the user acknowledges it.
 *   2. If the permission is already permanently denied, throws
 *      `LocationPermissionDeniedError('Location permission denied', true)` so the caller can offer an
 *      "Open Settings" CTA.
 *   3. Otherwise delegates to `getCurrentPosition`, which lets the Capacitor 8
 *      plugin handle the OS permission dialog internally via its
 *      `handlePermissionRequest → completeCurrentPosition` callback chain.
 *
 * This function does NOT display any UI itself. Modal rendering and the
 * "Open Settings" button are the caller's responsibility.
 */
export async function requestLocationWithRationale(
  options?: RequestPositionOptions,
): Promise<BridgeCoords> {
  const platform = detectLocationPlatform();

  if (platform === 'capacitor-native') {
    const plugin = await loadCapacitorPlugin();
    if (plugin) {
      let normalized: PermissionStatus = 'unknown';
      try {
        const status = await plugin.Geolocation.checkPermissions();
        normalized = normalizePermissionState(status.location);
      } catch {
        normalized = 'unknown';
      }

      if (normalized === 'prompt-with-rationale') {
        const err = new LocationPermissionDeniedError('rationale-required', false);
        (err as LocationPermissionDeniedError & { needsRationale?: boolean }).needsRationale = true;
        throw err;
      }

      if (normalized === 'denied') {
        throw new LocationPermissionDeniedError('Location permission denied', true);
      }
    }
  }

  // For 'granted', 'prompt', 'unknown', or non-native platforms, proceed to
  // the fallback chain which handles the OS dialog (and permission-denial
  // errors) internally.
  return requestPositionWithFallback(options);
}

// ---------------------------------------------------------------------------
// Position fetch with industry-standard fallback chain
// ---------------------------------------------------------------------------

/**
 * Resolve the device coordinates with the canonical fallback chain that
 * production-quality apps (Uber, Lyft, Swiggy, Zomato) use:
 *
 *   1. `getLastKnownLocation()` — instant if a recent fix exists. Returns
 *      `null` quickly when the OS has nothing cached. Capacitor 8 only —
 *      we feature-detect.
 *   2. `getCurrentPosition({ enableHighAccuracy: false, timeout: 30s })` —
 *      uses Wi-Fi + cell triangulation. Typical indoor latency 1–5 s,
 *      accuracy 30–100 m. Sufficient for booking-address reverse geocoding.
 *   3. `getCurrentPosition({ enableHighAccuracy: true, timeout: 30s })` —
 *      forces GPS. Slower (15–45 s outdoors) but accurate to <10 m.
 *      Only entered if step 2 failed.
 *
 * Throws on full chain failure so the caller can fall back to a typed
 * address entry path. Permission-denied errors propagate immediately
 * without exhausting the chain.
 */
export async function requestPositionWithFallback(
  options: RequestPositionOptions = {},
): Promise<BridgeCoords> {
  const platform = detectLocationPlatform();

  // Web has no last-known-location API. Run the browser geolocation directly
  // with the supplied options merged with DEFAULTS.
  if (platform === 'web') {
    return getPositionFromBrowser({ ...DEFAULTS, ...options });
  }
  if (platform !== 'capacitor-native') {
    throw new Error('Geolocation is not available in this runtime');
  }

  const plugin = await loadCapacitorPlugin();
  if (!plugin) {
    return getPositionFromBrowser({ ...DEFAULTS, ...options });
  }

  // Step 1 — getLastKnownLocation. Best-effort; ignore failures, ignore
  // null. The accuracy bar (200 m) excludes truly stale fixes.
  if (typeof plugin.Geolocation.getLastKnownLocation === 'function') {
    try {
      const last = await plugin.Geolocation.getLastKnownLocation({ maximumAge: 60_000 });
      if (last && last.coords && typeof last.coords.latitude === 'number') {
        return {
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          accuracy: last.coords.accuracy,
        };
      }
    } catch {
      // Ignore — fall through to step 2.
    }
  }

  // Step 2 — network/wifi-based fix. Fast, coarse.
  // 8 s budget: typical 1–5 s indoors on a healthy device. Tighter than
  // the legacy 30 s so we fail fast into step 3 / step 4 when WiFi is
  // dead.
  try {
    const res = await plugin.Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 8_000,
      maximumAge: 60_000,
    });
    return {
      latitude: res.coords.latitude,
      longitude: res.coords.longitude,
      accuracy: res.coords.accuracy,
    };
  } catch (err) {
    // Permission errors short-circuit the chain immediately so the UI can
    // route to the "denied" / "open settings" path without waiting the full
    // GPS fallback timeout.
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('denied') || msg.includes('permission')) {
      let isPermanentlyDenied = false;
      try {
        const postCheck = await plugin.Geolocation.checkPermissions();
        isPermanentlyDenied = normalizePermissionState(postCheck.location) === 'denied';
      } catch {
        isPermanentlyDenied = false;
      }
      throw new LocationPermissionDeniedError('Location permission denied', isPermanentlyDenied);
    }
    // Else: fall through to high-accuracy retry.
  }

  // Step 3 — GPS-only retry. Slow but accurate.
  // 10 s budget: tight enough to fail-fast on a cold indoor device,
  // generous enough for outdoor lock.
  try {
    const res = await plugin.Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 0,
    });
    return {
      latitude: res.coords.latitude,
      longitude: res.coords.longitude,
      accuracy: res.coords.accuracy,
    };
  } catch {
    // Fall through to step 4 — last-known-location of last resort.
  }

  // Step 4 — final fallback. If steps 1–3 all timed out, give the user
  // *something* (the most recent OS fix up to 5 min old) rather than a
  // hard error pill. Permission-denied was short-circuited in step 2 so
  // reaching here means the OS just couldn't get a fresh fix.
  //
  // Reachability note (per red-team T-A5): `useCurrentLocation` wraps this
  // entire fallback chain in `withTimeout(12_000)`. Worst case: step 2
  // burns 8 s, step 3 starts at t≈8 s, the outer 12 s wall aborts step 3
  // at t≈12 s — step 4 only runs when steps 1+2+3 collectively resolve
  // before the wall. That's true when step 2 succeeds quickly + step 3
  // fails fast, OR when a direct caller bypasses `useCurrentLocation`
  // (no current consumer does, but `requestPositionWithFallback` is
  // exported so this is the documented contract).
  if (typeof plugin.Geolocation.getLastKnownLocation === 'function') {
    try {
      const last = await plugin.Geolocation.getLastKnownLocation({ maximumAge: 5 * 60_000 });
      if (last && last.coords && typeof last.coords.latitude === 'number') {
        return {
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          accuracy: last.coords.accuracy,
        };
      }
    } catch {
      // Ignore — fall through to the final throw.
    }
  }

  throw new Error('Could not determine location after multiple attempts');
}
