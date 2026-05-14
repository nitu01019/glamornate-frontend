/**
 * Integration tests for `useRescheduleBooking` (SC-4).
 *
 * Locks the contract between the hook, the `rescheduleBooking` callable, and
 * the React Query cache:
 *
 *   1. Mutation calls
 *      `firebaseClientWrapper.callFunction('rescheduleBooking', …)` exactly
 *      once with the variables the caller passed (`bookingId`, `newSlot`,
 *      optional `therapistId`).
 *   2. On success, BOTH `bookingQueryKeys.all` AND
 *      `bookingQueryKeys.detail(bookingId)` are invalidated so the bookings
 *      list and the detail screen both re-fetch fresh state.
 *   3. On a backend `failed-precondition` error (e.g. the new slot conflicts
 *      with an existing booking, or the booking is no longer reschedulable),
 *      the mutation rejects, no cache invalidation fires, and the hook's
 *      `onError` logger path runs (asserted via `result.current.error`
 *      propagation — the hook does not surface logger calls on its public
 *      API).
 *
 * Mirrors the mock pattern in `useUpcomingBookings.test.tsx` and
 * `useCancelBooking-integration.test.tsx`.
 */

import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks
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

// Canonical Slot shape — must match `Slot` in `@/types`. We keep the literal
// inline (rather than importing) so the test fails loudly if the runtime
// shape changes.
function makeSlot(date: string, start: string, end: string) {
  return { date, start, end, duration: 60 };
}

beforeEach(() => {
  callFunctionMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// useRescheduleBooking — happy path
// ---------------------------------------------------------------------------

describe('useRescheduleBooking (SC-4) — success', () => {
  it('invokes rescheduleBooking callable once with caller variables', async () => {
    callFunctionMock.mockResolvedValueOnce({ success: true });

    const { wrapper } = makeWrapperAndClient();
    const { useRescheduleBooking } = await import('../useBookings');
    const { result } = renderHook(() => useRescheduleBooking(), { wrapper });

    const newSlot = makeSlot('2027-06-15', '10:00', '11:00');
    await result.current.mutateAsync({
      bookingId: 'booking-r1',
      newSlot,
    });

    expect(callFunctionMock).toHaveBeenCalledTimes(1);
    expect(callFunctionMock).toHaveBeenCalledWith('rescheduleBooking', {
      bookingId: 'booking-r1',
      newSlot,
    });
  });

  it('forwards optional therapistId when provided', async () => {
    callFunctionMock.mockResolvedValueOnce({ success: true });

    const { wrapper } = makeWrapperAndClient();
    const { useRescheduleBooking } = await import('../useBookings');
    const { result } = renderHook(() => useRescheduleBooking(), { wrapper });

    const newSlot = makeSlot('2027-06-16', '14:00', '15:00');
    await result.current.mutateAsync({
      bookingId: 'booking-r2',
      newSlot,
      therapistId: 'therapist-9',
    });

    expect(callFunctionMock).toHaveBeenCalledWith('rescheduleBooking', {
      bookingId: 'booking-r2',
      newSlot,
      therapistId: 'therapist-9',
    });
  });

  it('invalidates BOTH bookingQueryKeys.all AND bookingQueryKeys.detail(bookingId) on success', async () => {
    callFunctionMock.mockResolvedValueOnce({ success: true });

    const { wrapper, qc } = makeWrapperAndClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { useRescheduleBooking, bookingQueryKeys } = await import('../useBookings');
    const { result } = renderHook(() => useRescheduleBooking(), { wrapper });

    await result.current.mutateAsync({
      bookingId: 'booking-r3',
      newSlot: makeSlot('2027-06-17', '09:00', '10:00'),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

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
          JSON.stringify(bookingQueryKeys.detail('booking-r3')),
    );

    expect(allInvalidated).toBe(true);
    expect(detailInvalidated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useRescheduleBooking — failure path
// ---------------------------------------------------------------------------

describe('useRescheduleBooking (SC-4) — failure', () => {
  it('rejects when the callable throws a failed-precondition error and skips invalidation', async () => {
    const beError = Object.assign(new Error('New slot conflicts with an existing booking'), {
      code: 'functions/failed-precondition',
    });
    callFunctionMock.mockRejectedValueOnce(beError);

    const { wrapper, qc } = makeWrapperAndClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { useRescheduleBooking } = await import('../useBookings');
    const { result } = renderHook(() => useRescheduleBooking(), { wrapper });

    await expect(
      result.current.mutateAsync({
        bookingId: 'booking-r-fail',
        newSlot: makeSlot('2027-06-18', '10:00', '11:00'),
      }),
    ).rejects.toThrow('New slot conflicts with an existing booking');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(beError);

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
