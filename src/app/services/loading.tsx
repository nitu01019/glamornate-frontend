import { Skeleton } from '@/components/ui/LoadingState';

export default function ServicesLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <div className="bg-white px-4 pt-4 pb-3">
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Search bar skeleton */}
      <div className="bg-white px-4 pb-4">
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>

      {/* Category grid skeleton (2 columns to match actual page) */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-white border border-slate-100 overflow-hidden p-4 space-y-3"
            >
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
