import type { MutableRefObject } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import * as Sentry from '@sentry/nextjs';
import { getFirebaseAuth } from '@/lib/firebase-client';
import {
  setupFcmForUser,
  subscribeToBroadcastTopics,
  type BroadcastRole,
} from '@/lib/messaging/fcm';
import type { User } from '@/types';
import type { logger } from '@/lib/logger';
import { attemptProfileWithRetry } from './orphan-cleanup';

type Logger = ReturnType<typeof logger.child>;

export interface AuthListenerDeps {
  mountedRef: { current: boolean };
  setUser: (u: User | null) => void;
  setFirebaseUser: (fb: FirebaseUser | null) => void;
  setIsLoading: (v: boolean) => void;
  setAuthResolved: (v: boolean) => void;
  fetchUserProfile: (fb: FirebaseUser) => Promise<User | null>;
  profileCreationInFlightRef: MutableRefObject<Promise<void> | null>;
  log: Logger;
}

// Returns the unsubscribe function from onAuthStateChanged plus a clearTimeout
// helper so the caller can tear everything down on effect cleanup.
export function startAuthListener(deps: AuthListenerDeps): {
  unsubscribe: () => void;
  cancelTimeout: () => void;
} {
  const {
    mountedRef,
    setUser,
    setFirebaseUser,
    setIsLoading,
    setAuthResolved,
    fetchUserProfile,
    profileCreationInFlightRef,
    log,
  } = deps;

  // Fallback: if onAuthStateChanged never fires (e.g. network issue), stop
  // loading after 15 seconds so the app remains usable as a guest. 15s is
  // chosen to outlast a cold App Check + Play Integrity warmup on a slow
  // network; below that we'd flip to guest while a valid session is still
  // resolving.
  const authTimeout = setTimeout(() => {
    if (mountedRef.current) {
      log.warn('Auth state did not resolve within 15s — forcing isLoading=false');
      setIsLoading(false);
      setAuthResolved(true);
    }
  }, 15000);

  const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (fbUser) => {
    if (!mountedRef.current) return;

    // Phase 6: flip authResolved true regardless of whether fbUser is null
    // or a signed-in session, so consumers can stop showing "loading…" as
    // soon as the SDK has spoken.
    //
    // 2026-05-11 (Granite-M1 / F29): the clearTimeout(authTimeout) call
    // used to fire here too. That meant a listener body that errored
    // BEFORE setIsLoading(false) would leave the user stuck loading
    // forever (timer already cancelled, isLoading still true). Moved
    // clearTimeout to the `finally` below so it runs atomically with the
    // setIsLoading(false) hand-off.
    setAuthResolved(true);

    // Wrap the entire body so a single failure (App Check transient,
    // Firestore network blip) cannot reject the listener and leave the
    // user stuck in a phantom signed-out state.
    try {
      setFirebaseUser(fbUser);

      if (fbUser) {
        // No forced getIdToken(true) here — signInWithCredential / cached
        // sessions already provide a fresh token. The Firestore SDK auto-
        // refreshes if a 401 comes back. Saves a network round-trip.
        const orphanResult = await attemptProfileWithRetry(fbUser, {
          fetchUserProfile,
          log,
        });
        let profile = orphanResult.profile;

        // A-2-03 + γ4 (2026-05-12): Orphan firebaseUser handling.
        //   fetchUserProfile is now wrapped in attemptProfileWithRetry which
        //   absorbs transient Firestore-rules-propagation lag (≥2 retries,
        //   250ms backoff per spec 2026-05-12-auth-9_5-plus §3). Only after
        //   the retry loop exhausts AND any profileCreationInFlightRef await
        //   resolves do we treat this as a genuine orphan and signOut.
        //   Phantom-authenticated state (firebaseUser set but user null)
        //   used to flicker booking-flow gates; the retry path + signOut
        //   fallback prevents that.
        if (profile === null) {
          // C-01 (2026-05-11): if an imperative createUserProfile is
          // in-flight (signUp / signInWithGoogle / redirect-result), the
          // listener has fired BEFORE the Firestore doc landed. Do NOT
          // treat this as an orphan — await the imperative path, then
          // re-fetch. Only fall through to firebaseSignOut if the doc is
          // still missing after the imperative path resolves.
          if (profileCreationInFlightRef.current) {
            log.info('Listener saw null profile but createUserProfile is in-flight — awaiting', {
              uid: fbUser.uid,
            });
            try {
              await profileCreationInFlightRef.current;
            } catch {
              // The imperative path will surface its own error via the
              // caller's try/catch; here we just need to know whether the
              // doc landed, which the re-fetch below will tell us.
            }
            if (mountedRef.current) {
              profile = await fetchUserProfile(fbUser);
            }
          }
        }

        if (profile === null) {
          log.warn('Orphan Firebase session detected — signing out', { uid: fbUser.uid });
          Sentry.addBreadcrumb({
            category: 'auth',
            message: 'orphan_session_cleared',
            data: { uid: fbUser.uid },
          });
          try {
            await firebaseSignOut(getFirebaseAuth());
          } catch (signOutErr) {
            log.error('Failed to clear orphan Firebase session', signOutErr);
          }
          if (mountedRef.current) {
            setUser(null);
            setFirebaseUser(null);
          }
          return;
        }

        if (mountedRef.current) {
          setUser(profile);
        }

        // Background work — must never run in the auth critical path.
        // Defer behind requestIdleCallback (or 1500ms timeout polyfill)
        // so first authenticated paint is not blocked.
        const broadcastRole: BroadcastRole =
          (profile?.role as BroadcastRole | undefined) ?? 'customer';
        const runBackgroundWork = (): void => {
          // Phase 2 / Agent 2F — C9: register FCM token for this uid.
          // Fire-and-forget: must never block the auth state resolution.
          void setupFcmForUser(fbUser.uid).catch(() => {});
          // Phase 1 / Agent 06: subscribe to broadcast topics by role.
          // TODO: once custom claims carry the authoritative role, swap
          // this to fbUser.getIdTokenResult().claims.role.
          void subscribeToBroadcastTopics(broadcastRole).catch(() => {});
        };
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          (
            window as unknown as {
              requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
            }
          ).requestIdleCallback(runBackgroundWork, { timeout: 3000 });
        } else {
          setTimeout(runBackgroundWork, 1500);
        }
      } else {
        if (mountedRef.current) {
          setUser(null);
        }
      }
    } catch (err) {
      // Never let the listener reject — keep last-known state and surface
      // the error to logs/Sentry instead. Auth UI stays usable.
      //
      // 2026-05-11 (L-D1 / T3-F8): the listener writes `setFirebaseUser(fbUser)`
      // at the top of the try block BEFORE awaiting fetchUserProfile. If
      // that await throws (F14 transient Firestore error), the catch
      // would previously leave `firebaseUser` set while `user` is null —
      // state S16, route guards redirect to login, but signIn resolves
      // silently (Firebase has the session) without re-firing the
      // listener. User stuck. Clear `firebaseUser` here so state stays
      // CONSISTENT (both null) — the user is prompted to re-authenticate
      // and the next signIn DOES fire the listener (clean transition).
      if (mountedRef.current) {
        setFirebaseUser(null);
        setUser(null);
      }
      log.error('Auth listener error — clearing state for clean retry', err);
      Sentry.captureException(err, {
        tags: { source: 'auth-listener', code: (err as { code?: string })?.code ?? 'unknown' },
      });
    } finally {
      // 2026-05-11 (Granite-M1 / F29): clearTimeout moved here so the
      // 15s safety net stays armed until the body completes (success OR
      // error). If we cancelled it eagerly on listener entry and then
      // errored before the setIsLoading(false) hand-off, the user would
      // be stuck loading.
      clearTimeout(authTimeout);
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  });

  return {
    unsubscribe,
    cancelTimeout: () => clearTimeout(authTimeout),
  };
}
