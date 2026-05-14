import type { MutableRefObject } from 'react';
import {
  User as FirebaseUser,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  GoogleAuthProvider,
} from 'firebase/auth';
import * as Sentry from '@sentry/nextjs';
import { getFirebaseAuth } from '@/lib/firebase-client';
import { AuthError, getUserFriendlyMessage } from '@/auth/errors';
import type { User } from '@/types';
import type { logger } from '@/lib/logger';
import { isNativePlatform, signInWithNativeGoogle } from './credential';

type Logger = ReturnType<typeof logger.child>;

export interface GoogleAuthDeps {
  fetchUserProfile: (fbUser: FirebaseUser) => Promise<User | null>;
  createUserProfile: (
    fbUser: FirebaseUser,
    additionalData?: { displayName?: string },
  ) => Promise<User>;
  profileCreationInFlightRef: MutableRefObject<Promise<void> | null>;
  log: Logger;
}

export interface GoogleAuthApi {
  signInWithGoogle: () => Promise<void>;
  handleRedirectResult: (mountedRef: { current: boolean }) => void;
}

export function createGoogleAuth(deps: GoogleAuthDeps): GoogleAuthApi {
  const { createUserProfile, profileCreationInFlightRef, log } = deps;

  // Sign in with Google.
  //
  // On Capacitor native (Android / iOS) we use the native Google chooser
  // bottom sheet via @capacitor-firebase/authentication. The plugin returns
  // an idToken which we exchange for a Firebase session via
  // signInWithCredential. This avoids the WebView storage-partition bug
  // that makes signInWithRedirect fail with "auth/missing-initial-state".
  //
  // On web we keep the existing popup-first, redirect-fallback path.
  const signInWithGoogle = async (): Promise<void> => {
    if (isNativePlatform()) {
      // O2 (2026-05-11): publish deferred BEFORE plugin call. The plugin
      // resolves with an idToken that we exchange for a Firebase session
      // via signInWithCredential — the latter fires onAuthStateChanged
      // synchronously-ish, so we must already have a published ref before
      // the SDK flips state. Same pattern as signUp.
      let resolveCreation: () => void = () => undefined;
      let rejectCreation: (err: unknown) => void = () => undefined;
      const creationDeferred = new Promise<void>((resolve, reject) => {
        resolveCreation = resolve;
        rejectCreation = reject;
      });
      profileCreationInFlightRef.current = creationDeferred;
      creationDeferred.catch(() => undefined);

      try {
        // 2026-05-11 (H1): passing `scopes` forces the Android Authorization
        // Activity (full OAuth consent page) on top of the Credential Manager
        // bottom sheet. With the argument omitted, the plugin uses Credential
        // Manager only — email + profile are baseline OIDC claims on the
        // returned idToken regardless. iOS handler treats empty
        // additionalScopes identically; web path is unaffected (different
        // call site).
        const native = await signInWithNativeGoogle();
        const credential = GoogleAuthProvider.credential(native.idToken);
        const result = await signInWithCredential(getFirebaseAuth(), credential);
        // C-01 (2026-05-11): see signUp — track the in-flight profile
        // creation so the listener does not race-sign-out a brand-new
        // Google user before the imperative setDoc lands.
        const creationPromise = (async () => {
          // Force a token refresh before touching Firestore. On first sign-in
          // the Auth → Firestore rules propagation race can cause
          // permission-denied. getIdToken(true) ensures the SDK has the latest
          // token before we write the user doc. (Matches signUp behaviour.)
          await result.user.getIdToken(true);
          // Ensure the Firestore user/{uid} doc exists before the listener
          // reads it. createUserProfile is upsert-style — safe on returning
          // users. No setFirebaseUser/setUser here — the onAuthStateChanged
          // listener will run that work in a single pass, avoiding the
          // double-fetch latency that made sign-in slow.
          await createUserProfile(result.user);
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
        return;
      } catch (error: unknown) {
        // O2: settle deferred for the case where the plugin call or
        // signInWithCredential threw before the inner try ran.
        rejectCreation(error);
        profileCreationInFlightRef.current = null;
        const fbError = error as { code?: string; message?: string };
        const code = fbError.code ?? 'unknown';
        const msg = fbError.message ?? '';
        // 2026-05-11 (Cinder-D8 / F40): classify cancellation FIRST, then
        // decide whether to ship to Sentry. Previously the raw error was
        // captured BEFORE the classifier ran, so every user-cancelled
        // Google sign-in (codes 12500/12501/12502) emitted a Sentry event
        // — burning quota for non-exceptional UX.
        // A-2-10: Treat 12500/12501/12502 as cancellation. Recent Play
        // Services releases surface 12500 (SIGN_IN_FAILED) and 12502
        // (SIGN_IN_CURRENTLY_IN_PROGRESS) for de-facto user dismissals.
        const isCancellation =
          code === '12500' /* GoogleSignInStatusCodes.SIGN_IN_FAILED */ ||
          code === '12501' /* GoogleSignInStatusCodes.SIGN_IN_CANCELLED */ ||
          code === '12502' /* GoogleSignInStatusCodes.SIGN_IN_CURRENTLY_IN_PROGRESS */ ||
          // H4 (2026-05-11): Android 14+ Credential Manager emits a distinct
          // code/message when the user dismisses the bottom sheet. Catch it
          // as cancellation, not error, to stop Sentry noise.
          code === 'androidx.credentials.TYPE_USER_CANCELED' ||
          msg.includes('androidx.credentials.TYPE_USER_CANCELED') ||
          msg.toLowerCase().includes('canceled') ||
          msg.toLowerCase().includes('cancelled');
        if (isCancellation) {
          log.info('Native Google sign-in cancelled by user', { code });
        } else {
          log.error('Native Google sign-in raw error', error);
          // 2026-05-11 (Lens-D7 / T3-F26): tag includes raw `code`.
          Sentry.captureException(error, {
            tags: { source: 'auth-provider', phase: 'native-google-signin-raw', code },
          });
        }
        if (isCancellation) {
          throw new AuthError(
            getUserFriendlyMessage(
              new AuthError('', { firebaseCode: 'auth/popup-closed-by-user' }),
            ),
            {
              firebaseCode: 'auth/popup-closed-by-user',
              cause: error instanceof Error ? error : undefined,
            },
          );
        }
        log.error('Native Google sign in error (post-normalization)', error, { code, msg });
        // 2026-05-12 (Hunt-D1): stop aliasing unknown → auth/network-request-failed.
        // The misleading "Network error" toast made users chase a non-existent
        // connectivity issue when the real cause was upstream (App Check
        // rejection, SHA-1 mismatch, OAuth-config drift, restricted API key).
        // Route unknown through auth/internal-error which carries the
        // actionable "Try reinstalling the app." copy, and append a truncated
        // raw-message suffix so the toast surfaces the actual error for
        // diagnosis. See docs/superpowers/specs/2026-05-12-auth-regression-hunt.md.
        const resolvedCode = code !== 'unknown' ? code : 'auth/internal-error';
        const rawSuffix = code === 'unknown' && msg ? ` [${msg.slice(0, 100)}]` : '';
        throw new AuthError(
          getUserFriendlyMessage(new AuthError('', { firebaseCode: resolvedCode })) + rawSuffix,
          { firebaseCode: resolvedCode, cause: error instanceof Error ? error : undefined },
        );
      }
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    // O2 (2026-05-11): publish deferred BEFORE signInWithPopup. Same pattern
    // as signUp / native Google. signInWithPopup fires onAuthStateChanged
    // during its await; without a pre-published ref the listener could
    // orphan-cleanup the brand-new Google user.
    let resolveCreation: () => void = () => undefined;
    let rejectCreation: (err: unknown) => void = () => undefined;
    const creationDeferred = new Promise<void>((resolve, reject) => {
      resolveCreation = resolve;
      rejectCreation = reject;
    });
    profileCreationInFlightRef.current = creationDeferred;
    creationDeferred.catch(() => undefined);

    try {
      const result = await signInWithPopup(getFirebaseAuth(), provider);
      // C-01 (2026-05-11): same in-flight tracking as the native path so
      // the listener's orphan-cleanup branch awaits this createUserProfile
      // before deciding the session is orphaned.
      const creationPromise = (async () => {
        // Web path: same single-source-of-truth pattern as native. Force a
        // token refresh before Firestore to avoid the auth-propagation race.
        await result.user.getIdToken(true);
        // Ensure Firestore user doc exists; let the listener handle setUser.
        await createUserProfile(result.user);
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
      // O2: settle deferred for the case signInWithPopup or downstream threw.
      rejectCreation(error);
      profileCreationInFlightRef.current = null;
      const fbError = error as { code?: string; message?: string };
      const code = fbError.code ?? 'unknown';

      // Phase 4 (Booking Flow Fix v3.1, 2026-05-02): if Google sign-in
      // surfaces an existing-account-different-credential conflict, route
      // the user to /customer/account/link with a banner so they can
      // recover via linkWithCredential. Done before the popup-blocked
      // fallback because the conflict is unrelated to popup state.
      if (code === 'auth/account-exists-with-different-credential') {
        log.warn('Google sign-in surfaced cross-provider conflict', { code });
        if (typeof window !== 'undefined') {
          // Capture the pendingCredential into sessionStorage so the link
          // page (Vault A-6-01) can consume it via linkWithCredential after
          // the user signs in with the existing provider.
          try {
            const credential = GoogleAuthProvider.credentialFromError(fbError as never);
            if (credential) {
              sessionStorage.setItem(
                'glamornate.pendingCredential',
                JSON.stringify({
                  providerId: 'google.com',
                  idToken: credential.idToken ?? null,
                  accessToken: credential.accessToken ?? null,
                }),
              );
            }
          } catch (err) {
            // 2026-05-11 (Cinder-D10 / F34): sessionStorage may throw in
            // private mode or quota exhaustion. Recovery still works via
            // the user re-initiating Google sign-in on the link page, but
            // make the failure observable.
            log.warn('Failed to stash pendingCredential (google branch)', {
              err: err instanceof Error ? err.message : String(err),
            });
          }
          window.location.assign('/customer/account/link');
          return;
        }
        throw new AuthError(getUserFriendlyMessage(new AuthError('', { firebaseCode: code })), {
          firebaseCode: code,
          cause: error instanceof Error ? error : undefined,
        });
      }

      // A-2-08: Restrict redirect fallback to `auth/popup-blocked` only.
      // For `popup-closed-by-user` and `cancelled-popup-request` the user
      // dismissed the popup intentionally — surfacing a friendly toast via
      // the AuthError path below is the correct UX. Re-issuing
      // signInWithRedirect on a closed popup is hostile.
      if (code === 'auth/popup-blocked') {
        log.warn('Popup blocked, falling back to redirect', { code });
        await signInWithRedirect(getFirebaseAuth(), provider);
        return;
      }

      const msg = fbError.message ?? '';
      log.error('Google sign in error', error, { code, msg });
      // 2026-05-11 (Lens-D7 / T3-F26): tag includes phase + code.
      Sentry.captureException(error, {
        tags: { source: 'auth-provider', phase: 'google-web', code },
      });
      // 2026-05-12 (Track A): symmetry with the native Google catch at line 156 and email.ts signIn/signUp/resetPassword. Unknown SDK errors no longer fall through to the unmapped δ5 fallback toast.
      const resolvedCode = code !== 'unknown' ? code : 'auth/internal-error';
      const rawSuffix = code === 'unknown' && msg ? ` [${msg.slice(0, 100)}]` : '';
      throw new AuthError(
        getUserFriendlyMessage(new AuthError('', { firebaseCode: resolvedCode })) + rawSuffix,
        { firebaseCode: resolvedCode, cause: error instanceof Error ? error : undefined },
      );
    }
  };

  // Handle redirect result (from signInWithRedirect fallback).
  // A-2-07: Broaden the suppression set to include benign post-redirect
  // codes that should not produce Sentry noise: empty error objects,
  // `auth/no-auth-event` (no redirect was in progress), and
  // `auth/cancelled-popup-request` (user-initiated abort).
  //
  // C-02 (2026-05-11): redirect flow has no createUserProfile call site
  // because the redirect navigates away mid-popup-fallback. After A-2-04
  // dropped listener auto-create, popup-blocked users who fall back to
  // signInWithRedirect would land back here with no Firestore doc, hit
  // orphan-cleanup, and be permanently locked out. Ensure the doc exists
  // here, tracked through profileCreationInFlightRef so the listener
  // (which fires concurrently) waits before deciding the session is
  // orphaned.
  //
  // 2026-05-11 (Spire-D2 / F23): native Capacitor never uses
  // signInWithRedirect — it uses FirebaseAuthentication.signInWithGoogle +
  // signInWithCredential. Calling getRedirectResult on native triggers an
  // extra Firebase Auth round-trip plus a swallowed `auth/no-auth-event`
  // rejection on every cold start. Gate on platform.
  const handleRedirectResult = (mountedRef: { current: boolean }): void => {
    if (isNativePlatform()) return;

    // 2026-05-11 (Hawk-D3 / F12): publish a deferred promise on the
    // in-flight ref SYNCHRONOUSLY, BEFORE calling getRedirectResult().
    // Without this, the ref-assignment happens inside a `.then` chain
    // whose timing relative to onAuthStateChanged is SDK-internal — the
    // listener could observe a null ref, treat the redirect-returning
    // user as an orphan, and silently sign them out. The deferred-promise
    // pattern makes the invariant explicit and SDK-version-independent:
    // the ref is set before any other auth code runs.
    let resolveRedirectCreation: () => void = () => undefined;
    let rejectRedirectCreation: (err: unknown) => void = () => undefined;
    const redirectCreationPromise = new Promise<void>((resolve, reject) => {
      resolveRedirectCreation = resolve;
      rejectRedirectCreation = reject;
    });
    profileCreationInFlightRef.current = redirectCreationPromise;
    // Swallow the rejection on the deferred promise itself so listeners
    // that `await` it don't get an unhandled-rejection warning. Per-site
    // error handling is done in the .then/.catch below.
    redirectCreationPromise.catch(() => undefined);

    getRedirectResult(getFirebaseAuth())
      .then(async (result) => {
        if (result?.user && mountedRef.current) {
          const creationPromise = (async () => {
            await result.user.getIdToken(true);
            await createUserProfile(result.user);
          })();
          // Keep the deferred promise on the ref AND the inner creation
          // promise — when the inner resolves/rejects, mirror it onto the
          // deferred, then clear the ref.
          try {
            await creationPromise;
            resolveRedirectCreation();
          } catch (createErr) {
            // 2026-05-11 (Atlas-D1 + Cinder-D2 / F2): if createUserProfile
            // throws here, the listener will see no Firestore doc and fire
            // orphan-cleanup → silent firebaseSignOut. The user lands on
            // login with no toast and no explanation. Stash the failure
            // so the login page can surface a banner on next mount.
            log.error('Redirect-flow createUserProfile failed', createErr);
            Sentry.captureException(createErr, {
              tags: { source: 'auth-provider', phase: 'redirect-create-profile' },
            });
            try {
              sessionStorage.setItem(
                'glamornate.redirectProfileError',
                JSON.stringify({
                  code: (createErr as { code?: string })?.code ?? 'unknown',
                  ts: Date.now(),
                }),
              );
            } catch {
              // sessionStorage may be unavailable in private mode; log only.
              log.warn('Failed to stash redirectProfileError to sessionStorage');
            }
            rejectRedirectCreation(createErr);
          } finally {
            profileCreationInFlightRef.current = null;
          }
        } else {
          // No redirect-bound user — resolve the deferred so any listener
          // awaiting it can proceed, then clear the ref so subsequent
          // imperative paths can publish their own.
          resolveRedirectCreation();
          profileCreationInFlightRef.current = null;
        }
      })
      .catch((error: unknown) => {
        // Settle the deferred — even on the cross-provider branch below
        // we DON'T want listeners stuck awaiting forever.
        rejectRedirectCreation(error);
        profileCreationInFlightRef.current = null;
        const fbError = error as { code?: string };
        const code = fbError?.code || '';
        const benign =
          !code ||
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/no-auth-event' ||
          code === 'auth/cancelled-popup-request';
        // 2026-05-11 (Cinder-D3 / F39): the popup path at signInWithGoogle
        // routes cross-provider conflict to /customer/account/link with
        // pendingCredential stashed. The redirect path was dropping it
        // entirely — user lands on login with no recovery UI.
        if (code === 'auth/account-exists-with-different-credential') {
          log.warn('Redirect-flow surfaced cross-provider conflict', { code });
          try {
            const credential = GoogleAuthProvider.credentialFromError(
              error as Parameters<typeof GoogleAuthProvider.credentialFromError>[0],
            );
            sessionStorage.setItem(
              'glamornate.pendingCredential',
              JSON.stringify({
                providerId: 'google.com',
                idToken: credential?.idToken ?? null,
                accessToken: credential?.accessToken ?? null,
              }),
            );
          } catch {
            // sessionStorage may throw; recovery still works via re-init.
          }
          if (typeof window !== 'undefined') {
            window.location.assign('/customer/account/link');
          }
          return;
        }
        if (!benign) {
          log.error('Redirect result error', error);
        }
      });
  };

  return { signInWithGoogle, handleRedirectResult };
}
