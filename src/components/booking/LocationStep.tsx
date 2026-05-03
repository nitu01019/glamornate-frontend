'use client';

import { useState, useCallback } from 'react';
import { Building2, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBookingStore } from '@/store/booking';
import type { BookingLocation, BookingAddress } from '@/types';

interface LocationStepProps {
  onNext: () => void;
}

const SALON_ADDRESS = 'Glamornate, Jammu';

export default function LocationStep({ onNext }: LocationStepProps) {
  const { location, address, setLocation, setAddress } = useBookingStore();

  const [selectedLocation, setSelectedLocation] = useState<BookingLocation | null>(
    location
  );
  const [form, setForm] = useState<BookingAddress>(
    address ?? {
      fullAddress: '',
      landmark: '',
      city: 'Jammu',
      pincode: '',
      phone: '',
    }
  );

  const handleSelectLocation = useCallback(
    (loc: BookingLocation) => {
      setSelectedLocation(loc);
      setLocation(loc);
    },
    [setLocation]
  );

  const handleFieldChange = useCallback(
    (field: keyof BookingAddress, value: string) => {
      const updated: BookingAddress = { ...form, [field]: value };
      setForm(updated);
      setAddress(updated);
    },
    [form, setAddress]
  );

  const isSalonSelected = selectedLocation === 'spa';
  const isHomeSelected = selectedLocation === 'home';

  const isHomeFormValid =
    form.fullAddress.trim().length > 0 &&
    /^\d{6}$/.test(form.pincode.trim()) &&
    form.phone.trim().length >= 10;

  const canProceed =
    isSalonSelected || (isHomeSelected && isHomeFormValid);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Where would you like your service?
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose a location for your appointment
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Salon card */}
        <button
          type="button"
          onClick={() => handleSelectLocation('spa')}
          className={cn(
            'flex flex-col items-center gap-3 rounded-xl border-2 p-5 text-center transition-all duration-200 active:scale-[0.97]',
            isSalonSelected
              ? 'border-brand-maroon-500 bg-brand-maroon-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300'
          )}
        >
          <Building2
            className={cn(
              'h-8 w-8 transition-colors',
              isSalonSelected ? 'text-brand-maroon-500' : 'text-gray-400'
            )}
          />
          <div>
            <p className="text-sm font-medium text-gray-900">At Salon</p>
            <p className="mt-0.5 text-xs text-gray-500">{SALON_ADDRESS}</p>
          </div>
        </button>

        {/* Home card */}
        <button
          type="button"
          onClick={() => handleSelectLocation('home')}
          className={cn(
            'flex flex-col items-center gap-3 rounded-xl border-2 p-5 text-center transition-all duration-200 active:scale-[0.97]',
            isHomeSelected
              ? 'border-brand-maroon-500 bg-brand-maroon-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300'
          )}
        >
          <Home
            className={cn(
              'h-8 w-8 transition-colors',
              isHomeSelected ? 'text-brand-maroon-500' : 'text-gray-400'
            )}
          />
          <div>
            <p className="text-sm font-medium text-gray-900">At Home</p>
            <p className="mt-0.5 text-xs text-gray-500">
              We&apos;ll come to you
            </p>
          </div>
        </button>
      </div>

      {/* Address form for "At Home" */}
      {isHomeSelected && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <Label htmlFor="fullAddress">
              Full Address <span className="text-rose-500">*</span>
            </Label>
            <textarea
              id="fullAddress"
              rows={3}
              value={form.fullAddress}
              onChange={(e) => handleFieldChange('fullAddress', e.target.value)}
              placeholder="House / flat number, street, locality..."
              className="mt-1 flex w-full rounded-lg border border-brand-maroon-200 bg-background px-3 py-2 text-sm placeholder:text-brand-maroon-400 focus-visible:outline-none focus-visible:border-brand-gold-500 focus-visible:ring-2 focus-visible:ring-brand-gold-500 focus-visible:ring-offset-0"
            />
          </div>

          <div>
            <Label htmlFor="landmark">Landmark</Label>
            <Input
              id="landmark"
              value={form.landmark ?? ''}
              onChange={(e) => handleFieldChange('landmark', e.target.value)}
              placeholder="Near temple, park, etc. (optional)"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                disabled
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="pincode">
                Pincode <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="pincode"
                inputMode="numeric"
                maxLength={6}
                value={form.pincode}
                onChange={(e) =>
                  handleFieldChange(
                    'pincode',
                    e.target.value.replace(/\D/g, '').slice(0, 6)
                  )
                }
                placeholder="180001"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="phone">
              Contact Phone <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) =>
                handleFieldChange(
                  'phone',
                  e.target.value.replace(/[^0-9+\-\s]/g, '')
                )
              }
              placeholder="+91 98765 43210"
              className="mt-1"
            />
          </div>
        </div>
      )}

      <Button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full"
        size="lg"
      >
        Next
      </Button>
    </div>
  );
}
