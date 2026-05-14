'use client';

/**
 * LocationPulse — radar/ripple animation rendered while the location
 * pipeline is fetching. Three concentric brand-maroon circles fan out
 * with staggered `animate-ping` delays, framing a gradient pin in the
 * centre. CSS-only; no JS animation library.
 *
 * Used by:
 *   - AddressFormDialog "Use Current Location" button
 *   - any future call-site that wants the same "we're working on it"
 *     affordance.
 */

import { MapPin } from 'lucide-react';

export interface LocationPulseProps {
  readonly size?: 'sm' | 'md' | 'lg';
  readonly ariaLabel?: string;
}

const SIZE_MAP = {
  sm: {
    wrap: 'w-16 h-16',
    pin: 'w-7 h-7',
    icon: 'w-3.5 h-3.5',
    rings: ['w-10 h-10', 'w-14 h-14', 'w-16 h-16'] as const,
  },
  md: {
    wrap: 'w-24 h-24',
    pin: 'w-10 h-10',
    icon: 'w-5 h-5',
    rings: ['w-14 h-14', 'w-20 h-20', 'w-24 h-24'] as const,
  },
  lg: {
    wrap: 'w-36 h-36',
    pin: 'w-14 h-14',
    icon: 'w-7 h-7',
    rings: ['w-20 h-20', 'w-28 h-28', 'w-36 h-36'] as const,
  },
} as const;

export function LocationPulse({
  size = 'md',
  ariaLabel = 'Detecting your location',
}: LocationPulseProps) {
  const s = SIZE_MAP[size];
  return (
    <div
      className={`relative ${s.wrap} flex items-center justify-center`}
      role="status"
      aria-label={ariaLabel}
      data-testid="location-pulse"
    >
      <span
        aria-hidden
        className={`absolute ${s.rings[2]} rounded-full bg-brand-maroon-500/10 animate-ping`}
        style={{ animationDelay: '0ms', animationDuration: '1800ms' }}
      />
      <span
        aria-hidden
        className={`absolute ${s.rings[1]} rounded-full bg-brand-maroon-500/20 animate-ping`}
        style={{ animationDelay: '350ms', animationDuration: '1800ms' }}
      />
      <span
        aria-hidden
        className={`absolute ${s.rings[0]} rounded-full bg-brand-maroon-500/30 animate-ping`}
        style={{ animationDelay: '700ms', animationDuration: '1800ms' }}
      />
      <div
        className={`relative z-10 ${s.pin} rounded-full bg-gradient-to-br from-brand-maroon-500 to-brand-maroon-700 shadow-[0_8px_24px_rgba(136,14,79,0.35)] ring-1 ring-brand-gold-300/30 flex items-center justify-center`}
      >
        <MapPin className={`${s.icon} text-white drop-shadow-sm`} aria-hidden />
      </div>
    </div>
  );
}
