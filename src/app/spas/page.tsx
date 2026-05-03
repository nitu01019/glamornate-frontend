'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useSpas, type SpaFilters } from '@/hooks/useSpas';
import { useLocation } from '@/lib/location-provider';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Search, MapPin, Star, SlidersHorizontal, X } from 'lucide-react';
import type { Spa, SpaCategory } from '@/types';

// Default placeholder images
const defaultSpaImages = [
  'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=600&auto=format',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&auto=format',
  'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=600&auto=format',
];

// Filter chip options
const categoryChips: { value: SpaCategory | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'massage', label: 'Massage' },
  { value: 'facial', label: 'Facial' },
  { value: 'body', label: 'Body' },
  { value: 'wellness', label: 'Wellness' },
  { value: 'manicure', label: 'Nails' },
];

const ratingChips = [
  { value: 0, label: 'Any' },
  { value: 4, label: '4+' },
  { value: 4.5, label: '4.5+' },
];

// Spa card skeleton
function SpaCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <Skeleton className="h-48 w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// Spa card component
function SpaCard({ spa, index }: { spa: Spa & { id: string }; index: number }) {
  const spaImage = spa.featuredImage || defaultSpaImages[index % defaultSpaImages.length];

  return (
    <Link href={`/spas/${spa.id}`} className="block">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
        {/* Image Section */}
        <div className="relative h-48">
          <Image
            src={spaImage}
            alt={spa.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Rating Badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-sm font-medium shadow">
            <Star className="w-4 h-4 fill-brand-gold-400 text-brand-gold-400" />
            <span className="text-gray-800">{spa.rating?.overall?.toFixed(1) || '4.5'}</span>
            <span className="text-gray-400 text-xs">({spa.rating?.count || 0})</span>
          </div>

          {/* Spa Name on Image */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white font-semibold text-lg line-clamp-1">{spa.name}</h3>
            <div className="flex items-center gap-1 text-white/80 text-sm">
              <MapPin className="w-3.5 h-3.5" />
              <span className="line-clamp-1">
                {spa.location?.city || 'Location'}, {spa.location?.state || ''}
              </span>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-4">
          {/* Categories */}
          <div className="flex flex-wrap gap-2 mb-3">
            {(spa.categories || []).slice(0, 3).map((cat) => (
              <span
                key={cat}
                className="text-xs px-2.5 py-1 bg-brand-maroon-50 text-brand-maroon-600 rounded-full capitalize"
              >
                {cat}
              </span>
            ))}
          </div>

          {/* Price Range & CTA */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {spa.tier === 'premium'
                ? 'From ₹₹₹₹'
                : spa.tier === 'partner'
                  ? 'From ₹₹₹'
                  : 'From ₹₹'}
            </span>
            <span className="text-brand-maroon-600 text-sm font-medium">View Details →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function SpasPage() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') as SpaCategory | null;

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<SpaCategory | ''>(initialCategory || '');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState('rating-desc');
  const { location: rawLocation } = useLocation();

  // Defer location to client-only to prevent SSR hydration mismatch
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  const location = hasMounted ? rawLocation : null;

  // Build filters
  const filters: SpaFilters = useMemo(() => {
    const [sortField, sortDir] = sortBy.split('-') as [
      'rating' | 'name' | 'createdAt',
      'asc' | 'desc',
    ];
    return {
      isActive: true,
      ...(location?.city && { city: location.city }),
      ...(selectedCategory && { category: selectedCategory }),
      ...(minRating > 0 && { minRating }),
      sortBy: sortField,
      sortDirection: sortDir,
    };
  }, [selectedCategory, minRating, sortBy, location?.city]);

  const { data: spas, isLoading, error, refetch } = useSpas(filters);

  // Client-side search filtering
  const filteredSpas = useMemo(() => {
    if (!spas) return [];
    if (!searchQuery.trim()) return spas;

    const query = searchQuery.toLowerCase();
    return spas.filter(
      (spa) =>
        spa.name?.toLowerCase().includes(query) ||
        spa.location?.city?.toLowerCase().includes(query) ||
        spa.categories?.some((cat) => cat.toLowerCase().includes(query)),
    );
  }, [spas, searchQuery]);

  // Clear all filters
  const clearFilters = () => {
    setSelectedCategory('');
    setMinRating(0);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedCategory || minRating > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Bar - Fixed */}
      <div className="sticky top-14 z-40 bg-white border-b border-gray-100 px-4 py-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search spas by name, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-10 h-12 bg-gray-100 border-0 rounded-xl text-[15px] focus:bg-white focus:ring-2 focus:ring-brand-maroon-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips - Horizontal Scroll */}
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <div className="flex overflow-x-auto gap-2 scrollbar-hide">
          {/* Category Chips */}
          {categoryChips.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setSelectedCategory(chip.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95 ${
                selectedCategory === chip.value
                  ? 'bg-brand-maroon-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {chip.label}
            </button>
          ))}

          {/* Rating Filter */}
          <div className="flex-shrink-0 border-l border-gray-200 pl-2 ml-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                hasActiveFilters
                  ? 'bg-brand-gold-100 text-brand-gold-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasActiveFilters && <span className="w-2 h-2 bg-brand-gold-500 rounded-full" />}
            </button>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap gap-4">
              {/* Rating */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Rating</label>
                <div className="flex gap-2">
                  {ratingChips.map((chip) => (
                    <button
                      key={chip.value}
                      onClick={() => setMinRating(chip.value)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                        minRating === chip.value
                          ? 'bg-brand-maroon-600 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {chip.label}{' '}
                      {chip.value > 0 && <Star className="w-3 h-3 inline fill-current" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1.5 bg-gray-100 border-0 rounded-xl text-sm text-gray-700"
                >
                  <option value="rating-desc">Highest Rated</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="createdAt-desc">Newest</option>
                </select>
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 text-brand-maroon-600 text-sm font-medium flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="px-4 py-4">
        {/* Results Count */}
        {!isLoading && !error && (
          <p className="text-sm text-gray-500 mb-4">
            {filteredSpas.length} {filteredSpas.length === 1 ? 'spa' : 'spas'} found
            {location?.city ? ` in ${location.city}` : ''}
          </p>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            <SpaCardSkeleton />
            <SpaCardSkeleton />
            <SpaCardSkeleton />
          </div>
        )}

        {/* Error State */}
        {error && (
          <ErrorState
            title="Unable to Load Spas"
            message="Please check your connection and try again."
            showRetry
            onRetry={() => refetch()}
            variant="card"
          />
        )}

        {/* Spa List */}
        {!isLoading && !error && (
          <div className="space-y-4">
            {filteredSpas.length > 0 ? (
              filteredSpas.map((spa, index) => <SpaCard key={spa.id} spa={spa} index={index} />)
            ) : (
              <div className="text-center py-16">
                <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No spas found</h3>
                <p className="text-gray-500 text-sm mb-4">Try adjusting your search or filters</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-brand-maroon-600 text-sm font-medium"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  );
}
