import { Skeleton } from '@/components/ui/LoadingState';

export default function CartLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header skeleton */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-5 w-24" />
        </div>
      </header>

      {/* Cart item rows skeleton (3 items) */}
      <div className="flex-1 divide-y divide-gray-50">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-4">
            <Skeleton className="h-20 w-20 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary bar skeleton */}
      <div className="sticky bottom-0 z-10 border-t border-gray-100 bg-white px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-12 font-bold" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
