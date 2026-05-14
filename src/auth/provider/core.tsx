'use client';

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User as FirebaseUser, signOut as firebaseSignOut } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/nextjs';
import { getFirebaseAuth } from '@/lib/firebase-client';
import type { User } from '@/types';
import { isFirebaseConfigured } from '@/lib/firebase-config';
import { logger } from '@/lib/logger';
import { createEmailAuth } from './email';
import { createGoogleAuth } from './google';
import { attemptProfileWithRetry } from './orphan-cleanup';
import { useTokenRevokeRegistration } from './token-revoke';
import { createUserProfile, fetchUserProfile as fetchUserProfileFs } from './profile-firestore';
import { performSignOut } from './sign-out';
import { startAuthListener } from './auth-listener';

const log = logger.child({ component: 'AuthProvider' });

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
  signIn: (email: string, password: string, options?: { isLinkFlow?: boolean }) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authResolved, setAuthResolved] = useState(false);
  const queryClient = useQueryClient();
  // Guard against concurrent signOut calls so a double-tap cannot fire two
  // sweeps in flight (would drop a second firebaseSignOut after the first
  // already zeroed the session).
  const signOutInFlightRef = useRef<Promise<void> | null>(null);
  // C-01 + C-02 (2026-05-11): track imperative createUserProfile calls so the
  // auth listener does not race-sign-out a brand-new user mid-flow. Mirrors
  // `signOutInFlightRef`. Set in signUp / signInWithGoogle / getRedirectResult
  // success path; cleared after createUserProfile resolves.
  const profileCreationInFlightRef = useRef<Promise<void> | null>(null);

  const fetchUserProfile = (fbUser: FirebaseUser) => fetchUserProfileFs(fbUser, log);
  const createUserProfileWithLog = (
    fbUser: FirebaseUser,
    additionalData?: { displayName?: string },
  ) => createUserProfile(fbUser, additionalData, log);

  // Refresh user data.
  //
  // C-05 (2026-05-11): mirror the listener's orphan-cleanup contract
  // (A-2-03). If fetchUserProfile returns null, the Firestore doc no
  // longer exists — leaving firebaseUser set with user=null produces the
  // exact phantom-authenticated state A-2-03 was designed to prevent.
  // Sign the Firebase session out so consumers see a consistent
  // signed-out state.
  const refreshUser = async () => {
    if (!firebaseUser) return;
    // 2026-05-11 (Hawk-D4 + Vane-D4 / F36): mirror the listener's
    // in-flight-ref consult. If a profile-creation is mid-flight
    // (signUp / signInWithGoogle / redirect), refreshUser used to
    // race the imperative path: fetch null → firebaseSignOut → brand-new
    // user kicked. Await the in-flight, then re-fetch once.
    if (profileCreationInFlightRef.current) {
      try {
        await profileCreationInFlightRef.current;
      } catch {
        // The imperative path will surface its own error; we only care
        // that the await drained.
      }
    }
    let result: Awaited<ReturnType<typeof attemptProfileWithRetry>>;
    try {
      result = await attemptProfileWithRetry(firebaseUser, { fetchUserProfile, log });
    } catch (err) {
      // 2026-05-11 (Vane-D2 / F14): transient Firestore error during
      // refreshUser must NOT trigger orphan-cleanup. Keep last-known state.
      log.warn('refreshUser: fetchUserProfile threw transient — keeping last-known state', {
        uid: firebaseUser.uid,
        err,
      });
      return;
    }
    if (result.outcome === 'profile_missing') {
      log.warn('refreshUser: profile not found — clearing orphan session', {
        uid: firebaseUser.uid,
      });
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'orphan_session_cleared_via_refresh',
        data: { uid: firebaseUser.uid },
      });
      try {
        await firebaseSignOut(getFirebaseAuth());
      } catch (signOutErr) {
        log.error('Failed to clear orphan session via refreshUser', signOutErr);
      }
      setUser(null);
      setFirebaseUser(null);
      return;
    }
    if (result.profile) {
      setUser(result.profile);
    }
  };

  // Build factories — they capture state setters + refs by closure.
  const emailAuth = createEmailAuth({
    fetchUserProfile,
    createUserProfile: createUserProfileWithLog,
    profileCreationInFlightRef,
    log,
  });
  const googleAuth = createGoogleAuth({
    fetchUserProfile,
    createUserProfile: createUserProfileWithLog,
    profileCreationInFlightRef,
    log,
  });

  // Auth state listener
  useEffect(() => {
    const mountedRef = { current: true };

    // Guard: when Firebase is not configured (demo mode), skip auth listener
    if (!isFirebaseConfigured()) {
      log.warn('Firebase not configured — auth provider running in demo mode');
      setIsLoading(false);
      setAuthResolved(true);
      return () => {
        mountedRef.current = false;
      };
    }

    googleAuth.handleRedirectResult(mountedRef);

    const { unsubscribe, cancelTimeout } = startAuthListener({
      mountedRef,
      setUser,
      setFirebaseUser,
      setIsLoading,
      setAuthResolved,
      fetchUserProfile,
      profileCreationInFlightRef,
      log,
    });

    return () => {
      mountedRef.current = false;
      cancelTimeout();
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async (): Promise<void> => {
    return performSignOut({
      queryClient,
      user,
      setUser,
      setFirebaseUser,
      signOutInFlightRef,
      profileCreationInFlightRef,
      log,
    });
  };

  // Ref to the latest signOut so the api-client callback always calls the
  // current version without re-registering on every render.
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  // Phase 9 (Auth Bridge Fix, 2026-05-08): wire token-revoked → signOut.
  useTokenRevokeRegistration({ signOutRef, log });

  const value: AuthContextType = {
    user,
    firebaseUser,
    isLoading,
    authResolved,
    isAuthenticated: !!user,
    signIn: emailAuth.signIn,
    signUp: emailAuth.signUp,
    signInWithGoogle: googleAuth.signInWithGoogle,
    signOut,
    resetPassword: emailAuth.resetPassword,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
