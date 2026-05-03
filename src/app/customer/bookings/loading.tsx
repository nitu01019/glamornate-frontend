import { Skeleton } from '@/components/ui/LoadingState';

/**
 * Bookings page skeleton — mirrors the tab layout with booking cards.
 */
export default function BookingsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-fade-in">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-2">
        <Skeleton className="h-7 w-36" />
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 px-4">
        <div className="flex">
          {['Upcoming', 'Past', 'Cancelled'].map((tab) => (
            <div key={tab} className="flex-1 py-3 flex justify-center">
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Booking cards */}
      <div className="px-4 py-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex gap-4">
              {/* Date box */}
              <Skeleton className="w-16 h-16 rounded-xl flex-shrink-0" />

              {/* Content */}
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-1/2" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <Skeleton className="h-9 flex-1 rounded-xl" />
              <Skeleton className="h-9 flex-1 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
