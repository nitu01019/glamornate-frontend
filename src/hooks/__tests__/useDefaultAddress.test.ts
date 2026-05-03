/**
 * Tests for `useDefaultAddress`.
 *
 * Strategy:
 *  - Mock `firebase/firestore` so `onSnapshot` returns a controllable test
 *    harness (next/error callbacks + an unsubscribe spy).
 *  - Mock `@/lib/firebase-client.getFirebaseFirestore` so nothing touches a
 *    live Firestore.
 *  - Mock `@/lib/auth-provider.useAuth` so we can flip the signed-in user
 *    between renders.
 *  - All tests run in `jsdom` (configured in vitest.config.mts), so `window`
 *    is defined. The SSR-null branch is covered by asserting the initial
 *    render state before any `onSnapshot` callback fires.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { SavedAddress } from '@/types';

// ---------------------------------------------------------------------------
// Firestore mock — captures the onSnapshot next/error callbacks so tests can
// drive the listener imperatively.
// ---------------------------------------------------------------------------

interface SnapshotHandlers {
  next: (snapshot: { exists: () => boolean; data: () => unknown }) => void;
  error: (err: { code?: string; message?: string }) => void;
}

const snapshotHandlers: SnapshotHandlers[] = [];
const unsubscribeSpies: Array<ReturnType<typeof vi.fn>> = [];

vi.mock('firebase/firestore', () => {
  return {
    doc: vi.fn((_db: unknown, ...pathSegments: string[]) => ({
      type: 'document',
      path: pathSegments.join('/'),
    })),
    onSnapshot: vi.fn(
      (_ref: unknown, next: SnapshotHandlers['next'], error: SnapshotHandlers['error']) => {
        snapshotHandlers.push({ next, error });
        const unsubscribe = vi.fn();
        unsubscribeSpies.push(unsubscribe);
        return unsubscribe;
      },
    ),
  };
});

// ---------------------------------------------------------------------------
// Firebase App mock — provide a FirebaseError class with `.code` so the hook's
// narrow `code === 'permission-denied'` check works against a real instance.
// ---------------------------------------------------------------------------

vi.mock('firebase/app', () => {
  class FirebaseError extends Error {
    readonly code: string;
    readonly name = 'FirebaseError';
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return { FirebaseError };
});

// ---------------------------------------------------------------------------
// Firestore-client mock — return a sentinel; the real instance is never used
// because our firebase/firestore mock intercepts every call.
// ---------------------------------------------------------------------------

vi.mock('@/lib/firebase-client', () => ({
  getFirebaseFirestore: vi.fn(() => ({ __mock: 'firestore' })),
}));

// ---------------------------------------------------------------------------
// Auth-provider mock — lets each test decide who is signed in.
// ---------------------------------------------------------------------------

let mockFirebaseUser: Pick<FirebaseUser, 'uid'> | null = null;

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({
    firebaseUser: mockFirebaseUser,
    user: null,
    isLoading: false,
    isAuthenticated: mockFirebaseUser !== null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAddress(overrides: Partial<SavedAddress> = {}): SavedAddress {
  return {
    id: 'addr_1',
    label: 'home',
    name: 'Jane Doe',
    phone: '+919999999999',
    flatHouse: 'B-101',
    street: 'MG Road',
    landmark: '',
    city: 'Bengaluru',
    state: 'KA',
    pincode: '560001',
    isDefault: true,
    createdAt: '2026-04-20T10:00:00.000Z',
    updatedAt: '2026-04-20T10:00:00.000Z',
    ...overrides,
  };
}

function emitSnapshot(addresses: SavedAddress[] | undefined, handlerIndex = -1): void {
  const idx = handlerIndex === -1 ? snapshotHandlers.length - 1 : handlerIndex;
  const handler = snapshotHandlers[idx];
  if (!handler) throw new Error(`No snapshot handler at index ${idx}`);
  handler.next({
    exists: () => addresses !== undefined,
    data: () => ({ addresses }),
  });
}

function emitError(err: { code?: string; message?: string }, handlerIndex = -1): void {
  const idx = handlerIndex === -1 ? snapshotHandlers.length - 1 : handlerIndex;
  const handler = snapshotHandlers[idx];
  if (!handler) throw new Error(`No snapshot handler at index ${idx}`);
  handler.error(err);
}

beforeEach(() => {
  snapshotHandlers.length = 0;
  unsubscribeSpies.length = 0;
  mockFirebaseUser = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDefaultAddress', () => {
  it('returns { address: null, isLoading: false, error: null } when signed-out (SSR-equivalent)', async () => {
    mockFirebaseUser = null;
    const { useDefaultAddress } = await import('../useDefaultAddress');
    const { result } = renderHook(() => useDefaultAddress());

    // Signed-out: the effect short-circuits and flips isLoading to false
    // synchronously. This is the observable steady state SSR consumers see
    // once they mount in the browser with no user.
    expect(result.current.address).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    // No Firestore listener attached when signed out.
    expect(snapshotHandlers.length).toBe(0);
  });

  it('returns the address where isDefault === true once a snapshot arrives', async () => {
    mockFirebaseUser = { uid: 'user-123' } as FirebaseUser;
    const { useDefaultAddress } = await import('../useDefaultAddress');
    const { result } = renderHook(() => useDefaultAddress());

    // Before the snapshot: loading.
    expect(result.current.isLoading).toBe(true);
    expect(result.current.address).toBeNull();

    const defaultAddr = makeAddress({ id: 'a-default', isDefault: true });
    const otherAddr = makeAddress({
      id: 'a-other',
      isDefault: false,
      createdAt: '2026-04-19T09:00:00.000Z',
    });

    act(() => {
      emitSnapshot([otherAddr, defaultAddr]);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.address).not.toBeNull();
    expect(result.current.address?.id).toBe('a-default');
  });

  it('falls back to most recent live address when no explicit default is set', async () => {
    mockFirebaseUser = { uid: 'user-123' } as FirebaseUser;
    const { useDefaultAddress } = await import('../useDefaultAddress');
    const { result } = renderHook(() => useDefaultAddress());

    const older = makeAddress({
      id: 'older',
      isDefault: false,
      createdAt: '2026-04-01T00:00:00.000Z',
    });
    const recent = makeAddress({
      id: 'recent',
      isDefault: false,
      createdAt: '2026-04-18T00:00:00.000Z',
    });

    act(() => {
      emitSnapshot([older, recent]);
    });

    // Soft-delete fallback path: when no explicit default exists the hook
    // still surfaces a usable address rather than null. The Addresses page
    // auto-promotes a default on first-add, so this fallback only matters
    // for orphaned data — but we exercise the code path here.
    expect(result.current.address?.id).toBe('recent');
    expect(result.current.isLoading).toBe(false);
  });

  it('returns null when the user doc has no addresses array', async () => {
    mockFirebaseUser = { uid: 'user-123' } as FirebaseUser;
    const { useDefaultAddress } = await import('../useDefaultAddress');
    const { result } = renderHook(() => useDefaultAddress());

    act(() => {
      emitSnapshot([]);
    });

    expect(result.current.address).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('unsubscribes and clears state when firebaseUser transitions to null (sign-out)', async () => {
    mockFirebaseUser = { uid: 'user-123' } as FirebaseUser;
    const { useDefaultAddress } = await import('../useDefaultAddress');
    const { result, rerender } = renderHook(() => useDefaultAddress());

    // First: a live snapshot so we have an address.
    const addr = makeAddress({ id: 'a-default', isDefault: true });
    act(() => {
      emitSnapshot([addr]);
    });
    expect(result.current.address?.id).toBe('a-default');
    expect(unsubscribeSpies.length).toBe(1);
    expect(unsubscribeSpies[0]).not.toHaveBeenCalled();

    // Flip to signed-out — the previous listener MUST unsubscribe.
    mockFirebaseUser = null;
    rerender();

    expect(unsubscribeSpies[0]).toHaveBeenCalledTimes(1);
    expect(result.current.address).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('swallows permission-denied errors (transient sign-out race) without surfacing them', async () => {
    mockFirebaseUser = { uid: 'user-123' } as FirebaseUser;
    const { useDefaultAddress } = await import('../useDefaultAddress');
    const { FirebaseError } = await import('firebase/app');
    const { result } = renderHook(() => useDefaultAddress());

    act(() => {
      emitError(new FirebaseError('permission-denied', 'Missing or insufficient permissions.'));
    });

    expect(result.current.address).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('surfaces non-permission-denied Firestore errors via the error field', async () => {
    mockFirebaseUser = { uid: 'user-123' } as FirebaseUser;
    const { useDefaultAddress } = await import('../useDefaultAddress');
    const { FirebaseError } = await import('firebase/app');
    const { result } = renderHook(() => useDefaultAddress());

    const fatal = new FirebaseError('unavailable', 'Backend unavailable');
    act(() => {
      emitError(fatal);
    });

    expect(result.current.error).not.toBeNull();
    expect((result.current.error as { code?: string } | null)?.code).toBe('unavailable');
    expect(result.current.isLoading).toBe(false);
  });

  it('unsubscribes the previous listener when the uid changes (Fast Refresh guard)', async () => {
    mockFirebaseUser = { uid: 'user-A' } as FirebaseUser;
    const { useDefaultAddress } = await import('../useDefaultAddress');
    const { rerender } = renderHook(() => useDefaultAddress());

    expect(snapshotHandlers.length).toBe(1);
    expect(unsubscribeSpies.length).toBe(1);

    mockFirebaseUser = { uid: 'user-B' } as FirebaseUser;
    rerender();

    // Previous listener unsubscribed, new one attached.
    expect(unsubscribeSpies[0]).toHaveBeenCalledTimes(1);
    expect(snapshotHandlers.length).toBe(2);
    expect(unsubscribeSpies.length).toBe(2);
    expect(unsubscribeSpies[1]).not.toHaveBeenCalled();
  });

  it('returns a stable reference when an echo snapshot repeats identical data', async () => {
    mockFirebaseUser = { uid: 'user-123' } as FirebaseUser;
    const { useDefaultAddress } = await import('../useDefaultAddress');
    const { result } = renderHook(() => useDefaultAddress());

    const addr = makeAddress({ id: 'a-default', isDefault: true });

    act(() => {
      emitSnapshot([addr]);
    });
    const first = result.current.address;

    // Emit a structurally identical snapshot — the reference must NOT change.
    act(() => {
      emitSnapshot([{ ...addr }]);
    });

    expect(result.current.address).toBe(first);
  });

  it('falls back to the most recent live address when the default is soft-deleted', async () => {
    mockFirebaseUser = { uid: 'user-123' } as FirebaseUser;
    const { useDefaultAddress } = await import('../useDefaultAddress');
    const { result } = renderHook(() => useDefaultAddress());

    // Soft-delete marker on the "default" entry — hook should fall back.
    type Augmented = SavedAddress & { deletedAt?: string | null };
    const softDeletedDefault: Augmented = {
      ...makeAddress({
        id: 'tombstoned',
        isDefault: true,
        createdAt: '2026-04-10T00:00:00.000Z',
      }),
      deletedAt: '2026-04-15T00:00:00.000Z',
    };
    const recentLive = makeAddress({
      id: 'recent',
      isDefault: false,
      createdAt: '2026-04-19T00:00:00.000Z',
    });
    const olderLive = makeAddress({
      id: 'older',
      isDefault: false,
      createdAt: '2026-04-01T00:00:00.000Z',
    });

    act(() => {
      emitSnapshot([softDeletedDefault as SavedAddress, olderLive, recentLive]);
    });

    expect(result.current.address?.id).toBe('recent');
    // The `deletedAt` marker must be stripped from the returned address.
    expect(
      (result.current.address as (SavedAddress & { deletedAt?: string | null }) | null)?.deletedAt,
    ).toBeUndefined();
  });

  it('unsubscribes on unmount', async () => {
    mockFirebaseUser = { uid: 'user-123' } as FirebaseUser;
    const { useDefaultAddress } = await import('../useDefaultAddress');
    const { unmount } = renderHook(() => useDefaultAddress());

    expect(unsubscribeSpies.length).toBe(1);
    expect(unsubscribeSpies[0]).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribeSpies[0]).toHaveBeenCalledTimes(1);
  });
});
