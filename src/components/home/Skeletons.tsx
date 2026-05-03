'use client';

import { Skeleton } from '@/components/ui/LoadingState';

export function SpaCardSkeleton() {
  return (
    <div className="w-[280px] flex-shrink-0 snap-start">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <Skeleton className="h-40 w-full" />
        <div className="p-4 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

export function ServiceCardSkeleton() {
  return (
    <div className="w-[200px] flex-shrink-0 snap-start">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <Skeleton className="h-32 w-full" />
        <div className="p-3 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function TopRatedSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex gap-4">
        <Skeleton className="w-24 h-24 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
