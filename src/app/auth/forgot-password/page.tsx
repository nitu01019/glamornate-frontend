'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-provider';
import { ArrowLeft, Sparkles, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUserFriendlyMessage } from '@/lib/error-handler';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Brand Panel (matches login page styling)
// ---------------------------------------------------------------------------

function BrandPanel() {
  return (
    <div
      className={cn(
        'relative shrink-0 flex flex-col items-center justify-center',
        'bg-gradient-to-b from-brand-maroon-500 to-brand-maroon-700',
        'px-6 pt-14 pb-14',
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
// Forgot Password Form
// ---------------------------------------------------------------------------

function ForgotPasswordForm() {
  const router = useRouter();
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err: unknown) {
      Sentry.addBreadcrumb({ category: 'auth_ui', message: 'auth_error_displayed', data: { page: 'forgot-password' } });
      setError(getUserFriendlyMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex h-[100dvh] flex-col md:flex-row overflow-hidden">
      {/* Back button */}
      <button
        type="button"
        onClick={() => {
          if (typeof window !== 'undefined' && window.history.length <= 2) {
            router.push('/auth/login');
          } else {
            router.back();
          }
        }}
        className={cn(
          'absolute top-3 left-3 z-30',
          'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full',
          'bg-white/20 text-white hover:bg-white/30',
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
          'relative -mt-6 flex-1 min-h-0 rounded-t-3xl bg-white',
          'px-6 pt-8 pb-8',
          'overflow-hidden',
          'md:mt-0 md:rounded-none md:w-[55%]',
          'md:flex md:items-center md:justify-center',
          'md:px-12 md:overflow-y-auto',
        )}
      >
        <div className="w-full max-w-sm mx-auto">
          {/* Header */}
          <div className="mb-5 md:mb-8">
            <h1 className="text-2xl font-bold text-gray-900 font-serif md:text-3xl">
              Reset your password
            </h1>
            <p className="mt-1 text-gray-500 text-sm md:text-base md:mt-2">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          {/* Success message */}
          {success ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 rounded-2xl bg-green-50 border border-green-200 p-4">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                <p className="text-sm text-green-700">
                  Reset link sent to your email. Check your inbox and follow the link to reset your
                  password.
                </p>
              </div>
              <Link
                href="/auth/login"
                className={cn(
                  'flex w-full h-14 items-center justify-center font-semibold text-white rounded-2xl',
                  'bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500',
                  'hover:shadow-maroon active:scale-[0.98] transition-transform',
                )}
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              {/* Error */}
              {error && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl bg-red-50 border border-red-200 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
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
                    disabled={isSubmitting}
                    className={cn(
                      'w-full h-14 px-4 bg-gray-50 border border-gray-200 rounded-2xl',
                      'text-gray-900 placeholder-gray-400',
                      'focus:outline-none focus:ring-2 focus:ring-brand-gold-500 focus:border-brand-gold-500',
                      'transition-colors disabled:opacity-50',
                    )}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
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
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>

              {/* Back to login */}
              <p className="mt-5 md:mt-8 text-center text-gray-500 text-sm">
                Remember your password?{' '}
                <Link
                  href="/auth/login"
                  className="font-semibold text-brand-maroon-500 hover:text-brand-maroon-600 transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Export
// ---------------------------------------------------------------------------

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
