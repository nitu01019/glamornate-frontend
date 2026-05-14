'use client';

/**
 * LocationMapPin
 * --------------
 * Customer-facing Google Map with a draggable, branded pin. Used both
 * by the booking-wizard At-Home flow (centered on the selected saved
 * address's stored `geo`) and the GPS sub-flow (centered on a fresh GPS
 * fix). Drag emits the new coords + reverse-geocoded address to the
 * parent via `onChange`.
 *
 * v3 (2026-05-13 — location unification):
 *  - New `skipInitialGeocode` prop suppresses the mount-time
 *    `reverseGeocodeCoords` call. The booking-wizard saved-address path
 *    passes `true` because the saved doc already carries the address
 *    text; saving a Maps-JS / backend round-trip on every mount.
 *  - Branded `AdvancedMarker`: 40 px maroon-gradient circle with white
 *    ring + drop-shadow + lucide `<MapPin>` glyph. Replaces the default
 *    red pin so the map matches the rest of the customer surface.
 *  - Error boundary catches APIProvider / Map mount failures
 *    (referer-restriction mismatch, transient SDK load failures) and
 *    renders a stone-tinted fallback card instead of a blank rectangle.
 */

import * as React from 'react';
import {
  Map,
  AdvancedMarker,
  useApiLoadingStatus,
  useMap,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, MapPin, Move } from 'lucide-react';
import { reverseGeocodeCoords } from '@/lib/location/reverse-geocode-client';

export interface LocationMapPinChange {
  coords: { lat: number; lng: number; accuracy: number };
  addressText: string;
  placeId?: string;
  source: 'gps' | 'address_picked_on_map';
}

export interface LocationMapPinProps {
  readonly initialCoords: { lat: number; lng: number };
  readonly onChange: (loc: LocationMapPinChange) => void;
  /**
   * When `true`, the component does NOT run a reverse-geocode on mount.
   * Pass `true` when the parent already has the address text from a
   * saved-address record (avoids a redundant backend round-trip on every
   * pick). Defaults to `false` for the fresh-GPS path which needs the
   * text. v3 (2026-05-13).
   */
  readonly skipInitialGeocode?: boolean;
}

const DRAG_DEBOUNCE_MS = 500;

// The drag-end event ships a `latLng` with `.lat()`/`.lng()` accessors
// (`google.maps.MapMouseEvent`). We narrow structurally because the
// global `google` namespace requires `@types/google.maps`, which this
// workspace does not install.
interface DragEndEvent {
  latLng?: { lat: () => number; lng: () => number } | null;
}

// ---------------------------------------------------------------------------
// Error boundary — wraps the `<Map>` so an APIProvider load failure
// (referer-restriction mismatch, SDK fetch error) falls back to a
// readable card instead of a blank 380 px rectangle.
// ---------------------------------------------------------------------------

interface MapErrorBoundaryState {
  hasError: boolean;
}

class MapErrorBoundary extends React.Component<
  { children: React.ReactNode },
  MapErrorBoundaryState
> {
  state: MapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown): void {
    // eslint-disable-next-line no-console
    console.warn('LocationMapPin: Map mount failed; rendering fallback card', { error, info });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-6 text-center text-sm text-stone-700">
          <MapPin className="mx-auto mb-2 h-6 w-6 text-stone-400" aria-hidden />
          Map preview is currently unavailable. Your address is saved.
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function MapsUnavailableCard(): JSX.Element {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-6 text-center text-sm text-stone-700">
      <MapPin className="mx-auto mb-2 h-6 w-6 text-stone-400" aria-hidden />
      Map preview is currently unavailable. Your address is saved.
    </div>
  );
}

export function LocationMapPin({
  initialCoords,
  onChange,
  skipInitialGeocode = false,
}: LocationMapPinProps): JSX.Element {
  // v3 (2026-05-13): when the Maps JS SDK fails to load (e.g. App Check
  // enforcement on the Maps API key rejects the debug token on emulators),
  // we render the same fallback card the error boundary uses, instead of
  // letting Google's own "Oops! Something went wrong" overlay take the
  // whole 380 px height. This is a runtime check; the GCP-side fix is
  // separate (disable App Check enforcement on Maps JavaScript API or
  // configure a real debug token in App Check console).
  const apiStatus = useApiLoadingStatus();
  const [authFailed, setAuthFailed] = useState<boolean>(false);

  // Google Maps JS calls `window.gm_authFailure()` when its tile loader
  // fails authentication (e.g. App Check token rejected, referer
  // mismatch). This is independent of `useApiLoadingStatus` (which only
  // tracks SDK script loading). Install a listener so we can show our
  // friendly fallback instead of Google's gray "Oops!" overlay.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const previous = (window as unknown as { gm_authFailure?: () => void }).gm_authFailure;
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
      setAuthFailed(true);
      previous?.();
    };
    return () => {
      (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = previous;
    };
  }, []);

  const mapsUnavailable =
    apiStatus === APILoadingStatus.FAILED ||
    apiStatus === APILoadingStatus.AUTH_FAILURE ||
    authFailed;

  const [pin, setPin] = useState<{ lat: number; lng: number }>(initialCoords);
  // Drag-hint dismissable chip — shown on first paint, hidden once the
  // user starts dragging the pin. Persists the dismissed state in
  // sessionStorage so the hint does NOT reappear when the map remounts
  // (booking wizard re-keys the map per saved-address selection — red-team
  // T-B3 flagged the unnecessary repetition). Tab close still resets it.
  const [showDragHint, setShowDragHint] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.sessionStorage.getItem('glamornate_drag_hint_dismissed') !== '1';
    } catch {
      return true;
    }
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emitFromCoords = useCallback(
    async (lat: number, lng: number, source: LocationMapPinChange['source']) => {
      const result = await reverseGeocodeCoords({ lat, lng });
      if (result.status !== 'ok') {
        // eslint-disable-next-line no-console
        console.warn('reverseGeocode failed', result.status);
        return;
      }
      onChangeRef.current({
        coords: { lat, lng, accuracy: 0 },
        addressText: result.formattedAddress,
        ...(result.placeId ? { placeId: result.placeId } : {}),
        source,
      });
    },
    [],
  );

  // On mount: run the reverse-geocode UNLESS the parent told us to skip
  // (saved-address path already has the text). v3 — see prop docs.
  useEffect(() => {
    if (skipInitialGeocode) return;
    void emitFromCoords(initialCoords.lat, initialCoords.lng, 'gps');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleDragStart = useCallback(() => {
    // First drag means the user has discovered the marker is moveable —
    // hide the hint chip; it would be visual noise from this point on.
    setShowDragHint(false);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem('glamornate_drag_hint_dismissed', '1');
      } catch {
        // Storage unavailable — fall back to in-memory dismissal only.
      }
    }
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const latLng = e.latLng;
      if (!latLng) return;
      const lat = latLng.lat();
      const lng = latLng.lng();
      setPin({ lat, lng });
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void emitFromCoords(lat, lng, 'address_picked_on_map');
      }, DRAG_DEBOUNCE_MS);
    },
    [emitFromCoords],
  );

  // Recenter snaps the map + marker back to `initialCoords` (the GPS fix
  // or saved-address coords the parent originally passed in) and re-emits
  // the reverse-geocoded address so the parent's "selected address" copy
  // refreshes. Uses a child component (RecenterControl) because `useMap`
  // must be called inside the `<Map>` MapContext.
  const handleRecenter = useCallback(() => {
    setPin(initialCoords);
    setShowDragHint(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void emitFromCoords(initialCoords.lat, initialCoords.lng, 'gps');
  }, [initialCoords, emitFromCoords]);

  if (mapsUnavailable) {
    return <MapsUnavailableCard />;
  }

  return (
    <MapErrorBoundary>
      <div className="relative overflow-hidden rounded-2xl" style={{ width: '100%', height: 380 }}>
        <Map
          mapId="glamornate-booking-pin"
          defaultCenter={initialCoords}
          defaultZoom={17}
          gestureHandling="greedy"
          // v4 (2026-05-14): drop the Google chrome (zoom +/-, map-type
          // switcher, street view pegman, fullscreen, rotate) so the map
          // reads as a calm spatial confirmation rather than a busy travel
          // guide. The custom drag hint + Recenter FAB below are now the
          // only on-map chrome.
          disableDefaultUI={true}
          zoomControl={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          rotateControl={false}
          clickableIcons={false}
        >
          <AdvancedMarker
            draggable
            position={pin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Branded pin — maroon→deeper-maroon gradient, white ring,
                soft drop-shadow + lucide MapPin glyph. Matches the
                aesthetic of LocationPulse and the brand palette. */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-maroon-500 to-brand-maroon-700 shadow-[0_8px_24px_rgba(136,14,79,0.35)] ring-2 ring-white">
              <MapPin className="h-5 w-5 text-white drop-shadow-sm" aria-hidden />
            </div>
          </AdvancedMarker>
          <RecenterControl target={initialCoords} pinPosition={pin} />
        </Map>

        {/* Drag-to-adjust hint — dismisses on first drag. */}
        {showDragHint && (
          <div
            data-testid="location-map-pin-drag-hint"
            className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/65 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white shadow-sm"
            aria-hidden="true"
          >
            <Move className="h-3.5 w-3.5" />
            Drag the pin to adjust
          </div>
        )}

        {/* Recenter-to-original FAB. */}
        <button
          type="button"
          onClick={handleRecenter}
          data-testid="location-map-pin-recenter"
          aria-label="Recenter map to your detected location"
          className="absolute bottom-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-maroon-600 shadow-lg ring-1 ring-inset ring-brand-maroon-100 transition-transform active:scale-95 hover:bg-brand-maroon-50"
        >
          <Crosshair className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </MapErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// RecenterControl — child component that lives inside <Map> so it can use
// `useMap()` to programmatically pan the map back to the parent-provided
// `target` coords when the marker position changes. Renders nothing.
// ---------------------------------------------------------------------------

interface RecenterControlProps {
  readonly target: { lat: number; lng: number };
  readonly pinPosition: { lat: number; lng: number };
}

function RecenterControl({ target, pinPosition }: RecenterControlProps): null {
  const map = useMap();
  // When `pinPosition` matches `target` after a recenter, pan the map back
  // to that coord so the marker actually visually moves. We compare by
  // value rather than reference because both come from React state.
  useEffect(() => {
    if (!map) return;
    if (pinPosition.lat !== target.lat || pinPosition.lng !== target.lng) return;
    map.panTo(pinPosition);
  }, [map, pinPosition, target]);
  return null;
}
