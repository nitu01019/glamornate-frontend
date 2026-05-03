'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useFeaturedSpas } from '@/hooks/useSpas';
import { isFirebaseConfigured } from '@/lib/firebase';
import { TopRatedSkeleton } from './Skeletons';
import { Star, MapPin, ChevronRight } from 'lucide-react';

const DEFAULT_SPA_IMAGE =
  'https://images.unsplash.com/photo-1540555700478-4be289fbec6f?w=800&q=80';

const DEMO_SPAS = [
  {
    id: 'demo-tr-1',
    name: 'Serenity Spa',
    featuredImage: '',
    rating: { overall: 4.9, count: 203 },
    location: { city: 'Mumbai', state: 'Maharashtra', address: '', geo: { lat: 0, lng: 0 } },
    categories: ['massage', 'facial', 'aromatherapy'],
    tier: 'premium' as const,
  },
  {
    id: 'demo-tr-2',
    name: 'Golden Touch Wellness',
    featuredImage: '',
    rating: { overall: 4.8, count: 156 },
    location: { city: 'Delhi', state: 'Delhi', address: '', geo: { lat: 0, lng: 0 } },
    categories: ['body', 'hair'],
    tier: 'partner' as const,
  },
  {
    id: 'demo-tr-3',
    name: 'Lotus Retreat',
    featuredImage: '',
    rating: { overall: 4.7, count: 98 },
    location: { city: 'Bangalore', state: 'Karnataka', address: '', geo: { lat: 0, lng: 0 } },
    categories: ['massage', 'nails'],
    tier: 'premium' as const,
  },
];

export default function TopRatedSpas() {
  const { data: featuredSpas, isLoading } = useFeaturedSpas();
  const isDemoMode = !isFirebaseConfigured();
  const displaySpas = featuredSpas && featuredSpas.length > 0 ? featuredSpas : (isDemoMode ? DEMO_SPAS : []);

  return (
    <section className="py-6 px-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Top Rated</h2>
        <Link
          href="/spas?sort=rating"
          className="flex items-center gap-1 text-brand-maroon-600 text-sm font-medium"
        >
          See All
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <>
            <TopRatedSkeleton />
          </>
        ) : displaySpas.length > 0 ? (
          displaySpas.slice(0, 4).map(spa => (
            <Link
              key={spa.id}
              href={isDemoMode ? '#' : `/spas/${spa.id}`}
              className="block bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4">
                <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
                  <Image
                    src={spa.featuredImage || DEFAULT_SPA_IMAGE}
                    alt={spa.name}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                  {isDemoMode && (
                    <div className="absolute top-1 left-1 bg-brand-gold-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-semibold shadow">
                      Demo
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 line-clamp-1">
                      {spa.name}
                    </h3>
                    <div className="flex items-center gap-1 text-sm shrink-0">
                      <Star className="w-4 h-4 fill-brand-gold-400 text-brand-gold-400" />
                      <span className="font-medium text-gray-800">
                        {spa.rating?.overall?.toFixed(1) || '4.5'}
                      </span>
                      <span className="text-gray-400">
                        ({spa.rating?.count || 0})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="line-clamp-1">
                      {spa.location?.city}, {spa.location?.state}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(spa.categories || []).slice(0, 3).map(cat => (
                      <span
                        key={cat}
                        className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full capitalize"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1 text-brand-maroon-600 text-sm font-medium">
                      Book Now
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : null}
      </div>
    </section>
  );
}
