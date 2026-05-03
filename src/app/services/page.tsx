'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { catalogData, catalogServices } from '@/data/glamornate-catalog';
import CategoryCard from '@/components/catalog/CategoryCard';

interface CategorySummary {
  name: string;
  slug: string;
  serviceCount: number;
  priceRange: { min: number; max: number };
  ordering: number;
}

function buildCategorySummaries(): CategorySummary[] {
  try {
    return catalogData.map((cat) => {
      const services = catalogServices.filter((s) => s.categorySlug === cat.slug);
      const prices = services.map((s) => s.basePrice);
      const min = prices.length > 0 ? Math.min(...prices) : 0;
      const max = prices.length > 0 ? Math.max(...prices) : 0;

      return {
        name: cat.name,
        slug: cat.slug,
        serviceCount: services.length,
        priceRange: { min, max },
        ordering: cat.ordering,
      };
    });
  } catch {
    return [];
  }
}

export default function ServicesPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const allCategories = useMemo(() => buildCategorySummaries(), []);

  const filteredCategories = useMemo(() => {
    if (searchQuery.trim() === '') {
      return allCategories;
    }
    const query = searchQuery.toLowerCase().trim();
    return allCategories.filter((cat) => cat.name.toLowerCase().includes(query));
  }, [allCategories, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50 animate-fade-in">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold text-gray-900">Our Services</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse our complete catalog of beauty services
        </p>
      </div>

      {/* Search bar */}
      <div className="bg-white px-4 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-maroon-500/30 transition-shadow"
          />
        </div>
      </div>

      {/* Category grid */}
      <div className="px-4 py-4">
        {filteredCategories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredCategories.map((cat, idx) => (
              <div
                key={cat.slug}
                className="animate-fade-in-up"
                style={{
                  animationDelay: `${Math.min(idx * 50, 300)}ms`,
                  animationFillMode: 'both',
                }}
              >
                <CategoryCard
                  name={cat.name}
                  slug={cat.slug}
                  serviceCount={cat.serviceCount}
                  priceRange={cat.priceRange}
                  ordering={cat.ordering}
                />
              </div>
            ))}
          </div>
        ) : searchQuery.trim() !== '' ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No categories found</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Try a different search term or clear your search
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 text-sm font-semibold text-brand-maroon-500 hover:text-brand-maroon-600 transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-maroon-50 mb-4">
              <Search className="w-8 h-8 text-brand-maroon-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Services unavailable</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              We could not load the service catalog right now. Please try again later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
