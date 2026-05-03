import { Skeleton } from '@/components/ui/LoadingState';

export default function HelpLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 border-b border-gray-100">
        <Skeleton className="h-7 w-28 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Search bar */}
      <div className="bg-white px-4 pb-4">
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>

      <div className="px-4 py-6 space-y-3 max-w-2xl mx-auto">
        {/* Section heading */}
        <Skeleton className="h-5 w-36 mb-4" />

        {/* FAQ accordion items */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white border border-gray-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
