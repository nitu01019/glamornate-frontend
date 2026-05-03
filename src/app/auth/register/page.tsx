'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-provider';
import { PublicRoute } from '@/components/ProtectedRoute';
import { Sparkles, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, XCircle } from 'lucide-react';
import type { UserRole } from '@/types';
import {
  useSignupAvailability,
  type SignupAvailabilityStatus,
} from '@/hooks/useSignupAvailability';
import { useEmailTypoSuggestion } from '@/hooks/useEmailTypoSuggestion';
import { getUserFriendlyMessage } from '@/lib/error-handler';
import * as Sentry from '@sentry/nextjs';

interface PasswordStrength {
  score: number;
  requirements: {
    minLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
  };
}

const checkPasswordStrength = (password: string): PasswordStrength => {
  const requirements = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
  const score = Object.values(requirements).filter(Boolean).length;
  return { requirements, score };
};

function getRoleDashboard(role: UserRole | undefined): string {
  const dashboards: Record<UserRole, string> = {
    customer: '/customer/dashboard',
    spa_owner: '/spa/dashboard',
    spa_staff: '/spa/dashboard',
    admin: '/admin/dashboard',
  };
  return dashboards[role || 'customer'] || '/customer/dashboard';
}

/**
 * Renders the inline availability pill for a signup field.
 *
 * `idle` collapses to nothing so the field reverts to its untouched
 * appearance. The other states surface as a small icon + label tuned
 * to match the form's existing colour palette.
 */
function AvailabilityPill({
  status,
  field,
}: {
  status: SignupAvailabilityStatus;
  field: 'email' | 'phone';
}) {
  if (status === 'idle') return null;

  if (status === 'checking') {
    return (
      <p className="mt-1 text-xs text-gray-400 flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Checking...
      </p>
    );
  }
  if (status === 'available') {
    return (
      <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Available
      </p>
    );
  }
  if (status === 'taken') {
    const label =
      field === 'email'
        ? 'Already registered. Try signing in instead?'
        : 'Phone already registered. Try signing in instead?';
    return (
      <p className="mt-1 text-xs text-red-500 flex items-center gap-1.5">
        <XCircle className="w-3.5 h-3.5" />
        {label}
      </p>
    );
  }
  // status === 'error' is never set by the hook (silent-fail pattern); treat as idle.
  return null;
}

function RegisterForm() {
  const router = useRouter();
  const { signUp, signInWithGoogle, isLoading: authLoading, user, isAuthenticated } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const passwordStrength = checkPasswordStrength(password);
  const passwordsMatch = password === confirmPassword && password !== '';

  // Phase 7 — live signup-availability probe for the email field.
  // The signup form currently only collects email (no phone field),
  // so we only wire the email lookup here. If a phone field is added
  // later, mirror this with `useSignupAvailability('phone', phone)`.
  const { status: emailAvailability, triggerCheck: triggerEmailCheck } = useSignupAvailability('email', email, { trigger: 'both' });

  const { suggestion: emailTypoSuggestion } = useEmailTypoSuggestion(email);

  useEffect(() => {
    if (isAuthenticated && user && !authLoading && success) {
      const redirectUrl = getRoleDashboard(user.role);
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, user, authLoading, success, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (passwordStrength.score < 3) {
      setAuthError('Password must be at least 8 characters with letters and numbers');
      return;
    }

    if (!passwordsMatch) {
      setAuthError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp(email, password, name);
      setSuccess(true);
    } catch (error: unknown) {
      Sentry.addBreadcrumb({ category: 'auth_ui', message: 'auth_error_displayed', data: { page: 'register' } });
      setAuthError(getUserFriendlyMessage(error));
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setAuthError(null);
    setIsGoogleLoading(true);

    try {
      await signInWithGoogle();
      setSuccess(true);
    } catch (error: unknown) {
      Sentry.addBreadcrumb({ category: 'auth_ui', message: 'auth_error_displayed', data: { page: 'register' } });
      setAuthError(getUserFriendlyMessage(error));
      setIsGoogleLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength.score === 0) return 'bg-gray-200';
    if (passwordStrength.score <= 2) return 'bg-red-500';
    if (passwordStrength.score <= 3) return 'bg-brand-gold-500';
    return 'bg-emerald-500';
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Created!</h2>
        <p className="text-gray-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Redirecting to dashboard...
        </p>
      </div>
    );
  }

  const isLoading = isSubmitting || isGoogleLoading || authLoading;

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 py-12 safe-area-inset">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-10 h-10 bg-gradient-to-br from-brand-maroon-500 to-brand-maroon-600 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="text-2xl font-bold bg-gradient-to-r from-brand-maroon-500 to-brand-maroon-600 bg-clip-text text-transparent">
          Glamornate
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create account</h1>
          <p className="text-gray-500">Join us for exclusive wellness experiences</p>
        </div>

        {/* Error */}
        {authError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{authError}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              className="w-full h-14 px-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-maroon-500 focus:ring-2 focus:ring-brand-maroon-500/20 transition-colors disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={triggerEmailCheck}
              required
              disabled={isLoading}
              aria-invalid={emailAvailability === 'taken'}
              aria-describedby="email-availability"
              className={`w-full h-14 px-4 bg-gray-50 border rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 ${
                emailAvailability === 'taken'
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-200 focus:border-brand-maroon-500 focus:ring-brand-maroon-500/20'
              }`}
            />
            <div id="email-availability" aria-live="polite">
              <AvailabilityPill status={emailAvailability} field="email" />
              {emailTypoSuggestion && (
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline mt-1"
                  onClick={() => {
                    const match = /Did you mean (.+?)\?/.exec(emailTypoSuggestion);
                    if (match) setEmail(match[1]);
                  }}
                >
                  {emailTypoSuggestion}
                </button>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocus(true)}
                onBlur={() => setPasswordFocus(false)}
                required
                disabled={isLoading}
                className="w-full h-14 px-4 pr-12 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-maroon-500 focus:ring-2 focus:ring-brand-maroon-500/20 transition-colors disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {password && (
              <div className="mt-2">
                <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getStrengthColor()} transition-all`}
                    style={{ width: `${passwordStrength.score * 25}%` }}
                  />
                </div>
                {passwordFocus && (
                  <div className="mt-2 space-y-1">
                    {[
                      { key: 'minLength', label: 'At least 8 characters' },
                      { key: 'hasLower', label: 'Lowercase letter' },
                      { key: 'hasUpper', label: 'Uppercase letter' },
                      { key: 'hasNumber', label: 'Number' },
                    ].map((req) => (
                      <div
                        key={req.key}
                        className={`flex items-center gap-2 text-xs ${
                          passwordStrength.requirements[
                            req.key as keyof typeof passwordStrength.requirements
                          ]
                            ? 'text-emerald-600'
                            : 'text-gray-400'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {req.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              className={`w-full h-14 px-4 bg-gray-50 border rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 ${
                confirmPassword && !passwordsMatch
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-200 focus:border-brand-maroon-500 focus:ring-brand-maroon-500/20'
              }`}
            />
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={
              isLoading ||
              passwordStrength.score < 3 ||
              !passwordsMatch ||
              emailAvailability === 'taken'
            }
            className="w-full h-14 bg-gradient-to-r from-brand-maroon-500 to-brand-maroon-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 hover:from-brand-maroon-600 hover:to-brand-maroon-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-white text-sm text-gray-500">or</span>
          </div>
        </div>

        {/* Google Sign Up */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isLoading}
          className="w-full h-14 bg-white border border-gray-200 text-gray-700 font-medium rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isGoogleLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
          Sign up with Google
        </button>

        {/* Sign In Link */}
        <p className="text-center text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-brand-maroon-500 font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <PublicRoute>
      <RegisterForm />
    </PublicRoute>
  );
}
