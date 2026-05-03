import { Skeleton } from '@/components/ui/LoadingState';

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / brand mark */}
        <div className="flex flex-col items-center space-y-2">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <Skeleton className="h-3 w-28 ml-auto" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  );
}
