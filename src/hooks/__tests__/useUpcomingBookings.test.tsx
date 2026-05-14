/**
 * Tests for `useUpcomingBookings` and `useBookingHistory`.
 *
 * SC-10 / V-8: `useUpcomingBookings` powers the BottomNav badge and dashboard
 * widget. Before this fix it filtered to `bookingStatus === 'confirmed'` only,
 * so a customer mid-service (status `en_route` or `in_progress`) saw "0
 * upcoming" in the navigation. The fix expands the filter to all non-terminal
 * statuses produced by callables today, plus `in_progress` (canonical per
 * shared/contracts/booking.ts).
 *
 * SC-2 future-proof: `useBookingHistory` filtered `['completed','cancelled']`
 * via Firestore `where bookingStatus in [...]`. When V-5 ships in Round 2 the
 * BE will start writing `no_show` as a terminal status; locking this filter
 * forward avoids a regression at that point.
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

const getDocumentsMock = vi.fn();

vi.mock('@/lib/firebase-client-wrapper', () => ({
  firebaseClientWrapper: {
    getDocuments: (...args: unknown[]) => getDocumentsMock(...args),
  },
  // Re-export type as a runtime no-op object — only the type is used at compile time
  QueryConstraintConfig: {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper(): (props: { children: ReactNode }) => ReactNode {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  getDocumentsMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// useUpcomingBookings (SC-10 / V-8)
// ---------------------------------------------------------------------------

describe('useUpcomingBookings (SC-10 / V-8)', () => {
  it('includes confirmed, en_route, AND in_progress; excludes completed/cancelled', async () => {
    // Hook fetches WITHOUT a status filter (we filter client-side now), so the
    // data source returns every booking and the hook narrows it down.
    getDocumentsMock.mockResolvedValueOnce({
      documents: [
        { id: 'b1', data: { bookingStatus: 'confirmed', userId: 'test-uid', createdAt: 1 } },
        { id: 'b2', data: { bookingStatus: 'en_route', userId: 'test-uid', createdAt: 2 } },
        { id: 'b3', data: { bookingStatus: 'in_progress', userId: 'test-uid', createdAt: 3 } },
        { id: 'b4', data: { bookingStatus: 'completed', userId: 'test-uid', createdAt: 4 } },
        { id: 'b5', data: { bookingStatus: 'cancelled', userId: 'test-uid', createdAt: 5 } },
      ],
    });

    const { useUpcomingBookings } = await import('../useBookings');
    const { result } = renderHook(() => useUpcomingBookings(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const ids = (result.current.data ?? []).map((b) => b.id).sort();
    expect(ids).toEqual(['b1', 'b2', 'b3']);
  });

  it('excludes legacy/unknown statuses (filter is allow-list, not deny-list)', async () => {
    getDocumentsMock.mockResolvedValueOnce({
      documents: [
        { id: 'a1', data: { bookingStatus: 'confirmed', userId: 'test-uid', createdAt: 1 } },
        { id: 'a2', data: { bookingStatus: 'pending', userId: 'test-uid', createdAt: 2 } },
        { id: 'a3', data: { bookingStatus: 'draft', userId: 'test-uid', createdAt: 3 } },
        { id: 'a4', data: { bookingStatus: undefined, userId: 'test-uid', createdAt: 4 } },
      ],
    });

    const { useUpcomingBookings } = await import('../useBookings');
    const { result } = renderHook(() => useUpcomingBookings(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((result.current.data ?? []).map((b) => b.id)).toEqual(['a1']);
  });
});

// ---------------------------------------------------------------------------
// useBookingHistory (SC-2 future-proof)
// ---------------------------------------------------------------------------

describe('useBookingHistory (SC-2 future-proof)', () => {
  it('passes a `bookingStatus in [completed, cancelled, no_show]` constraint', async () => {
    getDocumentsMock.mockResolvedValueOnce({ documents: [] });

    const { useBookingHistory } = await import('../useBookings');
    const { result } = renderHook(() => useBookingHistory(20), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Inspect the query constraints sent to Firestore. The `in` operator
    // value MUST include `no_show` so future BE writes (post-V-5) appear in
    // history without a follow-up FE change.
    expect(getDocumentsMock).toHaveBeenCalledTimes(1);
    const [collection, constraints] = getDocumentsMock.mock.calls[0] as [
      string,
      Array<{ type: string; field?: string; operator?: string; value?: unknown }>,
    ];
    expect(collection).toBe('bookings');

    const statusConstraint = constraints.find(
      (c) => c.type === 'where' && c.field === 'bookingStatus' && c.operator === 'in',
    );
    expect(statusConstraint).toBeDefined();
    expect(statusConstraint?.value).toEqual(['completed', 'cancelled', 'no_show']);
  });

  it('returns no_show bookings alongside completed and cancelled', async () => {
    getDocumentsMock.mockResolvedValueOnce({
      documents: [
        { id: 'h1', data: { bookingStatus: 'completed', userId: 'test-uid', updatedAt: 3 } },
        { id: 'h2', data: { bookingStatus: 'cancelled', userId: 'test-uid', updatedAt: 2 } },
        { id: 'h3', data: { bookingStatus: 'no_show', userId: 'test-uid', updatedAt: 1 } },
      ],
    });

    const { useBookingHistory } = await import('../useBookings');
    const { result } = renderHook(() => useBookingHistory(20), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const ids = (result.current.data ?? []).map((b) => b.id).sort();
    expect(ids).toEqual(['h1', 'h2', 'h3']);
  });
});
