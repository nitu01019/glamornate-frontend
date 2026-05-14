'use client';

/**
 * AddAddressInline
 * ----------------
 * Compact inline form used inside the booking wizard's "At Home" step.
 *
 * Replaces the heavier `AddressFormDialog` modal used on `/customer/addresses`.
 * Lives in-flow under the saved-address list so the user can still see their
 * picker while filling in a new entry — no full-screen overlay, no mount
 * animation, no lag on opening.
 *
 * Brand theme preserved (brand-maroon palette). Validation reuses the
 * existing `manualAddressSchema` (10-digit India phone + 6-digit pincode)
 * so the wire payload matches what the addAddress callable expects.
 */

import { useState } from 'react';
import { Briefcase, Home, Loader2, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ManualAddressLabel } from '@/types';
import { manualAddressSchema, type ManualAddressInput } from '@/lib/schemas/saved-address';

const LABEL_OPTIONS: ReadonlyArray<{
  value: ManualAddressLabel;
  label: string;
  icon: typeof Home;
}> = [
  { value: 'home', label: 'Home', icon: Home },
  { value: 'work', label: 'Work', icon: Briefcase },
  { value: 'other', label: 'Other', icon: Tag },
];

interface AddAddressInlineProps {
  readonly isSubmitting: boolean;
  readonly onSubmit: (data: ManualAddressInput) => Promise<void>;
  readonly onCancel: () => void;
}

const INITIAL: ManualAddressInput = {
  label: 'home',
  name: '',
  phone: '',
  flatHouse: '',
  street: '',
  landmark: undefined,
  city: '',
  state: '',
  pincode: '',
};

export function AddAddressInline({ isSubmitting, onSubmit, onCancel }: AddAddressInlineProps) {
  const [data, setData] = useState<ManualAddressInput>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof ManualAddressInput, string>>>({});

  const setField = <K extends keyof ManualAddressInput>(key: K, value: ManualAddressInput[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = manualAddressSchema.safeParse({
      ...data,
      landmark: data.landmark && data.landmark.length > 0 ? data.landmark : undefined,
    });
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ManualAddressInput, string>> = {};
      for (const issue of result.error.issues) {
        const k = issue.path[0] as keyof ManualAddressInput;
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    await onSubmit(result.data);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm p-4 space-y-3"
      aria-label="Add a new address"
    >
      {/* Label chips */}
      <div className="flex items-center gap-2" role="radiogroup" aria-label="Save as">
        {LABEL_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = data.label === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setField('label', opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors min-h-[36px] ${
                selected
                  ? 'border-brand-maroon-500 bg-brand-maroon-50 text-brand-maroon-700'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>

      <Field label="Full name" error={errors.name}>
        <Input
          value={data.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Aisha Sharma"
          autoComplete="name"
          className="min-h-[44px]"
        />
      </Field>

      <Field label="Phone (10 digits)" error={errors.phone}>
        <Input
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={data.phone}
          onChange={(e) => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="9876543210"
          autoComplete="tel"
          className="min-h-[44px]"
        />
      </Field>

      <Field label="Flat / House" error={errors.flatHouse}>
        <Input
          value={data.flatHouse}
          onChange={(e) => setField('flatHouse', e.target.value)}
          placeholder="Flat 202, Tower B"
          autoComplete="address-line1"
          className="min-h-[44px]"
        />
      </Field>

      <Field label="Street / Area" error={errors.street}>
        <Input
          value={data.street}
          onChange={(e) => setField('street', e.target.value)}
          placeholder="MG Road, Indiranagar"
          autoComplete="address-line2"
          className="min-h-[44px]"
        />
      </Field>

      <Field label="Landmark (optional)" error={errors.landmark}>
        <Input
          value={data.landmark ?? ''}
          onChange={(e) => setField('landmark', e.target.value)}
          placeholder="Near Central Mall"
          className="min-h-[44px]"
        />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="City" error={errors.city}>
          <Input
            value={data.city}
            onChange={(e) => setField('city', e.target.value)}
            placeholder="Jammu"
            autoComplete="address-level2"
            className="min-h-[44px]"
          />
        </Field>
        <Field label="State" error={errors.state}>
          <Input
            value={data.state}
            onChange={(e) => setField('state', e.target.value)}
            placeholder="J&K"
            autoComplete="address-level1"
            className="min-h-[44px]"
          />
        </Field>
        <Field label="PIN" error={errors.pincode}>
          <Input
            inputMode="numeric"
            maxLength={6}
            value={data.pincode}
            onChange={(e) => setField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="180001"
            autoComplete="postal-code"
            className="min-h-[44px]"
          />
        </Field>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.99] transition-colors min-h-[44px] disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-brand-maroon-500 to-brand-maroon-600 text-white text-sm font-semibold active:scale-[0.99] transition-all disabled:opacity-60 min-h-[44px] flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Save address
        </button>
      </div>
    </form>
  );
}

interface FieldProps {
  readonly label: string;
  readonly error?: string;
  readonly children: React.ReactNode;
}

function Field({ label, error, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-600">{label}</Label>
      {children}
      {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
    </div>
  );
}
