/**
 * Integration tests for `useCancelBooking` (SC-3).
 *
 * Locks the contract between the hook, the `cancelBooking` callable, and the
 * React Query cache:
 *
 *   1. Mutation calls `firebaseClientWrapper.callFunction('cancelBooking', …)`
 *      exactly once with the variables the caller passed (`bookingId`,
 *      `reason`).
 *   2. On success, BOTH `bookingQueryKeys.all` AND
 *      `bookingQueryKeys.detail(bookingId)` are invalidated so the bookings
 *      list and the detail screen both re-fetch fresh state.
 *   3. On a backend `failed-precondition` error (the canonical "booking is
 *      already cancelled / past cutoff" rejection), the mutation rejects, no
 *      cache invalidation fires, and the hook's `onError` logger path runs
 *      (asserted indirectly via `result.current.error` propagation — the hook
 *      does not surface logger calls on its public API).
 *
 * Mirrors the mock pattern in `useUpcomingBookings.test.tsx` (vi.mock for
 * `@/lib/firebase`, `@/lib/auth-provider`, and
 * `@/lib/firebase-client-wrapper`).
 */

import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

vi.mock('@/lib/firebase', () => ({
  isFirebaseConfigured: () => true,
}));

const callFunctionMock = vi.fn();

vi.mock('@/lib/firebase-client-wrapper', () => ({
  firebaseClientWrapper: {
    callFunction: (...args: unknown[]) => callFunctionMock(...args),
    // getDocuments is exercised by sibling hooks in the same module; provide
    // a no-op so module-load doesn't crash if anything else is touched.
    getDocuments: vi.fn(),
  },
  QueryConstraintConfig: {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapperAndClient(): {
  wrapper: (props: { children: ReactNode }) => ReactNode;
  qc: QueryClient;
} {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { wrapper: Wrapper, qc };
}

beforeEach(() => {
  callFunctionMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// useCancelBooking — happy path
// ---------------------------------------------------------------------------

describe('useCancelBooking (SC-3) — success', () => {
  it('invokes cancelBooking callable once with caller variables', async () => {
    callFunctionMock.mockResolvedValueOnce({ success: true, refundAmount: 0 });

    const { wrapper } = makeWrapperAndClient();
    const { useCancelBooking } = await import('../useBookings');
    const { result } = renderHook(() => useCancelBooking(), { wrapper });

    await result.current.mutateAsync({
      bookingId: 'booking-123',
      reason: 'Plans changed',
    });

    expect(callFunctionMock).toHaveBeenCalledTimes(1);
    expect(callFunctionMock).toHaveBeenCalledWith('cancelBooking', {
      bookingId: 'booking-123',
      reason: 'Plans changed',
    });
  });

  it('invalidates BOTH bookingQueryKeys.all AND bookingQueryKeys.detail(bookingId) on success', async () => {
    callFunctionMock.mockResolvedValueOnce({ success: true });

    const { wrapper, qc } = makeWrapperAndClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { useCancelBooking, bookingQueryKeys } = await import('../useBookings');
    const { result } = renderHook(() => useCancelBooking(), { wrapper });

    await result.current.mutateAsync({
      bookingId: 'booking-456',
      reason: 'Customer request',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Locate every invalidation call. We assert by query-key value (NOT call
    // index) so the test stays robust if React Query internals shuffle the
    // order between releases.
    const calls = invalidateSpy.mock.calls.map(([arg]) => arg);

    const allInvalidated = calls.some(
      (c) =>
        Array.isArray((c as { queryKey?: unknown[] } | undefined)?.queryKey) &&
        JSON.stringify((c as { queryKey: unknown[] }).queryKey) ===
          JSON.stringify(bookingQueryKeys.all),
    );
    const detailInvalidated = calls.some(
      (c) =>
        Array.isArray((c as { queryKey?: unknown[] } | undefined)?.queryKey) &&
        JSON.stringify((c as { queryKey: unknown[] }).queryKey) ===
          JSON.stringify(bookingQueryKeys.detail('booking-456')),
    );

    expect(allInvalidated).toBe(true);
    expect(detailInvalidated).toBe(true);
  });

  it('returns the callable response payload to the caller', async () => {
    callFunctionMock.mockResolvedValueOnce({ success: true, refundAmount: 1500 });

    const { wrapper } = makeWrapperAndClient();
    const { useCancelBooking } = await import('../useBookings');
    const { result } = renderHook(() => useCancelBooking(), { wrapper });

    const response = await result.current.mutateAsync({
      bookingId: 'booking-789',
      reason: 'Plans changed',
    });

    expect(response).toEqual({ success: true, refundAmount: 1500 });
  });
});

// ---------------------------------------------------------------------------
// useCancelBooking — failure path (BE failed-precondition)
// ---------------------------------------------------------------------------

describe('useCancelBooking (SC-3) — failure', () => {
  it('rejects when the callable throws a failed-precondition error and skips invalidation', async () => {
    // Shape mirrors a Firebase HttpsError surfaced from the cancelBooking
    // callable when the booking is no longer cancellable (already cancelled,
    // past cutoff, in_progress, etc.).
    const beError = Object.assign(new Error('Booking is no longer cancellable'), {
      code: 'functions/failed-precondition',
    });
    callFunctionMock.mockRejectedValueOnce(beError);

    const { wrapper, qc } = makeWrapperAndClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { useCancelBooking } = await import('../useBookings');
    const { result } = renderHook(() => useCancelBooking(), { wrapper });

    await expect(
      result.current.mutateAsync({
        bookingId: 'booking-fail',
        reason: 'Plans changed',
      }),
    ).rejects.toThrow('Booking is no longer cancellable');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(beError);

    // No invalidations should fire on failure — onSuccess is the only place
    // they're triggered. Guards against an accidental onSettled migration
    // that would re-fetch on every failure and cause UI flicker.
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
