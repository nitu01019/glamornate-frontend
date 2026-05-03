/**
 * Geolocation wrapper used by the Round 5 single-writer location flow
 * (`@/lib/location-writer` → `setActiveLocationFromGps`).
 *
 * This file is now a thin re-export over `./location/capacitor-bridge`,
 * which unifies Capacitor-native and web `navigator.geolocation` paths.
 * The bridge owns platform detection, permission handling, and dynamic
 * import of `@capacitor/geolocation`; this wrapper just preserves the
 * legacy `requestCoords` signature so existing callers keep working.
 */

export interface RequestCoordsOptions {
  readonly enableHighAccuracy?: boolean;
  readonly timeout?: number;
  readonly maximumAge?: number;
}

export interface Coords {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number;
}

export async function requestCoords(options: RequestCoordsOptions = {}): Promise<Coords> {
  const { getCurrentPosition } = await import('./location/capacitor-bridge');
  const pos = await getCurrentPosition({
    enableHighAccuracy: options.enableHighAccuracy,
    timeout: options.timeout,
    maximumAge: options.maximumAge,
  });
  return {
    latitude: pos.latitude,
    longitude: pos.longitude,
    accuracy: pos.accuracy,
  };
}
