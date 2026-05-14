'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-provider';
import { ArrowLeft, Sparkles, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/LoadingState';
import type { UserRole } from '@/types';
import { getUserFriendlyMessage } from '@/lib/error-handler';
import * as Sentry from '@sentry/nextjs';

function getRoleDashboard(role: UserRole | undefined, hasSpaData: boolean = true): string {
  // spa_owner with null spaData hits /spa/dashboard and crashes on
  // undefined spaId — fall back to /customer/dashboard until the spa doc
  // exists. Sentry breadcrumb is emitted by lookupSpaData on miss.
  if (role === 'spa_owner' && !hasSpaData) {
    return '/customer/dashboard';
  }
  const dashboards: Record<UserRole, string> = {
    customer: '/customer/dashboard',
    spa_owner: '/spa/dashboard',
    spa_staff: '/spa/dashboard',
    admin: '/admin/dashboard',
  };
  return dashboards[role || 'customer'] || '/customer/dashboard';
}

// ---------------------------------------------------------------------------
// Brand Panel (left side on desktop, top on mobile)
// ---------------------------------------------------------------------------

function BrandPanel() {
  return (
    <div
      className={cn(
        // Mobile: compact hero — shrink-0 so it never compresses
        'relative shrink-0 flex flex-col items-center justify-center',
        'bg-gradient-to-b from-brand-maroon-500 to-brand-maroon-700',
        'px-6 pt-14 pb-14',
        // Desktop: sticky left panel, full height
        'md:sticky md:top-0 md:h-screen md:w-[45%]',
        'md:bg-gradient-to-br md:from-brand-maroon-500 md:to-brand-maroon-700',
        'md:px-10 md:pt-0 md:pb-0',
        'md:justify-center',
      )}
    >
      {/* Subtle decorative circles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute bottom-10 -left-16 h-48 w-48 rounded-full bg-white/5" />
        <div className="hidden md:block absolute top-1/4 right-10 h-32 w-32 rounded-full bg-brand-gold-500/10" />
      </div>

      {/* Logo */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
          <Sparkles className="h-6 w-6 text-brand-gold-500" />
        </div>
        <span className="text-3xl font-bold text-white font-serif tracking-tight">Glamornate</span>
      </div>

      {/* Tagline */}
      <p className="relative z-10 mt-4 text-center font-serif text-white/80 text-base italic leading-relaxed max-w-xs md:max-w-sm md:mt-6 md:text-lg">
        &ldquo;Where wellness meets elegance&rdquo;
      </p>

      {/* Desktop-only extra branding */}
      <div className="relative z-10 mt-10 hidden md:flex flex-col items-center gap-6">
        <div className="h-px w-16 bg-brand-gold-500/40" />
        <p className="text-sm text-white/60 text-center max-w-xs leading-relaxed">
          Premium spa experiences, curated for you. Book your journey to relaxation in moments.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Loading State (matches split-screen shape)
// ---------------------------------------------------------------------------

function LoginSkeleton() {
  return (
    <div className="flex h-[100dvh] flex-col md:flex-row overflow-hidden">
      {/* Brand panel skeleton */}
      <div
        className={cn(
          'relative shrink-0 flex flex-col items-center justify-center',
          'bg-gradient-to-b from-brand-maroon-500 to-brand-maroon-700',
          'px-6 pt-14 pb-14',
          'md:sticky md:top-0 md:h-screen md:w-[45%]',
          'md:bg-gradient-to-br md:from-brand-maroon-500 md:to-brand-maroon-700',
          'md:px-10 md:pt-0 md:pb-0 md:justify-center',
        )}
      >
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl !bg-white/15" />
          <Skeleton className="h-8 w-36 !bg-white/15" />
        </div>
        <Skeleton className="mt-4 h-5 w-48 !bg-white/15" />
      </div>

      {/* Form panel skeleton */}
      <div
        className={cn(
          'relative -mt-6 flex-1 min-h-0 rounded-t-3xl bg-white px-6 pt-8 pb-8 overflow-hidden',
          'md:mt-0 md:rounded-none md:flex md:items-center md:justify-center md:overflow-y-auto',
        )}
      >
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-8">
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="space-y-4">
            <div>
              <Skeleton className="h-4 w-12 mb-2" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
            <div>
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-4 w-40 mx-auto mt-8" />
          <Skeleton className="h-14 w-full rounded-2xl mt-4" />
          <Skeleton className="h-4 w-48 mx-auto mt-8" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login Form (reads searchParams, so must be inside Suspense)
// ---------------------------------------------------------------------------

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signInWithGoogle, isLoading: authLoading, user, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const rawCallbackUrl = searchParams.get('callbackUrl') || searchParams.get('redirect');

  // A-3-07: Validate callbackUrl as a defence-in-depth open-redirect guard.
  // Only relative paths starting with "/" (and not "//", "/\", etc.) are
  // accepted. We additionally reject backslash, "@" (URL userinfo
  // smuggling) and control chars (CR/LF/TAB/NUL — header injection).
  const callbackUrl = (() => {
    if (!rawCallbackUrl) return null;
    if (!rawCallbackUrl.startsWith('/')) return null;
    if (rawCallbackUrl.startsWith('//')) return null;
    if (rawCallbackUrl.startsWith('/\\')) return null;
    if (/[\\@]/.test(rawCallbackUrl)) return null;
    if (/[\r\n\t\0]/.test(rawCallbackUrl)) return null;
    return rawCallbackUrl;
  })();

  useEffect(() => {
    if (isAuthenticated && user && !authLoading) {
      const redirectUrl = callbackUrl || getRoleDashboard(user.role, !!user.spaData?.spaId);
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, user, authLoading, callbackUrl, router]);

  // 2026-05-11 (Atlas-D1 + Cinder-D2 / F2): if a Google redirect-flow
  // createUserProfile failed, the auth-provider stashed the failure in
  // sessionStorage before the listener orphan-cleaned the user. Surface a
  // banner so the user understands why they landed on the login page.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let stash: string | null = null;
    try {
      stash = sessionStorage.getItem('glamornate.redirectProfileError');
      if (stash) sessionStorage.removeItem('glamornate.redirectProfileError');
    } catch {
      return;
    }
    if (stash) {
      setAuthError(
        'Sign-in with Google completed, but we could not finish setting up your account. Please try again — if this keeps happening, contact support.',
      );
    }
  }, []);

  // 2026-05-11 (L-D10 / T3-F48): when the backend revokes the session
  // (token-revoked envelope), the api-client's onTokenRevoked handler
  // sweeps + hard-navigates to `/auth/login?reason=session_expired`
  // (F17). Surface a banner so the user understands why they were signed
  // out, instead of seeing a bare login form.
  const reason = searchParams.get('reason');
  useEffect(() => {
    if (reason === 'session_expired') {
      setAuthError('Your session has expired. Please sign in again.');
      // 2026-05-11 (Charlie-γ7): strip the reason param so the banner does
      // not re-fire on re-renders or persist across the user's next submit.
      // router.replace updates history in-place without a navigation.
      const url = new URL(window.location.href);
      url.searchParams.delete('reason');
      router.replace(`${url.pathname}${url.search}${url.hash}`);
    }
  }, [reason, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // 2026-05-11 (P-D1 / T3-F50): top-of-handler guard against
    // double-submit. The submit button is disabled while `isLoading` is
    // true, but on iOS Safari and some Android IMEs the Enter key
    // bypasses the disabled state on the form submit. Guard explicitly.
    if (isSubmitting || isGoogleLoading) return;
    setAuthError(null);
    setIsSubmitting(true);

    try {
      // A-3-11: trim email only — mobile keyboards append a trailing
      // space on autocomplete. Never trim password (legal whitespace).
      await signIn(email.trim(), password);
    } catch (error: unknown) {
      Sentry.addBreadcrumb({
        category: 'auth_ui',
        message: 'auth_error_displayed',
        data: { page: 'login' },
      });
      setAuthError(getUserFriendlyMessage(error));
    } finally {
      // 2026-05-11 (L-D4 / T3-F9): move reset to `finally`. Web
      // cross-provider paths in `signIn` resolve void via
      // `window.location.assign + return` — the catch never fires and the
      // spinner spun forever during slow navigation. `finally` always
      // runs; if navigation IS happening the unmount swallows the state
      // update; if NOT, the user sees the form again with the error.
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // 2026-05-11 (P-D1 / T3-F50): same guard as handleLogin.
    if (isSubmitting || isGoogleLoading) return;
    setAuthError(null);
    setIsGoogleLoading(true);

    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      Sentry.addBreadcrumb({
        category: 'auth_ui',
        message: 'auth_error_displayed',
        data: { page: 'login' },
      });
      setAuthError(getUserFriendlyMessage(error));
    } finally {
      // 2026-05-11 (L-D4 / T3-F9): see handleLogin comment above.
      setIsGoogleLoading(false);
    }
  };

  const isLoading = isSubmitting || isGoogleLoading || authLoading;

  // Show skeleton while auth is initializing or user is already authenticated (redirect pending)
  if (authLoading || (isAuthenticated && user)) {
    return <LoginSkeleton />;
  }

  return (
    <div className="relative flex h-[100dvh] flex-col md:flex-row overflow-hidden">
      {/* Back button — pinned to top-left of the entire screen */}
      <button
        type="button"
        onClick={() => {
          if (typeof window !== 'undefined' && window.history.length <= 2) {
            router.push('/');
          } else {
            router.back();
          }
        }}
        className={cn(
          'absolute top-3 left-3 z-30',
          'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full',
          'bg-white/20 text-white hover:bg-white/30',
          'md:text-white md:bg-white/20 md:hover:bg-white/30',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-500',
          'transition-colors',
        )}
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      {/* ---- Brand Panel ---- */}
      <BrandPanel />

      {/* ---- Form Panel ---- */}
      <div
        className={cn(
          // Mobile: white card that overlaps the hero, fills remaining space
          'relative -mt-6 flex-1 min-h-0 rounded-t-3xl bg-white',
          'px-6 pt-8 pb-8',
          'overflow-hidden',
          // Desktop: right side, vertically centered
          'md:mt-0 md:rounded-none md:w-[55%]',
          'md:flex md:items-center md:justify-center',
          'md:px-12 md:overflow-y-auto',
        )}
      >
        <div className="w-full max-w-sm mx-auto">
          {/* Header */}
          <div className="mb-5 md:mb-8">
            <h1 className="text-2xl font-bold text-gray-900 font-serif md:text-3xl">
              Welcome back
            </h1>
            <p className="mt-1 text-gray-500 text-sm md:text-base md:mt-2">
              Sign in to continue your wellness journey
            </p>
          </div>

          {/* Error */}
          {authError && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl bg-red-50 border border-red-200 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{authError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className={cn(
                  'w-full h-14 px-4 bg-gray-50 border border-gray-200 rounded-2xl',
                  'text-gray-900 placeholder-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-brand-gold-500 focus:border-brand-gold-500',
                  'transition-colors disabled:opacity-50',
                )}
              />
            </div>

            {/* Password */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm font-medium text-brand-maroon-500 hover:text-brand-maroon-600 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className={cn(
                    'w-full h-14 px-4 pr-12 bg-gray-50 border border-gray-200 rounded-2xl',
                    'text-gray-900 placeholder-gray-400',
                    'focus:outline-none focus:ring-2 focus:ring-brand-gold-500 focus:border-brand-gold-500',
                    'transition-colors disabled:opacity-50',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    'absolute right-4 top-1/2 -translate-y-1/2',
                    'min-h-[44px] min-w-[44px] flex items-center justify-center',
                    'text-gray-400 hover:text-gray-600 transition-colors',
                  )}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full h-14 font-semibold text-white rounded-2xl',
                'bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500',
                'flex items-center justify-center gap-2',
                'hover:shadow-maroon active:scale-[0.98] transition-transform',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5 md:my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-gray-500">or continue with</span>
            </div>
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className={cn(
              'w-full h-14 bg-white border border-gray-200 rounded-2xl',
              'text-gray-700 font-medium',
              'flex items-center justify-center gap-3',
              'hover:bg-gray-50 active:scale-[0.98] transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
            )}
          >
            {isGoogleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Google
          </button>

          {/* Sign Up Link */}
          <p className="mt-5 md:mt-8 text-center text-gray-500 text-sm">
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/register"
              className="font-semibold text-brand-maroon-500 hover:text-brand-maroon-600 transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Export (wraps LoginForm in Suspense for useSearchParams)
// ---------------------------------------------------------------------------

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
