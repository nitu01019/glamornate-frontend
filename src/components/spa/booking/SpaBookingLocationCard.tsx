'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Navigation, Phone, AlertCircle } from 'lucide-react';
import { openDirections } from '@/lib/maps-deeplink';
import type { BookingCustomerLocation } from '@/lib/contracts';
import MapsKeyMissingFallback from '@/components/maps/MapsKeyMissingFallback';

export interface SpaBookingLocationCardProps {
  booking: {
    bookingLocation?: 'spa' | 'home';
    customerLocation?: BookingCustomerLocation | null;
  };
  spa: {
    name: string;
    location?: {
      geo?: { lat: number; lng: number };
    };
  };
  customerPhone?: string;
}

function buildStaticMapUrl(lat: number, lng: number, key: string): string {
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=400x200&markers=${lat},${lng}&key=${key}`;
}

function StaticMapImage({
  lat,
  lng,
  alt,
  testId,
  onApiError,
}: {
  lat: number;
  lng: number;
  alt: string;
  testId: string;
  onApiError?: (err: { message: string }) => void;
}) {
  const [errored, setErrored] = useState(false);
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!mapsKey || errored) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Static Maps API URL is not next/image-compatible
    <img
      data-testid={testId}
      src={buildStaticMapUrl(lat, lng, mapsKey)}
      alt={alt}
      onError={() => {
        setErrored(true);
        onApiError?.({ message: 'REQUEST_DENIED' });
      }}
      className="rounded-lg w-full h-auto border border-gray-100"
    />
  );
}

export function SpaBookingLocationCard({
  booking,
  spa,
  customerPhone,
}: SpaBookingLocationCardProps) {
  const [mapsError, setMapsError] = useState<{ status?: number; message: string } | null>(null);

  const isHome = booking.bookingLocation === 'home';
  const location = booking.customerLocation;

  // Home + valid location: address card with map + directions
  if (isHome && location) {
    const { lat, lng } = location.coords;
    const addressText = location.addressText;
    const onGetDirections = () => {
      void openDirections({ lat, lng, address: addressText });
    };
    return (
      <Card
        className="border-0 shadow-sm rounded-2xl"
        data-testid="spa-booking-location-card"
      >
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-brand-maroon-100 rounded-xl flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-brand-maroon-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Service Address
              </p>
              <p className="font-medium text-gray-900 leading-snug">
                {addressText}
              </p>
            </div>
          </div>

          {mapsError ? (
            <MapsKeyMissingFallback
              spaCoords={spa.location?.geo ?? null}
              apiError={mapsError}
              onSubmit={() => undefined}
            />
          ) : (
            <StaticMapImage
              lat={lat}
              lng={lng}
              alt="Customer location map"
              testId="spa-booking-map-preview"
              onApiError={setMapsError}
            />
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onGetDirections}
              data-testid="spa-booking-directions-cta"
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-brand-maroon-500 text-white text-sm font-medium hover:bg-brand-maroon-600 active:scale-95 transition-all"
            >
              <Navigation className="w-4 h-4" />
              Get Directions
            </button>
            {customerPhone && (
              <a
                href={`tel:${customerPhone}`}
                data-testid="spa-booking-location-call-cta"
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-brand-maroon-500 text-brand-maroon-600 text-sm font-medium hover:bg-brand-maroon-50 active:scale-95 transition-all"
              >
                <Phone className="w-4 h-4" />
                Call Customer
              </a>
            )}
          </div>

          {location.additionalDetails && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Doorstep Notes
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {location.additionalDetails}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Home but no captured location (legacy bookings)
  if (isHome) {
    return (
      <Card
        className="border-0 shadow-sm rounded-2xl"
        data-testid="spa-booking-location-card"
      >
        <CardContent className="p-5 flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Service Address
            </p>
            <span className="inline-flex items-center mt-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
              No location captured
            </span>
            {customerPhone && (
              <p className="mt-2 text-sm text-gray-600">
                Please call the customer to confirm address.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // In-spa booking (default for legacy / explicit 'spa')
  const spaGeo = spa.location?.geo;
  return (
    <Card
      className="border-0 shadow-sm rounded-2xl"
      data-testid="spa-booking-location-card"
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-brand-maroon-100 rounded-xl flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-brand-maroon-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Location</p>
            <p className="font-medium text-gray-900">
              Booking will be at {spa.name}
            </p>
          </div>
        </div>
        {spaGeo && (
          <StaticMapImage
            lat={spaGeo.lat}
            lng={spaGeo.lng}
            alt={`${spa.name} map`}
            testId="spa-booking-spa-map-preview"
            onApiError={setMapsError}
          />
        )}
      </CardContent>
    </Card>
  );
}
