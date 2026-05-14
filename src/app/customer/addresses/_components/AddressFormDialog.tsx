'use client';

import { useState, useCallback, useEffect } from 'react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Home,
  Briefcase,
  Tag,
  Loader2,
  MapPin,
  MapPinOff,
} from 'lucide-react';
import type { SavedAddress, ManualAddressLabel } from '@/types';
import { useCurrentLocation } from '@/lib/location/hooks/useCurrentLocation';
import { LocationPulse } from '@/components/location/LocationPulse';
import { LocationRationaleModal } from '@/components/location/LocationRationaleModal';

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const addressSchema = z.object({
  label: z.enum(['home', 'work', 'other']),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name is too long'),
  phone: z
    .string()
    .min(10, 'Phone must be at least 10 digits')
    .max(15, 'Phone is too long')
    .regex(/^[+]?\d[\d\s-]{8,14}$/, 'Invalid phone number'),
  flatHouse: z
    .string()
    .min(1, 'Flat / House No. is required')
    .max(100, 'Too long'),
  street: z
    .string()
    .min(2, 'Street is required')
    .max(200, 'Too long'),
  landmark: z.string().max(100, 'Too long').optional().or(z.literal('')),
  city: z
    .string()
    .min(2, 'City is required')
    .max(50, 'Too long'),
  state: z
    .string()
    .min(2, 'State is required')
    .max(50, 'Too long'),
  pincode: z
    .string()
    .length(6, 'Pincode must be 6 digits')
    .regex(/^\d{6}$/, 'Pincode must be numeric'),
});

type AddressFormData = z.infer<typeof addressSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * v3 (2026-05-13 — location unification): `onSubmit` now also receives the
 * `geo` coords from `useCurrentLocation` when the user filled the form
 * via the "Use Current Location" button. The caller forwards them to the
 * `addAddress` callable so booking flows can mount the map without a
 * second client-side geocode round-trip.
 */
export type AddressFormPayload = AddressFormData & {
  geo?: { lat: number; lng: number; accuracy?: number };
};

interface AddressFormDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly editingAddress: SavedAddress | null;
  readonly onSubmit: (data: AddressFormPayload) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Label config
// ---------------------------------------------------------------------------

// Only manual labels are user-pickable here. `'detected'` is a GPS auto-
// save label and never shows up as a chip in this manual edit dialog.
const LABEL_OPTIONS: readonly {
  value: ManualAddressLabel;
  label: string;
  icon: typeof Home;
}[] = [
  { value: 'home', label: 'Home', icon: Home },
  { value: 'work', label: 'Work', icon: Briefcase },
  { value: 'other', label: 'Other', icon: Tag },
];

// ---------------------------------------------------------------------------
// Helper: initial form values
// ---------------------------------------------------------------------------

function getInitialValues(address: SavedAddress | null): AddressFormData {
  if (address) {
    return {
      // Editing a GPS-detected entry coerces the label to 'other' so the
      // user can pick a real category (Home/Work) — `'detected'` is
      // auto-only and never user-selectable in this manual form.
      label: address.label === 'detected' ? 'other' : address.label,
      name: address.name,
      phone: address.phone,
      flatHouse: address.flatHouse,
      street: address.street,
      landmark: address.landmark ?? '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    };
  }
  return {
    label: 'home',
    name: '',
    phone: '',
    flatHouse: '',
    street: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddressFormDialog({
  open,
  onOpenChange,
  editingAddress,
  onSubmit,
}: AddressFormDialogProps) {
  const initial = getInitialValues(editingAddress);

  const [formData, setFormData] = useState<AddressFormData>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof AddressFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  // Single canonical location hook — cache-hit instant paint, bridge GPS,
  // backend reverse-geocode, typed error taxonomy. See plan §6 Step 4.
  const loc = useCurrentLocation();

  // Reset form when dialog opens with new data
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        setFormData(getInitialValues(editingAddress));
        setErrors({});
      }
      onOpenChange(next);
    },
    [editingAddress, onOpenChange],
  );

  const setField = <K extends keyof AddressFormData>(
    key: K,
    value: AddressFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // -----------------------------------------------------------------------
  // Populate form fields from the canonical location hook. Runs whenever a
  // fresh address lands (cache-hit on open or new GPS fix after a tap).
  // We only overwrite the geo-derived fields (street/city/state/pincode);
  // name, phone, flatHouse, landmark stay user-typed.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!loc.address) return;
    setFormData((prev) => ({
      ...prev,
      street: loc.address?.line1 ?? prev.street,
      city: loc.address?.city ?? prev.city,
      state: loc.address?.state ?? prev.state,
      pincode: loc.address?.pincode ?? prev.pincode,
    }));
  }, [loc.address]);

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = addressSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof AddressFormData, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof AddressFormData;
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    // v3: attach the GPS coords surfaced by useCurrentLocation when the
    // user filled this form via the radar-pulse button. Booking flows
    // can then center the map on these coords without re-geocoding.
    const payload: AddressFormPayload = {
      ...result.data,
      ...(loc.coords && loc.source === 'gps'
        ? { geo: { lat: loc.coords.lat, lng: loc.coords.lng } }
        : {}),
    };

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing = editingAddress !== null;

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md mx-4 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900">
            {isEditing ? 'Edit Address' : 'Add New Address'}
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-sm">
            {isEditing
              ? 'Update the address details below.'
              : 'Fill in the details for your new address.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Label selection */}
          <div className="space-y-2">
            <Label className="text-gray-700">Save as</Label>
            <RadioGroup
              value={formData.label}
              onValueChange={(v) => setField('label', v as ManualAddressLabel)}
              className="flex gap-3"
            >
              {LABEL_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = formData.label === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-colors min-h-[44px] ${
                      selected
                        ? 'border-brand-maroon-500 bg-brand-maroon-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <RadioGroupItem value={opt.value} className="sr-only" />
                    <Icon
                      className={`w-4 h-4 ${
                        selected ? 'text-brand-maroon-500' : 'text-gray-400'
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        selected ? 'text-brand-maroon-700' : 'text-gray-600'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Use current location — canonical hook + radar pulse + typed
              error pills. Aesthetic per Claude's frontend-design skill:
              warm maroon→gold pin, brand-blush field, two-line copy. */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void loc.refresh()}
              disabled={loc.status === 'fetching'}
              className="flex w-full items-center gap-3 rounded-2xl border border-brand-maroon-200/60 bg-brand-blush/40 px-4 py-3 text-left transition-colors hover:bg-brand-blush/60 active:scale-[0.99] min-h-[56px] disabled:opacity-80"
            >
              {loc.status === 'fetching' ? (
                <LocationPulse size="sm" ariaLabel="Detecting your location" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-maroon-500 to-brand-maroon-700 shadow-[0_4px_14px_rgba(136,14,79,0.25)] ring-1 ring-brand-gold-300/30">
                  <MapPin className="h-5 w-5 text-white" aria-hidden />
                </div>
              )}
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-medium text-stone-900">
                  {loc.status === 'fetching'
                    ? 'Detecting your location…'
                    : loc.source === 'cache'
                      ? 'Refresh location'
                      : 'Use Current Location'}
                </span>
                <span className="block text-[13px] text-stone-500">
                  {loc.status === 'fetching'
                    ? "A moment — we're pinpointing your spot"
                    : 'Fill the address from where you are right now'}
                </span>
              </span>
            </button>

            {/* Error pills — every state actionable, never silent. */}
            {loc.error === 'permission-permanent' && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[13px] text-amber-900"
              >
                <MapPinOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">
                  Location is turned off for this app.{' '}
                  <button
                    type="button"
                    onClick={() => void loc.openSettings()}
                    className="font-semibold underline"
                  >
                    Open Settings
                  </button>{' '}
                  to allow it, or type the address below.
                </span>
              </div>
            )}
            {loc.error === 'permission-denied' && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-[13px] text-rose-900"
              >
                <span className="flex-1">
                  We need location permission to autofill.{' '}
                  <button
                    type="button"
                    onClick={() => void loc.refresh()}
                    className="font-semibold underline"
                  >
                    Try again
                  </button>{' '}
                  or type the address below.
                </span>
              </div>
            )}
            {(loc.error === 'service-down' ||
              loc.error === 'quota' ||
              loc.error === 'no-results' ||
              loc.error === 'timeout' ||
              loc.error === 'unknown') && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] text-stone-700"
              >
                <span className="flex-1">
                  {loc.error === 'quota'
                    ? 'Too many requests right now. Try again in a minute or type below.'
                    : loc.error === 'no-results'
                      ? 'Could not resolve your address. Please type below.'
                      : loc.error === 'service-down'
                        ? 'Location service is paused. Please type below.'
                        : loc.error === 'timeout'
                          ? 'Location is taking too long. Try again or type below.'
                          : 'Something went wrong. Try again or type below.'}{' '}
                  <button
                    type="button"
                    onClick={() => void loc.refresh()}
                    className="ml-1 font-semibold underline"
                  >
                    Try again
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Name */}
          <FieldWrapper label="Full Name" error={errors.name}>
            <Input
              value={formData.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="John Doe"
              className="min-h-[44px]"
            />
          </FieldWrapper>

          {/* Phone */}
          <FieldWrapper label="Phone Number" error={errors.phone}>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="9876543210"
              className="min-h-[44px]"
            />
          </FieldWrapper>

          {/* Flat / House */}
          <FieldWrapper label="Flat / House No." error={errors.flatHouse}>
            <Input
              value={formData.flatHouse}
              onChange={(e) => setField('flatHouse', e.target.value)}
              placeholder="Flat 202, Tower B"
              className="min-h-[44px]"
            />
          </FieldWrapper>

          {/* Street */}
          <FieldWrapper label="Street / Area" error={errors.street}>
            <Input
              value={formData.street}
              onChange={(e) => setField('street', e.target.value)}
              placeholder="MG Road, Indiranagar"
              className="min-h-[44px]"
            />
          </FieldWrapper>

          {/* Landmark */}
          <FieldWrapper label="Landmark (optional)" error={errors.landmark}>
            <Input
              value={formData.landmark ?? ''}
              onChange={(e) => setField('landmark', e.target.value)}
              placeholder="Near Central Mall"
              className="min-h-[44px]"
            />
          </FieldWrapper>

          {/* City + State row */}
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="City" error={errors.city}>
              <Input
                value={formData.city}
                onChange={(e) => setField('city', e.target.value)}
                placeholder="Bangalore"
                className="min-h-[44px]"
              />
            </FieldWrapper>
            <FieldWrapper label="State" error={errors.state}>
              <Input
                value={formData.state}
                onChange={(e) => setField('state', e.target.value)}
                placeholder="Karnataka"
                className="min-h-[44px]"
              />
            </FieldWrapper>
          </div>

          {/* Pincode */}
          <FieldWrapper label="Pincode" error={errors.pincode}>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={formData.pincode}
              onChange={(e) => setField('pincode', e.target.value.replace(/\D/g, ''))}
              placeholder="560038"
              className="min-h-[44px]"
            />
          </FieldWrapper>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white font-semibold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-60 min-h-[44px] flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Update Address' : 'Save Address'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
    <LocationRationaleModal
      open={loc.isRationaleOpen}
      onAllow={loc.acknowledgeRationale}
      onDeny={loc.dismissRationale}
    />
    </>
  );
}

// ---------------------------------------------------------------------------
// Tiny helper for field wrapper
// ---------------------------------------------------------------------------

function FieldWrapper({
  label,
  error,
  children,
}: {
  readonly label: string;
  readonly error?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-gray-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
