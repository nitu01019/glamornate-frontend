import { Skeleton, CardSkeleton } from '@/components/ui/LoadingState';

export default function SpasLoading() {
  return (
    <div className="min-h-screen bg-section-bg">
      {/* Header skeleton */}
      <div className="bg-white px-4 py-4 border-b border-slate-100">
        <Skeleton className="h-7 w-32 mb-2" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>

      {/* Filter chips skeleton */}
      <div className="flex gap-2 px-4 py-3 bg-white overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Spa cards skeleton */}
      <div className="p-4 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} showImage />
        ))}
      </div>
    </div>
  );
}
