'use client';

import Image from 'next/image';
import Link from 'next/link';
// Icons removed — category circles now show images only
import { useCategories } from '@/hooks/useHomeData';
import { catalogCategories } from '@/data/glamornate-catalog';
import { CategoriesGridSkeleton } from './HomeSkeletons';

/**
 * @deprecated Use HomeCategoryGrid behind NEXT_PUBLIC_HOME_V2_GRID. Will be
 * removed after flag flip.
 */
export default function NewCategoriesGrid() {
  const { data: categories, isLoading, isFetching, isError, refetch } = useCategories();

  // Initial load: show skeleton (React Query only, no timer).
  if (isLoading) return <CategoriesGridSkeleton />;

  // On error, fall back to the static catalog so users still see something.
  const showFallback = isError || !categories;
  const source = showFallback ? catalogCategories : categories;

  const items = (source ?? []).map((c) => ({
    slug: c.slug,
    name: c.name,
    image: c.image,
    badge: (c as { badge?: string }).badge,
  }));

  // Retry is visible only when we're in an error state and not currently fetching.
  // This prevents the button from "flashing" on every transient refetch.
  const showRetry = isError && !isFetching;

  return (
    <section className="bg-white px-4 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Explore Our Categories</h2>
        {showRetry && (
          <button
            onClick={() => {
              void refetch();
            }}
            className="text-xs text-brand-maroon-500 font-medium underline"
            type="button"
          >
            Retry
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-x-3 gap-y-5">
        {items.map((category) => {
          return (
            <Link
              key={category.slug}
              href={`/services/category/${category.slug}`}
              data-testid="category-card"
              className="flex flex-col items-center gap-2 touch-target active:scale-95 transition-transform relative"
            >
              {/* Category image circle */}
              <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden shadow-card-sm bg-gray-100">
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>

              {/* "New" badge */}
              {category.badge === 'New' && (
                <span className="absolute -top-1 right-0 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  New
                </span>
              )}

              <span className="text-[11px] md:text-xs font-medium text-gray-700 text-center leading-tight line-clamp-2">
                {category.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
