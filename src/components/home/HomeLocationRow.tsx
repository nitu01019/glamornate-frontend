'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, MapPin } from 'lucide-react';
import { useLocation } from '@/lib/location-provider';
import { useDefaultAddress } from '@/hooks/useDefaultAddress';
import type { SavedAddress } from '@/types';
import { cn } from '@/lib/utils';

interface HomeLocationSheetProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// HomeLocationSheet is imported lazily with SSR disabled so the sheet code
// only loads when the user actually taps to change location. A runtime
// try/catch keeps the build green if the sibling module is ever missing
// during parallel development.
// ---------------------------------------------------------------------------
const HomeLocationSheet: ComponentType<HomeLocationSheetProps> = dynamic(
  async () => {
    try {
      const mod: { default: ComponentType<HomeLocationSheetProps> } = await import(
        /* webpackChunkName: "home-location-sheet" */ '@/components/home/HomeLocationSheet'
      );
      return mod.default;
    } catch {
      const NoopSheet: ComponentType<HomeLocationSheetProps> = () => null;
      return NoopSheet;
    }
  },
  { ssr: false },
);

const MAX_SUBTITLE_CHARS = 40;

function formatAddressLine(address: SavedAddress | null): string {
  if (!address) return '';
  const segments = [
    address.flatHouse,
    address.street,
    address.landmark,
    address.city,
    address.pincode,
  ]
    .map((segment) => segment?.trim())
    .filter((segment): segment is string => Boolean(segment && segment.length > 0));
  return segments.join(', ');
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function pickPrimaryLine(args: {
  readonly address: SavedAddress | null;
  readonly locationCity: string | null;
}): string {
  const { address, locationCity } = args;
  // SavedAddress does not expose an 'area' today; fall back to city.
  // `useLocation()` provides richer area text when the user has opted into
  // geolocation but not yet saved an address — used as a secondary fallback.
  if (address?.city) return address.city;
  if (locationCity) return locationCity;
  return 'Set location';
}

export default function HomeLocationRow() {
  const { address, isLoading: addressLoading } = useDefaultAddress();
  const { location } = useLocation();

  // Defer any client-only state to prevent SSR hydration mismatch.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Track online/offline status (client-only). Default to online to avoid SSR
  // flash of the "offline" pill.
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const hasDefaultAddress = Boolean(address);
  const hasZeroState = hasMounted && !addressLoading && !hasDefaultAddress && !location?.city;

  const primaryLine = useMemo(() => {
    if (hasZeroState) return 'Add your address';
    return pickPrimaryLine({ address, locationCity: location?.city ?? null });
  }, [address, location?.city, hasZeroState]);

  const subtitleLine = useMemo(() => {
    if (hasZeroState) return 'Tap to save your first address';
    if (address) {
      const formatted = formatAddressLine(address);
      return formatted ? truncate(formatted, MAX_SUBTITLE_CHARS) : '';
    }
    if (location?.fullAddress) return truncate(location.fullAddress, MAX_SUBTITLE_CHARS);
    return '';
  }, [address, hasZeroState, location?.fullAddress]);

  const handleLocationActivate = useCallback(() => {
    // Always open the sheet — the sheet itself handles the zero state by
    // expanding the inline manual entry form (Phase 2, B3). No navigation
    // to `/customer/addresses` for selection anymore.
    setSheetOpen(true);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleLocationActivate();
      }
    },
    [handleLocationActivate],
  );

  const isLoadingPrimary = hasMounted && addressLoading;

  return (
    <>
      <div
        data-testid="home-location-row"
        className={cn(
          'fixed top-14 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg',
          'px-4 py-2 flex items-center min-h-[56px] max-h-16',
          'border-b border-gray-100',
        )}
      >
        {/* Location block — tappable, role=button */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Change location"
          onClick={handleLocationActivate}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex items-start gap-2 min-w-0 flex-1 cursor-pointer',
            'rounded-lg px-2 py-1',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500',
            'hover:bg-brand-blush-50/60 active:bg-brand-blush-100/60 transition-colors',
          )}
        >
          <MapPin className="w-4 h-4 text-brand-maroon-500 mt-1 flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              {isLoadingPrimary ? (
                <span
                  data-testid="home-location-primary-skeleton"
                  aria-hidden="true"
                  className="h-4 w-28 rounded bg-gray-200 animate-pulse"
                />
              ) : (
                <span
                  data-testid="home-location-primary"
                  className="text-sm font-semibold text-gray-900 truncate"
                >
                  {primaryLine}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" aria-hidden="true" />
              {hasMounted && !isOnline && (
                <span
                  data-testid="home-location-offline"
                  className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-medium"
                >
                  offline
                </span>
              )}
            </div>
            {subtitleLine.length > 0 && (
              <p
                data-testid="home-location-subtitle"
                className="text-[11px] text-gray-500 truncate leading-tight"
              >
                {subtitleLine}
              </p>
            )}
          </div>
        </div>
      </div>

      {sheetOpen && <HomeLocationSheet open={sheetOpen} onClose={closeSheet} />}
    </>
  );
}
