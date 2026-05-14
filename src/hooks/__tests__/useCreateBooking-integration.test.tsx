/**
 * Integration test for `useCreateBooking` → `createBookingDraft` callable flow.
 *
 * Phase 3.7 (Test 3) — locks the canonical wire shape passed from the customer
 * book-new screen through the hook into the Cloud Function callable, plus the
 * post-success cache-invalidation contract that drives the BottomNav badge +
 * dashboard widget refetch.
 *
 * Routing contract (per `useBookings.ts:298-318`):
 *   useCreateBooking().mutateAsync(input) →
 *     firebaseClientWrapper.callFunction('createBookingDraft', input) →
 *     onSuccess: queryClient.invalidateQueries({ queryKey: bookingQueryKeys.all })
 *
 * Wave 1b note (`useBookings.ts:80-90`): the callable returns ONLY
 * `{ bookingId }` — no Stripe `clientSecret`, `paymentIntentId`, `amount`, or
 * `currency`. The hook MUST forward this shape verbatim.
 *
 * Mirrors the mock pattern in `useUpcomingBookings.test.tsx:26-71` and
 * `useUpdateBookingStatus.test.tsx:28-84`.
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
    firebaseUser: { uid: 'customer-uid' },
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
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
  },
  QueryConstraintConfig: {},
}));

const sentryAddBreadcrumbMock = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: (...args: unknown[]) => sentryAddBreadcrumbMock(...args),
  captureException: vi.fn(),
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

// Canonical input shape produced by the customer book-new wizard
// (`frontend/src/app/customer/book-new/page.tsx`). Mirrors `CreateBookingInput`
// at `useBookings.ts:60-71` and the `Slot` interface at
// `frontend/src/types/index.ts:250-255`.
const canonicalInput = {
  spaId: 'spa-abc',
  serviceIds: ['svc-1', 'svc-2'],
  services: [
    { serviceId: 'svc-1', serviceName: 'Swedish Massage', price: 1500, quantity: 1 },
    { serviceId: 'svc-2', serviceName: 'Aromatherapy', price: 800, quantity: 1 },
  ],
  therapistId: 'th-9',
  slot: {
    date: '2027-06-15',
    start: '10:00',
    end: '11:30',
    duration: 90,
  },
  addonIds: ['addon-1'],
  customer: {
    name: 'Test Customer',
    phone: '+91-9999999999',
    email: 'test@example.com',
  },
  notes: 'First-timer',
  specialRequests: 'Window seat',
};
// Phase 3.7 typecheck-fix (lead session, 2026-05-08): the original
// `as const` made `serviceIds` a readonly tuple, which clashes with
// `CreateBookingInput.serviceIds: string[]` (mutable). Dropping `as const`
// keeps the literal-shape inference loose enough for the canonical input
// to be assignable. The test still passes the same payload object;
// only the static type narrowing changed.

beforeEach(() => {
  callFunctionMock.mockReset();
  sentryAddBreadcrumbMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Wire shape — callable invoked with canonical input forwarded verbatim
// ---------------------------------------------------------------------------

describe('useCreateBooking → createBookingDraft callable (Phase 3.7, Test 3)', () => {
  it('invokes createBookingDraft callable exactly once with the canonical input shape', async () => {
    callFunctionMock.mockResolvedValueOnce({ bookingId: 'b-1' });
    const { wrapper } = makeHarness();

    const { useCreateBooking } = await import('../useBookings');
    const { result } = renderHook(() => useCreateBooking(), { wrapper });

    const response = await result.current.mutateAsync(canonicalInput);

    expect(response).toEqual({ bookingId: 'b-1' });
    expect(callFunctionMock).toHaveBeenCalledTimes(1);
    expect(callFunctionMock).toHaveBeenCalledWith('createBookingDraft', canonicalInput);

    // Locks Wave 1b contract (`useBookings.ts:80-90`) — response payload is
    // exactly `{ bookingId }`, no Stripe-era fields.
    const payload = callFunctionMock.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(
      [
        'addonIds',
        'customer',
        'notes',
        'serviceIds',
        'services',
        'slot',
        'spaId',
        'specialRequests',
        'therapistId',
      ].sort(),
    );
  });

  it('preserves the canonical Slot shape — { date, start, end, duration } — through the wire', async () => {
    // Slot is the field most likely to silently drift (it's the only nested
    // structured value the BE consumes for overlap detection at
    // `backend/functions/src/callable/createBooking.ts:173`). Lock its shape
    // so a refactor to the wizard form does not strip a field.
    callFunctionMock.mockResolvedValueOnce({ bookingId: 'b-2' });
    const { wrapper } = makeHarness();

    const { useCreateBooking } = await import('../useBookings');
    const { result } = renderHook(() => useCreateBooking(), { wrapper });

    await result.current.mutateAsync(canonicalInput);

    const payload = callFunctionMock.mock.calls[0][1] as { slot: Record<string, unknown> };
    expect(payload.slot).toEqual({
      date: '2027-06-15',
      start: '10:00',
      end: '11:30',
      duration: 90,
    });
  });

  it('forwards minimal input (no optional fields) without injecting undefined keys', async () => {
    // The book-new wizard builds the payload conditionally (e.g. therapistId
    // is only set if the user chose one). The hook must NOT add undefined
    // values; a callable Zod validator that uses `.strict()` would reject
    // an `undefined` therapistId where it expected the key to be absent.
    callFunctionMock.mockResolvedValueOnce({ bookingId: 'b-3' });
    const { wrapper } = makeHarness();

    const minimal = {
      spaId: 'spa-min',
      serviceIds: ['svc-1'],
      slot: {
        date: '2027-07-01',
        start: '14:00',
        end: '15:00',
        duration: 60,
      },
    };

    const { useCreateBooking } = await import('../useBookings');
    const { result } = renderHook(() => useCreateBooking(), { wrapper });

    await result.current.mutateAsync(minimal);

    expect(callFunctionMock).toHaveBeenCalledWith('createBookingDraft', minimal);
    const payload = callFunctionMock.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(payload, 'therapistId')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, 'addonIds')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, 'customer')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Cache invalidation contract — bookingQueryKeys.all on success
  // -------------------------------------------------------------------------

  it('on success, invalidates bookingQueryKeys.all so list/upcoming/history refetch', async () => {
    callFunctionMock.mockResolvedValueOnce({ bookingId: 'b-4' });
    const { wrapper, invalidateSpy } = makeHarness();

    const { useCreateBooking, bookingQueryKeys } = await import('../useBookings');
    const { result } = renderHook(() => useCreateBooking(), { wrapper });

    await result.current.mutateAsync(canonicalInput);

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(1));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookingQueryKeys.all });

    // `bookingQueryKeys.all === ['bookings']` — invalidating this prefix
    // matches every list/detail/history sub-key per react-query semantics
    // (`useBookings.ts:96-105`).
    expect(bookingQueryKeys.all).toEqual(['bookings']);
  });

  // -------------------------------------------------------------------------
  // Error path — callable rejection propagates, no invalidation
  // -------------------------------------------------------------------------

  it('propagates callable error and does NOT invalidate cache on failure', async () => {
    const err = new Error('failed-precondition: slot already booked');
    callFunctionMock.mockRejectedValueOnce(err);
    const { wrapper, invalidateSpy } = makeHarness();

    const { useCreateBooking } = await import('../useBookings');
    const { result } = renderHook(() => useCreateBooking(), { wrapper });

    await expect(result.current.mutateAsync(canonicalInput)).rejects.toThrow(/failed-precondition/);

    // `onSuccess` must NOT fire — otherwise the dashboard would show a
    // refetch spinner for a booking that was never created.
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Bonus: Sentry breadcrumb scope (per teammate brief)
  // -------------------------------------------------------------------------
  //
  // Note: `useCreateBooking` itself does NOT call Sentry directly — Sentry
  // breadcrumbs are added inside `firebaseClientWrapper.callFunction` (see
  // `firebase-client-wrapper.ts:447, 501, 567`) on three paths:
  //   1. App Check token missing in production (`:447`)
  //   2. Callable error (`:501`)
  //   3. Firestore-read error (`:567`)
  // None of these fire on the hook's success path with a fully-mocked
  // wrapper. The assertion below locks the contract that this hook itself
  // does not duplicate breadcrumbs at the React-Query layer (the breadcrumb
  // belongs ONE place — the wrapper — to avoid double-counting in Sentry).

  it('hook adds NO Sentry breadcrumb directly on success (wrapper owns that surface)', async () => {
    callFunctionMock.mockResolvedValueOnce({ bookingId: 'b-5' });
    const { wrapper } = makeHarness();

    const { useCreateBooking } = await import('../useBookings');
    const { result } = renderHook(() => useCreateBooking(), { wrapper });

    await result.current.mutateAsync(canonicalInput);

    // The hook layer must not push breadcrumbs — that responsibility lives
    // in `firebaseClientWrapper.callFunction`. With a fully-mocked wrapper
    // there are zero breadcrumb calls observable from the hook.
    expect(sentryAddBreadcrumbMock).not.toHaveBeenCalled();
  });
});
