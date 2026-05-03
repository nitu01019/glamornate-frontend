import { Skeleton } from '@/components/ui/LoadingState';

/**
 * Home page skeleton — mirrors the actual layout of page.tsx
 * so the user sees content-shaped placeholders instead of a spinner.
 */
export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-section-bg animate-fade-in">
      {/*
        Note: The location header (HomeLocationRow) and search row are now rendered
        globally by ConditionalNav as fixed chrome (top-14 + top-0), so no skeleton
        is needed here — they paint immediately on every route, including suspense
        fallbacks. Avoid duplicating them here to prevent flash/double-row on first paint.
      */}

      {/* Hero banner skeleton */}
      <div className="px-4 pb-2">
        <Skeleton className="w-full aspect-[16/9] rounded-2xl" />
      </div>

      {/* Elite banner skeleton */}
      <div className="px-4 py-2">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>

      {/* Categories grid skeleton */}
      <section className="bg-white px-4 pt-4 pb-6">
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="grid grid-cols-4 gap-x-3 gap-y-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="w-16 h-16 rounded-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="h-2 bg-section-bg" />

      {/* Most Booked section skeleton */}
      <section className="bg-white py-5">
        <div className="px-4 mb-3">
          <Skeleton className="h-5 w-36 mb-1" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex gap-2 px-4 mb-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-full" />
          ))}
        </div>
        <div className="flex gap-3 px-4 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-44 rounded-2xl overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="h-2 bg-section-bg" />

      {/* Deal of the Day skeleton */}
      <div className="bg-white px-4 pt-4 pb-0">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <div className="px-4 py-4">
        <Skeleton className="w-full aspect-[16/8] rounded-2xl" />
      </div>
    </div>
  );
}
