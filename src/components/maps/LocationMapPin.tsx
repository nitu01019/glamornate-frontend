'use client';

import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useCallback, useEffect, useRef, useState } from 'react';
import { reverseGeocodeCoords } from '@/lib/location/reverse-geocode-client';

export interface LocationMapPinChange {
  coords: { lat: number; lng: number; accuracy: number };
  addressText: string;
  placeId?: string;
  source: 'gps' | 'address_picked_on_map';
}

export interface LocationMapPinProps {
  initialCoords: { lat: number; lng: number };
  onChange: (loc: LocationMapPinChange) => void;
}

const DRAG_DEBOUNCE_MS = 500;

// The drag-end event ships a `latLng` with `.lat()`/`.lng()` accessors
// (`google.maps.MapMouseEvent`). We narrow structurally because the
// global `google` namespace requires `@types/google.maps`, which this
// workspace does not install.
interface DragEndEvent {
  latLng?: { lat: () => number; lng: () => number } | null;
}

export function LocationMapPin({ initialCoords, onChange }: LocationMapPinProps) {
  const [pin, setPin] = useState<{ lat: number; lng: number }>(initialCoords);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emitFromCoords = useCallback(
    async (lat: number, lng: number, source: LocationMapPinChange['source']) => {
      const result = await reverseGeocodeCoords({ lat, lng });
      if (result.status !== 'ok') {
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

  // On mount: pre-populate the address by reverse-geocoding `initialCoords`.
  // The `source` is `gps` because the parent always seeds this component
  // with GPS-derived coords (per BookingLocationStep contract).
  useEffect(() => {
    void emitFromCoords(initialCoords.lat, initialCoords.lng, 'gps');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
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

  return (
    <div style={{ width: '100%', height: 380 }}>
      <Map
        mapId="glamornate-booking-pin"
        defaultCenter={initialCoords}
        defaultZoom={17}
        gestureHandling="greedy"
      >
        <AdvancedMarker draggable position={pin} onDragEnd={handleDragEnd} />
      </Map>
    </div>
  );
}
