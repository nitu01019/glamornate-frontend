'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useFeaturedSpas } from '@/hooks/useSpas';
import { isFirebaseConfigured } from '@/lib/firebase';
import { SpaCardSkeleton } from './Skeletons';
import { Star, MapPin, ChevronRight, Sparkles } from 'lucide-react';

const DEFAULT_SPA_IMAGE =
  'https://images.unsplash.com/photo-1540555700478-4be289fbec6f?w=800&q=80';

const DEMO_SPAS = [
  {
    id: 'demo-1',
    name: 'Serenity Spa',
    featuredImage: '',
    rating: { overall: 4.8, count: 124 },
    location: { city: 'Mumbai', state: 'Maharashtra', address: '', geo: { lat: 0, lng: 0 } },
    categories: ['massage', 'facial'],
    tier: 'premium' as const,
  },
  {
    id: 'demo-2',
    name: 'Golden Touch Wellness',
    featuredImage: '',
    rating: { overall: 4.6, count: 89 },
    location: { city: 'Delhi', state: 'Delhi', address: '', geo: { lat: 0, lng: 0 } },
    categories: ['aromatherapy', 'body'],
    tier: 'partner' as const,
  },
  {
    id: 'demo-3',
    name: 'Bliss & Beyond',
    featuredImage: '',
    rating: { overall: 4.9, count: 203 },
    location: { city: 'Bangalore', state: 'Karnataka', address: '', geo: { lat: 0, lng: 0 } },
    categories: ['massage', 'hair'],
    tier: 'premium' as const,
  },
  {
    id: 'demo-4',
    name: 'Zen Garden Spa',
    featuredImage: '',
    rating: { overall: 4.5, count: 67 },
    location: { city: 'Pune', state: 'Maharashtra', address: '', geo: { lat: 0, lng: 0 } },
    categories: ['facial', 'nails'],
    tier: 'basic' as const,
  },
];

function getPriceTier(tier?: string): string {
  switch (tier) {
    case 'premium':
      return '$$$$';
    case 'partner':
      return '$$$';
    default:
      return '$$';
  }
}

export default function FeaturedSpas() {
  const { data: featuredSpas, isLoading } = useFeaturedSpas();
  const isDemoMode = !isFirebaseConfigured();
  const displaySpas = featuredSpas && featuredSpas.length > 0 ? featuredSpas : (isDemoMode ? DEMO_SPAS : []);

  return (
    <section className="py-6">
      <div className="flex items-center justify-between px-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Popular Near You
        </h2>
        <Link
          href="/spas"
          className="flex items-center gap-1 text-brand-maroon-600 text-sm font-medium"
        >
          See All
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="flex overflow-x-auto gap-4 px-4 pb-2 scrollbar-hide snap-x-mandatory scroll-smooth">
        {isLoading ? (
          <>
            <SpaCardSkeleton />
            <SpaCardSkeleton />
            <SpaCardSkeleton />
          </>
        ) : displaySpas.length > 0 ? (
          displaySpas.slice(0, 8).map(spa => (
            <Link
              key={spa.id}
              href={isDemoMode ? '#' : `/spas/${spa.id}`}
              className="w-[280px] flex-shrink-0 snap-start"
            >
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="relative h-40">
                  <Image
                    src={spa.featuredImage || DEFAULT_SPA_IMAGE}
                    alt={spa.name}
                    fill
                    className="object-cover"
                    sizes="280px"
                  />
                  {isDemoMode && (
                    <div className="absolute top-3 left-3 bg-brand-gold-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow">
                      Demo
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-full text-sm font-medium shadow">
                    <Star className="w-3.5 h-3.5 fill-brand-gold-400 text-brand-gold-400" />
                    <span className="text-gray-800">
                      {spa.rating?.overall?.toFixed(1) || '4.5'}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-brand-maroon-500 text-white px-2 py-0.5 rounded-full text-xs font-medium">
                    {getPriceTier(spa.tier)}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
                    {spa.name}
                  </h3>
                  <div className="flex items-center gap-1 text-gray-500 text-sm mb-2">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="line-clamp-1">
                      {spa.location?.city || 'Location'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(spa.categories || []).slice(0, 2).map(cat => (
                      <span
                        key={cat}
                        className="text-xs px-2 py-0.5 bg-brand-maroon-50 text-brand-maroon-600 rounded-full capitalize"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="w-full text-center py-8 text-gray-500">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No spas available yet</p>
          </div>
        )}
      </div>
    </section>
  );
}
