import { Skeleton } from '@/components/ui/LoadingState';

export default function SpaDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero image */}
      <Skeleton className="h-64 w-full rounded-none" />

      <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto">
        {/* Spa name + rating */}
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
        </div>

        {/* Services section */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-2xl bg-white border border-gray-100 px-4 py-4"
            >
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-9 w-20 rounded-xl" />
              </div>
            </div>
          ))}
        </div>

        {/* Reviews snippet */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-20" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white border border-gray-100 p-4 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
