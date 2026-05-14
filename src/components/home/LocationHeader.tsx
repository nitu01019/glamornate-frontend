'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, ChevronDown } from 'lucide-react';
import { useLocation } from '@/lib/location-provider';
import LocationPicker from './LocationPicker';

export default function LocationHeader() {
  const router = useRouter();
  const { location } = useLocation();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const areaText = location?.area ?? 'Select your location';
  const subtitleText = location
    ? location.fullAddress ?? location.city
    : 'Tap to choose your city';

  return (
    <>
      <header className="sticky top-0 z-30 bg-white px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setIsPickerOpen(true)}
          className="flex items-start gap-2 min-w-0"
        >
          <MapPin className="w-5 h-5 text-brand-maroon-500 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-base font-semibold text-gray-900 truncate">
                {areaText}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
            </div>
            <p className="text-xs text-gray-500 truncate">{subtitleText}</p>
          </div>
        </button>

        <button
          onClick={() => router.push('/customer/elite')}
          className="flex-shrink-0 bg-brand-gold-500 hover:bg-brand-gold-600 text-brand-maroon-950 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
        >
          <span className="block text-[10px] font-normal leading-tight">Buy</span>
          <span className="block text-sm font-bold leading-tight italic">Elite</span>
        </button>
      </header>

      <LocationPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
      />
    </>
  );
}
