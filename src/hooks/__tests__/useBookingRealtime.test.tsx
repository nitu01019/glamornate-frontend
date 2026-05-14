/**
 * Tests for `useBookingRealtime` (Firestore onSnapshot subscription).
 *
 * Phase 3.7 coverage gap-fill — `useBookings.ts:399-442` was previously
 * untested at the unit level. This locks the subscription lifecycle:
 *
 *   1. mount with bookingId → calls subscribeToDocument(collection, id, cb)
 *   2. snapshot data       → setBooking({ id, ...data })
 *   3. snapshot null       → setBooking(null) (doc deleted / not found)
 *   4. unmount             → unsubscribe is invoked exactly once
 *   5. bookingId = null    → no subscription is opened
 *   6. bookingId change    → previous unsubscribe is invoked, new sub opened
 *
 * The hook drives the customer-facing booking detail page (Status pill,
 * timeline). A regression that drops the unsubscribe leaks Firestore
 * listeners; a regression that drops the snapshot mapping renders stale
 * status forever.
 */

import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (declared before importing the hook so the hook picks them up)
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({
    firebaseUser: { uid: 'test-uid' },
    user: { role: 'customer' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

const isFirebaseConfiguredMock = vi.fn(() => true);
vi.mock('@/lib/firebase', () => ({
  isFirebaseConfigured: () => isFirebaseConfiguredMock(),
}));

type SnapshotCallback = (
  data: { id: string; data: Record<string, unknown> } | null,
  err?: unknown,
) => void;

// Capture the most recent subscription so a test can drive snapshots
// synchronously.
const subscribeState: {
  callback: SnapshotCallback | null;
  unsubscribe: ReturnType<typeof vi.fn>;
  callCount: number;
  lastArgs: [string, string] | null;
} = {
  callback: null,
  unsubscribe: vi.fn(),
  callCount: 0,
  lastArgs: null,
};

const subscribeToDocumentMock = vi.fn((collection: string, id: string, cb: SnapshotCallback) => {
  subscribeState.callback = cb;
  subscribeState.callCount += 1;
  subscribeState.lastArgs = [collection, id];
  return subscribeState.unsubscribe;
});

vi.mock('@/lib/firebase-client-wrapper', () => ({
  firebaseClientWrapper: {
    subscribeToDocument: (collection: string, id: string, cb: SnapshotCallback) =>
      subscribeToDocumentMock(collection, id, cb),
    callFunction: vi.fn(),
    getDocuments: vi.fn(),
    updateDocument: vi.fn(),
  },
  QueryConstraintConfig: {},
}));

// ---------------------------------------------------------------------------
// Lifecycle reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  subscribeToDocumentMock.mockClear();
  subscribeState.callback = null;
  subscribeState.unsubscribe = vi.fn();
  subscribeState.callCount = 0;
  subscribeState.lastArgs = null;
  isFirebaseConfiguredMock.mockReturnValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useBookingRealtime — subscription lifecycle', () => {
  it('opens a subscription against the bookings collection on mount', async () => {
    const { useBookingRealtime } = await import('../useBookings');
    renderHook(() => useBookingRealtime('b-1'));

    expect(subscribeToDocumentMock).toHaveBeenCalledTimes(1);
    expect(subscribeState.lastArgs).toEqual(['bookings', 'b-1']);
  });

  it('does NOT subscribe when bookingId is null/undefined', async () => {
    const { useBookingRealtime } = await import('../useBookings');
    const { rerender } = renderHook(({ id }: { id: string | null }) => useBookingRealtime(id), {
      // Phase 3.7 typecheck-fix (lead, 2026-05-08): `initialProps: { id: null }`
      // alone narrowed the prop type to `{ id: null }` so `rerender({ id: 'b-late' })`
      // failed assignability. Casting the literal null back to the declared
      // `string | null` keeps the rerender accepting future ids without
      // changing runtime behavior.
      initialProps: { id: null as string | null },
    });

    expect(subscribeToDocumentMock).not.toHaveBeenCalled();

    // And does open a subscription once a real id arrives.
    rerender({ id: 'b-late' });
    expect(subscribeToDocumentMock).toHaveBeenCalledTimes(1);
    expect(subscribeState.lastArgs).toEqual(['bookings', 'b-late']);
  });

  it('does NOT subscribe when Firebase is not configured', async () => {
    isFirebaseConfiguredMock.mockReturnValue(false);
    const { useBookingRealtime } = await import('../useBookings');
    const { result } = renderHook(() => useBookingRealtime('b-2'));

    expect(subscribeToDocumentMock).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('snapshot data flows through to component state with id+spread', async () => {
    const { useBookingRealtime } = await import('../useBookings');
    const { result } = renderHook(() => useBookingRealtime('b-3'));

    expect(result.current).toBeNull();

    act(() => {
      subscribeState.callback?.(
        {
          id: 'b-3',
          data: { bookingStatus: 'en_route', spaId: 'spa_x', userId: 'test-uid' },
        },
        undefined,
      );
    });

    expect(result.current).toEqual({
      id: 'b-3',
      bookingStatus: 'en_route',
      spaId: 'spa_x',
      userId: 'test-uid',
    });
  });

  it('snapshot null clears state (doc deleted or not found)', async () => {
    const { useBookingRealtime } = await import('../useBookings');
    const { result } = renderHook(() => useBookingRealtime('b-4'));

    act(() => {
      subscribeState.callback?.({ id: 'b-4', data: { bookingStatus: 'confirmed' } }, undefined);
    });
    expect(result.current).not.toBeNull();

    act(() => {
      subscribeState.callback?.(null, undefined);
    });
    expect(result.current).toBeNull();
  });

  it('snapshot error does NOT update booking state (last-good wins) and does not throw', async () => {
    const { useBookingRealtime } = await import('../useBookings');
    const { result } = renderHook(() => useBookingRealtime('b-5'));

    act(() => {
      subscribeState.callback?.({ id: 'b-5', data: { bookingStatus: 'confirmed' } }, undefined);
    });
    expect(result.current?.bookingStatus).toBe('confirmed');

    // Errored emission must not flip booking state to null — that would
    // visually wipe the detail page on a transient permission glitch.
    act(() => {
      subscribeState.callback?.(null, new Error('permission-denied') as never);
    });
    expect(result.current?.bookingStatus).toBe('confirmed');
  });

  it('unmount calls the unsubscribe returned by subscribeToDocument exactly once', async () => {
    const { useBookingRealtime } = await import('../useBookings');
    const { unmount } = renderHook(() => useBookingRealtime('b-6'));

    expect(subscribeState.unsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(subscribeState.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('changing bookingId tears down the old subscription and opens a new one', async () => {
    const { useBookingRealtime } = await import('../useBookings');
    const { rerender } = renderHook(({ id }: { id: string }) => useBookingRealtime(id), {
      initialProps: { id: 'b-7' },
    });

    const firstUnsubscribe = subscribeState.unsubscribe;
    expect(subscribeToDocumentMock).toHaveBeenCalledTimes(1);

    // Reset capture for the second subscription.
    subscribeState.unsubscribe = vi.fn();

    rerender({ id: 'b-8' });

    expect(firstUnsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribeToDocumentMock).toHaveBeenCalledTimes(2);
    expect(subscribeState.lastArgs).toEqual(['bookings', 'b-8']);
  });
});
