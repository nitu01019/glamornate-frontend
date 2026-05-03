import { Skeleton } from '@/components/ui/LoadingState';

export default function BookingLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Progress bar skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="mt-1 hidden h-3 w-12 sm:block" />
              </div>
              {i < 3 && <Skeleton className="mx-1 h-0.5 flex-1" />}
            </div>
          ))}
        </div>
        <Skeleton className="mt-3 mx-auto h-3 w-24" />
      </div>

      {/* Form content skeleton */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-5">
        <Skeleton className="h-6 w-40 mb-1" />
        <Skeleton className="h-4 w-64" />

        <div className="space-y-4 pt-2">
          {/* Form field skeletons */}
          <div>
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-4 w-28 mb-2" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>

        {/* Action button skeleton */}
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
