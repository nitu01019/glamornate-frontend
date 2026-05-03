'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import type { UserRole } from '@/types';

// Mirrors the roleRoutes config in middleware.ts
const ROLE_DASHBOARDS: Record<UserRole, string> = {
  customer: '/customer/dashboard',
  spa_owner: '/spa/dashboard',
  spa_staff: '/spa/dashboard',
  admin: '/admin/dashboard',
};

// Route-to-role mapping (kept in sync with middleware.ts roleRoutes)
const ROUTE_ROLE_MAP: Record<string, UserRole[]> = {
  '/admin': ['admin'],
  '/spa': ['spa_owner', 'spa_staff'],
  '/customer': ['customer'],
};

function getRolesForPath(pathname: string): UserRole[] | undefined {
  const matched = Object.keys(ROUTE_ROLE_MAP).find((prefix) => pathname.startsWith(prefix));
  return matched ? ROUTE_ROLE_MAP[matched] : undefined;
}

/** Shared skeleton loading state used by both ProtectedRoute and PublicRoute */
function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-maroon-50/30 via-white to-brand-gold-50/30">
      {/* Header skeleton */}
      <div className="h-14 w-full animate-pulse bg-gray-200" />
      {/* Content area skeleton */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="h-8 w-1/3 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
        <div className="h-40 w-full animate-pulse rounded-xl bg-gray-200" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-24 animate-pulse rounded-xl bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  redirectTo?: string;
}

/**
 * ProtectedRoute — UI-level auth gate.
 *
 * NOTE: This is a defense-in-depth UI guard, NOT the security boundary.
 * Real authorization is enforced by:
 *   - Server-side Firestore Security Rules (see backend repo)
 *   - Cloud Function callables that verify the caller's ID token
 *     and check role/admin claims
 *   - Next.js middleware that token-presence-checks API routes
 *
 * This component prevents UI flicker (rendering admin chrome before
 * the redirect kicks in) and provides a clean UX for unauthenticated
 * users hitting protected routes. It does NOT prevent a determined
 * attacker from inspecting the bundled JS, which is unavoidable for
 * any client-rendered Next.js app.
 *
 * For production hardening, the recommended next step is converting
 * admin/spa/customer layouts to Server Components that gate via
 * `cookies()` + `verifySessionCookie`. See `docs/REPO_TOPOLOGY.md`.
 */
export function ProtectedRoute({
  children,
  requiredRoles,
  redirectTo = '/auth/login',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [timedOut, setTimedOut] = useState(false);

  // Derive required roles from route prefix if not explicitly provided
  const effectiveRoles = requiredRoles ?? getRolesForPath(pathname);

  // If auth is still loading after 8 seconds, show a user-friendly error
  // instead of an infinite skeleton.
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Use replace, not push: pushing /auth/login on top of e.g.
        // /customer/bookings means the back button takes the user back
        // to the protected page, which immediately re-runs this effect
        // and bounces them to /auth/login again — an infinite history
        // loop where the back button appears broken.
        const callbackUrl = encodeURIComponent(pathname);
        router.replace(`${redirectTo}?callbackUrl=${callbackUrl}`);
        return;
      }

      // Same reasoning for role mismatches.
      if (effectiveRoles && user && !effectiveRoles.includes(user.role)) {
        router.replace(ROLE_DASHBOARDS[user.role] || '/');
      }
    }
  }, [isAuthenticated, isLoading, user, effectiveRoles, router, redirectTo, pathname]);

  // Show skeleton loading state — but cap it with a timeout fallback
  if (isLoading) {
    if (timedOut) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-maroon-50/30 via-white to-brand-gold-50/30 px-4">
          <div className="text-center">
            <p className="text-gray-600">
              Unable to verify authentication. Please refresh or check your connection.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-brand-maroon-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-maroon-700"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return <PageLoadingSkeleton />;
  }

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Deny access if user's role is not authorized for this route
  if (effectiveRoles && user && !effectiveRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}

// Helper to get dashboard URL based on user role
function getRoleDashboard(role: UserRole | undefined): string {
  const dashboards: Record<UserRole, string> = {
    customer: '/customer/dashboard',
    spa_owner: '/spa/dashboard',
    spa_staff: '/spa/dashboard',
    admin: '/admin/dashboard',
  };
  return dashboards[role || 'customer'] || '/customer/dashboard';
}

// Public route - redirects to dashboard if already logged in
interface PublicRouteProps {
  children: React.ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // Redirect to appropriate dashboard based on role
      router.push(getRoleDashboard(user.role));
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return <PageLoadingSkeleton />;
  }

  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
