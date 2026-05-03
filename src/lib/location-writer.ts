'use client';

/**
 * Single-writer reconciler for the active user location.
 *
 * Round 5 introduces a Firestore-backed "default saved address" as the
 * canonical source of truth for where the user is. The legacy
 * `location-provider.tsx` still drives most downstream `useLocation()`
 * consumers (book-new, spas-by-city, etc.), so whenever the Home location
 * sheet resolves a new selection we MUST update both stores atomically
 * from exactly one call site.
 *
 * This module exports that call site: `setActiveLocation`.
 *
 * Design notes (autoplan T3 / F5):
 * - Writes are layered so the Firestore update always lands before the
 *   in-memory `location-provider` update; on any failure in the second
 *   step we roll back the Firestore write so the two stores never diverge.
 * - The legacy `glamornate_user_location` localStorage key is cleared the
 *   first time a real selection lands — after that, the Firestore default
 *   wins cleanly on next app start and the legacy value can never leak
 *   back into the picker.
 * - Manual city and GPS selections do not persist as addresses; they only
 *   drive the `location-provider` cache.
 */

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase-client';
import { getFirebaseAuth } from '@/lib/firebase-client';
import type { SavedAddress } from '@/types';
import type { UserLocation } from '@/lib/location-provider';
import { requestCoords } from '@/lib/geolocation';
import { reverseGeocodeCoords } from '@/lib/location/reverse-geocode-client';

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export type LocationWriteInput =
  | {
      readonly kind: 'saved-address';
      readonly addressId: string;
    }
  | {
      readonly kind: 'gps';
      readonly coords: {
        readonly latitude: number;
        readonly longitude: number;
        readonly accuracy?: number;
      };
    }
  | {
      readonly kind: 'manual-city';
      readonly city: string;
      readonly area?: string;
      readonly pincode?: string;
    };

export type LocationWriteErrorCode =
  | 'not-authenticated'
  | 'address-not-found'
  | 'firestore-write-failed'
  | 'provider-write-failed'
  | 'geocode-failed'
  | 'geocode-not-configured'
  | 'geocode-quota'
  | 'unknown';

/**
 * Discriminated return value from `setActiveLocationFromGps`. Using a
 * status tag (rather than exceptions) lets callers drive UX branches —
 * "show manual-entry toast" vs "show quota toast" vs "real error" —
 * without inspecting error codes.
 */
export type SetActiveLocationFromGpsResult =
  | { readonly status: 'ok' }
  | { readonly status: 'not-configured' }
  | { readonly status: 'quota' }
  | { readonly status: 'error'; readonly code: LocationWriteErrorCode; readonly message: string };

export class LocationWriteError extends Error {
  readonly code: LocationWriteErrorCode;
  readonly cause: unknown;

  constructor(code: LocationWriteErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'LocationWriteError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * The in-memory slice of the `location-provider` contract we need to write
 * to. Consumers inject the live `setLocation` (and optional `detectLocation`)
 * from `useLocation()`; this keeps `setActiveLocation` a pure async function
 * decoupled from React.
 */
export interface LocationProviderWriteSurface {
  readonly setLocation: (location: UserLocation) => void;
}

export interface SetActiveLocationOptions {
  /** Live handle to the legacy location-provider store. REQUIRED. */
  readonly provider: LocationProviderWriteSurface;
  /**
   * Optional reverse-geocode override used by tests. Defaults to the
   * built-in Nominatim lookup copied from `location-provider.tsx`.
   */
  readonly reverseGeocode?: (
    lat: number,
    lng: number,
  ) => Promise<{ city: string; area: string; fullAddress: string }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Legacy localStorage key used by `location-provider.tsx`. We clear this
 * once a real selection lands so stale city picks can never outrank the
 * Firestore default on the next mount.
 */
const LEGACY_LOCATION_STORAGE_KEY = 'glamornate_user_location';

const REVERSE_GEOCODE_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearLegacyLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_LOCATION_STORAGE_KEY);
  } catch {
    // Silently ignore — storage may be disabled in private mode / WebViews.
  }
}

function mapAddressToUserLocation(addr: SavedAddress): UserLocation {
  const area = addr.landmark?.trim() || addr.street?.trim() || addr.city;
  const fullAddress = [addr.flatHouse, addr.street, addr.landmark, addr.city, addr.pincode]
    .map((segment) => segment?.trim())
    .filter((segment): segment is string => Boolean(segment && segment.length > 0))
    .join(', ');

  return {
    // SavedAddress has no lat/lng today — downstream callers that need
    // radius queries must re-geocode. Using 0/0 is obviously sentinel.
    lat: 0,
    lng: 0,
    city: addr.city,
    area,
    fullAddress: fullAddress || `${addr.city}${addr.pincode ? `, ${addr.pincode}` : ''}`,
  };
}

async function defaultReverseGeocode(
  lat: number,
  lng: number,
): Promise<{ city: string; area: string; fullAddress: string }> {
  if (typeof fetch === 'undefined') {
    return {
      city: 'Your Location',
      area: 'Current Location',
      fullAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REVERSE_GEOCODE_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      throw new Error(`Reverse geocode failed with status ${res.status}`);
    }

    const data = (await res.json()) as {
      address?: Record<string, string | undefined>;
      display_name?: string;
    };
    const address = data?.address ?? {};
    const city =
      address.city ?? address.town ?? address.village ?? address.state_district ?? 'Unknown';
    const area = address.suburb ?? address.neighbourhood ?? address.county ?? city;
    const fullAddress = data?.display_name ?? `${area}, ${city}`;

    return { city, area, fullAddress };
  } catch {
    return {
      city: 'Your Location',
      area: 'Current Location',
      fullAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Firestore address operations
// ---------------------------------------------------------------------------

async function promoteAddressToDefault(
  uid: string,
  addressId: string,
): Promise<{
  before: readonly SavedAddress[];
  after: readonly SavedAddress[];
  picked: SavedAddress;
}> {
  const db = getFirebaseFirestore();
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const data = snap.exists() ? (snap.data() as { addresses?: readonly SavedAddress[] }) : undefined;
  const addresses = data?.addresses ?? [];

  const picked = addresses.find((a) => a.id === addressId);
  if (!picked) {
    throw new LocationWriteError(
      'address-not-found',
      `Address ${addressId} not found on user document`,
    );
  }

  const now = new Date().toISOString();
  const next: readonly SavedAddress[] = addresses.map((a) => ({
    ...a,
    isDefault: a.id === addressId,
    updatedAt: a.id === addressId ? now : a.updatedAt,
  }));

  try {
    await updateDoc(userRef, { addresses: next });
  } catch (err) {
    throw new LocationWriteError('firestore-write-failed', 'Could not set default address', err);
  }

  return { before: addresses, after: next, picked };
}

async function revertFirestoreAddresses(
  uid: string,
  previous: readonly SavedAddress[],
): Promise<void> {
  try {
    const db = getFirebaseFirestore();
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { addresses: previous });
  } catch {
    // Swallow — this is a best-effort rollback; the outer error already
    // describes the primary failure and we don't want to mask it.
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Single writer for the active user location. Routes every selection through
 * Firestore (when applicable) AND the legacy `location-provider` so `useLocation()`
 * consumers see the new value on the next render.
 */
export async function setActiveLocation(
  input: LocationWriteInput,
  options: SetActiveLocationOptions,
): Promise<void> {
  const { provider } = options;

  switch (input.kind) {
    case 'saved-address': {
      const auth = getFirebaseAuth();
      const uid = auth.currentUser?.uid ?? null;
      if (!uid) {
        throw new LocationWriteError(
          'not-authenticated',
          'You must be signed in to choose a saved address',
        );
      }

      const { before, picked } = await promoteAddressToDefault(uid, input.addressId);

      try {
        provider.setLocation(mapAddressToUserLocation(picked));
      } catch (err) {
        // Roll back the Firestore write so the two stores don't diverge.
        await revertFirestoreAddresses(uid, before);
        throw new LocationWriteError(
          'provider-write-failed',
          'Could not publish the selected address to the location provider',
          err,
        );
      }

      clearLegacyLocalStorage();
      return;
    }

    case 'gps': {
      const reverseGeocode = options.reverseGeocode ?? defaultReverseGeocode;
      let geo: { city: string; area: string; fullAddress: string };
      try {
        geo = await reverseGeocode(input.coords.latitude, input.coords.longitude);
      } catch (err) {
        throw new LocationWriteError(
          'geocode-failed',
          'Could not resolve your current location',
          err,
        );
      }

      try {
        provider.setLocation({
          lat: input.coords.latitude,
          lng: input.coords.longitude,
          city: geo.city,
          area: geo.area,
          fullAddress: geo.fullAddress,
        });
      } catch (err) {
        throw new LocationWriteError(
          'provider-write-failed',
          'Could not publish the detected location',
          err,
        );
      }

      clearLegacyLocalStorage();
      return;
    }

    case 'manual-city': {
      try {
        provider.setLocation({
          lat: 0,
          lng: 0,
          city: input.city,
          area: input.area ?? input.city,
          fullAddress: [input.area, input.city, input.pincode]
            .filter((s): s is string => Boolean(s && s.length > 0))
            .join(', '),
        });
      } catch (err) {
        throw new LocationWriteError(
          'provider-write-failed',
          'Could not publish the selected city',
          err,
        );
      }

      clearLegacyLocalStorage();
      return;
    }

    default: {
      // Exhaustiveness guard — satisfies TS strict `never`.
      const _exhaustive: never = input;
      void _exhaustive;
      throw new LocationWriteError('unknown', 'Unknown location write kind');
    }
  }
}

/**
 * Convenience: request coordinates from the platform (Capacitor-native when
 * available, browser `navigator.geolocation` otherwise), reverse-geocode
 * them via the backend callable, and forward them to `setActiveLocation`.
 *
 * Unlike `setActiveLocation`, this wrapper NEVER throws for the expected
 * "Google Maps key not yet configured" path. Instead it returns a tagged
 * result so the UI can:
 *   - `'ok'`              → proceed normally.
 *   - `'not-configured'`   → show "Location service is not set up yet.
 *                            Please enter your address manually below."
 *                            and expand the manual address form.
 *   - `'quota'`            → show "Too many requests — please enter
 *                            manually or try again in a minute."
 *   - `'error'`            → generic failure; show retry.
 *
 * Permission denied / coord-fetch failures still surface as
 * `{ status: 'error' }` rather than throwing, to keep this function's
 * contract simple for UI consumers.
 *
 * NOTE: the shared `setActiveLocation('gps', ...)` path is preserved for
 * backward compatibility and for tests that want to drive the writer
 * directly with synthetic coords. `setActiveLocationFromGps` is the
 * recommended entry point for UI code.
 */
export async function setActiveLocationFromGps(
  options: SetActiveLocationOptions,
): Promise<SetActiveLocationFromGpsResult> {
  // ---- 1. Coords -------------------------------------------------------
  let coords: { latitude: number; longitude: number; accuracy: number };
  try {
    coords = await requestCoords({
      enableHighAccuracy: false,
      timeout: 15_000,
      maximumAge: 300_000,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read device location';
    return { status: 'error', code: 'geocode-failed', message };
  }

  // ---- 2. Reverse-geocode via backend callable -------------------------
  const geocode = await reverseGeocodeCoords({
    lat: coords.latitude,
    lng: coords.longitude,
  });

  switch (geocode.status) {
    case 'ok': {
      try {
        options.provider.setLocation({
          lat: coords.latitude,
          lng: coords.longitude,
          city: geocode.components.city ?? 'Your Location',
          area: geocode.components.line1 ?? geocode.components.city ?? 'Current Location',
          fullAddress: geocode.formattedAddress,
        });
      } catch (err) {
        return {
          status: 'error',
          code: 'provider-write-failed',
          message: err instanceof Error ? err.message : 'Could not publish location',
        };
      }
      clearLegacyLocalStorage();
      return { status: 'ok' };
    }

    case 'not-configured': {
      // Graceful degradation — key is not set in Secret Manager yet. The
      // consumer UI should surface the "enter manually" toast.
      return { status: 'not-configured' };
    }

    case 'quota': {
      return { status: 'quota' };
    }

    case 'no-results':
    case 'invalid-input':
    case 'unauthenticated':
    case 'error':
    default: {
      // Fall back to the legacy Nominatim path so we at least give the
      // user SOMETHING useful while a real error is investigated. We
      // funnel through `setActiveLocation('gps', ...)` which already
      // knows how to call `reverseGeocode` with Nominatim as a default.
      try {
        await setActiveLocation(
          {
            kind: 'gps',
            coords: {
              latitude: coords.latitude,
              longitude: coords.longitude,
            },
          },
          options,
        );
        return { status: 'ok' };
      } catch (err) {
        if (err instanceof LocationWriteError) {
          return { status: 'error', code: err.code, message: err.message };
        }
        return {
          status: 'error',
          code: 'unknown',
          message: err instanceof Error ? err.message : 'Location lookup failed',
        };
      }
    }
  }
}
