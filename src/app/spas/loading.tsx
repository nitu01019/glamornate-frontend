import { Skeleton } from '@/components/ui/LoadingState';

/**
 * Spas listing page skeleton — grid of spa cards with image, name, rating.
 */
export default function SpasLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-fade-in">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3">
        <Skeleton className="h-7 w-32 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Search */}
      <div className="bg-white px-4 pb-4">
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 py-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Spa cards grid */}
      <div className="px-4 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
            {/* Image */}
            <Skeleton className="w-full aspect-[16/9]" />
            {/* Content */}
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-12 rounded-lg" />
              </div>
              <Skeleton className="h-4 w-1/2" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
