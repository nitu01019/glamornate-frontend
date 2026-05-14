import { Skeleton } from '@/components/ui/LoadingState';

/**
 * /customer/payments loading skeleton.
 *
 * Mirrors the finished page layout (sticky header, disabled banner, cards
 * section, UPI section) so the transition from skeleton → live UI doesn't
 * shift the layout.
 */
export default function PaymentsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky header skeleton */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <Skeleton className="h-5 w-36" />
          <div className="w-10" aria-hidden="true" />
        </div>
      </div>

      <main className="px-4 pt-4 max-w-lg mx-auto space-y-5">
        {/* Disabled banner skeleton */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Skeleton className="w-5 h-5 rounded-full shrink-0 mt-0.5" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Cards section skeleton */}
        <div className="rounded-2xl shadow-sm bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>

          {/* Empty-state skeleton (matches EmptyCardsState proportions) */}
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Skeleton className="w-16 h-16 rounded-full mb-4" />
            <Skeleton className="h-5 w-40 mb-2" />
            <Skeleton className="h-4 w-52 mb-6" />
            <Skeleton className="h-11 w-48 rounded-xl" />
          </div>
        </div>

        {/* UPI section skeleton */}
        <div className="rounded-2xl shadow-sm bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            <Skeleton className="w-14 h-14 rounded-full mb-3" />
            <Skeleton className="h-4 w-36 mb-2" />
            <Skeleton className="h-3 w-48 mb-4" />
            <Skeleton className="h-11 w-40 rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}
