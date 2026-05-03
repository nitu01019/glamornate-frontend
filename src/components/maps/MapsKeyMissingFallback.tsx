'use client';

import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface FallbackPickedLocation {
  coords: { lat: number; lng: number; accuracy: number };
  addressText: string;
  source: 'address_typed';
}

interface MapsKeyMissingFallbackProps {
  spaCoords: { lat: number; lng: number } | null;
  onSubmit: (loc: FallbackPickedLocation) => void;
  apiError?: { status?: number; message: string } | null;
}

interface FormState {
  fullAddress: string;
  landmark: string;
  pincode: string;
  city: string;
  additionalDetails: string;
}

const DETAILS_MAX = 500;

const INITIAL: FormState = {
  fullAddress: '',
  landmark: '',
  pincode: '',
  city: '',
  additionalDetails: '',
};

const is403Error = (apiError: { status?: number; message: string }) =>
  apiError.status === 403 ||
  apiError.message?.includes('REQUEST_DENIED') ||
  apiError.message?.includes('RefererNotAllowedMapError');

export default function MapsKeyMissingFallback({
  spaCoords,
  onSubmit,
  apiError,
}: MapsKeyMissingFallbackProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [form, setForm] = useState<FormState>(INITIAL);

  if (apiKey && !apiError) return null;

  const showApiErrorBanner = apiError != null && is403Error(apiError);

  if (showApiErrorBanner) {
    Sentry.captureMessage('Maps API failed', {
      level: 'warning',
      tags: {
        errorStatus: apiError.status,
        errorMessage: apiError.message,
      },
    });
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isPincodeValid = /^\d{6}$/.test(form.pincode.trim());
  const isValid =
    form.fullAddress.trim().length > 0 &&
    form.city.trim().length > 0 &&
    isPincodeValid;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid) return;
    const composed = [form.fullAddress, form.landmark, form.city, form.pincode]
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .join(', ');
    const coords = spaCoords
      ? { lat: spaCoords.lat, lng: spaCoords.lng, accuracy: 0 }
      : { lat: 0, lng: 0, accuracy: 0 };
    onSubmit({
      coords,
      addressText: composed,
      source: 'address_typed',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showApiErrorBanner ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>Map could not load due to a configuration issue. Enter your address below to continue.</span>
        </div>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-brand-gold-200 bg-brand-gold-50/40 p-3 text-xs text-brand-maroon-800"
        >
          Maps unavailable. Enter your address manually to continue.
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="map-fb-full-address">Full address</Label>
        <textarea
          id="map-fb-full-address"
          value={form.fullAddress}
          onChange={(e) => update('fullAddress', e.target.value)}
          placeholder="House / flat number, street, area"
          rows={3}
          className="flex w-full rounded-lg border border-brand-maroon-200 bg-background px-3 py-2 text-sm placeholder:text-brand-maroon-400 focus-visible:outline-none focus-visible:border-brand-gold-500 focus-visible:ring-2 focus-visible:ring-brand-gold-500"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="map-fb-landmark">Landmark</Label>
          <Input
            id="map-fb-landmark"
            value={form.landmark}
            onChange={(e) => update('landmark', e.target.value)}
            placeholder="Near park, mall, etc."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="map-fb-pincode">Pincode</Label>
          <Input
            id="map-fb-pincode"
            value={form.pincode}
            onChange={(e) => update('pincode', e.target.value)}
            placeholder="6-digit pincode"
            inputMode="numeric"
            maxLength={6}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="map-fb-city">City</Label>
        <Input
          id="map-fb-city"
          value={form.city}
          onChange={(e) => update('city', e.target.value)}
          placeholder="City"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="map-fb-details">
          Additional details
          <span className="ml-1 text-xs text-brand-maroon-400">
            ({form.additionalDetails.length}/{DETAILS_MAX})
          </span>
        </Label>
        <textarea
          id="map-fb-details"
          value={form.additionalDetails}
          onChange={(e) =>
            update('additionalDetails', e.target.value.slice(0, DETAILS_MAX))
          }
          maxLength={DETAILS_MAX}
          placeholder="Gate code, parking instructions, etc."
          rows={3}
          className="flex w-full rounded-lg border border-brand-maroon-200 bg-background px-3 py-2 text-sm placeholder:text-brand-maroon-400 focus-visible:outline-none focus-visible:border-brand-gold-500 focus-visible:ring-2 focus-visible:ring-brand-gold-500"
        />
      </div>

      <Button type="submit" disabled={!isValid} className="w-full">
        Confirm address
      </Button>
    </form>
  );
}
