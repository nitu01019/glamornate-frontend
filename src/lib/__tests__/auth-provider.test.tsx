/**
 * Integration tests for AuthProvider.signOut().
 *
 * These tests exercise the full wiring: AuthProvider → sign-out sweeper →
 * Zustand stores + React Query. Firebase Auth is mocked so the tests run in
 * isolation. We verify:
 *   - signOut clears the React Query cache
 *   - signOut resets every wired Zustand store
 *   - signOut calls firebase.auth().signOut() last
 *   - partial failure (e.g. Zustand store throws) does not block the final
 *     Firebase sign-out
 *   - double-click re-entrancy returns the same promise without firing a
 *     second Firebase call
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// -------- Firebase Auth mock ------------------------------------------------

const mockFirebaseSignOut = vi.fn().mockResolvedValue(undefined);
const mockOnAuthStateChanged = vi.fn(
  (_auth: unknown, cb: (user: unknown) => void): (() => void) => {
    // Fire once immediately with no user so the provider resolves
    // isLoading=false and the Probe captures the auth context.
    cb(null);
    return () => undefined;
  },
);
const mockGetRedirectResult = vi.fn().mockResolvedValue(null);

// Spies for the imperative auth methods exercised by signIn / signUp /
// signInWithGoogle / resetPassword. Declared at module scope so per-test
// describe blocks can `mockResolvedValueOnce` / `mockRejectedValueOnce`
// without re-defining the `vi.mock` factory.
const mockSignInWithEmailAndPassword = vi.fn();
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockSignInWithRedirect = vi.fn();
const mockSignInWithCredential = vi.fn();
const mockSendPasswordResetEmail = vi.fn();
const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);
const mockGoogleAuthProviderCredential = vi.fn((idToken: string) => ({
  providerId: 'google.com',
  idToken,
}));
// Default: no embedded credential available. Cross-provider conflict tests
// override per-call with `mockReturnValueOnce({ idToken, accessToken })` so
// the source's sessionStorage-write branch fires.
const mockGoogleAuthProviderCredentialFromError = vi.fn<(err: unknown) => unknown>(() => null);

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (auth: unknown, cb: (user: unknown) => void) =>
    mockOnAuthStateChanged(auth, cb),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) =>
    mockCreateUserWithEmailAndPassword(...args),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signInWithRedirect: (...args: unknown[]) => mockSignInWithRedirect(...args),
  signInWithCredential: (...args: unknown[]) => mockSignInWithCredential(...args),
  getRedirectResult: (...args: unknown[]) => mockGetRedirectResult(...args),
  GoogleAuthProvider: Object.assign(
    class {
      setCustomParameters(): void {}
    },
    {
      credential: (idToken: string) => mockGoogleAuthProviderCredential(idToken),
      credentialFromError: (err: unknown) => mockGoogleAuthProviderCredentialFromError(err),
    },
  ),
  signOut: (...args: unknown[]) => mockFirebaseSignOut(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

// -------- Capacitor + native Google sign-in mocks ---------------------------
// Default to web (`isNativePlatform()` returns false) so the existing
// signOut suite is unaffected; native tests opt in via
// `mockReturnValue(true)` inside their describe block.
const mockIsNativePlatform = vi.fn().mockReturnValue(false);
const mockNativeSignInWithGoogle = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mockIsNativePlatform(),
  },
}));

vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: {
    signInWithGoogle: (...args: unknown[]) => mockNativeSignInWithGoogle(...args),
  },
}));

// -------- Firestore mock (no-op getDoc/setDoc/etc.) -------------------------

const mockGetDoc = vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) });
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDocs = vi.fn().mockResolvedValue({ empty: true, docs: [] });

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  limit: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
}));

// -------- firebase-client wrapper: return lightweight stubs -----------------

vi.mock('@/lib/firebase-client', () => ({
  getFirebaseAuth: vi.fn(() => ({ __fakeAuth: true })),
  getFirebaseFirestore: vi.fn(() => ({ __fakeDb: true })),
}));

vi.mock('@/lib/firebase-config', () => ({
  isFirebaseConfigured: () => true,
  initializeFirebaseApp: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks are installed
// ---------------------------------------------------------------------------

import { AuthProvider, useAuth } from '../auth-provider';
import { useCartStore } from '@/store/cart';
import { useChatStore } from '@/store/chat';
import { useBookingStore } from '@/store/booking';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let capturedAuth: ReturnType<typeof useAuth> | null = null;

function Probe() {
  capturedAuth = useAuth();
  return null;
}

function renderProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const ui = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ui, queryClient };
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('AuthProvider.signOut integration', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFirebaseSignOut.mockClear();
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    // Reset Zustand stores
    useCartStore.setState({ items: [] });
    useChatStore.setState({ messages: [], unreadCount: 0, _chatId: null });
    useBookingStore.setState({ step: 1, spaId: null });
    // Clear any persisted cart data from prior tests
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('glamornate-cart', 'stale');
      window.sessionStorage.setItem('glamornate-popup-seen', 'true');
      window.localStorage.setItem('unrelated-key', 'keep');
    }
    capturedAuth = null;
  });

  afterEach(() => {
    infoSpy.mockRestore();
    cleanup();
    mockFirebaseSignOut.mockReset();
    mockFirebaseSignOut.mockResolvedValue(undefined);
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }
  });

  it('clears the React Query cache before calling firebaseSignOut', async () => {
    const { queryClient } = renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    queryClient.setQueryData(['user', 'me'], { id: 'u-1' });
    queryClient.setQueryData(['services'], [{ id: 's-1' }]);
    expect(queryClient.getQueryData(['user', 'me'])).toBeDefined();

    let cacheAtSignOut: unknown = 'not-captured';
    mockFirebaseSignOut.mockImplementationOnce(async () => {
      // Capture cache state at the moment firebase.signOut is invoked.
      cacheAtSignOut = queryClient.getQueryData(['user', 'me']);
    });

    await act(async () => {
      await capturedAuth!.signOut();
    });

    expect(cacheAtSignOut).toBeUndefined();
    expect(queryClient.getQueryData(['user', 'me'])).toBeUndefined();
    expect(queryClient.getQueryData(['services'])).toBeUndefined();
    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('resets wired Zustand stores on sign-out', async () => {
    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    useCartStore.setState({ items: [{ serviceId: 'x', quantity: 1 } as never] });
    useChatStore.setState({ messages: [{ id: 'm-1' } as never] });
    useBookingStore.setState({ spaId: 'spa-1', step: 3 });

    await act(async () => {
      await capturedAuth!.signOut();
    });

    expect(useCartStore.getState().items).toEqual([]);
    expect(useBookingStore.getState().spaId).toBeNull();
    expect(useBookingStore.getState().step).toBe(1);
  });

  it('purges allowlisted localStorage keys and sessionStorage fully', async () => {
    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    await act(async () => {
      await capturedAuth!.signOut();
    });

    expect(window.localStorage.getItem('glamornate-cart')).toBeNull();
    expect(window.localStorage.getItem('unrelated-key')).toBe('keep');
    expect(window.sessionStorage.getItem('glamornate-popup-seen')).toBeNull();
  });

  it('still calls firebaseSignOut when a Zustand store throws', async () => {
    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    // Temporarily poison useBookingStore.getState so it throws.
    const originalGetState = useBookingStore.getState;
    const poisoned = vi.fn(() => {
      throw new Error('booking store torn down');
    });
    Object.assign(useBookingStore, { getState: poisoned });

    try {
      await act(async () => {
        await capturedAuth!.signOut();
      });
      expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
    } finally {
      Object.assign(useBookingStore, { getState: originalGetState });
    }
  });

  it('is re-entrant safe — a double click only runs one sweep', async () => {
    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    // Pin the mock to a deferred promise so we can issue a second sign-out
    // while the first is still in flight. We resolve the deferred from
    // outside the `act()` wrapper to avoid racing the scheduler.
    let resolveFb: () => void = () => undefined;
    const fbGate = new Promise<void>((resolve) => {
      resolveFb = resolve;
    });
    mockFirebaseSignOut.mockImplementationOnce(() => fbGate);

    let first!: Promise<void>;
    let second!: Promise<void>;

    await act(async () => {
      first = capturedAuth!.signOut();
      // Yield a microtask so the first sweep reaches firebase.signOut
      // (and the ref is set) before we issue the re-entrant call.
      await Promise.resolve();
      second = capturedAuth!.signOut();
      // Unblock the mocked firebaseSignOut.
      resolveFb();
      await Promise.all([first, second]);
    });

    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('emits the structured signOut sweep summary to console.info', async () => {
    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    await act(async () => {
      await capturedAuth!.signOut();
    });

    const sweepCalls = infoSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === '[auth] signOut sweep',
    );
    expect(sweepCalls.length).toBe(1);
    const summary = sweepCalls[0][1] as {
      allOk: boolean;
      signedOut: boolean;
      steps: Array<{ step: string }>;
    };
    expect(summary.signedOut).toBe(true);
    expect(summary.steps.map((s) => s.step)).toEqual(
      expect.arrayContaining([
        'fcm.deleteToken',
        'queryClient.clear',
        'zustand.reset',
        'localStorage.purge',
        'sessionStorage.clear',
        'serviceWorker.unregister',
        'firebase.signOut',
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// Shared helpers for the imperative-auth suites (A-7-04 / A-7-05 / A-7-06 /
// A-7-07). The signOut suite above does not need these — it only exercises
// the side-effect order — so they live in their own block to avoid leaking
// state.
// ---------------------------------------------------------------------------

interface FakeFirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  getIdToken: ReturnType<typeof vi.fn>;
}

function makeFakeFirebaseUser(overrides: Partial<FakeFirebaseUser> = {}): FakeFirebaseUser {
  return {
    uid: overrides.uid ?? 'uid-fake-1',
    email: overrides.email ?? 'fake@example.com',
    displayName: overrides.displayName ?? 'Fake User',
    photoURL: overrides.photoURL ?? null,
    phoneNumber: overrides.phoneNumber ?? null,
    emailVerified: overrides.emailVerified ?? true,
    getIdToken: overrides.getIdToken ?? vi.fn().mockResolvedValue('fresh-id-token'),
  };
}

function resetImperativeAuthMocks(): void {
  mockSignInWithEmailAndPassword.mockReset();
  mockCreateUserWithEmailAndPassword.mockReset();
  mockSignInWithPopup.mockReset();
  mockSignInWithRedirect.mockReset();
  mockSignInWithCredential.mockReset();
  mockSendPasswordResetEmail.mockReset();
  mockUpdateProfile.mockReset();
  mockUpdateProfile.mockResolvedValue(undefined);
  mockNativeSignInWithGoogle.mockReset();
  mockGoogleAuthProviderCredential.mockClear();
  mockGoogleAuthProviderCredentialFromError.mockReset();
  mockGoogleAuthProviderCredentialFromError.mockReturnValue(null);
  mockGetDoc.mockReset();
  mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
  mockSetDoc.mockReset();
  mockSetDoc.mockResolvedValue(undefined);
  mockUpdateDoc.mockReset();
  mockUpdateDoc.mockResolvedValue(undefined);
  mockGetDocs.mockReset();
  mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
  mockIsNativePlatform.mockReset();
  mockIsNativePlatform.mockReturnValue(false);
}

// ---------------------------------------------------------------------------
// A-7-04: signInWithGoogle — native (Capacitor) idToken path
// ---------------------------------------------------------------------------

describe('AuthProvider.signInWithGoogle (native)', () => {
  let assignSpy: ReturnType<typeof vi.fn>;
  const originalLocation = window.location;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetImperativeAuthMocks();
    mockIsNativePlatform.mockReturnValue(true);
    assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, assign: assignSpy },
    });
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    capturedAuth = null;
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    if (typeof window !== 'undefined') {
      window.sessionStorage.clear();
    }
  });

  it('runs idToken → credential → signInWithCredential → getIdToken(true) → createUserProfile in order', async () => {
    const callOrder: string[] = [];

    mockNativeSignInWithGoogle.mockImplementation(async () => {
      callOrder.push('native.signInWithGoogle');
      return { credential: { idToken: 'test-id-token' } };
    });
    mockGoogleAuthProviderCredential.mockImplementation((idToken: string) => {
      callOrder.push(`GoogleAuthProvider.credential:${idToken}`);
      return { providerId: 'google.com', idToken };
    });
    const fakeUser = makeFakeFirebaseUser({
      uid: 'uid-google',
      email: 'g@example.com',
      getIdToken: vi.fn().mockImplementation(async (force?: boolean) => {
        callOrder.push(`user.getIdToken:${force ? 'force' : 'cached'}`);
        return 'fresh-id-token';
      }),
    });
    mockSignInWithCredential.mockImplementation(async () => {
      callOrder.push('signInWithCredential');
      return { user: fakeUser };
    });
    // createUserProfile internally calls getDoc; new doc → setDoc
    mockGetDoc.mockImplementation(async () => {
      callOrder.push('getDoc(user)');
      return { exists: () => false, data: () => ({}) };
    });
    mockSetDoc.mockImplementation(async () => {
      callOrder.push('setDoc(user)');
    });

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    await act(async () => {
      await capturedAuth!.signInWithGoogle();
    });

    expect(mockNativeSignInWithGoogle).toHaveBeenCalledWith();
    expect(mockGoogleAuthProviderCredential).toHaveBeenCalledWith('test-id-token');
    expect(mockSignInWithCredential).toHaveBeenCalledTimes(1);
    expect(fakeUser.getIdToken).toHaveBeenCalledWith(true);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);

    // The chronological order through the success path must match the
    // documented sequence for createUserProfile to read against a fresh
    // token — getIdToken(true) must precede the Firestore round-trip.
    const indexOf = (needle: string): number =>
      callOrder.findIndex((evt) => evt === needle || evt.startsWith(`${needle}:`));
    expect(indexOf('native.signInWithGoogle')).toBeLessThan(
      indexOf('GoogleAuthProvider.credential'),
    );
    expect(indexOf('GoogleAuthProvider.credential')).toBeLessThan(indexOf('signInWithCredential'));
    expect(indexOf('signInWithCredential')).toBeLessThan(indexOf('user.getIdToken'));
    expect(indexOf('user.getIdToken')).toBeLessThan(indexOf('getDoc(user)'));
  });

  it('throws AuthError(auth/popup-closed-by-user) when native plugin reports cancellation 12501', async () => {
    mockNativeSignInWithGoogle.mockRejectedValue({
      code: '12501',
      message: 'Sign in cancelled by user',
    });

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    let thrown: unknown = null;
    await act(async () => {
      try {
        await capturedAuth!.signInWithGoogle();
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    const authErr = thrown as { name?: string; firebaseCode?: string };
    expect(authErr.name).toBe('AuthError');
    expect(authErr.firebaseCode).toBe('auth/popup-closed-by-user');
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('throws AuthError when native plugin returns no idToken', async () => {
    mockNativeSignInWithGoogle.mockResolvedValue({ credential: { idToken: null } });

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    let thrown: unknown = null;
    await act(async () => {
      try {
        await capturedAuth!.signInWithGoogle();
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as { name?: string }).name).toBe('AuthError');
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// A-7-04: signInWithGoogle — web (popup → redirect fallback)
// ---------------------------------------------------------------------------

describe('AuthProvider.signInWithGoogle (web)', () => {
  let assignSpy: ReturnType<typeof vi.fn>;
  const originalLocation = window.location;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetImperativeAuthMocks();
    mockIsNativePlatform.mockReturnValue(false);
    assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, assign: assignSpy },
    });
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    capturedAuth = null;
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    if (typeof window !== 'undefined') {
      window.sessionStorage.clear();
    }
  });

  it('calls createUserProfile on signInWithPopup success — listener owns setUser', async () => {
    const fakeUser = makeFakeFirebaseUser({ uid: 'uid-web', email: 'web@example.com' });
    mockSignInWithPopup.mockResolvedValue({ user: fakeUser });

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    await act(async () => {
      await capturedAuth!.signInWithGoogle();
    });

    expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
    expect(fakeUser.getIdToken).toHaveBeenCalledWith(true);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    // signInWithCredential is the native-only path — must not fire on web.
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('falls back to signInWithRedirect when popup is blocked (auth/popup-blocked)', async () => {
    mockSignInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });
    mockSignInWithRedirect.mockResolvedValue(undefined);

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    await act(async () => {
      await capturedAuth!.signInWithGoogle();
    });

    expect(mockSignInWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('routes cross-provider conflict via window.location.assign and stashes pendingCredential', async () => {
    mockSignInWithPopup.mockRejectedValue({
      code: 'auth/account-exists-with-different-credential',
      email: 'cross@example.com',
    });
    mockGoogleAuthProviderCredentialFromError.mockReturnValueOnce({
      idToken: 'cross-id-token',
      accessToken: 'cross-access-token',
    });

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    let thrown: unknown = null;
    await act(async () => {
      try {
        await capturedAuth!.signInWithGoogle();
      } catch (err) {
        thrown = err;
      }
    });

    // Per A-2-02 fix: function returns early after assign, no AuthError
    // escapes the call site (so the toast can't flash before nav).
    expect(thrown).toBeNull();
    expect(assignSpy).toHaveBeenCalledWith('/customer/account/link');
    const stashed = window.sessionStorage.getItem('glamornate.pendingCredential');
    expect(stashed).not.toBeNull();
    const parsed = JSON.parse(stashed as string) as {
      providerId: string;
      idToken: string | null;
    };
    expect(parsed.providerId).toBe('google.com');
    expect(parsed.idToken).toBe('cross-id-token');
    expect(mockSignInWithRedirect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// A-7-05: signIn cross-provider routing + error mapping
// ---------------------------------------------------------------------------

describe('AuthProvider.signIn cross-provider', () => {
  let assignSpy: ReturnType<typeof vi.fn>;
  const originalLocation = window.location;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetImperativeAuthMocks();
    assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, assign: assignSpy },
    });
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    capturedAuth = null;
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    if (typeof window !== 'undefined') {
      window.sessionStorage.clear();
    }
  });

  it('routes auth/account-exists-with-different-credential to /customer/account/link', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({
      code: 'auth/account-exists-with-different-credential',
    });

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    let thrown: unknown = null;
    await act(async () => {
      try {
        await capturedAuth!.signIn('cross@example.com', 'pw1234');
      } catch (err) {
        thrown = err;
      }
    });

    // Per A-3-01 fix: assign + return; — no AuthError escapes to caller.
    expect(thrown).toBeNull();
    expect(assignSpy).toHaveBeenCalledWith('/customer/account/link');
  });

  it('throws AuthError(auth/wrong-password) for wrong password', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password' });

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    let thrown: unknown = null;
    await act(async () => {
      try {
        await capturedAuth!.signIn('user@example.com', 'wrong-pw');
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    const authErr = thrown as { name?: string; firebaseCode?: string; message?: string };
    expect(authErr.name).toBe('AuthError');
    expect(authErr.firebaseCode).toBe('auth/wrong-password');
    // 2026-05-11 (Cinder-D5 / F7): neutral copy — anti-enumeration.
    expect(authErr.message).toBe('Email or password is incorrect.');
    // Wrong-password is NOT a cross-provider event; must not redirect.
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('throws AuthError(auth/email-already-in-use) on signUp', async () => {
    mockCreateUserWithEmailAndPassword.mockRejectedValue({
      code: 'auth/email-already-in-use',
    });

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    let thrown: unknown = null;
    await act(async () => {
      try {
        await capturedAuth!.signUp('dup@example.com', 'pw1234', 'Dup User');
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    const authErr = thrown as { name?: string; firebaseCode?: string; message?: string };
    expect(authErr.name).toBe('AuthError');
    expect(authErr.firebaseCode).toBe('auth/email-already-in-use');
    expect(authErr.message).toBe(
      'Unable to create the account. Please try a different email or sign in.',
    );
  });
});

// ---------------------------------------------------------------------------
// A-7-06: fetchUserProfile permission-denied retry path
// ---------------------------------------------------------------------------

describe('AuthProvider.fetchUserProfile retry', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useRealTimers();
    resetImperativeAuthMocks();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    capturedAuth = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    // Restore default listener behaviour (fires with null) for sibling suites.
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      cb(null);
      return () => undefined;
    });
  });

  it('retries getDoc once after permission-denied and surfaces the profile', async () => {
    const fakeUser = makeFakeFirebaseUser({
      uid: 'uid-retry',
      email: 'retry@example.com',
      getIdToken: vi.fn().mockResolvedValue('refreshed-token'),
    });
    const profilePayload = {
      authProvider: 'email',
      role: 'customer',
      profile: { displayName: 'Retry User', email: 'retry@example.com' },
      emailVerified: true,
      phoneVerified: false,
      preferences: { language: 'en', notifications: { email: true, push: true, sms: false } },
      customerData: { favorites: [], history: [] },
      isActive: true,
      lastLoginAt: '2026-05-10T00:00:00Z',
      createdAt: '2026-05-10T00:00:00Z',
      updatedAt: '2026-05-10T00:00:00Z',
    };
    mockGetDoc
      .mockRejectedValueOnce({ code: 'permission-denied' })
      .mockResolvedValueOnce({ exists: () => true, data: () => profilePayload });

    // Drive the auth listener with our fake user so fetchUserProfile fires.
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      cb(fakeUser);
      return () => undefined;
    });

    renderProvider();

    // The retry is gated on a real 1.5s setTimeout; default waitFor timeout
    // (1s) is too short, so we extend it to cover the full 1.5s + render.
    await waitFor(() => expect(capturedAuth?.user?.profile?.displayName).toBe('Retry User'), {
      timeout: 5000,
    });
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
    expect(fakeUser.getIdToken).toHaveBeenCalledWith(true);
  });

  it('backfills spaData on retry success when the profile is a spa_owner missing it (A-3-02)', async () => {
    const fakeUser = makeFakeFirebaseUser({
      uid: 'uid-spa-owner',
      email: 'owner@example.com',
      getIdToken: vi.fn().mockResolvedValue('refreshed-token'),
    });
    const ownerProfile = {
      authProvider: 'email',
      role: 'spa_owner',
      profile: { displayName: 'Owner', email: 'owner@example.com' },
      emailVerified: true,
      phoneVerified: false,
      preferences: { language: 'en', notifications: { email: true, push: true, sms: false } },
      isActive: true,
      lastLoginAt: '2026-05-10T00:00:00Z',
      createdAt: '2026-05-10T00:00:00Z',
      updatedAt: '2026-05-10T00:00:00Z',
    };
    mockGetDoc
      .mockRejectedValueOnce({ code: 'permission-denied' })
      .mockResolvedValueOnce({ exists: () => true, data: () => ownerProfile });
    // lookupSpaData uses getDocs(spas) — return one matching spa doc.
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'spa-001',
          data: () => ({ commission: { platformRate: 0.18 } }),
        },
      ],
    });

    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      cb(fakeUser);
      return () => undefined;
    });

    renderProvider();

    await waitFor(() => expect(capturedAuth?.user?.spaData?.spaId).toBeDefined(), {
      timeout: 5000,
    });
    expect(capturedAuth!.user!.role).toBe('spa_owner');
    expect(capturedAuth!.user!.spaData!.spaId).toBe('spa-001');
    expect(capturedAuth!.user!.spaData!.commissionRate).toBeCloseTo(0.18);
  });
});

// ---------------------------------------------------------------------------
// A-7-07: resetPassword + refreshUser
// ---------------------------------------------------------------------------

describe('AuthProvider.resetPassword', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useRealTimers();
    resetImperativeAuthMocks();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    capturedAuth = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('resolves cleanly when sendPasswordResetEmail succeeds', async () => {
    mockSendPasswordResetEmail.mockResolvedValue(undefined);

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    let thrown: unknown = null;
    await act(async () => {
      try {
        await capturedAuth!.resetPassword('user@example.com');
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeNull();
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('throws AuthError(auth/network-request-failed) when the underlying call fails with a transport error', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({
      code: 'auth/network-request-failed',
    });

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    let thrown: unknown = null;
    await act(async () => {
      try {
        await capturedAuth!.resetPassword('user@example.com');
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    const authErr = thrown as { name?: string; firebaseCode?: string };
    expect(authErr.name).toBe('AuthError');
    expect(authErr.firebaseCode).toBe('auth/network-request-failed');
  });
});

describe('AuthProvider.refreshUser', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useRealTimers();
    resetImperativeAuthMocks();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    capturedAuth = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      cb(null);
      return () => undefined;
    });
  });

  it('refetches the profile and updates the user when the firebaseUser is set', async () => {
    const fakeUser = makeFakeFirebaseUser({
      uid: 'uid-refresh',
      email: 'refresh@example.com',
      getIdToken: vi.fn().mockResolvedValue('refreshed-token'),
    });
    const initialProfile = {
      authProvider: 'email',
      role: 'customer',
      profile: { displayName: 'Initial Name', email: 'refresh@example.com' },
      emailVerified: true,
      phoneVerified: false,
      preferences: { language: 'en', notifications: { email: true, push: true, sms: false } },
      customerData: { favorites: [], history: [] },
      isActive: true,
      lastLoginAt: '2026-05-10T00:00:00Z',
      createdAt: '2026-05-10T00:00:00Z',
      updatedAt: '2026-05-10T00:00:00Z',
    };
    const updatedProfile = {
      ...initialProfile,
      profile: { ...initialProfile.profile, displayName: 'Updated Name' },
    };

    // First load returns the initial profile.
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => initialProfile });

    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      cb(fakeUser);
      return () => undefined;
    });

    renderProvider();
    await waitFor(() => expect(capturedAuth?.user?.profile.displayName).toBe('Initial Name'));

    // Second getDoc — refreshUser-triggered — returns the updated profile.
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => updatedProfile });

    await act(async () => {
      await capturedAuth!.refreshUser();
    });

    await waitFor(() => expect(capturedAuth?.user?.profile.displayName).toBe('Updated Name'));
  });
});

// ---------------------------------------------------------------------------
// C-03 (2026-05-11): race regression suite for C-01 + C-02 + post-fix orphan
// cleanup. Pins the `profileCreationInFlightRef` contract:
//   1. Listener fires `cb(fakeUser)` BEFORE the imperative createUserProfile
//      resolves (Firebase's listener-first ordering on first sign-in).
//   2. First `getDoc` from the listener's fetchUserProfile returns missing
//      (Firestore doc not yet written).
//   3. Listener awaits `profileCreationInFlightRef.current`, then re-fetches.
//   4. Second `getDoc` returns the freshly-written doc → setUser, NO
//      firebaseSignOut.
// Tests cover signUp, signInWithGoogle (native + web popup), and
// getRedirectResult success paths. Final test pins the unchanged orphan-
// cleanup branch (no in-flight ref → firebaseSignOut still fires).
// ---------------------------------------------------------------------------

describe('AuthProvider — race regression (C-01 + C-02 + post-fix)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useRealTimers();
    resetImperativeAuthMocks();
    mockFirebaseSignOut.mockClear();
    mockGetRedirectResult.mockReset();
    mockGetRedirectResult.mockResolvedValue(null);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    capturedAuth = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    infoSpy.mockRestore();
    mockFirebaseSignOut.mockReset();
    mockFirebaseSignOut.mockResolvedValue(undefined);
    mockGetRedirectResult.mockReset();
    mockGetRedirectResult.mockResolvedValue(null);
    // Restore default listener behaviour for sibling suites.
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      cb(null);
      return () => undefined;
    });
  });

  // Build the freshly-written user doc that the listener's re-fetch should
  // see after the imperative createUserProfile resolves. This mirrors the
  // shape createUserProfile writes via setDoc (role: 'customer').
  function buildFreshProfile(email: string, displayName: string): Record<string, unknown> {
    return {
      authProvider: 'email',
      role: 'customer',
      profile: { displayName, email },
      emailVerified: true,
      phoneVerified: false,
      preferences: {
        language: 'en',
        notifications: { email: true, push: true, sms: false },
      },
      customerData: { favorites: [], history: [] },
      isActive: true,
      lastLoginAt: '2026-05-11T00:00:00Z',
      createdAt: '2026-05-11T00:00:00Z',
      updatedAt: '2026-05-11T00:00:00Z',
    };
  }

  it('signUp success: listener race does NOT orphan-sign-out the brand-new user (C-01)', async () => {
    const fakeUser = makeFakeFirebaseUser({
      uid: 'uid-signup-race',
      email: 'race@example.com',
      displayName: 'Race User',
    });
    // Listener fires synchronously with the new user the instant
    // createUserWithEmailAndPassword resolves — this is Firebase's actual
    // ordering on first sign-in and the trigger for the C-01 regression.
    let listenerFired = false;
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      cb(null);
      mockCreateUserWithEmailAndPassword.mockImplementation(async () => {
        // Fire the listener with the new user BEFORE returning so the
        // listener path enters its fetchUserProfile branch concurrently
        // with the imperative createUserProfile.
        if (!listenerFired) {
          listenerFired = true;
          cb(fakeUser);
        }
        return { user: fakeUser };
      });
      return () => undefined;
    });

    // First getDoc (listener-side fetchUserProfile) → doc missing.
    // Second getDoc (listener-side re-fetch after awaiting in-flight ref) →
    // doc present, freshly written by createUserProfile.
    // Third getDoc (createUserProfile-side existence check) → also missing,
    // so createUserProfile writes a fresh doc via setDoc.
    let getDocCall = 0;
    mockGetDoc.mockImplementation(async () => {
      getDocCall += 1;
      // Listener's first read (call 1) → missing
      // createUserProfile's read (call 2) → missing (so it setDoc's)
      // Listener's re-fetch (call 3) → present
      if (getDocCall <= 2) {
        return { exists: () => false, data: () => ({}) };
      }
      return {
        exists: () => true,
        data: () => buildFreshProfile('race@example.com', 'Race User'),
      };
    });

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    await act(async () => {
      await capturedAuth!.signUp('race@example.com', 'pw1234567', 'Race User');
    });

    // Profile creation happened (setDoc fired in createUserProfile).
    expect(mockSetDoc).toHaveBeenCalled();
    // The listener must NOT have orphan-cleanup'd the brand-new user.
    expect(mockFirebaseSignOut).not.toHaveBeenCalled();
    // Final user state set from the re-fetch.
    await waitFor(() => expect(capturedAuth?.user?.profile?.displayName).toBe('Race User'));
  });

  it('signInWithGoogle native success: listener race does NOT orphan-sign-out (C-01)', async () => {
    const fakeUser = makeFakeFirebaseUser({
      uid: 'uid-google-native-race',
      email: 'gnative@example.com',
      displayName: 'Native Google User',
    });
    mockIsNativePlatform.mockReturnValue(true);
    mockNativeSignInWithGoogle.mockResolvedValue({
      credential: { idToken: 'fake-id-token' },
    });

    let listenerFired = false;
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      cb(null);
      mockSignInWithCredential.mockImplementation(async () => {
        if (!listenerFired) {
          listenerFired = true;
          cb(fakeUser);
        }
        return { user: fakeUser };
      });
      return () => undefined;
    });

    let getDocCall = 0;
    mockGetDoc.mockImplementation(async () => {
      getDocCall += 1;
      if (getDocCall <= 2) {
        return { exists: () => false, data: () => ({}) };
      }
      return {
        exists: () => true,
        data: () => buildFreshProfile('gnative@example.com', 'Native Google User'),
      };
    });

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    await act(async () => {
      await capturedAuth!.signInWithGoogle();
    });

    expect(mockSignInWithCredential).toHaveBeenCalled();
    expect(mockSetDoc).toHaveBeenCalled();
    expect(mockFirebaseSignOut).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(capturedAuth?.user?.profile?.displayName).toBe('Native Google User'),
    );
  });

  it('signInWithGoogle web popup success: listener race does NOT orphan-sign-out (C-01)', async () => {
    const fakeUser = makeFakeFirebaseUser({
      uid: 'uid-google-web-race',
      email: 'gweb@example.com',
      displayName: 'Web Google User',
    });
    mockIsNativePlatform.mockReturnValue(false);

    let listenerFired = false;
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      cb(null);
      mockSignInWithPopup.mockImplementation(async () => {
        if (!listenerFired) {
          listenerFired = true;
          cb(fakeUser);
        }
        return { user: fakeUser };
      });
      return () => undefined;
    });

    let getDocCall = 0;
    mockGetDoc.mockImplementation(async () => {
      getDocCall += 1;
      if (getDocCall <= 2) {
        return { exists: () => false, data: () => ({}) };
      }
      return {
        exists: () => true,
        data: () => buildFreshProfile('gweb@example.com', 'Web Google User'),
      };
    });

    renderProvider();
    await waitFor(() => expect(capturedAuth).not.toBeNull());

    await act(async () => {
      await capturedAuth!.signInWithGoogle();
    });

    expect(mockSignInWithPopup).toHaveBeenCalled();
    expect(mockSetDoc).toHaveBeenCalled();
    expect(mockFirebaseSignOut).not.toHaveBeenCalled();
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
    await waitFor(() => expect(capturedAuth?.user?.profile?.displayName).toBe('Web Google User'));
  });

  it('getRedirectResult success: createUserProfile fires and listener does NOT orphan-sign-out (C-02)', async () => {
    const fakeUser = makeFakeFirebaseUser({
      uid: 'uid-redirect-race',
      email: 'redirect@example.com',
      displayName: 'Redirect User',
    });
    // getRedirectResult resolves with a user (popup-blocked → redirect flow
    // completing on a fresh page load). The listener also fires with the
    // same user concurrently.
    mockGetRedirectResult.mockResolvedValue({ user: fakeUser });

    let listenerFired = false;
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      // Fire null first, then immediately fire with the redirect user so the
      // listener's fetchUserProfile races getRedirectResult's createUserProfile.
      cb(null);
      if (!listenerFired) {
        listenerFired = true;
        cb(fakeUser);
      }
      return () => undefined;
    });

    let getDocCall = 0;
    mockGetDoc.mockImplementation(async () => {
      getDocCall += 1;
      if (getDocCall <= 2) {
        return { exists: () => false, data: () => ({}) };
      }
      return {
        exists: () => true,
        data: () => buildFreshProfile('redirect@example.com', 'Redirect User'),
      };
    });

    renderProvider();

    // Wait for the redirect-flow createUserProfile (via setDoc) to complete
    // and the listener's re-fetch to populate user state.
    await waitFor(() => expect(capturedAuth?.user?.profile?.displayName).toBe('Redirect User'), {
      timeout: 5000,
    });
    expect(mockSetDoc).toHaveBeenCalled();
    // The redirect-flow doc-creation must NOT trigger the orphan-cleanup
    // branch — that's the regression C-02 introduced before the fix.
    expect(mockFirebaseSignOut).not.toHaveBeenCalled();
  });

  it('genuine orphan: no in-flight createUserProfile → firebaseSignOut fires (post-fix contract)', async () => {
    // No imperative path is running. The listener sees a Firebase user with
    // no Firestore doc — this is the original A-2-03 orphan-cleanup branch
    // and MUST still fire firebaseSignOut. Pins the post-C-01-fix invariant
    // that the in-flight-ref short-circuit does not accidentally swallow
    // legitimate orphan cleanups.
    const orphanUser = makeFakeFirebaseUser({
      uid: 'uid-true-orphan',
      email: 'orphan@example.com',
    });
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      cb(orphanUser);
      return () => undefined;
    });
    // Every getDoc returns missing — there is no profile and none in flight.
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });

    renderProvider();
    await waitFor(() => expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1), {
      timeout: 5000,
    });
    // No imperative path → setDoc must not fire (A-2-04 dropped listener
    // auto-create).
    expect(mockSetDoc).not.toHaveBeenCalled();
    await waitFor(() => expect(capturedAuth?.user).toBeNull());
    await waitFor(() => expect(capturedAuth?.firebaseUser).toBeNull());
  });
});
