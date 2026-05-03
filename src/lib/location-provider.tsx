'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { logger } from './logger';

const log = logger.child({ component: 'LocationProvider' });

// =============================================================================
// Types
// =============================================================================

export interface UserLocation {
  lat: number;
  lng: number;
  city: string;
  area: string;
  fullAddress?: string;
}

interface LocationContextValue {
  location: UserLocation | null;
  isLoading: boolean;
  error: string | null;
  setLocation: (location: UserLocation) => void;
  detectLocation: () => Promise<void>;
  clearLocation: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'glamornate_user_location';

const REVERSE_GEOCODE_TIMEOUT_MS = 10_000;

// =============================================================================
// Context
// =============================================================================

const LocationContext = createContext<LocationContextValue | undefined>(
  undefined,
);

// =============================================================================
// Hook
// =============================================================================

export function useLocation(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}

// =============================================================================
// Helpers
// =============================================================================

function loadStoredLocation(): UserLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'lat' in parsed &&
      'lng' in parsed &&
      'city' in parsed &&
      'area' in parsed
    ) {
      return parsed as UserLocation;
    }
    return null;
  } catch {
    return null;
  }
}

function persistLocation(location: UserLocation): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  } catch {
    // Storage full or unavailable -- silently ignore.
  }
}

function clearStoredLocation(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore.
  }
}

/**
 * Attempt to reverse-geocode coordinates into a city/area string using the
 * browser Geolocation API coordinates with a simple Nominatim lookup.
 *
 * Falls back to generic "Your Location" when the network call fails so the
 * coordinates are still usable for distance-based queries.
 */
async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ city: string; area: string; fullAddress: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REVERSE_GEOCODE_TIMEOUT_MS,
  );

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

    const data = await res.json();
    const address = data?.address ?? {};
    const city =
      address.city ??
      address.town ??
      address.village ??
      address.state_district ??
      'Unknown';
    const area =
      address.suburb ??
      address.neighbourhood ??
      address.county ??
      city;
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

// =============================================================================
// Provider
// =============================================================================

interface LocationProviderProps {
  children: ReactNode;
}

export function LocationProvider({ children }: LocationProviderProps) {
  const [location, setLocationState] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = loadStoredLocation();
    if (stored) {
      setLocationState(stored);
      log.info('Restored location from storage', { city: stored.city });
    }
  }, []);

  const setLocation = useCallback((newLocation: UserLocation) => {
    setLocationState(newLocation);
    persistLocation(newLocation);
    setError(null);
    log.info('Location set', { city: newLocation.city });
  }, []);

  const clearLocation = useCallback(() => {
    setLocationState(null);
    clearStoredLocation();
    setError(null);
    log.info('Location cleared');
  }, []);

  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      const msg = 'Geolocation is not supported by your browser';
      setError(msg);
      log.warn(msg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 15_000,
            maximumAge: 300_000, // 5 minutes cache
          });
        },
      );

      const { latitude: lat, longitude: lng } = position.coords;
      const geo = await reverseGeocode(lat, lng);

      const detected: UserLocation = {
        lat,
        lng,
        city: geo.city,
        area: geo.area,
        fullAddress: geo.fullAddress,
      };

      setLocationState(detected);
      persistLocation(detected);
      setError(null);
      log.info('Location detected', { city: detected.city });
    } catch (err: unknown) {
      let message = 'Unable to detect your location';

      if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable it in your browser settings.';
            break;
          case err.POSITION_UNAVAILABLE:
            message = 'Location information is currently unavailable.';
            break;
          case err.TIMEOUT:
            message = 'Location request timed out. Please try again.';
            break;
        }
      }

      setError(message);
      log.error('Location detection failed', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: LocationContextValue = {
    location,
    isLoading,
    error,
    setLocation,
    detectLocation,
    clearLocation,
  };

  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  );
}
