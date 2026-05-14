'use client';

/**
 * Booking Hooks - React Query hooks for booking data access
 * Provides data fetching, mutations, and real-time updates for bookings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { firebaseClientWrapper, QueryConstraintConfig } from '@/lib/firebase-client-wrapper';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-provider';
import { parseError, AppError, AppCheckError, AuthError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import type { Booking, BookingStatus, Slot, CustomerInfo } from '@/types';

// =============================================================================
// Module-level loggers (stable references — do not recreate inside hook bodies)
// =============================================================================

const bookingsLogger = logger.child({ component: 'useBookings' });
const bookingLogger = logger.child({ component: 'useBooking' });
const createBookingLogger = logger.child({ component: 'useCreateBooking' });
const cancelBookingLogger = logger.child({ component: 'useCancelBooking' });
const rescheduleBookingLogger = logger.child({ component: 'useRescheduleBooking' });
const bookingRealtimeLogger = logger.child({ component: 'useBookingRealtime' });
const bookingHistoryLogger = logger.child({ component: 'useBookingHistory' });
const updateBookingStatusLogger = logger.child({ component: 'useUpdateBookingStatus' });

// =============================================================================
// Types
// =============================================================================

export interface BookingWithId extends Booking {
  id: string;
}

export interface BookingFilters {
  /** Filter by user ID (defaults to current user for customers) */
  userId?: string;
  /** Filter by spa ID */
  spaId?: string;
  /** Filter by booking status */
  status?: BookingStatus;
  /** Filter from date */
  dateFrom?: string;
  /** Filter to date */
  dateTo?: string;
  /** Maximum results */
  limit?: number;
}

export interface ServiceItem {
  serviceId: string;
  serviceName?: string;
  price: number;
  quantity?: number;
}

export interface CreateBookingInput {
  spaId: string;
  serviceIds: string[];
  services?: ServiceItem[];
  therapistId?: string;
  slot: Slot;
  addonIds?: string[];
  customer?: CustomerInfo;
  notes?: string;
  specialRequests?: string;
  [key: string]: unknown;
}

export interface RescheduleBookingInput {
  bookingId: string;
  newSlot: Slot;
  therapistId?: string;
  [key: string]: unknown;
}

/**
 * Wave 1b (2026-05-02): the backend `createBookingDraft` callable now writes
 * the booking directly with `bookingStatus: 'confirmed'` (pay-at-spa). It no
 * longer returns a Stripe `clientSecret`, `paymentIntentId`, `amount`, or
 * `currency` — only the Firestore `bookingId`. The booking detail document is
 * the source of truth for amount + status; clients read it through
 * `useBooking` / `useBookingRealtime`.
 */
export interface CreateBookingResponse {
  bookingId: string;
}

// =============================================================================
// Query Keys
// =============================================================================

export const bookingQueryKeys = {
  all: ['bookings'] as const,
  lists: () => [...bookingQueryKeys.all, 'list'] as const,
  list: (filters?: BookingFilters) => [...bookingQueryKeys.lists(), filters] as const,
  details: () => [...bookingQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...bookingQueryKeys.details(), id] as const,
  // userBookings query key removed in Phase 5 (Booking Flow Fix v3.1,
  // 2026-05-02) — never had a consumer; the list/detail keys cover every
  // active read path.
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Fetch list of bookings with optional filtering
 * Customers automatically see only their own bookings
 *
 * @param filters - Optional filters for status, spa, date range
 * @returns Query result with booking list
 *
 * @example
 * ```tsx
 * const { data: bookings } = useBookings({ status: 'confirmed' });
 * ```
 */
export function useBookings(filters?: BookingFilters) {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;

  const query = useQuery({
    // 2026-05-13: include `uid` in the queryKey so a cached failure / empty
    // result from a prior (or anonymous) session cannot bleed into the next
    // signed-in user. Pre-fix, the key was `['bookings','list',filters]` —
    // shared across uids — and a single race-window failure (see below)
    // would lock the bookings list to "empty" for the rest of the session.
    queryKey: [...bookingQueryKeys.list(filters), uid ?? null],
    // 2026-05-13: gate on `uid` alone — the legacy `enabled: !!firebaseUser`
    // fired the query before `user` (the Firestore profile) had resolved,
    // and the queryFn's `user?.role === 'customer'` gate then silently
    // dropped the `where userId == auth.uid` filter, producing a cached
    // empty/error result. The fix is two-fold: (1) the queryKey now
    // includes `uid` so a swap between sessions invalidates the cache, and
    // (2) the queryFn below always adds the userId filter when no override
    // is supplied — independent of `user.role`. With the filter always
    // present, gating `enabled` on `user` is unnecessary and (worse)
    // wedges the hook into a non-subscribing state during the brief
    // pre-profile window that meant a successful `refetch()` after that
    // window still failed to propagate fresh data to the component.
    enabled: !!uid,
    // Phase 6 (Booking Flow Fix v3.1, 2026-05-02): aggressively refresh on
    // mount + reconnect so a returning APK user sees fresh bookings even
    // after a long background. `refetchOnWindowFocus: false` because
    // Capacitor WebView frequently fires spurious focus events on
    // visibility cycles.
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<BookingWithId[]> => {
      if (!isFirebaseConfigured()) {
        bookingsLogger.debug('Firebase not configured, returning empty booking list');
        return [];
      }

      try {
        const constraints: QueryConstraintConfig[] = [];

        // 2026-05-13: ALWAYS add a userId filter when no explicit `filters.userId`
        // override is provided. Pre-fix this was gated on
        // `user?.role === 'customer'`, but that races against the auth
        // listener splitting `setFirebaseUser` and `setUser` across an
        // `await` (see auth/provider/auth-listener.ts:80–145). The bookings
        // list page is wrapped in `<ProtectedRoute requiredRoles=['customer']>`
        // (bookings/page.tsx:638), so by the time this hook is *consumed*
        // we know the caller is a customer; the Firestore security rule
        // (bookings/{id} allow read: resource.data.userId == auth.uid …)
        // enforces the owner/staff/admin matrix per-doc regardless. The
        // explicit `filters.userId` branch still wins so admin / spa-owner
        // call-sites can target other users when they have rule coverage.
        if (filters?.userId) {
          constraints.push({
            type: 'where',
            field: 'userId',
            operator: '==',
            value: filters.userId,
          });
        } else if (uid) {
          constraints.push({
            type: 'where',
            field: 'userId',
            operator: '==',
            value: uid,
          });
        }

        if (filters?.spaId) {
          constraints.push({
            type: 'where',
            field: 'spaId',
            operator: '==',
            value: filters.spaId,
          });
        }

        if (filters?.status) {
          constraints.push({
            type: 'where',
            field: 'bookingStatus',
            operator: '==',
            value: filters.status,
          });
        }

        // Add ordering
        constraints.push({
          type: 'orderBy',
          field: 'createdAt',
          direction: 'desc',
        });

        if (filters?.limit) {
          constraints.push({
            type: 'limit',
            count: filters.limit,
          });
        }

        const result = await firebaseClientWrapper.getDocuments<Booking>('bookings', constraints);

        return result.documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        bookingsLogger.error('Failed to fetch bookings', error, { filters });
        throw parseError(error);
      }
    },
    staleTime: 0, // always refetch — bookings are real-time
  });

  return query;
}

/**
 * Fetch a single booking by ID
 *
 * @param bookingId - The booking document ID
 * @returns Query result with booking details
 *
 * @example
 * ```tsx
 * const { data: booking } = useBooking('booking-123');
 * ```
 */
export function useBooking(bookingId: string | null | undefined) {
  const hooksLogger = bookingLogger;

  return useQuery({
    queryKey: bookingQueryKeys.detail(bookingId ?? ''),
    queryFn: async (): Promise<BookingWithId | null> => {
      if (!bookingId) return null;

      if (!isFirebaseConfigured()) {
        hooksLogger.debug('Firebase not configured, returning null booking');
        return null;
      }

      try {
        const result = await firebaseClientWrapper.getDocument<Booking>('bookings', bookingId);

        if (!result) {
          return null;
        }

        return {
          id: result.id,
          ...result.data,
        };
      } catch (error) {
        hooksLogger.error('Failed to fetch booking', error, { bookingId });
        throw parseError(error);
      }
    },
    enabled: !!bookingId,
    staleTime: 0, // always refetch — booking detail is real-time
  });
}

/**
 * Retry classifier shared by every booking-flow mutation. App Check rejections
 * and auth failures are NEVER retried (they don't recover in 500ms — the user
 * needs operator action / re-login). Transient FirebaseError codes are retried
 * up to 2x with exponential backoff, matching the global default at
 * `providers.tsx`. Anything else surfaces immediately so the caller can render
 * a single, kind-specific toast instead of the user watching three identical
 * "Network request failed" toasts.
 */
function bookingMutationShouldRetry(failureCount: number, error: unknown): boolean {
  const appError = parseError(error);
  if (appError instanceof AppCheckError) return false;
  if (appError instanceof AuthError) return false;
  if (!appError.isRetryable) return false;
  return failureCount < 2;
}

function bookingMutationRetryDelay(attemptIndex: number): number {
  return Math.min(500 * 2 ** attemptIndex, 4000);
}

/**
 * Create a new booking
 * Calls the createBookingDraft callable function (legacy name — Wave 1b kept
 * the existing function id to avoid renaming the deployed callable; despite
 * the name the booking is now written immediately as 'confirmed').
 *
 * Wave 1b (2026-05-02): Stripe online-payment surface removed. The callable
 * returns only the Firestore `bookingId`. There is no PaymentIntent step, no
 * `clientSecret`, no separate confirm-after-payment hook.
 *
 * @returns Mutation for creating booking
 *
 * @example
 * ```tsx
 * const { mutate: createBooking } = useCreateBooking();
 * createBooking({ spaId: '...', serviceIds: [...], slot: {...} });
 * ```
 */
export function useCreateBooking() {
  const queryClient = useQueryClient();
  const hooksLogger = createBookingLogger;

  return useMutation({
    mutationFn: async (data: CreateBookingInput): Promise<CreateBookingResponse> => {
      hooksLogger.info('Creating booking', { spaId: data.spaId });

      const result = await firebaseClientWrapper.callFunction<
        CreateBookingInput,
        CreateBookingResponse
      >('createBookingDraft', data);

      return result;
    },
    retry: bookingMutationShouldRetry,
    retryDelay: bookingMutationRetryDelay,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingQueryKeys.all });
    },
    onError: (error) => {
      hooksLogger.error('Booking creation failed', error);
    },
  });
}

// Wave 1b (2026-05-02): `useConfirmBooking` and `useCreatePaymentIntent` were
// removed along with the Stripe online-payment surface. Booking creation now
// commits to `bookingStatus: 'confirmed'` in a single round-trip via
// `useCreateBooking` above. Re-introduce here only if a new payment-collection
// surface is added; do NOT shim the old hooks back as no-ops — Wave 4 W4-C
// rewrote `book-new/page.tsx` to consume only `useCreateBooking`.

/**
 * Cancel a booking
 * Calls the cancelBooking callable function
 *
 * @returns Mutation for cancelling booking
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();
  const hooksLogger = cancelBookingLogger;

  return useMutation({
    mutationFn: async (data: {
      bookingId: string;
      reason: string;
    }): Promise<{ success: boolean; refundAmount?: number }> => {
      hooksLogger.info('Cancelling booking', { bookingId: data.bookingId });

      return firebaseClientWrapper.callFunction('cancelBooking', data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: bookingQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: bookingQueryKeys.detail(variables.bookingId),
      });
    },
    onError: (error) => {
      hooksLogger.error('Booking cancellation failed', error);
    },
  });
}

/**
 * Reschedule a booking
 * Calls the rescheduleBooking callable function
 *
 * @returns Mutation for rescheduling booking
 */
export function useRescheduleBooking() {
  const queryClient = useQueryClient();
  const hooksLogger = rescheduleBookingLogger;

  return useMutation({
    mutationFn: async (data: RescheduleBookingInput): Promise<{ success: boolean }> => {
      hooksLogger.info('Rescheduling booking', { bookingId: data.bookingId });

      return firebaseClientWrapper.callFunction('rescheduleBooking', data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: bookingQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: bookingQueryKeys.detail(variables.bookingId),
      });
    },
    onError: (error) => {
      hooksLogger.error('Booking reschedule failed', error);
    },
  });
}

/**
 * Real-time booking status subscription
 * Uses Firestore onSnapshot for live updates
 *
 * @param bookingId - The booking document ID
 * @returns Booking data with real-time updates
 *
 * @example
 * ```tsx
 * const booking = useBookingRealtime('booking-123');
 * // booking updates automatically when status changes
 * ```
 */
export function useBookingRealtime(bookingId: string | null | undefined): BookingWithId | null {
  const [booking, setBooking] = useState<BookingWithId | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `_error` is captured for future surface (toast/telemetry) but read-side consumers not yet wired; keep setter to avoid silent failures
  const [_error, setError] = useState<AppError | null>(null);
  const hooksLogger = bookingRealtimeLogger;

  useEffect(() => {
    if (!bookingId || !isFirebaseConfigured()) {
      setBooking(null);
      return;
    }

    hooksLogger.debug('Setting up real-time subscription', { bookingId });

    const unsubscribe = firebaseClientWrapper.subscribeToDocument<Booking>(
      'bookings',
      bookingId,
      (data, err) => {
        if (err) {
          hooksLogger.error('Real-time subscription error', err, { bookingId });
          setError(err);
          return;
        }

        if (data) {
          setBooking({
            id: data.id,
            ...data.data,
          });
        } else {
          setBooking(null);
        }
      },
    );

    return () => {
      hooksLogger.debug('Cleaning up real-time subscription', { bookingId });
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hooksLogger is a stable module-scoped reference (module-singleton); including it would re-subscribe on every render
  }, [bookingId]); // hooksLogger is a stable module-scoped reference

  return booking;
}

// =============================================================================
// Realtime list subscription
// =============================================================================

export interface UseBookingsRealtimeResult {
  /** Current snapshot of the user's bookings. `null` until first snapshot. */
  data: BookingWithId[] | null;
  /** True before the first snapshot arrives (initial subscribe). */
  isLoading: boolean;
  /** Re-subscribing in response to a manual refresh or uid change. */
  isRefreshing: boolean;
  /** Latest error from the listener, classified as AppError / AppCheckError. */
  error: AppError | null;
  /** Tear down + re-establish the subscription. Cheap. */
  refetch(): void;
}

/**
 * Real-time subscription to the signed-in customer's bookings.
 *
 * Why this exists (2026-05-13): the one-shot React-Query path used to power
 * the bookings list (`useBookings()`) hung in `status: pending, fetchStatus:
 * idle` on Android cold-start — `PersistQueryClientProvider`'s restore
 * promise wedges on Capacitor (the `Preferences.then() is not implemented on
 * android` error surfaces from a sibling code path and the persist client
 * never flips `isRestoring: false`), so `refetchOnMount: 'always'` silently
 * never fires. The user had to manually tap Refresh to see their bookings.
 *
 * Real-time subscription via Firestore `onSnapshot` is both (a) the right
 * architecture for "I just booked, it should appear instantly" UX and (b)
 * independent of React-Query's lifecycle gates, so the auto-fetch hang is
 * structurally impossible here. Server-side state changes (a spa cancels
 * the booking, status transitions to en_route / in_progress, reschedule
 * via console) all propagate to the customer's list within a few hundred
 * milliseconds.
 *
 * The hook mirrors the shape of `useBookings()` so the page-level branches
 * (`isLoading` → skeleton, `error` → error UI, `data` → cards) don't change
 * meaningfully. `refetch()` tears down and re-establishes the listener;
 * useful when the Capacitor WebView resumes from background and the
 * listener may have been suspended.
 */
export function useBookingsRealtime(): UseBookingsRealtimeResult {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [data, setData] = useState<BookingWithId[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  // Bumping this triggers a re-subscribe via the useEffect dependency.
  const [refreshKey, setRefreshKey] = useState(0);
  const hooksLogger = bookingsLogger;

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      setData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading((prev) => (data === null ? true : prev));
    setIsRefreshing(data !== null);
    setError(null);

    const constraints: QueryConstraintConfig[] = [
      { type: 'where', field: 'userId', operator: '==', value: uid },
      { type: 'orderBy', field: 'createdAt', direction: 'desc' },
    ];

    const unsubscribe = firebaseClientWrapper.subscribeToQuery<Booking>(
      'bookings',
      constraints,
      (documents, err) => {
        if (err) {
          hooksLogger.error('Realtime bookings subscription error', err, { uid });
          setError(err);
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }
        setData(documents.map((doc) => ({ id: doc.id, ...doc.data })));
        setError(null);
        setIsLoading(false);
        setIsRefreshing(false);
      },
    );

    return () => {
      try {
        unsubscribe();
      } catch (cleanupErr) {
        hooksLogger.warn('Realtime bookings unsubscribe threw', { uid, cleanupErr });
      }
    };
    // `data` intentionally omitted: it would re-subscribe on every snapshot.
    // The refreshKey bump is the manual re-subscribe trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, refreshKey]);

  const refetch = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { data, isLoading, isRefreshing, error, refetch };
}

/**
 * Non-terminal statuses surfaced as "upcoming" to the customer (SC-10 / V-8).
 *
 * Server-side `where bookingStatus in [...]` would force a query rewrite; the
 * existing `useBookings` hook only supports `==`. Filtering client-side keeps
 * a single shared query while letting the BottomNav badge + dashboard widget
 * include a customer who is already mid-service (`en_route`, `in_progress`).
 */
const UPCOMING_STATUSES = ['confirmed', 'en_route', 'in_progress'] as const;

/**
 * Fetch user's upcoming bookings
 * Convenience hook for getting all non-terminal bookings (confirmed,
 * en_route, in_progress). Closes V-8 — pre-fix the BottomNav badge showed
 * "0 upcoming" for a customer mid-service.
 *
 * @returns Query result with upcoming bookings (filtered client-side)
 */
export function useUpcomingBookings() {
  const { firebaseUser } = useAuth();

  // Limit raised from 10 → 30 to compensate for client-side filtering: the
  // server now returns the user's most-recent 30 bookings of any status, and
  // we narrow to non-terminal here. 30 is comfortably above the practical
  // ceiling of concurrent active bookings per customer.
  const query = useBookings({
    userId: firebaseUser?.uid,
    limit: 30,
  });

  const data = useMemo(
    () =>
      (query.data ?? []).filter(
        (b) =>
          typeof b.bookingStatus === 'string' &&
          (UPCOMING_STATUSES as readonly string[]).includes(b.bookingStatus),
      ),
    [query.data],
  );

  return { ...query, data };
}

/**
 * Fetch user's booking history (completed/cancelled)
 *
 * @param limitCount - Maximum number of results
 * @returns Query result with past bookings
 */
export function useBookingHistory(limitCount: number = 20) {
  const { firebaseUser } = useAuth();
  const hooksLogger = bookingHistoryLogger;

  return useQuery({
    queryKey: [...bookingQueryKeys.all, 'history', firebaseUser?.uid],
    queryFn: async (): Promise<BookingWithId[]> => {
      if (!isFirebaseConfigured() || !firebaseUser?.uid) {
        return [];
      }

      try {
        // Fetch completed and cancelled bookings
        const constraints: QueryConstraintConfig[] = [
          {
            type: 'where',
            field: 'userId',
            operator: '==',
            value: firebaseUser.uid,
          },
          {
            type: 'where',
            field: 'bookingStatus',
            operator: 'in',
            value: ['completed', 'cancelled', 'no_show'],
          },
          {
            type: 'orderBy',
            field: 'updatedAt',
            direction: 'desc',
          },
          {
            type: 'limit',
            count: limitCount,
          },
        ];

        const result = await firebaseClientWrapper.getDocuments<Booking>('bookings', constraints);

        return result.documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        hooksLogger.error('Failed to fetch booking history', error);
        throw parseError(error);
      }
    },
    enabled: !!firebaseUser?.uid,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Update booking status (for spa staff/admin)
 *
 * Routes each terminal/financial status change through the appropriate Cloud
 * Function so that business logic (refunds, notifications, audit trails) is
 * enforced server-side:
 *
 *   'completed'  → checkOutService  Cloud Function
 *   'cancelled'  → cancelBooking    Cloud Function
 *
 * Intermediate operational transitions (en_route, in_service) that do not
 * carry financial consequences are written directly to Firestore. They are
 * still guarded by Firestore security rules, which enforce the valid state
 * machine transitions for spa_owner / spa_staff roles.
 *
 * @returns Mutation for updating booking status
 */
export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();
  const hooksLogger = updateBookingStatusLogger;

  return useMutation({
    mutationFn: async (data: {
      bookingId: string;
      status: BookingStatus;
      notes?: string;
      cancellationReason?: string;
    }): Promise<void> => {
      hooksLogger.info('Updating booking status', {
        bookingId: data.bookingId,
        status: data.status,
      });

      if (data.status === 'completed') {
        // Route through Cloud Function — triggers payout, notifications, audit
        await firebaseClientWrapper.callFunction('checkOutService', {
          bookingId: data.bookingId,
          ...(data.notes !== undefined && { notes: data.notes }),
        });
        return;
      }

      if (data.status === 'cancelled') {
        // Route through Cloud Function — handles refund logic and notifications
        await firebaseClientWrapper.callFunction('cancelBooking', {
          bookingId: data.bookingId,
          reason: data.cancellationReason ?? data.notes ?? '',
        });
        return;
      }

      // Intermediate operational transitions (en_route, in_service, etc.)
      // Written directly to Firestore. Access is still enforced by Firestore
      // security rules, which implement the valid state machine for
      // spa_owner / spa_staff roles — no business-logic bypass occurs here.
      const updatePayload: Record<string, unknown> = {
        bookingStatus: data.status,
      };

      if (data.notes !== undefined) {
        updatePayload.notes = data.notes;
      }

      await firebaseClientWrapper.updateDocument('bookings', data.bookingId, updatePayload);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: bookingQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: bookingQueryKeys.detail(variables.bookingId),
      });
    },
    onError: (error) => {
      hooksLogger.error('Booking status update failed', error);
    },
  });
}
