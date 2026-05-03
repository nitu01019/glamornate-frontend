import { Skeleton, ListSkeleton } from '@/components/ui/LoadingState';

export default function CustomerDashboardLoading() {
  return (
    <div className="min-h-screen bg-section-bg">
      {/* Profile header skeleton */}
      <div className="bg-white px-4 py-6 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>

      {/* Quick-action cards skeleton */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 space-y-2">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>

      {/* Upcoming bookings skeleton */}
      <div className="bg-white mx-4 rounded-xl p-4">
        <Skeleton className="h-5 w-44 mb-4" />
        <ListSkeleton count={3} showAvatar={false} />
      </div>
    </div>
  );
}
