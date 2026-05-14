'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Navigation, X, Loader2, MapPin } from 'lucide-react';
import { useLocation } from '@/lib/location-provider';
import { useCurrentLocation } from '@/lib/location/hooks/useCurrentLocation';

// =============================================================================
// Types
// =============================================================================

interface PopularCity {
  lat: number;
  lng: number;
  city: string;
  area: string;
}

interface LocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// Popular Cities Data
// NOTE: When adding Google Places autocomplete for real-time city search,
// route requests through a server-side API route (e.g. /api/v1/location/search)
// instead of calling Google APIs directly from the client. This keeps API keys
// server-side only -- never use NEXT_PUBLIC_ env vars for Google API keys.
// =============================================================================

const POPULAR_CITIES: readonly PopularCity[] = [
  { lat: 32.7266, lng: 74.857, city: 'Jammu', area: 'Jammu' },
  { lat: 28.6139, lng: 77.209, city: 'Delhi', area: 'New Delhi' },
  { lat: 19.076, lng: 72.8777, city: 'Mumbai', area: 'Mumbai' },
  { lat: 12.9716, lng: 77.5946, city: 'Bangalore', area: 'Bangalore' },
  { lat: 17.385, lng: 78.4867, city: 'Hyderabad', area: 'Hyderabad' },
  { lat: 13.0827, lng: 80.2707, city: 'Chennai', area: 'Chennai' },
  { lat: 22.5726, lng: 88.3639, city: 'Kolkata', area: 'Kolkata' },
  { lat: 18.5204, lng: 73.8567, city: 'Pune', area: 'Pune' },
] as const;

// =============================================================================
// Component
// =============================================================================

export default function LocationPicker({ isOpen, onClose }: LocationPickerProps) {
  const { location, setLocation } = useLocation();
  const loc = useCurrentLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasFiredDetect, setHasFiredDetect] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isLoading = loc.status === 'fetching';
  const errorMessage = useMemo<string | null>(() => {
    if (!loc.error) return null;
    switch (loc.error) {
      case 'permission-permanent':
        return 'Location is turned off for this app. Open Settings to allow.';
      case 'permission-denied':
        return 'Location permission denied. Tap again or pick a city.';
      case 'quota':
        return 'Too many requests — try again in a minute.';
      case 'service-down':
        return 'Location service is paused. Pick a city below.';
      case 'no-results':
        return 'Could not resolve your address.';
      case 'timeout':
        return 'Location is taking too long. Try again.';
      default:
        return 'Could not detect your location.';
    }
  }, [loc.error]);

  // Handle open/close animation
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      // Focus search input after animation
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setSearchQuery('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Intercept the Android hardware back button while this sheet is open so
  // that pressing back closes the picker instead of navigating away.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: Event): void => {
      event.preventDefault();
      onClose();
    };
    window.addEventListener('glamornate:back-button', handler);
    return () => window.removeEventListener('glamornate:back-button', handler);
  }, [isOpen, onClose]);

  const filteredCities = POPULAR_CITIES.filter(
    (city) =>
      city.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      city.area.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  function handleSelectCity(city: PopularCity): void {
    setLocation({
      lat: city.lat,
      lng: city.lng,
      city: city.city,
      area: city.area,
      fullAddress: `${city.area}, ${city.city}`,
    });
    onClose();
  }

  async function handleDetectLocation(): Promise<void> {
    setHasFiredDetect(true);
    await loc.refresh();
  }

  // Mirror a successful GPS+geocode result into the legacy location provider
  // so marketplace consumers (spas-by-city, MostBookedSection, LocationHeader)
  // re-render with the new locale, then close the picker. Guarded by
  // `hasFiredDetect` so the picker doesn't auto-close on a cache-hit that
  // hydrated useCurrentLocation before the user tapped "Use current location".
  useEffect(() => {
    if (!hasFiredDetect) return;
    if (loc.status !== 'success' || !loc.coords || !loc.address) return;
    setLocation({
      lat: loc.coords.lat,
      lng: loc.coords.lng,
      city: loc.address.city ?? 'Detected',
      area: loc.address.line1 ?? loc.address.city ?? 'Current location',
      fullAddress: loc.address.formatted,
    });
    setHasFiredDetect(false);
    onClose();
  }, [hasFiredDetect, loc.status, loc.coords, loc.address, setLocation, onClose]);

  if (!isOpen && !isAnimating) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isOpen ? 'opacity-50' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className={`relative bg-white rounded-t-2xl max-h-[85vh] overflow-hidden transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="text-lg font-semibold text-gray-900">Choose your location</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close location picker"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search for a city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-maroon-500/30 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Detect Location Button */}
        <div className="px-4 pb-3">
          <button
            onClick={handleDetectLocation}
            disabled={isLoading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-brand-maroon-200 bg-brand-maroon-50/50 hover:bg-brand-maroon-50 transition-colors disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-brand-maroon-500 animate-spin" />
            ) : (
              <Navigation className="w-5 h-5 text-brand-maroon-500" />
            )}
            <div className="text-left">
              <span className="text-sm font-medium text-brand-maroon-700">
                {isLoading ? 'Detecting location...' : 'Use current location'}
              </span>
              {errorMessage && <p className="text-xs text-red-500 mt-0.5">{errorMessage}</p>}
            </div>
          </button>
        </div>

        {/* Divider */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Popular cities</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>

        {/* Cities List */}
        <div className="overflow-y-auto max-h-[45vh] px-4 pb-6">
          {filteredCities.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">No cities found for &quot;{searchQuery}&quot;</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredCities.map((city) => {
                const isSelected = location?.city === city.city;
                return (
                  <button
                    key={city.city}
                    onClick={() => handleSelectCity(city)}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-brand-maroon-500 text-white shadow-md'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <MapPin
                      className={`w-4 h-4 flex-shrink-0 ${
                        isSelected ? 'text-white' : 'text-brand-maroon-400'
                      }`}
                    />
                    <span className="text-sm font-medium truncate">{city.city}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
