'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import type { BookingCustomerLocation } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LocationMapPin, type LocationMapPinChange } from '@/components/maps/LocationMapPin';
import MapsKeyMissingFallback, {
  type FallbackPickedLocation,
} from '@/components/maps/MapsKeyMissingFallback';
import PlaceAutocompleteInput, {
  type PickedLocation,
} from '@/components/maps/PlaceAutocompleteInput';
import {
  requestLocationWithRationale,
  LocationPermissionDeniedError,
} from '@/lib/location/capacitor-bridge';
import { isNative } from '@/lib/capacitor';
import { logger } from '@/lib/logger';
import { LocationRationaleModal } from '@/components/location/LocationRationaleModal';

interface BookingLocationStepProps {
  spaCoords: { lat: number; lng: number } | null;
  spaName?: string | null;
  bookingLocationKind: 'spa' | 'home';
  onKindChange: (kind: 'spa' | 'home') => void;
  onChange: (loc: BookingCustomerLocation | null) => void;
}

const DETAILS_MAX = 500;

type GpsPhase = 'pre-prompt' | 'fetching' | 'ready' | 'fallback-typed';

interface BaseLocationCandidate {
  coords: { lat: number; lng: number; accuracy: number };
  source: 'gps' | 'address_typed' | 'address_picked_on_map';
  addressText: string;
  placeId?: string;
}

function buildCustomerLocation(
  base: BaseLocationCandidate | null,
  additionalDetails: string,
): BookingCustomerLocation | null {
  if (!base) return null;
  if (!base.addressText || base.addressText.length === 0) return null;
  const trimmedDetails = additionalDetails.trim();
  return {
    coords: base.coords,
    source: base.source,
    addressText: base.addressText.slice(0, 500),
    ...(base.placeId ? { placeId: base.placeId } : {}),
    ...(trimmedDetails.length > 0 ? { additionalDetails: trimmedDetails } : {}),
    capturedAt: new Date().toISOString(),
  };
}

export function BookingLocationStep({
  spaCoords,
  spaName,
  bookingLocationKind,
  onKindChange,
  onChange,
}: BookingLocationStepProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapsAvailable = Boolean(apiKey);

  const [phase, setPhase] = useState<GpsPhase>('pre-prompt');
  const [base, setBase] = useState<BaseLocationCandidate | null>(null);
  const [additionalDetails, setAdditionalDetails] = useState<string>('');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permanentlyDenied, setPermanentlyDenied] = useState<boolean>(false);
  const [showRationaleModal, setShowRationaleModal] = useState(false);

  const initialPinCoords = useMemo<{ lat: number; lng: number } | null>(() => {
    if (base) return { lat: base.coords.lat, lng: base.coords.lng };
    if (spaCoords) return spaCoords;
    return null;
  }, [base, spaCoords]);

  // Reset internal state when the user toggles back to "spa". Emitting null
  // ensures the wizard does not include a stale customerLocation in payload.
  useEffect(() => {
    if (bookingLocationKind === 'spa') {
      setPhase('pre-prompt');
      setBase(null);
      setAdditionalDetails('');
      setPermissionError(null);
      setPermanentlyDenied(false);
      setShowRationaleModal(false);
      onChange(null);
    }
  }, [bookingLocationKind, onChange]);

  // Whenever the underlying base or additionalDetails changes, emit a fresh
  // BookingCustomerLocation. capturedAt is regenerated so the wire payload
  // always reflects the latest user action.
  useEffect(() => {
    if (bookingLocationKind !== 'home') return;
    onChange(buildCustomerLocation(base, additionalDetails));
  }, [bookingLocationKind, base, additionalDetails, onChange]);

  const handleOpenSystemSettings = useCallback(async () => {
    if (!isNative()) return;
    try {
      // @capacitor/app v8 removed openUrl from the typed API, but the
      // Android native layer still accepts the call. We cast to access it.
      const { App } = await import('@capacitor/app');
      await (App as unknown as { openUrl: (opts: { url: string }) => Promise<void> }).openUrl({
        url: 'package:com.glamornate.app',
      });
    } catch (err) {
      logger.warn(
        'App.openUrl (settings) failed',
        { component: 'BookingLocationStep', action: 'open-settings' },
        { errorMessage: err instanceof Error ? err.message : String(err) },
      );
    }
  }, []);

  const handleAllowGps = useCallback(async () => {
    setPermissionError(null);
    setPermanentlyDenied(false);
    setShowRationaleModal(false);
    setPhase('fetching');
    try {
      // Use the bridge's industry-standard fallback chain
      // (last-known → network/wifi → GPS). High accuracy isn't needed for
      // a booking address — coarse 30–100 m fix is plenty for reverse
      // geocoding, and is 6–10× faster than forcing GPS-only.
      const pos = await requestLocationWithRationale();
      setBase({
        coords: {
          lat: pos.latitude,
          lng: pos.longitude,
          accuracy: Math.min(Math.max(pos.accuracy, 0), 100000),
        },
        source: 'gps',
        addressText: '',
      });
      setPhase('ready');
    } catch (err) {
      if (err instanceof LocationPermissionDeniedError) {
        if ((err as LocationPermissionDeniedError & { needsRationale?: boolean }).needsRationale) {
          // Android requires a rationale before the OS dialog can be shown.
          setPhase('pre-prompt');
          setShowRationaleModal(true);
          return;
        }
        setPhase('fallback-typed');
        setPermanentlyDenied(err.isPermanentlyDenied);
        setPermissionError(
          err.isPermanentlyDenied
            ? 'Location is turned off for this app. Open settings to allow it, or type your address below.'
            : 'Location permission denied. You can type your address instead.',
        );
        return;
      }
      const reason = err instanceof Error ? err.message : String(err);
      logger.warn(
        `GPS capture failed; falling back to typed address: ${reason}`,
        { component: 'BookingLocationStep', action: 'gps-fallback' },
      );
      setPhase('fallback-typed');
      setPermissionError(null);
    }
  }, []);

  const handleSkipToTyped = useCallback(() => {
    setPhase('fallback-typed');
  }, []);

  const handleRationaleAllow = useCallback(() => {
    setShowRationaleModal(false);
    void handleAllowGps();
  }, [handleAllowGps]);

  const handleRationaleDeny = useCallback(() => {
    setShowRationaleModal(false);
    setPhase('fallback-typed');
  }, []);

  const handleMapChange = useCallback((loc: LocationMapPinChange) => {
    setBase({
      coords: loc.coords,
      source: loc.source,
      addressText: loc.addressText,
      ...(loc.placeId ? { placeId: loc.placeId } : {}),
    });
  }, []);

  const handleAutocompletePick = useCallback((loc: PickedLocation) => {
    setBase({
      coords: loc.coords,
      source: loc.source,
      addressText: loc.addressText,
      placeId: loc.placeId,
    });
    setPhase('ready');
  }, []);

  const handleFallbackSubmit = useCallback((loc: FallbackPickedLocation) => {
    setBase({
      coords: loc.coords,
      source: loc.source,
      addressText: loc.addressText,
    });
    setPhase('ready');
  }, []);

  return (
    <div className="p-5 space-y-5">
      <div className="bg-white rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Where should we meet?</h3>
        <div
          role="radiogroup"
          aria-label="Booking location"
          className="grid grid-cols-2 gap-2"
        >
          <button
            type="button"
            role="radio"
            aria-checked={bookingLocationKind === 'spa'}
            onClick={() => onKindChange('spa')}
            className={`rounded-xl border px-3 py-3 text-left transition-colors ${
              bookingLocationKind === 'spa'
                ? 'border-brand-maroon-500 bg-brand-maroon-50 text-brand-maroon-700'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            <p className="text-sm font-semibold">At the spa</p>
            <p className="text-xs text-gray-500 mt-1">Visit the salon for your service.</p>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={bookingLocationKind === 'home'}
            onClick={() => onKindChange('home')}
            className={`rounded-xl border px-3 py-3 text-left transition-colors ${
              bookingLocationKind === 'home'
                ? 'border-brand-maroon-500 bg-brand-maroon-50 text-brand-maroon-700'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            <p className="text-sm font-semibold">At your address</p>
            <p className="text-xs text-gray-500 mt-1">Technician travels to you.</p>
          </button>
        </div>
      </div>

      {bookingLocationKind === 'spa' ? (
        <div className="bg-white rounded-2xl p-4 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-brand-maroon-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Booking will be at {spaName ?? 'the spa'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              The address is shown on your confirmation.
            </p>
          </div>
        </div>
      ) : null}

      {bookingLocationKind === 'home' && !mapsAvailable ? (
        <div className="bg-white rounded-2xl p-4">
          <MapsKeyMissingFallback
            spaCoords={spaCoords}
            onSubmit={handleFallbackSubmit}
          />
          {base && phase === 'ready' ? (
            <div className="mt-4 space-y-2">
              <Label htmlFor="loc-additional-details">
                Doorstep details
                <span className="ml-1 text-xs text-brand-maroon-400">
                  ({additionalDetails.length}/{DETAILS_MAX})
                </span>
              </Label>
              <textarea
                id="loc-additional-details"
                value={additionalDetails}
                onChange={(e) =>
                  setAdditionalDetails(e.target.value.slice(0, DETAILS_MAX))
                }
                maxLength={DETAILS_MAX}
                placeholder="Gate code, parking instructions, etc."
                rows={3}
                className="flex w-full rounded-lg border border-brand-maroon-200 bg-background px-3 py-2 text-sm placeholder:text-brand-maroon-400 focus-visible:outline-none focus-visible:border-brand-gold-500 focus-visible:ring-2 focus-visible:ring-brand-gold-500"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {bookingLocationKind === 'home' && mapsAvailable ? (
        <div className="bg-white rounded-2xl p-4 space-y-4">
          {phase === 'pre-prompt' ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-brand-maroon-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Share your location
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    So the technician can reach your doorstep. You can also type your
                    address manually.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" onClick={handleAllowGps} className="w-full">
                  Allow
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkipToTyped}
                  className="w-full"
                >
                  Type address
                </Button>
              </div>
            </div>
          ) : null}

          {phase === 'fetching' ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Locating you…
            </div>
          ) : null}

          {permissionError ? (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              {permissionError}
              {permanentlyDenied && isNative() ? (
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleOpenSystemSettings}
                  >
                    Open settings
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {(phase === 'ready' || phase === 'fallback-typed') && initialPinCoords ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <LocationMapPin
                  initialCoords={initialPinCoords}
                  onChange={handleMapChange}
                />
              </div>
            </div>
          ) : null}

          {phase === 'ready' || phase === 'fallback-typed' ? (
            <div className="space-y-2">
              <Label htmlFor="loc-autocomplete">Or search an address</Label>
              <PlaceAutocompleteInput
                onPick={handleAutocompletePick}
                placeholder="Search for your address"
                defaultValue={base?.addressText ?? ''}
              />
            </div>
          ) : null}

          {(phase === 'ready' || phase === 'fallback-typed') && base ? (
            <div className="rounded-lg border border-brand-maroon-200 bg-brand-maroon-50 px-3 py-2 text-xs text-brand-maroon-800">
              <span className="font-semibold">Selected:</span> {base.addressText || '—'}
            </div>
          ) : null}

          {phase === 'ready' || phase === 'fallback-typed' ? (
            <div className="space-y-2">
              <Label htmlFor="loc-additional-details">
                Doorstep details
                <span className="ml-1 text-xs text-brand-maroon-400">
                  ({additionalDetails.length}/{DETAILS_MAX})
                </span>
              </Label>
              <textarea
                id="loc-additional-details"
                value={additionalDetails}
                onChange={(e) =>
                  setAdditionalDetails(e.target.value.slice(0, DETAILS_MAX))
                }
                maxLength={DETAILS_MAX}
                placeholder="Gate code, parking instructions, etc."
                rows={3}
                className="flex w-full rounded-lg border border-brand-maroon-200 bg-background px-3 py-2 text-sm placeholder:text-brand-maroon-400 focus-visible:outline-none focus-visible:border-brand-gold-500 focus-visible:ring-2 focus-visible:ring-brand-gold-500"
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <LocationRationaleModal
        open={showRationaleModal}
        onAllow={handleRationaleAllow}
        onDeny={handleRationaleDeny}
      />
    </div>
  );
}
