import type { MutableRefObject } from 'react';
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth';
import * as Sentry from '@sentry/nextjs';
import { getFirebaseAuth } from '@/lib/firebase-client';
import { AuthError, getUserFriendlyMessage } from '@/auth/errors';
import type { User } from '@/types';
import type { logger } from '@/lib/logger';

type Logger = ReturnType<typeof logger.child>;

export interface EmailAuthDeps {
  fetchUserProfile: (fbUser: FirebaseUser) => Promise<User | null>;
  createUserProfile: (
    fbUser: FirebaseUser,
    additionalData?: { displayName?: string },
  ) => Promise<User>;
  profileCreationInFlightRef: MutableRefObject<Promise<void> | null>;
  log: Logger;
}

export interface EmailAuthApi {
  signIn: (email: string, password: string, options?: { isLinkFlow?: boolean }) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

export function createEmailAuth(deps: EmailAuthDeps): EmailAuthApi {
  const { createUserProfile, profileCreationInFlightRef, log } = deps;

  // Sign in with email/password.
  // The onAuthStateChanged listener is the single source of truth for
  // setUser / fetchUserProfile — we don't duplicate that work here.
  const signIn = async (
    email: string,
    password: string,
    options?: { isLinkFlow?: boolean },
  ): Promise<void> => {
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    } catch (error: unknown) {
      const fbError = error as { code?: string; message?: string };
      const code = fbError.code ?? 'unknown';
      const msg = fbError.message ?? '';
      // Phase 4 (Booking Flow Fix v3.1, 2026-05-02): cross-provider
      // conflict during email sign-in routes to the linking flow rather
      // than confusing the user with "wrong-password".
      //
      // 2026-05-11 (Mire-D1 + Keystone-M3 / F5): the link page also calls
      // signIn during cross-provider recovery. If the user mistypes their
      // email there, this branch would OVERWRITE the original Google
      // pendingCredential with `{providerId:'password', email:<typo>}` and
      // redirect back to /account/link in an infinite loop, with the
      // original Google idToken destroyed. The `isLinkFlow` flag suppresses
      // both the overwrite and the redirect — the link page's own catch
      // surfaces the error in-page.
      if (code === 'auth/account-exists-with-different-credential' && !options?.isLinkFlow) {
        log.warn('Email sign-in surfaced cross-provider conflict', { code });
        if (typeof window !== 'undefined') {
          // Stash pendingCredential so the link page can recover the email
          // path: user signs in with the conflicting provider (Google), then
          // adds password as an additional credential via linkWithCredential.
          // Email/password has no FirebaseError-derived credential factory in
          // a sign-in failure (EmailAuthProvider.credentialFromError is
          // undefined for this code), so we stash the raw email instead.
          try {
            sessionStorage.setItem(
              'glamornate.pendingCredential',
              JSON.stringify({ providerId: 'password', email }),
            );
          } catch (err) {
            // 2026-05-11 (Atlas-D7 + Cinder-D6 / F34): sessionStorage may
            // throw in private mode or when quota is exhausted. Recovery
            // still works (the link page falls back to its no-pending-
            // credential branch) but the failure should be observable so
            // we can detect "everyone in private mode is stuck."
            log.warn('Failed to stash pendingCredential (password branch)', {
              err: err instanceof Error ? err.message : String(err),
            });
          }
          window.location.assign('/customer/account/link');
          return;
        }
      }
      // 2026-05-11 (Cinder-D4 / F15): expected user-input failures
      // (wrong-password, user-not-found, invalid-credential) and user-cancelled
      // popups are NOT exceptional — they happen on every typo. Don't burn
      // Sentry quota and dilute real-signal alerts with them.
      const EXPECTED_SIGNIN_CODES = new Set([
        'auth/wrong-password',
        'auth/user-not-found',
        'auth/invalid-credential',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        // V-15 (2026-05-11): Firebase platform throttling is expected, not
        // exceptional. Demote from Sentry error to warn.
        'auth/too-many-requests',
      ]);
      if (EXPECTED_SIGNIN_CODES.has(code)) {
        log.warn('Sign in failed (user input)', { code });
      } else {
        log.error('Sign in error', error);
        // 2026-05-11 (Lens-D7 / T3-F26): include `code` tag so on-call can
        // filter Sentry by failure mode (`auth/internal-error`, etc.).
        Sentry.captureException(error, {
          tags: { source: 'auth-provider', phase: 'signin', code },
        });
      }
      // 2026-05-12 (Track A): symmetry with email.ts signUp (line 209) and google.ts native (line 156). Unknown SDK errors no longer fall through to the unmapped δ5 fallback toast.
      const resolvedCode = code !== 'unknown' ? code : 'auth/internal-error';
      const rawSuffix = code === 'unknown' && msg ? ` [${msg.slice(0, 100)}]` : '';
      throw new AuthError(
        getUserFriendlyMessage(new AuthError('', { firebaseCode: resolvedCode })) + rawSuffix,
        {
          firebaseCode: resolvedCode,
          cause: error instanceof Error ? error : undefined,
        },
      );
    }
  };

  // Sign up with email/password.
  // The user profile MUST be created before the listener tries to read it,
  // so the createUserProfile call stays here. setUser/setFirebaseUser are
  // dropped — the listener will set them in a single pass.
  const signUp = async (email: string, password: string, displayName: string): Promise<void> => {
    // O2 (2026-05-11): publish a deferred promise on the in-flight ref
    // BEFORE calling createUserWithEmailAndPassword. The SDK fires
    // onAuthStateChanged synchronously-ish inside that call; without a
    // pre-published ref the listener can observe a brand-new fbUser with
    // no profile and no in-flight signal — orphan cleanup then
    // firebaseSignOut's the user. Mirrors the redirect-flow pattern at
    // ~:420-426.
    let resolveCreation: () => void = () => undefined;
    let rejectCreation: (err: unknown) => void = () => undefined;
    const creationDeferred = new Promise<void>((resolve, reject) => {
      resolveCreation = resolve;
      rejectCreation = reject;
    });
    profileCreationInFlightRef.current = creationDeferred;
    // Swallow unhandled-rejection on the ref itself; awaiters get the real
    // error via the resolve/reject capabilities.
    creationDeferred.catch(() => undefined);

    try {
      const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);

      const creationPromise = (async () => {
        await result.user.getIdToken(true); // force token refresh before Firestore
        // Update display name on Firebase Auth profile
        await updateProfile(result.user, { displayName });
        // Create the Firestore user/{uid} doc so the listener can read it
        await createUserProfile(result.user, { displayName });
        // 2026-05-11 (Cipher-D5 / T3-F6): kick off an email-verification
        // email on signup. Best-effort — failure (rate-limit, transient)
        // does NOT block signup completion. NIST 800-63B AAL2 stepping
        // stone; lets us gate sensitive actions on `emailVerified` later.
        try {
          await sendEmailVerification(result.user);
          log.info('signUp: verification email sent');
        } catch (verifyErr) {
          log.warn('signUp: sendEmailVerification failed (non-blocking)', {
            err: verifyErr instanceof Error ? verifyErr.message : String(verifyErr),
          });
        }
      })();

      try {
        await creationPromise;
        resolveCreation();
      } catch (createErr) {
        rejectCreation(createErr);
        throw createErr;
      } finally {
        profileCreationInFlightRef.current = null;
      }
    } catch (error: unknown) {
      // O2: settle the deferred for the case where
      // createUserWithEmailAndPassword itself threw (or the inner
      // creationPromise rethrew). Safe to call after settlement —
      // resolve/reject capabilities are no-ops once the promise is settled.
      rejectCreation(error);
      profileCreationInFlightRef.current = null;

      const fbError = error as { code?: string; message?: string };
      const code = fbError.code ?? 'unknown';
      const msg = fbError.message ?? '';
      // 2026-05-11 (Cinder-D7 / F8): `auth/email-already-in-use` is the
      // expected response to an attacker probing whether a target email is
      // registered. Don't ship those probes to Sentry — they leak the very
      // signal that the register-route's neutral-response design tries to
      // hide. Also: don't dump `msg` (the raw Firebase string) into structured
      // log fields, where it ends up indexed by log search.
      if (code === 'auth/email-already-in-use') {
        log.warn('Sign up failed (email already in use)', { code });
      } else {
        log.error('Sign up error', error, { code });
        // 2026-05-11 (Lens-D7 / T3-F26): tag with phase + code.
        Sentry.captureException(error, {
          tags: { source: 'auth-provider', phase: 'signup', code },
        });
      }
      // 2026-05-12 (Hunt-D1): symmetry with google.ts. When the SDK throws
      // without a recognizable code (e.g. plain Error from getFirebaseAuth
      // when env vars are absent at runtime, or a non-FirebaseError thrown
      // by a misconfigured native bridge), route through auth/internal-error
      // so the toast says "try reinstalling" instead of the generic unmapped
      // fallback "Sign-in failed. Please try again." Append a truncated raw
      // message so the user sees the actual failure for diagnosis.
      const resolvedCode = code !== 'unknown' ? code : 'auth/internal-error';
      const rawSuffix = code === 'unknown' && msg ? ` [${msg.slice(0, 100)}]` : '';
      throw new AuthError(
        getUserFriendlyMessage(new AuthError('', { firebaseCode: resolvedCode })) + rawSuffix,
        {
          firebaseCode: resolvedCode,
          cause: error instanceof Error ? error : undefined,
        },
      );
    }
  };

  // Reset password
  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
    } catch (error: unknown) {
      const fbError = error as { code?: string; message?: string };
      const code = fbError.code ?? 'unknown';
      const msg = fbError.message ?? '';
      // A-3-05: swallow user-not-found to mirror Firebase's default
      // anti-enumeration behaviour. The forgot-password page surfaces a
      // generic "if an account exists" message regardless of outcome, so
      // resolving silently never confirms or denies the account exists.
      if (code === 'auth/user-not-found') {
        log.info(
          'Password reset for non-existent email — resolving silently to prevent enumeration',
        );
        return;
      }
      log.error('Password reset error', error);
      // 2026-05-11 (Lens-D7 / T3-F26): tag includes phase + code.
      Sentry.captureException(error, {
        tags: { source: 'auth-provider', phase: 'reset-password', code },
      });
      // 2026-05-12 (Track A): same Hunt-D1 normalization as signIn / signUp. Preserves the enumeration-defence silent-return for auth/user-not-found above.
      const resolvedCode = code !== 'unknown' ? code : 'auth/internal-error';
      const rawSuffix = code === 'unknown' && msg ? ` [${msg.slice(0, 100)}]` : '';
      throw new AuthError(
        getUserFriendlyMessage(new AuthError('', { firebaseCode: resolvedCode })) + rawSuffix,
        {
          firebaseCode: resolvedCode,
          cause: error instanceof Error ? error : undefined,
        },
      );
    }
  };

  return { signIn, signUp, resetPassword };
}
