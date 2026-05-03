'use client';

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase-client';
import { useCartStore } from '@/store/cart';
import { useChatStore } from '@/store/chat';
import { useBookingStore } from '@/store/booking';
import { usePopupStore } from '@/store/popup';
import { sweepClientState, type StoreHandle } from '@/lib/auth/sign-out-sweeper';
import {
  setupFcmForUser,
  teardownFcmForUser,
  subscribeToBroadcastTopics,
  unsubscribeFromBroadcastTopics,
  type BroadcastRole,
} from '@/lib/messaging/fcm';
import type { User, SpaData } from '@/types';
import { isFirebaseConfigured } from '@/lib/firebase-config';
import { logger } from '@/lib/logger';
import { AuthError, getUserFriendlyMessage } from '@/lib/error-handler';
import * as Sentry from '@sentry/nextjs';

const log = logger.child({ component: 'AuthProvider' });

// Auth context type
interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  /**
   * Phase 6 (Booking Flow Fix v3.1, 2026-05-02): `true` once the first
   * `onAuthStateChanged` callback has fired (regardless of whether the
   * user is signed in) OR the 15-second safety timeout has elapsed.
   * Booking-flow gates use this instead of `!isLoading && firebaseUser`
   * because the legacy combination flips to "signed-out" during the
   * Capacitor cold-start race and surfaces an empty bookings list as
   * the user's history (Issue C on APK).
   */
  authResolved: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Look up spaData for a spa_owner who is missing it
async function lookupSpaData(uid: string): Promise<SpaData | null> {
  try {
    const db = getFirebaseFirestore();
    const spasQuery = query(collection(db, 'spas'), where('ownerId', '==', uid), limit(1));
    const snapshot = await getDocs(spasQuery);
    if (snapshot.empty) return null;

    const spaDoc = snapshot.docs[0];
    const spaData: SpaData = {
      spaId: spaDoc.id,
      permissions: ['manage_bookings', 'manage_staff', 'manage_services', 'view_analytics'],
      commissionRate: spaDoc.data().commission?.platformRate ?? 0.15,
    };

    // Backfill the user document so this lookup doesn't repeat
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      spaData,
      updatedAt: serverTimestamp(),
    });

    return spaData;
  } catch (error: unknown) {
    log.error('Failed to lookup spaData for spa_owner', error);
    return null;
  }
}

// Convert Firebase user to app User type
async function createUserProfile(
  firebaseUser: FirebaseUser,
  additionalData?: { displayName?: string },
): Promise<User> {
  const db = getFirebaseFirestore();
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const userData = userSnap.data() as User;

    // CRIT-001: If spa_owner is missing spaData, look it up from spas collection
    if (userData.role === 'spa_owner' && !userData.spaData?.spaId) {
      const spaData = await lookupSpaData(firebaseUser.uid);
      if (spaData) {
        return { ...userData, spaData };
      }
    }

    return userData;
  }

  // Create new user profile
  // Build profile without undefined values — Firestore rejects undefined fields
  const { email, displayName, photoURL, phoneNumber } = firebaseUser;
  const profile = {
    displayName: additionalData?.displayName || displayName || 'New User',
    ...(email && { email }),
    ...(phoneNumber && { phone: phoneNumber }),
    ...(photoURL && { photo: photoURL }),
  };

  const newUser: User = {
    authProvider: email ? 'email' : 'google',
    role: 'customer',
    profile,
    emailVerified: firebaseUser.emailVerified,
    phoneVerified: !!phoneNumber,
    preferences: {
      language: 'en',
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
    },
    customerData: {
      favorites: [],
      history: [],
    },
    isActive: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(userRef, {
    authProvider: newUser.authProvider,
    role: 'customer',
    profile,
    emailVerified: newUser.emailVerified,
    phoneVerified: newUser.phoneVerified,
    preferences: newUser.preferences,
    customerData: newUser.customerData,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });

  return newUser;
}

// Auth Provider component
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Phase 6 (Booking Flow Fix v3.1, 2026-05-02): authResolved becomes true
  // on the first onAuthStateChanged callback OR when the 15s safety
  // timeout fires. Stays true forever after.
  const [authResolved, setAuthResolved] = useState(false);
  const queryClient = useQueryClient();
  // Guard against concurrent signOut calls so a double-tap cannot fire two
  // sweeps in flight (would drop a second firebaseSignOut after the first
  // already zeroed the session).
  const signOutInFlightRef = useRef<Promise<void> | null>(null);

  // Fetch user profile from Firestore
  const fetchUserProfile = async (fbUser: FirebaseUser): Promise<User | null> => {
    try {
      const db = getFirebaseFirestore();
      const userRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data() as User;

        // Backfill spaData for spa_owner if missing (mirrors createUserProfile logic)
        if (userData.role === 'spa_owner' && !userData.spaData?.spaId) {
          const spaData = await lookupSpaData(fbUser.uid);
          if (spaData) {
            return { ...userData, spaData };
          }
        }

        return userData;
      } else {
        // Auto-create profile for users who exist in Firebase Auth but not Firestore
        // (e.g. previous sign-up failed at the Firestore step)
        log.warn('User profile missing in Firestore — auto-creating', { uid: fbUser.uid });
        return await createUserProfile(fbUser);
      }
    } catch (error: unknown) {
      // Firebase auth state may not be synced with Firestore yet on first sign-in.
      // Retry once after a short delay to allow the auth token to propagate.
      const code = (error as { code?: string })?.code || '';
      if (code === 'permission-denied' || String(error).includes('permissions')) {
        log.warn('Firestore auth not synced yet — retrying in 1.5s', { uid: fbUser.uid });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        try {
          await fbUser.getIdToken(true);
          const db = getFirebaseFirestore();
          const userRef = doc(db, 'users', fbUser.uid);
          const retrySnap = await getDoc(userRef);
          if (retrySnap.exists()) {
            return retrySnap.data() as User;
          }
          return await createUserProfile(fbUser);
        } catch (retryError: unknown) {
          log.error('Retry also failed', retryError);
          return null;
        }
      }
      log.error('Error fetching user profile', error);
      return null;
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    if (firebaseUser) {
      const profile = await fetchUserProfile(firebaseUser);
      setUser(profile);
    }
  };

  // Auth state listener
  useEffect(() => {
    let mounted = true;

    // Guard: when Firebase is not configured (demo mode), skip auth listener
    if (!isFirebaseConfigured()) {
      log.warn('Firebase not configured — auth provider running in demo mode');
      setIsLoading(false);
      setAuthResolved(true);
      return () => {
        mounted = false;
      };
    }

    // Handle redirect result (from signInWithRedirect fallback)
    getRedirectResult(getFirebaseAuth()).catch((error: unknown) => {
      const code = (error as { code?: string })?.code || '';
      if (code && code !== 'auth/popup-closed-by-user') {
        log.error('Redirect result error', error);
      }
    });

    // Fallback: if onAuthStateChanged never fires (e.g. network issue), stop
    // loading after 15 seconds so the app remains usable as a guest. 15s is
    // chosen to outlast a cold App Check + Play Integrity warmup on a slow
    // network; below that we'd flip to guest while a valid session is still
    // resolving.
    const authTimeout = setTimeout(() => {
      if (mounted) {
        log.warn('Auth state did not resolve within 15s — forcing isLoading=false');
        setIsLoading(false);
        setAuthResolved(true);
      }
    }, 15000);

    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (fbUser) => {
      if (!mounted) return;

      // Auth resolved — cancel the safety timeout. Phase 6: flip
      // `authResolved` true regardless of whether `fbUser` is null or a
      // signed-in session, so consumers can stop showing "loading…" as
      // soon as the SDK has spoken.
      clearTimeout(authTimeout);
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
          const profile = await fetchUserProfile(fbUser);
          if (mounted) {
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
            (window as unknown as {
              requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
            }).requestIdleCallback(runBackgroundWork, { timeout: 3000 });
          } else {
            setTimeout(runBackgroundWork, 1500);
          }
        } else {
          if (mounted) {
            setUser(null);
          }
        }
      } catch (err) {
        // Never let the listener reject — keep last-known state and surface
        // the error to logs/Sentry instead. Auth UI stays usable.
        log.error('Auth listener error — keeping last-known state', err);
        Sentry.captureException(err, { tags: { source: 'auth-listener' } });
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
      unsubscribe();
    };
  }, []);

  // Sign in with email/password.
  // The onAuthStateChanged listener is the single source of truth for
  // setUser / fetchUserProfile — we don't duplicate that work here.
  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    } catch (error: unknown) {
      const fbError = error as { code?: string; message?: string };
      const code = fbError.code ?? 'unknown';
      // Phase 4 (Booking Flow Fix v3.1, 2026-05-02): cross-provider
      // conflict during email sign-in routes to the linking flow rather
      // than confusing the user with "wrong-password".
      if (code === 'auth/account-exists-with-different-credential') {
        log.warn('Email sign-in surfaced cross-provider conflict', { code });
        if (typeof window !== 'undefined') {
          window.location.assign('/customer/account/link?reason=cross_provider');
        }
      }
      log.error('Sign in error', error);
      Sentry.captureException(error, { tags: { source: 'auth-provider' } });
      throw new AuthError(
        getUserFriendlyMessage(new AuthError('', { firebaseCode: code })),
        { firebaseCode: code, cause: error instanceof Error ? error : undefined },
      );
    }
  };

  // Sign up with email/password.
  // The user profile MUST be created before the listener tries to read it,
  // so the createUserProfile call stays here. setUser/setFirebaseUser are
  // dropped — the listener will set them in a single pass.
  const signUp = async (email: string, password: string, displayName: string): Promise<void> => {
    try {
      const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);

      await result.user.getIdToken(true); // force token refresh before Firestore

      // Update display name on Firebase Auth profile
      await updateProfile(result.user, { displayName });

      // Create the Firestore user/{uid} doc so the listener can read it
      await createUserProfile(result.user, { displayName });
    } catch (error: unknown) {
      const fbError = error as { code?: string; message?: string };
      const code = fbError.code ?? 'unknown';
      const msg = fbError.message ?? '';
      log.error('Sign up error', error, { code, msg });
      Sentry.captureException(error, { tags: { source: 'auth-provider' } });
      throw new AuthError(
        getUserFriendlyMessage(new AuthError('', { firebaseCode: code })),
        { firebaseCode: code, cause: error instanceof Error ? error : undefined },
      );
    }
  };

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
    if (Capacitor.isNativePlatform()) {
      try {
        const native = await FirebaseAuthentication.signInWithGoogle({
          scopes: ['email', 'profile'],
        });
        const idToken = native.credential?.idToken;
        if (!idToken) {
          throw new Error('Google sign-in returned no idToken');
        }
        const credential = GoogleAuthProvider.credential(idToken);
        const result = await signInWithCredential(getFirebaseAuth(), credential);
        // Ensure the Firestore user/{uid} doc exists before the listener
        // reads it. createUserProfile is upsert-style — safe on returning
        // users. No setFirebaseUser/setUser/getIdToken(true) here — the
        // onAuthStateChanged listener will run that work in a single pass,
        // avoiding the double-fetch latency that made sign-in slow.
        await createUserProfile(result.user);
        return;
      } catch (error: unknown) {
        const fbError = error as { code?: string; message?: string };
        const code = fbError.code ?? 'unknown';
        const msg = fbError.message ?? '';
        // Native plugin uses different cancellation codes; do NOT report to Sentry.
        const isCancellation =
          code === '12501' /* GoogleSignInStatusCodes.SIGN_IN_CANCELLED */ ||
          msg.toLowerCase().includes('canceled') ||
          msg.toLowerCase().includes('cancelled');
        if (isCancellation) {
          throw new AuthError(
            getUserFriendlyMessage(new AuthError('', { firebaseCode: 'auth/popup-closed-by-user' })),
            { firebaseCode: 'auth/popup-closed-by-user', cause: error instanceof Error ? error : undefined },
          );
        }
        log.error('Native Google sign in error', error, { code, msg });
        Sentry.captureException(error, { tags: { source: 'auth-provider' } });
        const resolvedCode = code !== 'unknown' ? code : 'auth/network-request-failed';
        throw new AuthError(
          getUserFriendlyMessage(new AuthError('', { firebaseCode: resolvedCode })),
          { firebaseCode: resolvedCode, cause: error instanceof Error ? error : undefined },
        );
      }
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await signInWithPopup(getFirebaseAuth(), provider);
      // Web path: same single-source-of-truth pattern as native. Ensure
      // Firestore user doc exists; let the listener handle setUser.
      await createUserProfile(result.user);
    } catch (error: unknown) {
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
          window.location.assign('/customer/account/link?reason=cross_provider');
        }
        throw new AuthError(
          getUserFriendlyMessage(new AuthError('', { firebaseCode: code })),
          { firebaseCode: code, cause: error instanceof Error ? error : undefined },
        );
      }

      // If popup was blocked or COOP prevents it, fall back to redirect
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        log.warn('Popup failed, falling back to redirect', { code });
        await signInWithRedirect(getFirebaseAuth(), provider);
        return;
      }

      const msg = fbError.message ?? '';
      log.error('Google sign in error', error, { code, msg });
      Sentry.captureException(error, { tags: { source: 'auth-provider' } });
      throw new AuthError(
        getUserFriendlyMessage(new AuthError('', { firebaseCode: code })),
        { firebaseCode: code, cause: error instanceof Error ? error : undefined },
      );
    }
  };

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
  const signOut = async (): Promise<void> => {
    // Re-entrancy guard — a double tap on the sign-out button would
    // otherwise fire two sweeps in parallel.
    if (signOutInFlightRef.current) {
      return signOutInFlightRef.current;
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
        // Remove this device's FCM token from the user doc. Fire-and-forget
        // — errors are swallowed inside teardownFcmForUser, and we never
        // want a push-registration hiccup to block sign-out.
        if (uidForFcmTeardown) {
          await teardownFcmForUser(uidForFcmTeardown).catch(() => {
            // handled inside teardownFcmForUser
          });
        }
        // Phase 1 / Agent 06: unsubscribe this device from broadcast
        // topics. Stale subscriptions expire on Google's side when the
        // FCM registration token rotates, so this is strictly
        // belt-and-suspenders for correctness.
        await unsubscribeFromBroadcastTopics(roleForBroadcastTeardown).catch(() => {
          // handled inside unsubscribeFromBroadcastTopics
        });

        await sweepClientState({
          queryClient,
          stores,
          // FCM token removal is handled above (before the sweeper) because
          // `sweepClientState` is a best-effort best-order clean-up and we
          // want the Firestore write to happen while Firebase Auth is still
          // attached.
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
        log.error('Sign out error', error);
        setUser(null);
        setFirebaseUser(null);
        throw error;
      }
    })();

    signOutInFlightRef.current = promise;
    try {
      await promise;
    } finally {
      signOutInFlightRef.current = null;
    }
  };

  // Reset password
  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
    } catch (error: unknown) {
      const fbError = error as { code?: string; message?: string };
      const code = fbError.code ?? 'unknown';
      log.error('Password reset error', error);
      Sentry.captureException(error, { tags: { source: 'auth-provider' } });
      throw new AuthError(
        getUserFriendlyMessage(new AuthError('', { firebaseCode: code })),
        { firebaseCode: code, cause: error instanceof Error ? error : undefined },
      );
    }
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    isLoading,
    authResolved,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
