import { Skeleton } from '@/components/ui/LoadingState';

/**
 * Shared loading skeleton for all auth/* nested routes (login,
 * register, forgot-password). Mirrors the centered card layout used
 * by each auth page.
 */
export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-section-bg px-4 py-8">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-3 pt-2">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
