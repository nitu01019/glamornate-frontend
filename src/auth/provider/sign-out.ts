import type { MutableRefObject } from 'react';
import * as Sentry from '@sentry/nextjs';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { QueryClient } from '@tanstack/react-query';
import { getFirebaseApp, getFirebaseAuth } from '@/lib/firebase-client';
import { useCartStore } from '@/store/cart';
import { useChatStore } from '@/store/chat';
import { useBookingStore } from '@/store/booking';
import { usePopupStore } from '@/store/popup';
import { sweepClientState, type StoreHandle } from '@/auth/sign-out-sweeper';
import { teardownFcmForUser, unsubscribeFromBroadcastTopics } from '@/lib/messaging/fcm';
import type { User } from '@/types';
import type { logger } from '@/lib/logger';

type Logger = ReturnType<typeof logger.child>;

export interface SignOutDeps {
  queryClient: QueryClient;
  user: User | null;
  setUser: (u: User | null) => void;
  setFirebaseUser: (fb: import('firebase/auth').User | null) => void;
  signOutInFlightRef: MutableRefObject<Promise<void> | null>;
  profileCreationInFlightRef: MutableRefObject<Promise<void> | null>;
  log: Logger;
}

// Sign out — hardened to leave no session residue.
//
// Delegates to `sweepClientState` which executes every cleanup step in a
// deterministic order with per-step try/catch. The terminal Firebase Auth
// sign-out is guaranteed to run even if earlier steps throw, so a partial
// failure can never leave the user half signed-out.
//
// Order (PHASE_3 § 3.3):
//   1. FCM token unregister (no-op until Phase 4 wires messaging)
//   2. React Query cancel + clear
//   3. Zustand stores reset (cart, chat, booking, popup, ...)
//   4. localStorage purge of allowlisted prefixes
//   5. sessionStorage.clear
//   6. service worker + cache unregister
//   7. firebase.auth().signOut()
export async function performSignOut(deps: SignOutDeps): Promise<void> {
  const {
    queryClient,
    user,
    setUser,
    setFirebaseUser,
    signOutInFlightRef,
    profileCreationInFlightRef,
    log,
  } = deps;

  // Re-entrancy guard — a double tap on the sign-out button would
  // otherwise fire two sweeps in parallel.
  if (signOutInFlightRef.current) {
    return signOutInFlightRef.current;
  }

  // 2026-05-11 (Forge-D5 / F46): if a profile-creation is mid-flight
  // (slow first-sign-in), waiting for it to drain before sweeping avoids
  // an orphan Firestore doc (setDoc running against a now-stale token
  // post-firebaseSignOut). We swallow the in-flight's own rejection — it
  // surfaces via its caller's try/catch — we only care that the await
  // returns control.
  if (profileCreationInFlightRef.current) {
    log.info('signOut: awaiting in-flight profile creation before sweep');
    try {
      await profileCreationInFlightRef.current;
    } catch {
      // Imperative path surfaces its own error; we just want to drain.
    }
  }

  // 2026-05-11 (Cipher-D2 / T3-F4): server-side revoke BEFORE the local
  // sweep. Without this, `firebaseSignOut(auth)` only clears local
  // persistence — a leaked refresh token retains validity for up to ~60
  // days (Firebase default). The `revokeMySessions` callable updates the
  // server-side `validSince` so subsequent `verifyIdToken(..., true)`
  // returns `auth/id-token-revoked`. Best-effort: failure (network,
  // already-revoked, unauth) does NOT block the local sweep — we still
  // want the UI to reflect a signed-out state. Requires the caller to
  // still have a live ID token, which they do at this point.
  try {
    const functions = getFunctions(getFirebaseApp(), 'us-central1');
    // M-F5 (2026-05-11): cap callable at 5s. Sign-out is already declared
    // best-effort on revoke failure (see catch below); the default 70s
    // timeout means a flaky network keeps the user staring at a spinner.
    // 5s is well above median (~300ms) and 2σ of observed latency.
    const callable = httpsCallable<unknown, { success: boolean }>(functions, 'revokeMySessions', {
      timeout: 5000,
    });
    await callable();
    log.info('signOut: revokeMySessions callable succeeded');
  } catch (revokeErr) {
    Sentry.captureException(revokeErr, {
      tags: { source: 'auth-provider', phase: 'signout-revoke' },
    });
    log.warn('signOut: revokeMySessions failed — proceeding with local sweep anyway', {
      err: revokeErr instanceof Error ? revokeErr.message : String(revokeErr),
    });
  }

  const stores: StoreHandle[] = [
    {
      name: 'cart',
      getState: () => useCartStore.getState() as unknown as Record<string, unknown>,
    },
    {
      name: 'chat',
      getState: () => useChatStore.getState() as unknown as Record<string, unknown>,
    },
    {
      name: 'booking',
      getState: () => useBookingStore.getState() as unknown as Record<string, unknown>,
    },
    {
      name: 'popup',
      getState: () => usePopupStore.getState() as unknown as Record<string, unknown>,
    },
  ];

  // Phase 2 / Agent 2F — C9: capture the uid *before* the sweeper wipes
  // it, so we can remove this device's FCM token from users/{uid}. The
  // sweeper itself still runs regardless of whether teardown succeeds.
  const uidForFcmTeardown = getFirebaseAuth().currentUser?.uid;
  // Phase 1 / Agent 06: capture the role for broadcast-topic unsubscribe
  // before React state is cleared. Falls back to 'customer' when the
  // Firestore profile never loaded so we still unsubscribe from
  // 'audience:all' + 'audience:role_customer' (best-effort cleanup).
  const roleForBroadcastTeardown: string = user?.role ?? 'customer';

  const promise = (async () => {
    try {
      if (uidForFcmTeardown) {
        await teardownFcmForUser(uidForFcmTeardown).catch(() => {});
      }
      await unsubscribeFromBroadcastTopics(roleForBroadcastTeardown).catch(() => {});

      await sweepClientState({
        queryClient,
        stores,
        firebaseSignOut: async () => {
          await firebaseSignOut(getFirebaseAuth());
        },
      });
      setUser(null);
      setFirebaseUser(null);
    } catch (error: unknown) {
      // sweepClientState is designed never to throw, but if it does we
      // still clear the React state so the UI at least reflects a
      // signed-out status.
      //
      // 2026-05-11 (Cinder-D11 / F57): the previous code re-threw here,
      // but the only caller (signOutRef in the token-revoked handler)
      // explicitly swallows via `.catch(() => {})`. The throw was dead.
      // Dropping it removes a misleading public contract — callers
      // should treat signOut() as best-effort fire-and-forget.
      log.error('Sign out error', error);
      setUser(null);
      setFirebaseUser(null);
    }
  })();

  signOutInFlightRef.current = promise;
  try {
    await promise;
  } finally {
    signOutInFlightRef.current = null;
  }
}
