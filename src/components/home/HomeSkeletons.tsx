'use client';

/** Skeleton loading states for home page sections */

export function HeroBannerSkeleton() {
  return (
    <div className="px-4 pb-2">
      <div className="w-full aspect-[16/9] rounded-2xl bg-gray-100 animate-pulse" />
    </div>
  );
}

/**
 * Skeleton for the new Phase-1 clean Home hero (`HomeHeroCarousel`).
 * Matches the wrapper padding (`px-4 pt-3 pb-4`) and tile radius
 * (`rounded-tile`) of the real component so the layout does not shift.
 */
export function HomeHeroCarouselSkeleton() {
  return (
    <div className="px-4 pt-3 pb-4">
      <div className="w-full aspect-[16/9] rounded-tile bg-gray-100 animate-pulse" />
    </div>
  );
}

export function CategoriesGridSkeleton() {
  return (
    <section className="bg-white px-4 pt-4 pb-6">
      <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-4" />
      <div className="grid grid-cols-4 gap-x-3 gap-y-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-gray-100 animate-pulse" />
            <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Skeleton for the Yes-Madam-style home category grid (13 tiles:
 * 2 wide rectangles + 11 squares). Matches the geometry of
 * `HomeCategoryGrid` so there is no layout shift when real data lands.
 */
export function HomeCategoryGridSkeleton() {
  return (
    <section
      className="bg-white px-4 pt-4 pb-6"
      data-testid="home-category-grid-skeleton"
    >
      <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-4" />
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 gap-y-5">
        {/* Row 1 — wide anchor */}
        <div className="col-span-3 sm:col-span-4 lg:col-span-5 flex flex-col">
          <div className="w-full aspect-[2/1] rounded-tile bg-gray-100 animate-pulse" />
          <div className="mt-2 h-4 w-32 bg-gray-100 rounded animate-pulse" />
        </div>

        {/* Row 2 — 3 squares (phone) / 4 (tablet) / 5 (desktop) */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`row2-${i}`} className="col-span-1 flex flex-col">
            <div className="w-full aspect-square rounded-tile bg-gray-100 animate-pulse" />
            <div className="mt-2 h-3 w-16 bg-gray-100 rounded animate-pulse mx-auto" />
          </div>
        ))}

        {/* Row 3 — second wide anchor */}
        <div className="col-span-3 sm:col-span-4 lg:col-span-5 flex flex-col">
          <div className="w-full aspect-[2/1] rounded-tile bg-gray-100 animate-pulse" />
          <div className="mt-2 h-4 w-40 bg-gray-100 rounded animate-pulse" />
        </div>

        {/* Row 4+ — remaining 6 squares */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`row4-${i}`} className="col-span-1 flex flex-col">
            <div className="w-full aspect-square rounded-tile bg-gray-100 animate-pulse" />
            <div className="mt-2 h-3 w-16 bg-gray-100 rounded animate-pulse mx-auto" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function MostBookedSkeleton() {
  return (
    <section className="bg-white py-5">
      <div className="px-4 mb-3">
        <div className="h-5 w-36 bg-gray-200 rounded animate-pulse mb-1" />
        <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="flex gap-2 px-4 mb-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-32 rounded-full bg-gray-100 animate-pulse" />
        ))}
      </div>
      <div className="flex gap-3 px-4 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <ServiceCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

export function ServiceCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-44 rounded-card-lg bg-white shadow-card-sm overflow-hidden">
      <div className="aspect-[4/3] bg-gray-100 animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
        <div className="h-9 w-full bg-gray-100 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

export function PromoBannerSkeleton() {
  return (
    <div className="px-4 py-4">
      <div className="w-full aspect-[16/8] rounded-2xl bg-gray-100 animate-pulse" />
    </div>
  );
}
