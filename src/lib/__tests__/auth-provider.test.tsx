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

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (auth: unknown, cb: (user: unknown) => void) =>
    mockOnAuthStateChanged(auth, cb),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: (...args: unknown[]) => mockGetRedirectResult(...args),
  GoogleAuthProvider: class {
    setCustomParameters(): void {}
  },
  signOut: (...args: unknown[]) => mockFirebaseSignOut(...args),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn(),
}));

// -------- Firestore mock (no-op getDoc/setDoc/etc.) -------------------------

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
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
