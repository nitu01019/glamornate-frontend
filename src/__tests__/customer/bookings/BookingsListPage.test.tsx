/**
 * SC-2 (Round 1) — `/customer/bookings` list rendering for the four
 * statuses actually produced by callables today: `confirmed`, `en_route`,
 * `completed`, `cancelled`. (`in_progress` and `no_show` are schema-declared
 * but unreachable in production; see design doc Section 2b.1.)
 *
 * Asserts, per fixture:
 *  1. status pill text matches `STATUS_LABEL`
 *  2. action button visibility — Cancel + Reschedule appear on every
 *     non-terminal status (`confirmed`, `en_route`); "Leave a Review" on
 *     `completed`; no action buttons on `cancelled`
 *  3. tab placement — `confirmed` / `en_route` land in Upcoming;
 *     `completed` lands in Past; `cancelled` lands in Cancelled
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BookingStatus } from '../../../types';
import type { BookingWithId } from '../../../hooks/useBookings';
import BookingsPage from '../../../app/customer/bookings/page';

// ---------------------------------------------------------------------------
// Mocks — declared before importing the page so module-eval picks them up.
// ---------------------------------------------------------------------------

vi.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({
    authResolved: true,
    firebaseUser: {
      uid: 'test-uid',
      email: 'test@example.com',
      phoneNumber: null,
      providerData: [{ providerId: 'password' }],
    },
    user: { role: 'customer' },
  }),
}));

vi.mock('@/hooks/useSpas', () => ({
  useSpa: (spaId: string) => ({
    data: { id: spaId, name: `Spa ${spaId}` },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useAvailability', () => ({
  useAvailableSlots: () => ({ data: { slots: [] }, isLoading: false }),
}));

const cancelMutateAsync = vi.fn();
const rescheduleMutateAsync = vi.fn();
const refetchMock = vi.fn();
const bookingsRef: { current: BookingWithId[] } = { current: [] };

vi.mock('@/hooks/useBookings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useBookings')>();
  // 2026-05-13: page now consumes `useBookingsRealtime` (Firestore onSnapshot
  // replacement for the React-Query one-shot path). Mock both surfaces so
  // legacy consumers (spa/admin pages still on `useBookings`) keep working
  // and the customer list page reads from `useBookingsRealtime`.
  const mockShape = () => ({
    data: bookingsRef.current,
    isLoading: false,
    isRefreshing: false,
    error: null,
    refetch: refetchMock,
  });
  return {
    ...actual,
    useBookings: () => mockShape(),
    useBookingsRealtime: () => mockShape(),
    useCancelBooking: () => ({
      mutateAsync: cancelMutateAsync,
      isPending: false,
    }),
    useRescheduleBooking: () => ({
      mutateAsync: rescheduleMutateAsync,
      isPending: false,
    }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBooking(args: {
  id: string;
  bookingStatus: BookingStatus;
  date: string;
  overrides?: Partial<BookingWithId>;
}): BookingWithId {
  const { id, bookingStatus, date, overrides } = args;
  return {
    id,
    userId: 'test-uid',
    spaId: 'spa_test',
    serviceIds: ['svc_1'],
    services: [
      {
        serviceId: 'svc_1',
        name: `Service for ${id}`,
        price: 1000,
        duration: 60,
        quantity: 1,
      },
    ],
    addons: [],
    slot: {
      date,
      start: '14:00',
      end: '15:00',
      duration: 60,
    },
    pricing: {
      services: 1000,
      addons: 0,
      tax: 180,
      discount: 0,
      platformFee: 50,
      total: 1230,
      currency: 'INR',
    },
    bookingStatus,
    statusHistory: [],
    customer: { name: 'Test User', phone: '+91 99999 99999' },
    isActive: bookingStatus !== 'cancelled',
    createdBy: 'customer',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    scheduledAt: `${date}T14:00:00Z`,
    ...overrides,
  } as BookingWithId;
}

function renderPage(): { user: ReturnType<typeof userEvent.setup> } {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <BookingsPage />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup() };
}

beforeEach(() => {
  cancelMutateAsync.mockReset();
  rescheduleMutateAsync.mockReset();
  refetchMock.mockReset();
  bookingsRef.current = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Date setup
// ---------------------------------------------------------------------------

// All "upcoming" fixtures use a far-future date so the `bookingDateStr >= todayStr`
// filter succeeds regardless of when the test runs. The "past" fixture uses a
// far-past date.
const FUTURE_DATE = '2099-01-15';
const PAST_DATE = '2000-01-15';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Status pill is a `<span>` inside the card; the tab bar uses `<button>` with
// the same word ("Cancelled"). Scope text queries to the span selector to
// avoid colliding with tab buttons.
function pillText(name: string): HTMLElement {
  return screen.getByText(name, { selector: 'span' });
}

function queryPillText(name: string): HTMLElement | null {
  return screen.queryByText(name, { selector: 'span' });
}

// 2026-05-13: the booking card was redesigned as an `<article>` element.
// We scope action-button queries via `within(card)` so the Reschedule dialog's
// own "Cancel" button (always mounted by Radix) doesn't pollute matches.
// Selector matches the article wrapper regardless of Tailwind class churn.
function getCardFor(serviceName: string): HTMLElement {
  const heading = screen.getByText(serviceName);
  const card = heading.closest('article');
  if (!card) {
    throw new Error(`No booking card found for service "${serviceName}"`);
  }
  return card as HTMLElement;
}

describe('BookingsListPage — SC-2 status rendering', () => {
  describe('Upcoming tab', () => {
    it('renders confirmed booking with status pill, Cancel + Reschedule buttons', () => {
      bookingsRef.current = [
        makeBooking({ id: 'b_confirmed', bookingStatus: 'confirmed', date: FUTURE_DATE }),
      ];
      renderPage();

      expect(pillText('Confirmed')).toBeInTheDocument();
      const card = getCardFor('Service for b_confirmed');
      expect(within(card).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
      // Past-only CTA must NOT render.
      expect(within(card).queryByRole('link', { name: /leave a review/i })).toBeNull();
    });

    it('renders en_route booking with "On the way" pill, Cancel + Reschedule buttons', () => {
      bookingsRef.current = [
        makeBooking({ id: 'b_en_route', bookingStatus: 'en_route', date: FUTURE_DATE }),
      ];
      renderPage();

      expect(pillText('On the way')).toBeInTheDocument();
      const card = getCardFor('Service for b_en_route');
      // Cancel + Reschedule must remain available for non-terminal en_route —
      // see design doc §2b.1 (en_route is the second produced non-terminal).
      expect(within(card).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
    });

    it('does NOT render completed booking under Upcoming', () => {
      bookingsRef.current = [
        makeBooking({ id: 'b_completed', bookingStatus: 'completed', date: PAST_DATE }),
      ];
      renderPage();
      // "Completed" is never a tab name, so a span-scoped query is safe.
      expect(queryPillText('Completed')).toBeNull();
    });
  });

  describe('Past tab', () => {
    it('renders completed booking under Past with "Leave a Review" CTA, no Cancel button', async () => {
      bookingsRef.current = [
        makeBooking({ id: 'b_completed', bookingStatus: 'completed', date: PAST_DATE }),
      ];
      const { user } = renderPage();
      await user.click(screen.getByRole('button', { name: /^Past$/ }));

      expect(pillText('Completed')).toBeInTheDocument();
      const card = getCardFor('Service for b_completed');
      const reviewLink = within(card).getByRole('link', { name: /leave a review/i });
      expect(reviewLink).toBeInTheDocument();
      expect(reviewLink).toHaveAttribute('href', '/spas/spa_test/review?booking=b_completed');
      expect(within(card).queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(within(card).queryByRole('button', { name: /reschedule/i })).toBeNull();
    });
  });

  describe('Cancelled tab', () => {
    it('renders cancelled booking under Cancelled with "Cancelled" pill, no action buttons', async () => {
      bookingsRef.current = [
        makeBooking({ id: 'b_cancelled', bookingStatus: 'cancelled', date: FUTURE_DATE }),
      ];
      const { user } = renderPage();
      await user.click(screen.getByRole('button', { name: /^Cancelled$/ }));

      expect(pillText('Cancelled')).toBeInTheDocument();
      const card = getCardFor('Service for b_cancelled');
      // Terminal — no Cancel / Reschedule / Leave a Review affordances.
      expect(within(card).queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(within(card).queryByRole('button', { name: /reschedule/i })).toBeNull();
      expect(within(card).queryByRole('link', { name: /leave a review/i })).toBeNull();
    });
  });

  describe('Tab placement (all 4 produced statuses)', () => {
    it('routes each booking to its correct tab', async () => {
      bookingsRef.current = [
        makeBooking({ id: 'b_confirmed', bookingStatus: 'confirmed', date: FUTURE_DATE }),
        makeBooking({ id: 'b_en_route', bookingStatus: 'en_route', date: FUTURE_DATE }),
        makeBooking({ id: 'b_completed', bookingStatus: 'completed', date: PAST_DATE }),
        makeBooking({ id: 'b_cancelled', bookingStatus: 'cancelled', date: FUTURE_DATE }),
      ];
      const { user } = renderPage();

      // Upcoming: confirmed + en_route, NOT completed/cancelled.
      const upcomingPills = screen
        .queryAllByText(/Confirmed|On the way/, { selector: 'span' });
      expect(upcomingPills.length).toBe(2);
      expect(queryPillText('Completed')).toBeNull();
      expect(queryPillText('Cancelled')).toBeNull();

      // Past: completed only.
      await user.click(screen.getByRole('button', { name: /^Past$/ }));
      expect(pillText('Completed')).toBeInTheDocument();
      expect(queryPillText('Confirmed')).toBeNull();
      expect(queryPillText('On the way')).toBeNull();
      expect(queryPillText('Cancelled')).toBeNull();

      // Cancelled: cancelled only.
      await user.click(screen.getByRole('button', { name: /^Cancelled$/ }));
      expect(pillText('Cancelled')).toBeInTheDocument();
      expect(queryPillText('Confirmed')).toBeNull();
      expect(queryPillText('On the way')).toBeNull();
      expect(queryPillText('Completed')).toBeNull();
    });
  });

  describe('Cancel mutation wiring', () => {
    it('clicking Cancel on a confirmed booking opens the dialog and calls mutate', async () => {
      cancelMutateAsync.mockResolvedValueOnce(undefined);
      bookingsRef.current = [
        makeBooking({ id: 'b1', bookingStatus: 'confirmed', date: FUTURE_DATE }),
      ];
      const { user } = renderPage();

      const card = getCardFor('Service for b1');
      await user.click(within(card).getByRole('button', { name: 'Cancel' }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: /cancel booking/i }));

      expect(cancelMutateAsync).toHaveBeenCalledWith({
        bookingId: 'b1',
        reason: 'Cancelled by customer',
      });
    });
  });
});
