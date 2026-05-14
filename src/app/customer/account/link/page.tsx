'use client';

/**
 * Account-linking landing page.
 *
 * A-6-01 (2026-05-10): the page now consumes the `pendingCredential`
 * stashed by `auth-provider.tsx` when a sign-in attempt fails with
 * `auth/account-exists-with-different-credential`, then drives the
 * canonical Firebase recovery flow:
 *
 *   - When the conflicting attempt was Google (providerId='google.com'),
 *     the primary account is email/password — the user enters their
 *     password, we sign them in, then call `linkWithCredential` with
 *     the rebuilt GoogleAuthCredential.
 *
 *   - When the conflicting attempt was email/password
 *     (providerId='password'), the primary account is Google — the user
 *     signs in with Google. The password they typed is not retrievable
 *     from a sign-in failure, so we surface a "set a password from
 *     Profile → Security" message + a one-click password-reset that
 *     emails the link to the conflicting email.
 *
 * Lance (A-2-01) swapped this page from `<ProtectedRoute>` to
 * `<PublicRoute>` so cross-provider users (no session yet) can land here
 * after the redirect.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GoogleAuthProvider, linkWithCredential, type AuthCredential } from 'firebase/auth';
import { PublicRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LINK_ACCOUNTS_TITLE, LINK_ACCOUNTS_BODY } from '@/lib/booking/copy';
import { useAuth } from '@/lib/auth-provider';
import { useToastActions } from '@/lib/providers';
import { getFirebaseAuth } from '@/lib/firebase-client';
import { AuthError, getUserFriendlyMessage } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

const log = logger.child({ component: 'AccountLinkPage' });

const PENDING_CREDENTIAL_KEY = 'glamornate.pendingCredential';

interface PendingGoogleCredential {
  providerId: 'google.com';
  idToken: string | null;
  accessToken: string | null;
}

interface PendingPasswordCredential {
  providerId: 'password';
  email: string;
}

type PendingCredential = PendingGoogleCredential | PendingPasswordCredential;

function readPendingCredential(): PendingCredential | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_CREDENTIAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { providerId?: string } & Record<string, unknown>;
    if (parsed.providerId === 'google.com') {
      const idToken =
        typeof parsed.idToken === 'string' || parsed.idToken === null
          ? (parsed.idToken as string | null)
          : null;
      const accessToken =
        typeof parsed.accessToken === 'string' || parsed.accessToken === null
          ? (parsed.accessToken as string | null)
          : null;
      return { providerId: 'google.com', idToken, accessToken };
    }
    if (parsed.providerId === 'password' && typeof parsed.email === 'string') {
      return { providerId: 'password', email: parsed.email };
    }
    return null;
  } catch (err) {
    log.warn('Failed to read pendingCredential from sessionStorage', { err });
    return null;
  }
}

function clearPendingCredential(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_CREDENTIAL_KEY);
  } catch {
    // sessionStorage may throw in private mode; the next link attempt
    // will overwrite via setItem so leakage is bounded to this session.
  }
}

function rebuildGoogleCredential(pending: PendingGoogleCredential): AuthCredential | null {
  if (!pending.idToken && !pending.accessToken) return null;
  return GoogleAuthProvider.credential(pending.idToken, pending.accessToken);
}

// 2026-05-11 (Mire-D2 / F6): codes that mean the recovery cannot succeed
// with the current pendingCredential. Transient codes (network, too-many-
// requests) are intentionally NOT included — the user may retry. Terminal
// codes clear the entry so a stale credential cannot replay against a
// different user on a subsequent mount.
const TERMINAL_LINK_ERROR_CODES = new Set<string>([
  'auth/wrong-password',
  'auth/invalid-credential',
  'auth/user-not-found',
  'auth/user-disabled',
  'auth/credential-already-in-use',
  'auth/provider-already-linked',
  'auth/email-already-in-use',
  'auth/invalid-verification-code',
  'auth/invalid-verification-id',
]);

function isTerminalLinkError(code: string): boolean {
  return TERMINAL_LINK_ERROR_CODES.has(code);
}

interface CompleteGoogleLinkArgs {
  email: string;
  password: string;
  pending: PendingGoogleCredential;
}

function AccountLinkContent() {
  const router = useRouter();
  const { firebaseUser, isAuthenticated, signIn, signInWithGoogle, resetPassword } = useAuth();
  const toast = useToastActions();

  const [pending, setPending] = useState<PendingCredential | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    setPending(readPendingCredential());
    setHydrated(true);
  }, []);

  const completeGoogleLink = useCallback(
    async ({
      email: userEmail,
      password: userPassword,
      pending: pendingCred,
    }: CompleteGoogleLinkArgs) => {
      const credential = rebuildGoogleCredential(pendingCred);
      if (!credential) {
        throw new AuthError(
          'We could not reconstruct the Google credential. Please sign in with Google again.',
          { firebaseCode: 'auth/invalid-credential' },
        );
      }
      // 2026-05-11 (Mire-D1 + Keystone-M3 / F5): pass isLinkFlow so the
      // auth-provider's cross-provider branch does NOT overwrite the
      // pending Google credential if the user mistyped their email.
      await signIn(userEmail, userPassword, { isLinkFlow: true });
      const auth = getFirebaseAuth();
      const current = auth.currentUser;
      if (!current) {
        throw new AuthError('Sign-in did not produce an active session.', {
          firebaseCode: 'auth/internal-error',
        });
      }
      await linkWithCredential(current, credential);
    },
    [signIn],
  );

  const onSubmitGoogle = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!pending || pending.providerId !== 'google.com') return;
      setErrorMessage(null);
      setSubmitting(true);
      try {
        await completeGoogleLink({ email: email.trim(), password, pending });
        clearPendingCredential();
        toast.success('Accounts linked', 'You can now sign in with Google or email + password.');
        router.replace('/customer/dashboard');
      } catch (err) {
        const code = (err as { code?: string } | null)?.code ?? '';
        const friendly = getUserFriendlyMessage(err);
        log.warn('Account link via Google failed', { code });
        Sentry.captureException(err, {
          tags: { source: 'account-link', phase: 'google-link', code },
        });
        setErrorMessage(friendly);
        // 2026-05-11 (Mire-D2 / F6): clear the pendingCredential on terminal
        // errors so a stale entry can't be replayed against the wrong user
        // on a subsequent mount (auto-link useEffect would otherwise fire
        // linkWithCredential against whatever uid is signed in next).
        if (isTerminalLinkError(code)) {
          clearPendingCredential();
        }
      } finally {
        setSubmitting(false);
      }
    },
    [completeGoogleLink, email, password, pending, router, toast],
  );

  const onClickGoogleSignIn = useCallback(async () => {
    if (!pending || pending.providerId !== 'password') return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      // Password is not stored in the failed sign-in error, so we cannot
      // call linkWithCredential here. After Google sign-in succeeds the
      // user can add a password from Profile → Security; we surface that
      // copy via the post-sign-in branch below.
      clearPendingCredential();
      toast.success(
        'Signed in with Google',
        'You can add a password to this account from Profile → Security.',
      );
      router.replace('/customer/dashboard');
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? '';
      const friendly = getUserFriendlyMessage(err);
      log.warn('Account link via Google sign-in failed', { code });
      Sentry.captureException(err, {
        tags: { source: 'account-link', phase: 'google-signin', code },
      });
      setErrorMessage(friendly);
      // 2026-05-11 (Mire-D2 / F6): same rationale as the Google-form catch.
      if (isTerminalLinkError(code)) {
        clearPendingCredential();
      }
    } finally {
      setSubmitting(false);
    }
  }, [pending, router, signInWithGoogle, toast]);

  const onClickResetPassword = useCallback(async () => {
    if (!pending || pending.providerId !== 'password') return;
    setErrorMessage(null);
    try {
      await resetPassword(pending.email);
      setResetEmailSent(true);
      toast.success(
        'Reset email sent',
        'If an account exists for this email, a reset link is on its way.',
      );
    } catch (err) {
      const friendly = getUserFriendlyMessage(err);
      Sentry.captureException(err, {
        tags: { source: 'account-link', phase: 'password-reset' },
      });
      setErrorMessage(friendly);
    }
  }, [pending, resetPassword, toast]);

  // Already authenticated AND we still have a pending google credential —
  // the user must have completed primary sign-in elsewhere. Try to link
  // immediately so we don't ask them to type their password again.
  useEffect(() => {
    if (!hydrated || !pending || submitting) return;
    if (pending.providerId !== 'google.com') return;
    if (!isAuthenticated || !firebaseUser) return;
    const credential = rebuildGoogleCredential(pending);
    if (!credential) {
      // 2026-05-11 (Mire-D4 / F25): both idToken and accessToken are null;
      // the auto-link useEffect used to silently `return`, stranding the
      // user on the page with no error. Surface the failure + clear the
      // entry so the user can re-initiate from /auth/login.
      setErrorMessage(
        'This sign-in link has expired. Please sign in with Google again to link your accounts.',
      );
      clearPendingCredential();
      return;
    }
    let cancelled = false;
    (async () => {
      setSubmitting(true);
      try {
        await linkWithCredential(firebaseUser, credential);
        if (cancelled) return;
        clearPendingCredential();
        toast.success('Accounts linked', 'Google has been added as a sign-in method.');
        router.replace('/customer/dashboard');
      } catch (err) {
        if (cancelled) return;
        const code = (err as { code?: string } | null)?.code ?? '';
        const friendly = getUserFriendlyMessage(err);
        log.warn('Auto-link on authenticated session failed', { code });
        Sentry.captureException(err, {
          tags: { source: 'account-link', phase: 'auto-link', code },
        });
        setErrorMessage(friendly);
        // 2026-05-11 (Mire-D2 / F6): same rationale — terminal errors mean
        // the credential cannot link to the current user; clear so the
        // next mount does not re-fire this useEffect against the same uid.
        if (isTerminalLinkError(code)) {
          clearPendingCredential();
        }
      } finally {
        if (!cancelled) setSubmitting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, hydrated, isAuthenticated, pending, router, submitting, toast]);

  const heading = useMemo(() => {
    if (!pending) return LINK_ACCOUNTS_TITLE;
    return pending.providerId === 'google.com'
      ? 'Add Google to your account'
      : 'Sign in with Google';
  }, [pending]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-50 px-5 py-8">
        <div className="max-w-md mx-auto">
          <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-5 py-8">
      <div className="max-w-md mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-gray-900">{heading}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {pending
              ? LINK_ACCOUNTS_BODY
              : 'You can land here after a cross-provider sign-in conflict.'}
          </p>
        </header>

        {pending?.providerId === 'google.com' ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Confirm your existing password
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Sign in with the email and password you originally registered with — Google will be
                added as an alternate sign-in method on the same account.
              </p>
            </div>
            <form className="space-y-3" onSubmit={onSubmitGoogle} noValidate>
              <div className="space-y-1">
                <Label htmlFor="link-email">Email</Label>
                <Input
                  id="link-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="link-password">Password</Label>
                <Input
                  id="link-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
              {errorMessage ? (
                <p role="alert" className="text-sm text-red-600">
                  {errorMessage}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Linking…' : 'Link Google to this account'}
              </Button>
            </form>
          </section>
        ) : null}

        {pending?.providerId === 'password' ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                This email is registered with Google
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                <span className="font-medium">{pending.email}</span> already has a Google sign-in.
                Continue with Google below to access your account. You can add a password later from
                Profile → Security, or send yourself a reset link now.
              </p>
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={onClickGoogleSignIn}
              disabled={submitting}
            >
              {submitting ? 'Signing in…' : 'Continue with Google'}
            </Button>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="h-px flex-1 bg-gray-200" /> or{' '}
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onClickResetPassword}
              disabled={submitting || resetEmailSent}
            >
              {resetEmailSent ? 'Reset email sent' : 'Email me a password reset link'}
            </Button>
            {errorMessage ? (
              <p role="alert" className="text-sm text-red-600">
                {errorMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        {!pending ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-base font-semibold text-gray-900">How linking works</h2>
            <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-2">
              <li>
                Try to sign in with whichever method (Google or email + password) you usually use.
              </li>
              <li>
                If your other identifier collides with an existing account, we&apos;ll bring you
                back here with the recovery flow primed.
              </li>
              <li>Confirm the link, and both methods sign you in to the same account.</li>
            </ol>
            <div className="flex gap-2 pt-1">
              <Link href="/customer/bookings">
                <Button variant="ghost">Back to bookings</Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline">Go to sign-in</Button>
              </Link>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Still missing bookings?</h2>
          <p className="text-sm text-gray-600">
            If your bookings were created on a fully separate account (different email and phone),
            our team can merge them for you. Reply to your booking-confirmation email or visit Help.
          </p>
          <div className="flex gap-2 pt-1">
            <Link href="/help">
              <Button variant="outline">Open Help</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AccountLinkPage() {
  return (
    <PublicRoute>
      <AccountLinkContent />
    </PublicRoute>
  );
}
