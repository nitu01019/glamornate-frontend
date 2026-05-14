'use client';

/**
 * BookingLocationStep
 * -------------------
 * Step 1 of the booking wizard. Lets the customer pick "At the Salon" or
 * "At Home", and — for home bookings — choose a saved delivery address
 * (preferred) or share their current location (fallback).
 *
 * Refactor 2026-05-13: the legacy version forced every home-service
 * customer through a Google Places typed-address flow even when they had
 * a perfectly good saved address on file. The new flow is saved-address
 * first, with three escape hatches:
 *
 *   1. "Add new address"   → opens the same AddressFormDialog used on
 *                            `/customer/addresses`; uses the addAddress
 *                            callable so the new record lands in the
 *                            users/{uid}/addresses subcollection.
 *   2. "Use current location" → existing GPS + map-pin + Places autocomplete
 *                            UI (untouched logic, just gated behind a CTA).
 *   3. Empty / Maps unavailable → typed-address fallback.
 *
 * Glamornate is a salon, not a massage-therapist marketplace — copy is
 * "Our team comes to your door" rather than "Technician travels to you."
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, Check, Home, Loader2, MapPin, Navigation, Plus, Tag } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { BookingCustomerLocation } from '@/shared/contracts';
import { DETECTED_PHONE_SENTINEL, type AddressLabel, type SavedAddress } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LocationMapPin, type LocationMapPinChange } from '@/components/maps/LocationMapPin';
import MapsKeyMissingFallback, {
  type FallbackPickedLocation,
} from '@/components/maps/MapsKeyMissingFallback';
import PlaceAutocompleteInput, {
  type PickedLocation,
} from '@/components/maps/PlaceAutocompleteInput';
import { isNative } from '@/lib/capacitor';
import { logger } from '@/lib/logger';
import { LocationRationaleModal } from '@/components/location/LocationRationaleModal';
import { useAddresses } from '@/lib/addresses/use-addresses';
import { useCurrentLocation } from '@/lib/location/hooks/useCurrentLocation';
import { AddAddressInline } from './AddAddressInline';
import type { ManualAddressInput } from '@/lib/schemas/saved-address';

const DETAILS_MAX = 500;

const LABEL_META: Record<
  AddressLabel,
  { readonly icon: typeof Home; readonly chip: string; readonly tint: string }
> = {
  home: {
    icon: Home,
    chip: 'Home',
    tint: 'bg-brand-maroon-50 text-brand-maroon-600',
  },
  work: {
    icon: Briefcase,
    chip: 'Work',
    tint: 'bg-blue-50 text-blue-600',
  },
  other: {
    icon: Tag,
    chip: 'Other',
    tint: 'bg-gray-100 text-gray-600',
  },
  // GPS auto-save entry (HomeLocationSheet) — rendered with the same
  // maroon accent as 'home' to read as a personal location, distinct
  // from the gray 'other'.
  detected: {
    icon: Navigation,
    chip: 'Detected',
    tint: 'bg-brand-maroon-50 text-brand-maroon-600',
  },
};

interface BookingLocationStepProps {
  spaCoords: { lat: number; lng: number } | null;
  spaName?: string | null;
  bookingLocationKind: 'spa' | 'home';
  onKindChange: (kind: 'spa' | 'home') => void;
  onChange: (loc: BookingCustomerLocation | null) => void;
  /**
   * Step-level "Continue" handler. The wizard's bottom bar already exposes
   * a Continue button, but on long viewports it lives off-screen for a
   * meaningful share of users. Surfacing the same action inline at the end
   * of the step makes the next step obvious.
   */
  onContinue: () => void;
  /** True when the wizard's gating rules say the user may advance. */
  canProceed: boolean;
}

type GpsPhase = 'pre-prompt' | 'fetching' | 'ready' | 'fallback-typed';

interface BaseLocationCandidate {
  coords: { lat: number; lng: number; accuracy: number };
  source: 'gps' | 'address_typed' | 'address_picked_on_map';
  addressText: string;
  placeId?: string;
}

function formatAddressLine(addr: SavedAddress): string {
  return [addr.flatHouse, addr.street, addr.landmark, addr.city, addr.state, addr.pincode]
    .filter((p): p is string => Boolean(p && p.length > 0))
    .join(', ');
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

function savedAddressToCustomerLocation(
  addr: SavedAddress,
  geo: { lat: number; lng: number } | null,
  additionalDetails: string,
): BookingCustomerLocation | null {
  const addressText = formatAddressLine(addr);
  if (!addressText) return null;
  const trimmedDetails = additionalDetails.trim();
  return {
    coords: {
      lat: geo?.lat ?? 0,
      lng: geo?.lng ?? 0,
      accuracy: 0,
    },
    // SavedAddress entries are semantically typed by the customer, so the
    // wire-level `source` is the same value the legacy typed-flow used.
    source: 'address_typed',
    addressText: addressText.slice(0, 500),
    ...(trimmedDetails.length > 0 ? { additionalDetails: trimmedDetails } : {}),
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Reverse-geocode a free-form address text via the Google Maps Geocoder.
 * Returns `null` if the geocoder library is unavailable or the lookup
 * fails — callers must tolerate a missing geo by submitting (0,0) coords
 * + the address text; the backend persists the addressText verbatim and
 * recomputes Maps URLs server-side.
 */
function useAddressGeocoder(): (text: string) => Promise<{ lat: number; lng: number } | null> {
  const geocodingLib = useMapsLibrary('geocoding');

  return useCallback(
    async (text: string) => {
      if (!geocodingLib || !text) return null;
      const lib = geocodingLib as unknown as {
        Geocoder: new () => {
          geocode: (req: { address: string }) => Promise<{
            results: Array<{ geometry: { location: { lat: () => number; lng: () => number } } }>;
          }>;
        };
      };
      try {
        const geocoder = new lib.Geocoder();
        const res = await geocoder.geocode({ address: text });
        const first = res.results?.[0];
        if (!first) return null;
        return { lat: first.geometry.location.lat(), lng: first.geometry.location.lng() };
      } catch (err) {
        logger.warn(
          'addressGeocode failed',
          { component: 'BookingLocationStep', action: 'address-geocode' },
          { errorMessage: err instanceof Error ? err.message : String(err) },
        );
        return null;
      }
    },
    [geocodingLib],
  );
}

export function BookingLocationStep({
  spaCoords,
  spaName,
  bookingLocationKind,
  onKindChange,
  onChange,
  onContinue,
  canProceed,
}: BookingLocationStepProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapsAvailable = Boolean(apiKey);

  // ---- Saved addresses (canonical post-migration store) -----------------
  const { addresses, isLoading: addressesLoading, addAddress: addAddressMutation } = useAddresses();

  // v3 (2026-05-13 — location unification): canonical live-location hook
  // for the GPS sub-flow. The old direct `requestLocationWithRationale`
  // call is replaced by an effect that watches `loc.status` and feeds
  // the existing `gpsPhase` / `gpsBase` / `permissionError` state.
  const loc = useCurrentLocation();

  // ---- Selection state --------------------------------------------------
  // Two mutually-exclusive sources for the customer location:
  //   - `selectedAddressId`: a saved address chosen from the list
  //   - `gpsBase` (with `gpsActive`): a fresh GPS / map / autocomplete capture
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [resolvedGeoById, setResolvedGeoById] = useState<
    Record<string, { lat: number; lng: number }>
  >({});

  const [gpsActive, setGpsActive] = useState(false);
  const [gpsPhase, setGpsPhase] = useState<GpsPhase>('pre-prompt');
  const [gpsBase, setGpsBase] = useState<BaseLocationCandidate | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permanentlyDenied, setPermanentlyDenied] = useState<boolean>(false);
  const [showRationaleModal, setShowRationaleModal] = useState(false);

  // Free-text gate code / floor / parking notes — applies to both sources.
  const [additionalDetails, setAdditionalDetails] = useState<string>('');

  // Inline "Add new address" form expansion. When `addresses.length === 0`
  // the form is shown directly; otherwise the user must tap the affordance.
  const [addExpanded, setAddExpanded] = useState(false);

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );

  // v3 (2026-05-13 — location unification): prefer the selected saved
  // address's stored `geo` so the map renders the moment At-Home is
  // chosen, without paying a client-side Geocoder round-trip. Falls back
  // to the lazy `useAddressGeocoder` for legacy addresses without geo
  // (covered by `resolvedGeoById`), then to spa coords if no address.
  const initialPinCoords = useMemo<{ lat: number; lng: number } | null>(() => {
    if (gpsBase) return { lat: gpsBase.coords.lat, lng: gpsBase.coords.lng };
    if (selectedAddress?.geo) {
      return { lat: selectedAddress.geo.lat, lng: selectedAddress.geo.lng };
    }
    if (selectedAddress && resolvedGeoById[selectedAddress.id]) {
      return resolvedGeoById[selectedAddress.id];
    }
    if (spaCoords) return spaCoords;
    return null;
  }, [gpsBase, selectedAddress, resolvedGeoById, spaCoords]);

  // ---- Reset to spa-only -------------------------------------------------
  useEffect(() => {
    if (bookingLocationKind !== 'spa') return;
    setSelectedAddressId(null);
    setGpsActive(false);
    setGpsPhase('pre-prompt');
    setGpsBase(null);
    setAdditionalDetails('');
    setPermissionError(null);
    setPermanentlyDenied(false);
    setShowRationaleModal(false);
    onChange(null);
  }, [bookingLocationKind, onChange]);

  // ---- Auto-pick the default saved address when entering 'home' mode ----
  useEffect(() => {
    if (bookingLocationKind !== 'home') return;
    if (gpsActive) return;
    if (selectedAddressId) return;
    if (addresses.length === 0) return;
    const def = addresses.find((a) => a.isDefault) ?? addresses[0];
    setSelectedAddressId(def.id);
  }, [bookingLocationKind, addresses, selectedAddressId, gpsActive]);

  // ---- Reverse-geocode a saved address on selection (lazy + memoized) ---
  const geocodeAddress = useAddressGeocoder();
  useEffect(() => {
    if (!selectedAddress) return;
    if (resolvedGeoById[selectedAddress.id]) return;
    let cancelled = false;
    void (async () => {
      const geo = await geocodeAddress(formatAddressLine(selectedAddress));
      if (cancelled || !geo) return;
      setResolvedGeoById((prev) => ({ ...prev, [selectedAddress.id]: geo }));
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAddress, resolvedGeoById, geocodeAddress]);

  // ---- Emit BookingCustomerLocation upward whenever inputs change -------
  useEffect(() => {
    if (bookingLocationKind !== 'home') return;
    if (gpsActive) {
      onChange(buildCustomerLocation(gpsBase, additionalDetails));
      return;
    }
    if (selectedAddress) {
      const geo = resolvedGeoById[selectedAddress.id] ?? null;
      onChange(savedAddressToCustomerLocation(selectedAddress, geo, additionalDetails));
      return;
    }
    onChange(null);
  }, [
    bookingLocationKind,
    gpsActive,
    gpsBase,
    selectedAddress,
    resolvedGeoById,
    additionalDetails,
    onChange,
  ]);

  // ---- Handlers ---------------------------------------------------------
  const handleOpenSystemSettings = useCallback(async () => {
    if (!isNative()) return;
    try {
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

  // v3: drive the GPS sub-flow through `useCurrentLocation`. The hook
  // owns the bridge + reverseGeocode pipeline + 12 s ceiling + typed
  // error taxonomy; we just sync its state back into `gpsPhase` /
  // `gpsBase` / `permissionError` so the rest of this component's
  // existing render logic continues to work unchanged.
  const handleAllowGps = useCallback(async () => {
    setPermissionError(null);
    setPermanentlyDenied(false);
    setShowRationaleModal(false);
    setGpsPhase('fetching');
    await loc.refresh();
  }, [loc]);

  useEffect(() => {
    // Only react while we're actively in the GPS sub-flow (gpsActive=true)
    // or transitioning into it (gpsPhase === 'fetching'). Stale state
    // from a prior sheet open won't leak into a saved-address render.
    if (gpsPhase !== 'fetching' && !gpsActive) return;

    // Mirror the hook's rationale flag into local UI state so the existing
    // <LocationRationaleModal open={showRationaleModal}> mount keeps
    // working without touching the JSX. Two-way: open AND close.
    setShowRationaleModal(loc.isRationaleOpen);
    if (loc.isRationaleOpen) return;

    if (loc.status === 'success' && loc.coords && loc.address) {
      setGpsBase({
        coords: { lat: loc.coords.lat, lng: loc.coords.lng, accuracy: 0 },
        source: 'gps',
        addressText: loc.address.formatted,
      });
      setGpsPhase('ready');
      setPermissionError(null);
      setPermanentlyDenied(false);
      return;
    }

    if (loc.status === 'error' && loc.error) {
      if (loc.error === 'permission-permanent') {
        setPermanentlyDenied(true);
        setPermissionError(
          'Location is turned off for this app. Open settings to allow it, or type an address below.',
        );
      } else if (loc.error === 'permission-denied') {
        setPermissionError('Location permission denied. You can type an address instead.');
      } else {
        // service-down / quota / no-results / timeout / unknown
        setPermissionError(null);
        logger.warn(`GPS capture failed; falling back to typed address: ${loc.error}`, {
          component: 'BookingLocationStep',
          action: 'gps-fallback',
        });
      }
      setGpsPhase('fallback-typed');
    }
  }, [
    loc.status,
    loc.coords,
    loc.address,
    loc.error,
    loc.isRationaleOpen,
    gpsPhase,
    gpsActive,
  ]);

  const handleUseCurrentLocation = useCallback(() => {
    setSelectedAddressId(null);
    setGpsActive(true);
    setGpsPhase('pre-prompt');
    setGpsBase(null);
    void handleAllowGps();
  }, [handleAllowGps]);

  const handleBackToSaved = useCallback(() => {
    setGpsActive(false);
    setGpsBase(null);
    setGpsPhase('pre-prompt');
    setPermissionError(null);
    setPermanentlyDenied(false);
  }, []);

  // v3: rationale modal is now owned by useCurrentLocation. The hook's
  // `acknowledgeRationale` re-runs the fetch internally; `dismissRationale`
  // just closes the modal — we additionally drop to the typed-address
  // fallback so the user is never stranded.
  const handleRationaleAllow = useCallback(() => {
    setShowRationaleModal(false);
    loc.acknowledgeRationale();
  }, [loc]);

  const handleRationaleDeny = useCallback(() => {
    setShowRationaleModal(false);
    loc.dismissRationale();
    setGpsPhase('fallback-typed');
  }, [loc]);

  const handleMapChange = useCallback((loc: LocationMapPinChange) => {
    setGpsBase({
      coords: loc.coords,
      source: loc.source,
      addressText: loc.addressText,
      ...(loc.placeId ? { placeId: loc.placeId } : {}),
    });
  }, []);

  const handleAutocompletePick = useCallback((loc: PickedLocation) => {
    setGpsBase({
      coords: loc.coords,
      source: loc.source,
      addressText: loc.addressText,
      placeId: loc.placeId,
    });
    setGpsPhase('ready');
  }, []);

  const handleFallbackSubmit = useCallback((loc: FallbackPickedLocation) => {
    setGpsBase({
      coords: loc.coords,
      source: loc.source,
      addressText: loc.addressText,
    });
    setGpsPhase('ready');
  }, []);

  const handleSelectSaved = useCallback((id: string) => {
    setSelectedAddressId(id);
    setGpsActive(false);
    setGpsBase(null);
    setGpsPhase('pre-prompt');
    setPermissionError(null);
  }, []);

  const handleAddNewSubmit = useCallback(
    async (data: ManualAddressInput) => {
      const result = await addAddressMutation.mutateAsync({
        label: data.label,
        name: data.name,
        phone: data.phone,
        flatHouse: data.flatHouse,
        street: data.street,
        ...(data.landmark ? { landmark: data.landmark } : {}),
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        isDefault: addresses.length === 0,
      });
      setAddExpanded(false);
      setSelectedAddressId(result.addressId);
      setGpsActive(false);
    },
    [addAddressMutation, addresses.length],
  );

  // ---- Render -----------------------------------------------------------
  return (
    <div className="p-5 space-y-5">
      {/* Mode selector */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Where should we meet?</h3>
        <div role="radiogroup" aria-label="Booking location" className="grid grid-cols-2 gap-2">
          <ModeTile
            selected={bookingLocationKind === 'spa'}
            onClick={() => onKindChange('spa')}
            title="At the Salon"
            sub={spaName ? `Visit ${spaName}` : 'Visit the salon for your service'}
          />
          <ModeTile
            selected={bookingLocationKind === 'home'}
            onClick={() => onKindChange('home')}
            title="At Home"
            sub="Our team comes to your door"
          />
        </div>
      </section>

      {bookingLocationKind === 'spa' ? (
        <section className="bg-white rounded-2xl p-4 shadow-sm flex items-start gap-3">
          <MapPin className="w-5 h-5 text-brand-maroon-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {spaName ? `Booking at ${spaName}` : 'Booking at the salon'}
            </p>
            <p className="text-xs text-gray-500 mt-1">The full address is on your confirmation.</p>
          </div>
        </section>
      ) : null}

      {/* v3 (2026-05-13 — location unification): map renders the moment
          At-Home is selected AND we have coords for the selected saved
          address (stored `geo` preferred; lazy geocoding fills legacy
          addresses asynchronously). `skipInitialGeocode` is `true` here so
          the mount-time reverse-geocode doesn't overwrite the saved
          address's text. Drag still works — the parent treats a drag as
          intent to refine the booking coords (see handleMapChange).
          Key bound to addressId + has-geo so we only remount when the
          user picks a different address. */}
      {bookingLocationKind === 'home' && !gpsActive && mapsAvailable && selectedAddress &&
        (selectedAddress.geo || resolvedGeoById[selectedAddress.id]) ? (
        <section className="bg-white rounded-2xl p-3 shadow-sm overflow-hidden">
          <LocationMapPin
            key={`saved-${selectedAddress.id}-${selectedAddress.geo ? 'stored' : 'lazy'}`}
            initialCoords={
              selectedAddress.geo
                ? { lat: selectedAddress.geo.lat, lng: selectedAddress.geo.lng }
                : resolvedGeoById[selectedAddress.id]
            }
            onChange={handleMapChange}
            skipInitialGeocode
          />
        </section>
      ) : null}

      {/* HOME · Saved-address picker (default sub-mode) */}
      {bookingLocationKind === 'home' && !gpsActive ? (
        <SavedAddressList
          addresses={addresses}
          isLoading={addressesLoading}
          selectedId={selectedAddressId}
          onSelect={handleSelectSaved}
          onAddNew={() => setAddExpanded((v) => !v)}
          addOpen={addExpanded || addresses.length === 0}
          onUseCurrentLocation={mapsAvailable ? handleUseCurrentLocation : undefined}
          renderAddForm={
            <AddAddressInline
              isSubmitting={addAddressMutation.isPending}
              onSubmit={handleAddNewSubmit}
              onCancel={() => setAddExpanded(false)}
            />
          }
        />
      ) : null}

      {/* HOME · GPS / Map / Places sub-mode */}
      {bookingLocationKind === 'home' && gpsActive && mapsAvailable ? (
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Pin your location</p>
            <button
              type="button"
              onClick={handleBackToSaved}
              className="text-xs font-medium text-brand-maroon-500 hover:text-brand-maroon-600"
            >
              Back to saved
            </button>
          </div>

          {gpsPhase === 'fetching' ? (
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

          {(gpsPhase === 'ready' || gpsPhase === 'fallback-typed') && initialPinCoords ? (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <LocationMapPin initialCoords={initialPinCoords} onChange={handleMapChange} />
            </div>
          ) : null}

          {gpsPhase === 'ready' || gpsPhase === 'fallback-typed' ? (
            <div className="space-y-2">
              <Label htmlFor="loc-autocomplete">Search an address</Label>
              <PlaceAutocompleteInput
                onPick={handleAutocompletePick}
                placeholder="Search for your address"
                defaultValue={gpsBase?.addressText ?? ''}
              />
            </div>
          ) : null}

          {(gpsPhase === 'ready' || gpsPhase === 'fallback-typed') && gpsBase ? (
            <div className="rounded-lg border border-brand-maroon-200 bg-brand-maroon-50 px-3 py-2 text-xs text-brand-maroon-800">
              <span className="font-semibold">Selected:</span> {gpsBase.addressText || '—'}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* HOME · No Maps key → typed-only fallback */}
      {bookingLocationKind === 'home' && gpsActive && !mapsAvailable ? (
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Enter address</p>
            <button
              type="button"
              onClick={handleBackToSaved}
              className="text-xs font-medium text-brand-maroon-500 hover:text-brand-maroon-600"
            >
              Back to saved
            </button>
          </div>
          <MapsKeyMissingFallback spaCoords={spaCoords} onSubmit={handleFallbackSubmit} />
        </section>
      ) : null}

      {/* HOME · Doorstep instructions (visible once a location is chosen) */}
      {bookingLocationKind === 'home' && (selectedAddress || gpsBase) ? (
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <Label htmlFor="loc-additional-details">
            Doorstep instructions
            <span className="ml-1 text-xs text-brand-maroon-400">
              ({additionalDetails.length}/{DETAILS_MAX})
            </span>
          </Label>
          <textarea
            id="loc-additional-details"
            value={additionalDetails}
            onChange={(e) => setAdditionalDetails(e.target.value.slice(0, DETAILS_MAX))}
            maxLength={DETAILS_MAX}
            placeholder="Gate code, floor, parking, landmarks…"
            rows={3}
            className="flex w-full rounded-lg border border-brand-maroon-200 bg-background px-3 py-2 text-sm placeholder:text-brand-maroon-400 focus-visible:outline-none focus-visible:border-brand-gold-500 focus-visible:ring-2 focus-visible:ring-brand-gold-500"
          />
        </section>
      ) : null}

      {/* Step-level Continue CTA — duplicates the wizard's bottom bar action
          but in-flow with the step content so the user always sees a clear
          next-step affordance, including in "At the Salon" where there's no
          other input to focus on. */}
      <button
        type="button"
        onClick={onContinue}
        disabled={!canProceed}
        aria-disabled={!canProceed}
        className={`w-full min-h-[52px] rounded-2xl font-semibold text-white transition-all flex items-center justify-center gap-1 ${
          canProceed
            ? 'bg-gradient-to-r from-brand-maroon-500 to-brand-maroon-600 active:scale-[0.99]'
            : 'bg-gray-200 text-gray-400'
        }`}
      >
        Continue to schedule
      </button>

      <LocationRationaleModal
        open={showRationaleModal}
        onAllow={handleRationaleAllow}
        onDeny={handleRationaleDeny}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode tile
// ---------------------------------------------------------------------------

interface ModeTileProps {
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly title: string;
  readonly sub: string;
}

function ModeTile({ selected, onClick, title, sub }: ModeTileProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-left transition-colors min-h-[68px] ${
        selected
          ? 'border-brand-maroon-500 bg-brand-maroon-50 text-brand-maroon-700'
          : 'border-gray-200 bg-white text-gray-700'
      }`}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Saved address list + cards
// ---------------------------------------------------------------------------

interface SavedAddressListProps {
  readonly addresses: readonly SavedAddress[];
  readonly isLoading: boolean;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onAddNew: () => void;
  readonly addOpen: boolean;
  readonly renderAddForm: React.ReactNode;
  readonly onUseCurrentLocation?: () => void;
}

function SavedAddressList({
  addresses,
  isLoading,
  selectedId,
  onSelect,
  onAddNew,
  addOpen,
  renderAddForm,
  onUseCurrentLocation,
}: SavedAddressListProps) {
  const isEmpty = !isLoading && addresses.length === 0;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-gray-500">
          {isEmpty ? 'Add a delivery address' : 'Saved addresses'}
        </h3>
        {onUseCurrentLocation ? (
          <button
            type="button"
            onClick={onUseCurrentLocation}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-maroon-500 hover:text-brand-maroon-600 min-h-[36px]"
          >
            <Navigation className="w-3.5 h-3.5" />
            Use current location
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : addresses.length > 0 ? (
        <div role="radiogroup" aria-label="Saved addresses" className="space-y-2">
          {addresses.map((addr) => (
            <SavedAddressCard
              key={addr.id}
              address={addr}
              selected={addr.id === selectedId}
              onSelect={() => onSelect(addr.id)}
            />
          ))}
        </div>
      ) : null}

      {/* Empty state: render the inline form directly so the user isn't
          forced through an extra "Add" tap. When there is at least one
          saved address, the form stays collapsed behind an explicit toggle. */}
      {addresses.length > 0 ? (
        <button
          type="button"
          onClick={onAddNew}
          aria-expanded={addOpen}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-brand-maroon-300 bg-white text-brand-maroon-600 text-sm font-semibold hover:bg-brand-maroon-50 active:scale-[0.99] transition-colors min-h-[48px]"
        >
          <Plus className="w-4 h-4" />
          {addOpen ? 'Close form' : 'Add new address'}
        </button>
      ) : null}

      {addOpen ? renderAddForm : null}
    </section>
  );
}

interface SavedAddressCardProps {
  readonly address: SavedAddress;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

function SavedAddressCard({ address, selected, onSelect }: SavedAddressCardProps) {
  const meta = LABEL_META[address.label];
  const LabelIcon = meta.icon;
  const line = formatAddressLine(address);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`w-full text-left bg-white rounded-2xl shadow-sm p-4 border transition-colors ${
        selected ? 'border-brand-maroon-500 ring-2 ring-brand-maroon-200' : 'border-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center ${meta.tint}`}
        >
          <LabelIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{address.name}</span>
            <span
              className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded ${meta.tint}`}
            >
              {meta.chip}
            </span>
            {address.isDefault ? (
              <span className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded bg-brand-gold-50 text-brand-gold-700 border border-brand-gold-200">
                Default
              </span>
            ) : null}
          </div>
          {/* GPS-detected addresses carry the sentinel `'0000000'` phone
              (the auth user had no phoneNumber on file). Show a friendlier
              line in those cases instead of leaking the sentinel literal
              into the booking wizard card. Red-team T-B6 finding. */}
          {address.label === 'detected' && address.phone === DETECTED_PHONE_SENTINEL ? (
            <p className="text-xs text-gray-500 mt-0.5">
              GPS detected · tap to confirm or edit
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">{address.phone}</p>
          )}
          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed line-clamp-2">{line}</p>
        </div>
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            selected ? 'border-brand-maroon-500 bg-brand-maroon-500' : 'border-gray-300 bg-white'
          }`}
          aria-hidden="true"
        >
          {selected ? <Check className="w-3 h-3 text-white" strokeWidth={3} /> : null}
        </div>
      </div>
    </button>
  );
}
