'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useCategories, useMostBooked } from '@/hooks/useHomeData';
import { useLocation } from '@/lib/location-provider';
import { computeBadges } from '@/lib/badge-engine';
import { catalogServices, catalogCategories } from '@/data/glamornate-catalog';
import ServiceCard from './ServiceCard';
import { ServiceCardSkeleton } from './HomeSkeletons';
import type { ServiceItem } from './types';
import type { HomeService } from '@/lib/mock-data';

/** Map API HomeService → component ServiceItem (badges computed dynamically) */
function toServiceItem(s: HomeService, allServices: readonly HomeService[]): ServiceItem {
  return {
    id: s.id,
    name: s.name,
    duration: s.duration,
    price: s.basePrice,
    originalPrice: s.originalPrice ?? s.basePrice,
    discount: s.discountPercent ?? 0,
    image: s.image,
    category: s.category,
    badges: computeBadges(s, allServices),
  };
}

const LOAD_TIMEOUT_MS = 10_000;

interface MostBookedSectionProps {
  onAddToCart?: (serviceId: string) => void;
  onUpdateQuantity?: (serviceId: string, quantity: number) => void;
  cartItems?: Record<string, number>;
}

export default function MostBookedSection({
  onAddToCart,
  onUpdateQuantity,
  cartItems = {},
}: MostBookedSectionProps) {
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { location: rawLocation } = useLocation();

  // Defer location to client-only to avoid SSR hydration mismatch
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);
  const location = hasMounted ? rawLocation : null;

  const { data: categories, isError: categoriesError } = useCategories();

  // Build chip data — fall back to catalog categories on error
  const categorySource = categoriesError || !categories ? catalogCategories : categories;
  const filterChips = (categorySource ?? []).slice(0, 5).map((c) => ({
    slug: c.slug,
    name: c.name,
  }));

  const { data: mostBookedResult, isLoading, isError, refetch } = useMostBooked(activeFilter, location?.city);

  useEffect(() => {
    if (isLoading) {
      timerRef.current = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setTimedOut(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoading]);

  const showFallback = isError || timedOut;

  // Use API data or fall back to catalog services
  const allServices: HomeService[] = showFallback
    ? catalogServices.slice(0, 8)
    : (mostBookedResult?.services ?? []);

  const fallbackLevel = (!showFallback && mostBookedResult?.fallbackLevel) ? mostBookedResult.fallbackLevel : 'platform';
  const serviceItems = allServices.map((s) => toServiceItem(s, allServices));

  return (
    <section className="bg-white py-5">
      {/* Header — adaptive based on fallback level */}
      <div className="px-4 mb-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {fallbackLevel === 'city' && location
                ? `Most Booked in ${location.city}`
                : fallbackLevel === 'backfill'
                  ? 'Popular Services'
                  : 'Trending Services'}
            </h2>
            {fallbackLevel === 'city' && location && (
              <p className="text-sm text-gray-500">Top picks in your city</p>
            )}
            {fallbackLevel === 'backfill' && (
              <p className="text-sm text-gray-500">Curated picks for you</p>
            )}
            {fallbackLevel === 'platform' && (
              <p className="text-sm text-gray-500">Loved across India</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {showFallback && (
              <button
                onClick={() => { setTimedOut(false); void refetch(); }}
                className="text-xs text-brand-maroon-500 font-medium underline"
                type="button"
              >
                Retry
              </button>
            )}
            {location && (
              <div className="flex items-center gap-1 text-brand-maroon-500">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">{location.city}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter chips — horizontally scrollable */}
      <div className="flex overflow-x-auto gap-2 px-4 pb-3 scrollbar-hide">
        {filterChips.map((chip) => (
          <button
            key={chip.slug}
            onClick={() => setActiveFilter(chip.slug === activeFilter ? undefined : chip.slug)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeFilter === chip.slug
                ? 'bg-brand-maroon-500 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-brand-maroon-200'
            }`}
          >
            {chip.name}
          </button>
        ))}
      </div>

      {/* Service cards — horizontally scrollable */}
      <div className="flex overflow-x-auto gap-3 px-4 pb-2 scrollbar-hide snap-x-mandatory">
        {isLoading && !timedOut
          ? Array.from({ length: 3 }).map((_, i) => <ServiceCardSkeleton key={i} />)
          : serviceItems.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                quantity={cartItems[service.id] ?? 0}
                onAddToCart={onAddToCart}
                onUpdateQuantity={onUpdateQuantity}
              />
            ))}
      </div>
    </section>
  );
}
