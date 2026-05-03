'use client';

import { useState, useCallback } from 'react';
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
  Navigation,
} from 'lucide-react';
import type { SavedAddress, AddressLabel } from '@/types';

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

interface AddressFormDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly editingAddress: SavedAddress | null;
  readonly onSubmit: (data: AddressFormData) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Label config
// ---------------------------------------------------------------------------

const LABEL_OPTIONS: readonly {
  value: AddressLabel;
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
      label: address.label,
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
  const [locating, setLocating] = useState(false);

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
  // Geolocation + Nominatim reverse-geocode
  // -----------------------------------------------------------------------
  const handleUseCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10_000,
          }),
      );
      const { latitude, longitude } = position.coords;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } },
      );
      if (!res.ok) throw new Error('Geocoding failed');
      const data = await res.json();
      const addr = data.address ?? {};

      setFormData((prev) => ({
        ...prev,
        street: [addr.road, addr.neighbourhood, addr.suburb]
          .filter(Boolean)
          .join(', ') || prev.street,
        city: addr.city || addr.town || addr.village || prev.city,
        state: addr.state || prev.state,
        pincode: addr.postcode || prev.pincode,
      }));
    } catch {
      // Silently fail -- user can fill manually
    } finally {
      setLocating(false);
    }
  }, []);

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

    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing = editingAddress !== null;

  return (
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
              onValueChange={(v) => setField('label', v as AddressLabel)}
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

          {/* Use current location */}
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="flex items-center gap-2 text-sm font-medium text-brand-maroon-500 hover:text-brand-maroon-600 transition-colors min-h-[44px]"
          >
            {locating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
            {locating ? 'Detecting location...' : 'Use Current Location'}
          </button>

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
