/**
 * Tests for `useUpdateBookingStatus` (spa-staff status mutation router).
 *
 * Phase 3.7 coverage gap-fill — `useBookings.ts:563-621` was previously
 * exercised only through emulator + UI tests. This locks the routing
 * contract at the unit level so a refactor that accidentally re-routes a
 * status surfaces as a unit-test failure, not a production regression.
 *
 * Routing contract (per `useBookings.ts:578-609`):
 *   status === 'completed'  → callable('checkOutService', { bookingId, notes? })
 *   status === 'cancelled'  → callable('cancelBooking',   { bookingId, reason })
 *   status === anything else → updateDocument('bookings', id, { bookingStatus, notes? })
 *
 * On success, both `bookingQueryKeys.all` AND `bookingQueryKeys.detail(id)`
 * must be invalidated so the spa-staff list AND the customer detail page
 * both refetch.
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
    firebaseUser: { uid: 'staff-uid' },
    user: { role: 'spa_staff' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

vi.mock('@/lib/firebase', () => ({
  isFirebaseConfigured: () => true,
}));

const callFunctionMock = vi.fn();
const updateDocumentMock = vi.fn();

vi.mock('@/lib/firebase-client-wrapper', () => ({
  firebaseClientWrapper: {
    callFunction: (...args: unknown[]) => callFunctionMock(...args),
    updateDocument: (...args: unknown[]) => updateDocumentMock(...args),
    getDocuments: vi.fn(),
  },
  QueryConstraintConfig: {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TestHarness {
  wrapper: (props: { children: ReactNode }) => ReactNode;
  invalidateSpy: ReturnType<typeof vi.fn>;
}

function makeHarness(): TestHarness {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const invalidateSpy = vi.fn();
  qc.invalidateQueries = invalidateSpy as unknown as typeof qc.invalidateQueries;
  const wrapper = function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
  return { wrapper, invalidateSpy };
}

beforeEach(() => {
  callFunctionMock.mockReset();
  updateDocumentMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Routing — completed → checkOutService callable
// ---------------------------------------------------------------------------

describe('useUpdateBookingStatus — routing', () => {
  it('status="completed" routes to checkOutService callable with bookingId+notes', async () => {
    callFunctionMock.mockResolvedValueOnce(undefined);
    const { wrapper } = makeHarness();

    const { useUpdateBookingStatus } = await import('../useBookings');
    const { result } = renderHook(() => useUpdateBookingStatus(), { wrapper });

    await result.current.mutateAsync({
      bookingId: 'b-1',
      status: 'completed',
      notes: 'Service complete',
    });

    expect(callFunctionMock).toHaveBeenCalledTimes(1);
    expect(callFunctionMock).toHaveBeenCalledWith('checkOutService', {
      bookingId: 'b-1',
      notes: 'Service complete',
    });
    // direct-write path must NOT fire
    expect(updateDocumentMock).not.toHaveBeenCalled();
  });

  it('status="completed" without notes still routes to checkOutService and omits notes key', async () => {
    callFunctionMock.mockResolvedValueOnce(undefined);
    const { wrapper } = makeHarness();

    const { useUpdateBookingStatus } = await import('../useBookings');
    const { result } = renderHook(() => useUpdateBookingStatus(), { wrapper });

    await result.current.mutateAsync({ bookingId: 'b-2', status: 'completed' });

    expect(callFunctionMock).toHaveBeenCalledTimes(1);
    expect(callFunctionMock).toHaveBeenCalledWith('checkOutService', {
      bookingId: 'b-2',
    });
    // notes key MUST be absent (not undefined). Per useBookings.ts:582-584
    // the spread is conditional so a noisy server-side validator does not
    // see `notes: undefined`.
    const payload = callFunctionMock.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(payload, 'notes')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Routing — cancelled → cancelBooking callable
  // -------------------------------------------------------------------------

  it('status="cancelled" routes to cancelBooking callable with reason', async () => {
    callFunctionMock.mockResolvedValueOnce(undefined);
    const { wrapper } = makeHarness();

    const { useUpdateBookingStatus } = await import('../useBookings');
    const { result } = renderHook(() => useUpdateBookingStatus(), { wrapper });

    await result.current.mutateAsync({
      bookingId: 'b-3',
      status: 'cancelled',
      cancellationReason: 'Customer no-show',
    });

    expect(callFunctionMock).toHaveBeenCalledWith('cancelBooking', {
      bookingId: 'b-3',
      reason: 'Customer no-show',
    });
    expect(updateDocumentMock).not.toHaveBeenCalled();
  });

  it('status="cancelled" falls back to notes when cancellationReason missing', async () => {
    callFunctionMock.mockResolvedValueOnce(undefined);
    const { wrapper } = makeHarness();

    const { useUpdateBookingStatus } = await import('../useBookings');
    const { result } = renderHook(() => useUpdateBookingStatus(), { wrapper });

    await result.current.mutateAsync({
      bookingId: 'b-4',
      status: 'cancelled',
      notes: 'Operator override',
    });

    expect(callFunctionMock).toHaveBeenCalledWith('cancelBooking', {
      bookingId: 'b-4',
      reason: 'Operator override',
    });
  });

  it('status="cancelled" with no reason+notes sends empty-string reason', async () => {
    // useBookings.ts:592 → `reason: data.cancellationReason ?? data.notes ?? ''`
    // Locks the empty-string fallback so a callable validator that requires
    // reason being a string (not undefined) does not receive `undefined`.
    callFunctionMock.mockResolvedValueOnce(undefined);
    const { wrapper } = makeHarness();

    const { useUpdateBookingStatus } = await import('../useBookings');
    const { result } = renderHook(() => useUpdateBookingStatus(), { wrapper });

    await result.current.mutateAsync({ bookingId: 'b-5', status: 'cancelled' });

    expect(callFunctionMock).toHaveBeenCalledWith('cancelBooking', {
      bookingId: 'b-5',
      reason: '',
    });
  });

  // -------------------------------------------------------------------------
  // Routing — intermediate status (en_route, in_progress) → direct write
  // -------------------------------------------------------------------------

  it('status="en_route" writes directly to Firestore (no callable)', async () => {
    updateDocumentMock.mockResolvedValueOnce(undefined);
    const { wrapper } = makeHarness();

    const { useUpdateBookingStatus } = await import('../useBookings');
    const { result } = renderHook(() => useUpdateBookingStatus(), { wrapper });

    await result.current.mutateAsync({ bookingId: 'b-6', status: 'en_route' });

    expect(updateDocumentMock).toHaveBeenCalledTimes(1);
    expect(updateDocumentMock).toHaveBeenCalledWith('bookings', 'b-6', {
      bookingStatus: 'en_route',
    });
    expect(callFunctionMock).not.toHaveBeenCalled();
  });

  it('status="in_progress" with notes writes both status and notes directly', async () => {
    updateDocumentMock.mockResolvedValueOnce(undefined);
    const { wrapper } = makeHarness();

    const { useUpdateBookingStatus } = await import('../useBookings');
    const { result } = renderHook(() => useUpdateBookingStatus(), { wrapper });

    await result.current.mutateAsync({
      bookingId: 'b-7',
      status: 'in_progress',
      notes: 'Started service',
    });

    expect(updateDocumentMock).toHaveBeenCalledWith('bookings', 'b-7', {
      bookingStatus: 'in_progress',
      notes: 'Started service',
    });
    expect(callFunctionMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cache invalidation contract — both keys on success
  // -------------------------------------------------------------------------

  it('on success, invalidates both bookingQueryKeys.all and bookingQueryKeys.detail(id)', async () => {
    updateDocumentMock.mockResolvedValueOnce(undefined);
    const { wrapper, invalidateSpy } = makeHarness();

    const { useUpdateBookingStatus, bookingQueryKeys } = await import('../useBookings');
    const { result } = renderHook(() => useUpdateBookingStatus(), { wrapper });

    await result.current.mutateAsync({ bookingId: 'b-8', status: 'en_route' });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(2));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookingQueryKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: bookingQueryKeys.detail('b-8'),
    });
  });

  // -------------------------------------------------------------------------
  // Error path — callable rejection propagates
  // -------------------------------------------------------------------------

  it('propagates callable error so the caller sees the rejection (no silent swallow)', async () => {
    const err = new Error('failed-precondition: booking already cancelled');
    callFunctionMock.mockRejectedValueOnce(err);
    const { wrapper } = makeHarness();

    const { useUpdateBookingStatus } = await import('../useBookings');
    const { result } = renderHook(() => useUpdateBookingStatus(), { wrapper });

    await expect(
      result.current.mutateAsync({
        bookingId: 'b-9',
        status: 'cancelled',
        cancellationReason: 'late',
      }),
    ).rejects.toThrow(/failed-precondition/);
  });
});
