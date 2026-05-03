'use client';

/**
 * Multi-provider account-linking helpers.
 *
 * Phase 4 (Booking Flow Fix v3.1, 2026-05-02): the same physical user
 * signing in via Google on web (uid-A) and via phone-OTP in the APK
 * (uid-B) ends up with two disjoint Firestore identities, so bookings
 * created under one session are invisible from the other (Issue C).
 *
 * Firebase Auth's `linkWithCredential` is the canonical fix: when a
 * sign-in attempt fires `auth/account-exists-with-different-credential`,
 * we (1) discover which provider the *primary* account uses,
 * (2) prompt the user to sign in with that primary, and
 * (3) call `linkWithCredential(primary, pendingCred)` so the secondary
 * identifier becomes a second login method on the same uid.
 *
 * `mergeUserAccounts` (admin-only callable) handles the rarer case where
 * the user has *already* created bookings under both uids before the
 * link prompt fires — see `backend/functions/src/callable/mergeUserAccounts.ts`.
 */
import type { Auth, AuthCredential, User as FirebaseUser } from 'firebase/auth';
import {
  fetchSignInMethodsForEmail,
  linkWithCredential,
} from 'firebase/auth';
import { logger } from '@/lib/logger';

const linkLogger = logger.child({ component: 'account-linking' });

export type LinkAttemptOutcome =
  | { kind: 'linked'; primaryUid: string }
  | { kind: 'no_action_required' }
  | { kind: 'needs_recovery'; email: string; methods: string[]; pendingCredential: AuthCredential };

/**
 * On a sign-in attempt that fails with
 * `auth/account-exists-with-different-credential`, resolve which methods
 * are registered for the conflicting email. Returns the methods list and
 * the pending credential the caller should re-use after the user signs
 * in with their primary method.
 *
 * Returns `no_action_required` for any other Firebase error code so call
 * sites can transparently call this from their existing catch blocks.
 */
export async function resolveLinkConflict(
  err: unknown,
): Promise<LinkAttemptOutcome> {
  const code = (err as { code?: string } | null)?.code;
  if (code !== 'auth/account-exists-with-different-credential') {
    return { kind: 'no_action_required' };
  }

  const errorAny = err as {
    customData?: { email?: string };
    email?: string;
    credential?: AuthCredential;
  };
  const email = errorAny.customData?.email ?? errorAny.email;
  const pendingCredential = errorAny.credential;
  if (!email || !pendingCredential) {
    linkLogger.warn('Link conflict missing email or credential', { hasEmail: !!email, hasCred: !!pendingCredential });
    return { kind: 'no_action_required' };
  }

  // Note: `fetchSignInMethodsForEmail` is deprecated for email enumeration
  // protection; for accounts that pre-date enumeration protection or were
  // created in a project that has it disabled, this still works. Failure
  // here gracefully degrades to a no-op so the caller doesn't crash.
  try {
    const auth = (errorAny as unknown as { auth?: Auth }).auth ?? undefined;
    if (!auth) return { kind: 'no_action_required' };
    const methods = await fetchSignInMethodsForEmail(auth, email);
    return { kind: 'needs_recovery', email, methods, pendingCredential };
  } catch (lookupError) {
    linkLogger.warn('fetchSignInMethodsForEmail failed', { lookupError });
    return { kind: 'no_action_required' };
  }
}

/**
 * After the user has signed in with their primary provider, call this
 * with the now-current `FirebaseUser` and the credential captured from
 * the original conflicting attempt. Successful link returns the primary
 * uid so the caller can route past the linking UI.
 */
export async function completeLink(
  primaryUser: FirebaseUser,
  pendingCredential: AuthCredential,
): Promise<{ primaryUid: string }> {
  await linkWithCredential(primaryUser, pendingCredential);
  linkLogger.info('Account linked', { uid: primaryUser.uid });
  return { primaryUid: primaryUser.uid };
}

/**
 * Heuristic detector for the customer's bookings list:
 * `bookings.length === 0` AND the auth user has only one provider entry
 * AND the user has multiple identifiers (email + phone) — likely the
 * other identifier is on a different uid. Returns `true` to surface
 * the unlinked-account banner.
 */
export function detectUnlinkedAccounts(args: {
  hasZeroBookings: boolean;
  providerCount: number;
  hasEmail: boolean;
  hasPhone: boolean;
}): boolean {
  const { hasZeroBookings, providerCount, hasEmail, hasPhone } = args;
  return hasZeroBookings && providerCount === 1 && hasEmail && hasPhone;
}
