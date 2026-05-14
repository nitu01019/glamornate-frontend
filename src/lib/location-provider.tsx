'use client';

/**
 * LocationProvider
 * ----------------
 * In-memory + localStorage mirror of the user's currently-active location.
 * Marketplace consumers (`spas-by-city`, `MostBookedSection`,
 * `LocationHeader`, `HomeLocationRow`, `InlineLocationTrigger`) subscribe
 * to this provider to keep their copy of the user's locale fresh.
 *
 * Writes happen from:
 *   - `HomeLocationSheet` after a successful GPS detect or saved-address pick.
 *   - `AddressSheetManualForm` after a manual address save.
 *   - `LocationPicker` after a city-list pick or successful GPS detect
 *     (via `useCurrentLocation` — single source of truth).
 *
 * Read API: `location`, `setLocation`, `clearLocation`. The provider does
 * NOT trigger GPS itself — every GPS path goes through `useCurrentLocation`
 * so we have a single bridge + geocode + cache pipeline.
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
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
  setLocation: (location: UserLocation) => void;
  clearLocation: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'glamornate_user_location';

// =============================================================================
// Context
// =============================================================================

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

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

// =============================================================================
// Provider
// =============================================================================

interface LocationProviderProps {
  children: ReactNode;
}

export function LocationProvider({ children }: LocationProviderProps) {
  const [location, setLocationState] = useState<UserLocation | null>(null);

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
    log.info('Location set', { city: newLocation.city });
  }, []);

  const clearLocation = useCallback(() => {
    setLocationState(null);
    clearStoredLocation();
    log.info('Location cleared');
  }, []);

  const value: LocationContextValue = {
    location,
    setLocation,
    clearLocation,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}
