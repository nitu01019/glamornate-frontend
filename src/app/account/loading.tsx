import { Skeleton } from '@/components/ui/LoadingState';

/**
 * Account page skeleton — mirrors the profile header + menu sections layout.
 */
export default function AccountLoading() {
  return (
    <div className="min-h-screen bg-section-bg pb-24 animate-fade-in">
      {/* Profile header skeleton */}
      <div className="bg-white px-4 pt-6 pb-5">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>

        {/* Elite banner skeleton */}
        <Skeleton className="mt-5 h-20 w-full rounded-2xl" />

        {/* Quick actions skeleton */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>

      {/* Menu sections skeleton */}
      <div className="px-4 pt-4 space-y-3">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  );
}
