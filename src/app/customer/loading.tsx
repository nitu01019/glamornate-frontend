import { Skeleton } from '@/components/ui/LoadingState';

/**
 * Shared loading skeleton for all customer/* nested routes.
 * Individual route-level loading.tsx files override this where a more
 * specific skeleton is needed (e.g. customer/bookings).
 */
export default function CustomerLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="px-4 py-5 space-y-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-3 pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
