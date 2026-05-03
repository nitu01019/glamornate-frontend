/**
 * Tests for `useNotifications` public hooks.
 *
 * Scope (B2 lane):
 *   - `useNotificationsFeed` cursor-based pagination
 *   - `useMarkNotificationRead` writes ONLY `readAt`
 *   - Backward compat: legacy `read === true` without `readAt` is read
 *
 * Strategy:
 *   - Mock `@/lib/firebase-client-wrapper.firebaseClientWrapper` so we can
 *     control `getDocuments` / `updateDocument` / `deleteDocument` per test
 *     without touching a live Firestore.
 *   - Mock `firebase/firestore` to capture the raw `updateDoc` payload for the
 *     mark-as-read assertion (the hook calls `updateDoc` directly so the
 *     wrapper's auto-injected `updatedAt` doesn't trip the Phase-4 rules).
 *   - Mock `@/lib/auth-provider` so we can flip the signed-in user.
 *   - Wrap every hook in a fresh `QueryClientProvider` for isolation.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User as FirebaseUser } from 'firebase/auth';
import type { Notification } from '@/types';

// ---------------------------------------------------------------------------
// firebase/firestore mock — the mark-as-read hook calls `updateDoc` directly
// to avoid the wrapper's auto `updatedAt` injection. We capture every call.
// ---------------------------------------------------------------------------

const updateDocSpy = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
const serverTimestampSentinel = Symbol('SERVER_TIMESTAMP_SENTINEL');

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({
    type: 'document',
    path: segments.join('/'),
  })),
  updateDoc: (ref: unknown, payload: unknown) => updateDocSpy(ref, payload),
  serverTimestamp: () => serverTimestampSentinel,
}));

// ---------------------------------------------------------------------------
// firebase.ts mock — isFirebaseConfigured() and getFirestoreDb() must be
// deterministic for the hook to exercise its live path.
// ---------------------------------------------------------------------------

vi.mock('@/lib/firebase', () => ({
  isFirebaseConfigured: () => true,
  getFirestoreDb: () => ({ __mock: 'firestore' }),
}));

// ---------------------------------------------------------------------------
// firebase-client-wrapper mock — we control getDocuments / deleteDocument /
// subscribeToQuery / callFunction per test.
// ---------------------------------------------------------------------------

const getDocumentsSpy = vi.fn();
const deleteDocumentSpy = vi.fn();
const callFunctionSpy = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained for future subscription assertion tests
let subscribeNextCallback: null | ((data: unknown[], err?: unknown) => void) = null;
const subscribeUnsubscribe = vi.fn();

vi.mock('@/lib/firebase-client-wrapper', () => ({
  firebaseClientWrapper: {
    getDocuments: (...args: unknown[]) => getDocumentsSpy(...args),
    deleteDocument: (...args: unknown[]) => deleteDocumentSpy(...args),
    callFunction: (...args: unknown[]) => callFunctionSpy(...args),
    subscribeToQuery: (
      _collection: string,
      _constraints: unknown,
      cb: (data: unknown[], err?: unknown) => void,
    ) => {
      subscribeNextCallback = cb;
      return subscribeUnsubscribe;
    },
  },
}));

// ---------------------------------------------------------------------------
// auth-provider mock
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
// Test helpers
// ---------------------------------------------------------------------------

function makeNotification(
  id: string,
  overrides: Partial<Notification> = {},
): { id: string; data: Notification } {
  return {
    id,
    data: {
      userId: 'user-123',
      type: 'general',
      title: `Notification ${id}`,
      body: `Body for ${id}`,
      data: {},
      read: false,
      deliveryStatus: 'delivered',
      sentAt: new Date(2026, 3, 20, 10, 0, 0).toISOString(),
      channels: { push: false, email: false, sms: false },
      ...overrides,
    },
  };
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { client, Wrapper };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockFirebaseUser = { uid: 'user-123' } as FirebaseUser;
  updateDocSpy.mockClear();
  getDocumentsSpy.mockReset();
  deleteDocumentSpy.mockReset();
  callFunctionSpy.mockReset();
  subscribeUnsubscribe.mockClear();
  subscribeNextCallback = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// useNotificationsFeed — pagination
// ===========================================================================

describe('useNotificationsFeed', () => {
  it('returns items + hasMore = false when docs fewer than pageSize', async () => {
    const docs = [
      makeNotification('n-3', {
        sentAt: new Date(2026, 3, 20, 12, 0).toISOString(),
      }),
      makeNotification('n-2', {
        sentAt: new Date(2026, 3, 20, 11, 0).toISOString(),
      }),
      makeNotification('n-1', {
        sentAt: new Date(2026, 3, 20, 10, 0).toISOString(),
      }),
    ];
    getDocumentsSpy.mockResolvedValueOnce({ documents: docs });

    const { useNotificationsFeed } = await import('../useNotifications');
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNotificationsFeed(20), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.items.length).toBe(3);
    });
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.error).toBeNull();

    // First page cursor starts as null — only userId / orderBy / limit.
    expect(getDocumentsSpy).toHaveBeenCalledTimes(1);
    const [, constraints] = getDocumentsSpy.mock.calls[0];
    expect(constraints).toContainEqual({
      type: 'where',
      field: 'userId',
      operator: '==',
      value: 'user-123',
    });
    expect(constraints).toContainEqual({
      type: 'orderBy',
      field: 'sentAt',
      direction: 'desc',
    });
    expect(constraints).toContainEqual({ type: 'limit', count: 20 });
    // No cursor `where sentAt <` on the first page.
    const sentAtWhere = constraints.find(
      (c: { type: string; field?: string }) => c.type === 'where' && c.field === 'sentAt',
    );
    expect(sentAtWhere).toBeUndefined();
  });

  it('returns items + hasMore = false when docs exactly equal pageSize but is the tail', async () => {
    // A full first page triggers `hasMore = true` and a cursor; a second call
    // returning an empty page flips `hasMore` back to false.
    const pageOne = Array.from({ length: 5 }, (_, i) =>
      makeNotification(`n-${10 - i}`, {
        sentAt: new Date(2026, 3, 20, 12 - i, 0).toISOString(),
      }),
    );
    getDocumentsSpy.mockResolvedValueOnce({ documents: pageOne });

    const { useNotificationsFeed } = await import('../useNotifications');
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNotificationsFeed(5), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.items.length).toBe(5);
    });
    expect(result.current.hasMore).toBe(true);

    // Stage an empty second page — fetchMore resolves with no new rows.
    getDocumentsSpy.mockResolvedValueOnce({ documents: [] });
    await act(async () => {
      await result.current.fetchMore();
    });

    await waitFor(() => {
      expect(result.current.hasMore).toBe(false);
    });
  });

  it('fetchMore appends the next cursor page using startAfter on sentAt', async () => {
    const pageOne = Array.from({ length: 3 }, (_, i) =>
      makeNotification(`n-${10 - i}`, {
        sentAt: new Date(2026, 3, 20, 12 - i, 0).toISOString(),
      }),
    );
    const pageTwo = Array.from({ length: 3 }, (_, i) =>
      makeNotification(`n-${7 - i}`, {
        sentAt: new Date(2026, 3, 20, 9 - i, 0).toISOString(),
      }),
    );

    getDocumentsSpy
      .mockResolvedValueOnce({ documents: pageOne })
      .mockResolvedValueOnce({ documents: pageTwo });

    const { useNotificationsFeed } = await import('../useNotifications');
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNotificationsFeed(3), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.items.length).toBe(3);
    });
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.fetchMore();
    });

    await waitFor(() => {
      expect(result.current.items.length).toBe(6);
    });

    // The second call must include a `where sentAt <` cursor seeded from the
    // last row of the first page.
    expect(getDocumentsSpy).toHaveBeenCalledTimes(2);
    const [, secondConstraints] = getDocumentsSpy.mock.calls[1];
    const cursorWhere = secondConstraints.find(
      (c: { type: string; field?: string; operator?: string; value?: unknown }) =>
        c.type === 'where' && c.field === 'sentAt' && c.operator === '<',
    );
    expect(cursorWhere).toBeDefined();
    expect(cursorWhere?.value).toBe(pageOne[pageOne.length - 1].data.sentAt);
  });

  it('surfaces errors from the underlying query', async () => {
    getDocumentsSpy.mockRejectedValueOnce(new Error('network down'));

    const { useNotificationsFeed } = await import('../useNotifications');
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNotificationsFeed(10), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.items.length).toBe(0);
  });

  it('is disabled when there is no signed-in user', async () => {
    mockFirebaseUser = null;
    const { useNotificationsFeed } = await import('../useNotifications');
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNotificationsFeed(20), { wrapper: Wrapper });

    // Let the microtask queue drain; query should remain un-invoked.
    await new Promise((r) => setTimeout(r, 10));
    expect(getDocumentsSpy).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });
});

// ===========================================================================
// useMarkNotificationRead — writes ONLY readAt
// ===========================================================================

describe('useMarkNotificationRead', () => {
  it('writes ONLY readAt (no read:true, no updatedAt) via updateDoc', async () => {
    const { useMarkNotificationRead } = await import('../useNotifications');
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ notificationId: 'notif-1' });
    });

    expect(updateDocSpy).toHaveBeenCalledTimes(1);
    const firstCall = updateDocSpy.mock.calls[0] as unknown as [
      { path: string },
      Record<string, unknown>,
    ];
    const [ref, payload] = firstCall;
    expect(ref.path).toBe('notifications/notif-1');

    // ONLY `readAt` — no `read`, no `updatedAt`, no stray fields.
    expect(Object.keys(payload)).toEqual(['readAt']);
    expect(payload.readAt).toBe(serverTimestampSentinel);
    expect(payload).not.toHaveProperty('read');
    expect(payload).not.toHaveProperty('updatedAt');
  });

  it('optimistically patches the feed cache before the network resolves', async () => {
    const { useNotificationsFeed, useMarkNotificationRead, notificationQueryKeys } =
      await import('../useNotifications');

    getDocumentsSpy.mockResolvedValueOnce({
      documents: [makeNotification('n-1'), makeNotification('n-2')],
    });

    const { Wrapper, client } = createWrapper();

    const feed = renderHook(() => useNotificationsFeed(20), { wrapper: Wrapper });
    await waitFor(() => {
      expect(feed.result.current.items.length).toBe(2);
    });

    // Make `updateDoc` hang so we can observe the optimistic patch pre-resolve.
    let resolveUpdate: () => void = () => undefined;
    updateDocSpy.mockImplementationOnce(
      () =>
        new Promise<void>((res) => {
          resolveUpdate = () => res();
        }),
    );

    const markRead = renderHook(() => useMarkNotificationRead(), { wrapper: Wrapper });

    act(() => {
      void markRead.result.current.mutate({ notificationId: 'n-1' });
    });

    await waitFor(() => {
      const cached = client.getQueryData(notificationQueryKeys.feed(20, 'user-123')) as
        | {
            pages: Array<{ items: Array<{ id: string; readAt?: string }> }>;
          }
        | undefined;
      const patched = cached?.pages?.[0]?.items?.find((i) => i.id === 'n-1');
      expect(patched?.readAt).toBeTruthy();
    });

    // Release the network so the mutation can settle cleanly.
    resolveUpdate();
    await waitFor(() => {
      expect(markRead.result.current.isPending).toBe(false);
    });
  });

  it('rolls back the optimistic patch when the network call fails', async () => {
    const { useNotificationsFeed, useMarkNotificationRead, notificationQueryKeys } =
      await import('../useNotifications');

    getDocumentsSpy.mockResolvedValueOnce({
      documents: [makeNotification('n-1')],
    });

    const { Wrapper, client } = createWrapper();
    const feed = renderHook(() => useNotificationsFeed(20), { wrapper: Wrapper });
    await waitFor(() => {
      expect(feed.result.current.items.length).toBe(1);
    });

    updateDocSpy.mockRejectedValueOnce(new Error('permission denied'));

    const markRead = renderHook(() => useMarkNotificationRead(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await markRead.result.current.mutateAsync({ notificationId: 'n-1' });
      } catch {
        // expected
      }
    });

    // Once the error fires, the cache should be rolled back — the cached
    // row must not carry `readAt`.
    await waitFor(() => {
      const cached = client.getQueryData(notificationQueryKeys.feed(20, 'user-123')) as
        | {
            pages: Array<{ items: Array<{ id: string; readAt?: string }> }>;
          }
        | undefined;
      const row = cached?.pages?.[0]?.items?.find((i) => i.id === 'n-1');
      // After rollback + post-error invalidation, the row reverts. Either
      // rollback leaves readAt undefined, or a refetch reseeds it without
      // readAt because the mocked getDocuments has no readAt either.
      expect(row?.readAt).toBeUndefined();
    });
  });
});

// ===========================================================================
// Backward compat: legacy `read === true` without `readAt`
// ===========================================================================

describe('isNotificationUnread (backward compat)', () => {
  it('treats a legacy doc with read:true and no readAt as READ', async () => {
    const { isNotificationUnread } = await import('../useNotifications');
    expect(
      isNotificationUnread({
        read: true,
        readAt: undefined,
      }),
    ).toBe(false);
  });

  it('treats a new-schema doc with readAt present as READ even if read:false', async () => {
    const { isNotificationUnread } = await import('../useNotifications');
    expect(
      isNotificationUnread({
        read: false,
        readAt: '2026-04-20T12:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('treats a doc with read:false and no readAt as UNREAD', async () => {
    const { isNotificationUnread } = await import('../useNotifications');
    expect(
      isNotificationUnread({
        read: false,
        readAt: undefined,
      }),
    ).toBe(true);
  });
});
