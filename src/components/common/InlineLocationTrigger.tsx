'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { useLocation } from '@/lib/location-provider';
import LocationPicker from '@/components/home/LocationPicker';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface InlineLocationTriggerProps {
  className?: string;
  size?: 'sm' | 'md';
}

// =============================================================================
// Component
// =============================================================================

/**
 * Compact pill button that displays the user's current city and opens the
 * LocationPicker bottom-sheet on tap. Lives inside page content — not the
 * global AppHeader chrome.
 *
 * When no location is set, shows "Set location" as a CTA label.
 */
export default function InlineLocationTrigger({
  className,
  size = 'sm',
}: InlineLocationTriggerProps) {
  const { location: rawLocation } = useLocation();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Defer client-only state to avoid SSR hydration mismatch.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  const location = hasMounted ? rawLocation : null;

  const label = location?.city ?? 'Set location';
  const ariaLabel = location?.city
    ? `Change location (currently ${location.city})`
    : 'Set your location';

  const sizeClasses = size === 'md' ? 'text-sm px-3 py-1.5 gap-1.5' : 'text-xs px-2.5 py-1 gap-1';
  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <>
      <button
        type="button"
        onClick={() => setIsPickerOpen(true)}
        aria-label={ariaLabel}
        data-testid="inline-location-trigger"
        className={cn(
          'inline-flex items-center rounded-full',
          'bg-brand-pink-50 text-brand-maroon-600 font-medium',
          'hover:bg-brand-pink-100 active:scale-[0.97] transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-500',
          sizeClasses,
          className,
        )}
      >
        <MapPin className={cn(iconSize, 'flex-shrink-0')} aria-hidden="true" />
        <span className="truncate max-w-[8rem]">{label}</span>
        <ChevronDown className={cn(iconSize, 'flex-shrink-0 opacity-70')} aria-hidden="true" />
      </button>

      <LocationPicker isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} />
    </>
  );
}
