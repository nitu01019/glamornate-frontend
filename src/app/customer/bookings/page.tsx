'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Clock, X, RefreshCw, Loader2, Star } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-provider';
import {
  useBookingsRealtime,
  useCancelBooking,
  type BookingWithId,
} from '@/hooks/useBookings';
import { useSpa } from '@/hooks/useSpas';
import { todayIST } from '@/lib/date-ist';
import { AppCheckError } from '@/lib/error-handler';
import { detectUnlinkedAccounts } from '@/auth/account-linking';
import { Skeleton } from '@/components/ui/LoadingState';
import { EmptyState } from './_components/EmptyState';
import RescheduleSheet from './_components/RescheduleSheet';
import { logger } from '@/lib/logger';
import type { BookingStatus } from '@/types';

// Tab types
type TabType = 'upcoming' | 'past' | 'cancelled';

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: 'Confirmed',
  en_route: 'On the way',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

// Spa name component
function SpaName({ spaId }: { spaId: string }) {
  const { data: spa, isLoading } = useSpa(spaId);
  if (isLoading)
    return <span className="inline-block h-4 w-20 animate-pulse rounded bg-gray-200" />;
  return <span>{spa?.name || 'Spa'}</span>;
}

// Format time
function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

// 2026-05-13 redesign per Claude's frontend-design skill — refined Indian-
// salon-luxury aesthetic. Curated per-status palette (no flat 100/700 pairs),
// editorial date capsule, status pill with dot indicator, hairline divider
// before the action row, deliberate destructive-action placement on the right.
const STATUS_STYLES: Record<BookingStatus, { dot: string; label: string; pill: string }> = {
  confirmed: {
    dot: 'bg-emerald-500',
    label: 'text-emerald-800',
    pill: 'bg-emerald-50 ring-1 ring-inset ring-emerald-200/70',
  },
  en_route: {
    dot: 'bg-amber-500',
    label: 'text-amber-800',
    pill: 'bg-amber-50 ring-1 ring-inset ring-amber-200/70',
  },
  in_progress: {
    dot: 'bg-sky-500',
    label: 'text-sky-800',
    pill: 'bg-sky-50 ring-1 ring-inset ring-sky-200/70',
  },
  completed: {
    dot: 'bg-stone-500',
    label: 'text-stone-700',
    pill: 'bg-stone-50 ring-1 ring-inset ring-stone-200/70',
  },
  cancelled: {
    dot: 'bg-rose-500',
    label: 'text-rose-800',
    pill: 'bg-rose-50 ring-1 ring-inset ring-rose-200/70',
  },
  no_show: {
    dot: 'bg-zinc-500',
    label: 'text-zinc-700',
    pill: 'bg-zinc-50 ring-1 ring-inset ring-zinc-200/70',
  },
};

function BookingCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading booking"
      className="rounded-2xl border border-brand-maroon-100/60 bg-white p-5 shadow-[0_2px_12px_rgba(136,14,79,0.04)]"
    >
      <div className="flex gap-5">
        {/* Date capsule skeleton */}
        <Skeleton className="h-[72px] w-[58px] rounded-xl bg-gradient-to-b from-brand-maroon-50 to-brand-blush" />
        <div className="flex-1 space-y-3 pt-1">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
      <div className="mt-5 flex gap-3 border-t border-stone-100 pt-4">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 flex-1 rounded-xl" />
      </div>
    </div>
  );
}

function BookingCard({
  booking,
  onCancel,
  onReschedule,
  isCancelling,
}: {
  booking: BookingWithId;
  onCancel: (booking: BookingWithId) => void;
  onReschedule: (booking: BookingWithId) => void;
  isCancelling: boolean;
}) {
  const serviceName = booking.services?.[0]?.name || 'Service';
  const duration = booking.slot?.duration || booking.services?.[0]?.duration || 60;
  const price = booking.pricing?.total;
  const extraServiceCount = Math.max((booking.services?.length ?? 1) - 1, 0);
  // SC-2: Cancel/Reschedule must remain available on every produced
  // non-terminal status — `confirmed` and `en_route`. (See design doc §2b.1.)
  const isUpcoming = booking.bookingStatus === 'confirmed' || booking.bookingStatus === 'en_route';
  const isPast = booking.bookingStatus === 'completed';

  const status = STATUS_STYLES[booking.bookingStatus] ?? STATUS_STYLES.completed;
  const slotDate = new Date(`${booking.slot.date}T00:00:00`);
  const day = slotDate.getDate();
  const month = slotDate.toLocaleDateString('en-US', { month: 'short' });
  const weekday = slotDate.toLocaleDateString('en-US', { weekday: 'short' });

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-brand-maroon-100/60 bg-white p-5 shadow-[0_2px_12px_rgba(136,14,79,0.05)] transition-shadow hover:shadow-[0_6px_20px_rgba(136,14,79,0.08)]">
      <div className="flex items-stretch gap-5">
        {/* Date capsule — tear-off-calendar feel, brand-warm gradient,
            day number is the hero glyph */}
        <div className="flex h-[72px] w-[58px] shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-b from-brand-maroon-50 via-brand-blush/60 to-brand-gold-50/80 ring-1 ring-inset ring-brand-maroon-200/60">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-brand-maroon-500/80">
            {weekday}
          </span>
          <span className="text-[26px] font-semibold leading-none text-brand-maroon-700 tabular-nums">
            {day}
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-brand-maroon-500/80">
            {month}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-stone-900">
                {serviceName}
                {extraServiceCount > 0 && (
                  <span className="ml-1.5 font-normal text-stone-500">
                    +{extraServiceCount} more
                  </span>
                )}
              </h3>
              <p className="mt-0.5 truncate text-xs font-medium text-stone-500">
                <SpaName spaId={booking.spaId} />
              </p>
            </div>

            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.pill} ${status.label}`}
            >
              <i className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
              {STATUS_LABEL[booking.bookingStatus] ?? booking.bookingStatus.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[13px] text-stone-600">
            <Clock className="h-3.5 w-3.5 text-stone-400" aria-hidden />
            <span className="tabular-nums">{formatTime(booking.slot.start)}</span>
            <span aria-hidden className="text-stone-300">
              ·
            </span>
            <span className="tabular-nums">{duration} min</span>
            {typeof price === 'number' && (
              <>
                <span aria-hidden className="text-stone-300">
                  ·
                </span>
                <span className="font-medium tabular-nums text-stone-700">₹{price}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action row */}
      {isUpcoming && (
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4">
          <Button
            variant="outline"
            onClick={() => onReschedule(booking)}
            className="h-11 rounded-xl border-brand-maroon-200/70 bg-brand-blush/40 text-brand-maroon-700 hover:bg-brand-maroon-50 hover:text-brand-maroon-800"
          >
            <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
            Reschedule
          </Button>
          <Button
            variant="ghost"
            onClick={() => onCancel(booking)}
            disabled={isCancelling}
            className="h-11 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <X className="mr-1.5 h-4 w-4" aria-hidden />
            {isCancelling ? 'Cancelling…' : 'Cancel'}
          </Button>
        </div>
      )}

      {isPast && (
        <div className="mt-5 border-t border-stone-100 pt-4">
          <Link
            href={`/spas/${booking.spaId}/review?booking=${booking.id}`}
            className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-brand-gold-200 bg-brand-gold-50/40 px-4 text-sm font-medium text-brand-gold-700 transition-colors hover:bg-brand-gold-50 hover:text-brand-gold-800"
          >
            <Star className="h-4 w-4" aria-hidden />
            Leave a review
          </Link>
        </div>
      )}
    </article>
  );
}

// Patch SB-8 / Phase 4.5 W4.5-C (Booking Flow Fix v3.1, 2026-05-02):
// 14-day one-time "we've simplified booking — pay only at the spa now"
// banner shown to returning customers post-Stripe-removal. Expires
// automatically when `NEXT_PUBLIC_PAY_AT_SPA_BANNER_UNTIL` falls in the
// past. Dismissal is sticky via localStorage so it never reappears.
const PAY_AT_SPA_DISMISSED_KEY = 'pay-at-spa-banner-dismissed-until';

function shouldShowPayAtSpaBanner(): boolean {
  const until = process.env.NEXT_PUBLIC_PAY_AT_SPA_BANNER_UNTIL;
  if (!until) return false;
  const untilDate = new Date(until);
  if (Number.isNaN(untilDate.getTime()) || untilDate.getTime() <= Date.now()) {
    return false;
  }
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PAY_AT_SPA_DISMISSED_KEY) !== until;
}

// 2026-05-13: editorial page header — display-weight title with a
// one-line concierge subtitle, refresh button reframed as an icon-only
// affordance with a quiet spin-on-load state.
function PageHeader({ onRefresh, isLoading }: { onRefresh: () => void; isLoading: boolean }) {
  return (
    <header className="border-b border-stone-200/60 bg-white px-4 pb-3 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-[28px] font-semibold leading-tight tracking-tight text-stone-900">
            My Bookings
          </h1>
          <p className="mt-1 text-[13px] italic leading-snug text-stone-500">
            Your appointments, in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh bookings"
          className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition-all hover:bg-stone-100 hover:text-brand-maroon-700 active:scale-95 disabled:opacity-50"
          disabled={isLoading}
        >
          <RefreshCw className={`h-[18px] w-[18px] ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </header>
  );
}

function BookingsContent() {
  const { authResolved, firebaseUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithId | null>(null);
  // 2026-05-14: selectedDate/selectedTime moved into RescheduleSheet; the
  // page no longer mediates the picker state.
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [showPayAtSpaBanner, setShowPayAtSpaBanner] = useState(false);

  useEffect(() => {
    setShowPayAtSpaBanner(shouldShowPayAtSpaBanner());
  }, []);

  const dismissPayAtSpaBanner = () => {
    const until = process.env.NEXT_PUBLIC_PAY_AT_SPA_BANNER_UNTIL;
    if (until && typeof window !== 'undefined') {
      localStorage.setItem(PAY_AT_SPA_DISMISSED_KEY, until);
    }
    setShowPayAtSpaBanner(false);
  };

  // 2026-05-13: Firestore real-time subscription. Replaces the old
  // React-Query one-shot path which silently hung in `status: pending,
  // fetchStatus: idle` on Android cold-start (PersistQueryClientProvider
  // restore wedge on Capacitor Preferences). The new hook also gives
  // instant propagation of server-side changes — a spa cancelling /
  // moving the booking shows up on the customer's screen in <1s with no
  // refresh tap.
  const { data: bookingsData, isLoading, isRefreshing, error, refetch } = useBookingsRealtime();
  // `useMemo` keeps the `bookings` reference stable across renders when
  // `bookingsData` itself is stable; without it, `?? []` makes a fresh
  // array literal on every render and downstream `useMemo` hooks that
  // depend on `bookings` re-fire each tick.
  const bookings = useMemo(() => bookingsData ?? [], [bookingsData]);
  const cancelBooking = useCancelBooking();
  // 2026-05-14: `useRescheduleBooking` now lives inside RescheduleSheet,
  // so the page no longer needs a top-level mutation handle.

  // F6: defer `new Date()` to post-mount to avoid SSR/CSR hydration drift.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // 2026-05-14: the page no longer renders an inline reschedule date/time
  // picker — RescheduleSheet owns its own calendar + slot grid + mutation.
  // We only need `serviceDuration` here to forward as a prop so the sheet
  // computes the slot's end-time correctly.
  const serviceDuration = selectedBooking?.slot?.duration || 60;

  // Filter bookings by tab — Phase 2 (Booking Flow Fix v3.1, 2026-05-02):
  // compare IST date strings, not `Date.toDateString()`. The legacy
  // `new Date(booking.slot.date)` parses 'YYYY-MM-DD' as UTC midnight,
  // which on a UTC-runtime CI host gave the wrong day-bucket and bookings
  // disappeared from "Upcoming" near midnight IST.
  const filteredBookings = useMemo(() => {
    if (!now) return [];
    const todayStr = todayIST();

    return bookings
      .filter((booking) => {
        const bookingDateStr = booking.slot?.date;
        if (!bookingDateStr) return false;

        if (activeTab === 'upcoming') {
          return (
            booking.bookingStatus !== 'cancelled' &&
            booking.bookingStatus !== 'completed' &&
            bookingDateStr >= todayStr
          );
        } else if (activeTab === 'past') {
          return (
            booking.bookingStatus === 'completed' ||
            (booking.bookingStatus !== 'cancelled' && bookingDateStr < todayStr)
          );
        } else if (activeTab === 'cancelled') {
          return booking.bookingStatus === 'cancelled';
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.slot.date}T${a.slot.start}`);
        const dateB = new Date(`${b.slot.date}T${b.slot.start}`);
        return activeTab === 'upcoming'
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      });
  }, [bookings, activeTab, now]);

  const handleCancelClick = (booking: BookingWithId) => {
    setSelectedBooking(booking);
    setCancelDialogOpen(true);
  };

  const handleRescheduleClick = (booking: BookingWithId) => {
    setSelectedBooking(booking);
    setRescheduleDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedBooking) return;
    try {
      await cancelBooking.mutateAsync({
        bookingId: selectedBooking.id,
        reason: 'Cancelled by customer',
      });
      setCancelDialogOpen(false);
      setSelectedBooking(null);
      refetch();
      setFeedback({ type: 'success', message: 'Booking cancelled successfully.' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      logger.error('Failed to cancel booking', err, { component: 'customer/bookings' });
      setCancelDialogOpen(false);
      setFeedback({ type: 'error', message: 'Failed to cancel booking. Please try again.' });
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  // 2026-05-14: `handleConfirmReschedule` + `getDayName` removed — the
  // new RescheduleSheet's `handleConfirm` owns end-time computation +
  // calls useRescheduleBooking internally; its MonthCalendar derives
  // weekday labels from the IST date itself, so we no longer need the
  // page-level helpers.

  // Phase 6 (Booking Flow Fix v3.1, 2026-05-02): wait for the auth SDK to
  // resolve before deciding "no bookings". Without this, the Capacitor
  // cold-start race renders a "no upcoming bookings" empty state for ~200-
  // 500ms even when the user is signed in (Issue C on APK).
  if (!authResolved) {
    return (
      <div className="min-h-screen bg-stone-50 animate-fade-in">
        <PageHeader onRefresh={refetch} isLoading={true} />
        <div className="px-4 pt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <BookingCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 animate-fade-in">
      <PageHeader onRefresh={refetch} isLoading={isLoading} />

      {/* Patch SB-8 / Phase 4.5 W4.5-C: pay-at-spa transition banner.
          Auto-hides after `NEXT_PUBLIC_PAY_AT_SPA_BANNER_UNTIL`. */}
      {showPayAtSpaBanner && (
        <div className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-2xl border border-brand-gold-200 bg-brand-gold-50 p-4 shadow-sm">
          <p className="text-sm text-brand-maroon-900">
            We&apos;ve simplified booking. Pay only at the spa now.
          </p>
          <button
            type="button"
            onClick={dismissPayAtSpaBanner}
            className="shrink-0 rounded-lg bg-brand-maroon-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-maroon-600"
          >
            Got it
          </button>
        </div>
      )}

      {/* Mutation feedback banner */}
      {feedback && (
        <div
          className={`mx-4 mt-4 p-3 rounded-xl border ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <p className="text-sm font-medium">{feedback.message}</p>
        </div>
      )}

      {/* Tab Bar — sliding underline indicator, refined inactive weight */}
      <div className="sticky top-14 z-40 border-b border-stone-200/70 bg-white/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="relative flex">
          {(['upcoming', 'past', 'cancelled'] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            // Tab label is rendered as raw text on the <button> so it doesn't
            // collide with the pill-span selector used by SC-2 tests.
            const label = tab === 'upcoming' ? 'Upcoming' : tab === 'past' ? 'Past' : 'Cancelled';
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex-1 py-3.5 text-[13px] uppercase tracking-[0.08em] transition-colors ${
                  isActive
                    ? 'font-semibold text-brand-maroon-700'
                    : 'font-medium text-stone-400 hover:text-stone-600'
                }`}
              >
                {label}
                {isActive && (
                  <span className="absolute inset-x-4 bottom-[-1px] h-[2px] rounded-full bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subtle "Updating…" pill on re-subscribe — keeps the user's place
          rather than swapping cards for skeletons during a manual refresh. */}
      {isRefreshing && !isLoading && (
        <div className="flex justify-center pt-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-medium text-stone-500 ring-1 ring-inset ring-stone-200">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Updating…
          </span>
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-5">
        {isLoading && (
          <div className="space-y-4">
            <BookingCardSkeleton />
            <BookingCardSkeleton />
            <BookingCardSkeleton />
          </div>
        )}

        {/* Phase 4.5 / Patch DR-6 (Booking Flow Fix v3.1, 2026-05-02):
            single EmptyState component renders the (tab × state) matrix —
            one of: error_app_check, error_other, empty_unlinked, empty_ok,
            or the booking cards. Centralised here so the matrix lives in
            one file rather than four ad-hoc branches. */}
        {!isLoading &&
          (() => {
            if (error instanceof AppCheckError) {
              return (
                <EmptyState tab={activeTab} state="error_app_check" onRetry={() => refetch()} />
              );
            }
            if (error) {
              return <EmptyState tab={activeTab} state="error_other" onRetry={() => refetch()} />;
            }

            const unlinked =
              filteredBookings.length === 0 &&
              firebaseUser !== null &&
              detectUnlinkedAccounts({
                hasZeroBookings: bookings.length === 0,
                providerCount: firebaseUser.providerData.length,
                hasEmail: !!firebaseUser.email,
                hasPhone: !!firebaseUser.phoneNumber,
              });

            if (filteredBookings.length === 0 && unlinked) {
              return <EmptyState tab={activeTab} state="empty_unlinked" />;
            }
            if (filteredBookings.length === 0) {
              return <EmptyState tab={activeTab} state="empty_ok" />;
            }

            return (
              <div className="space-y-4">
                {filteredBookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    onCancel={handleCancelClick}
                    onReschedule={handleRescheduleClick}
                    isCancelling={cancelBooking.isPending && selectedBooking?.id === booking.id}
                  />
                ))}
              </div>
            );
          })()}
      </div>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>Are you sure you want to cancel this appointment?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              className="rounded-xl"
            >
              Keep Booking
            </Button>
            <Button
              onClick={handleConfirmCancel}
              disabled={cancelBooking.isPending}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >
              {cancelBooking.isPending ? 'Cancelling...' : 'Cancel Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule — mobile-first bottom sheet (2026-05-14). Replaces
          the v3 centered <Dialog> which overflowed 80vh on small viewports
          and had a non-sticky footer. RescheduleSheet owns its own state
          (selectedDate, selectedTime, mutation) so the page no longer
          needs the local handlers + useAvailableSlots fetch. */}
      <RescheduleSheet
        open={rescheduleDialogOpen}
        onClose={() => setRescheduleDialogOpen(false)}
        bookingId={selectedBooking?.id ?? null}
        currentSlot={selectedBooking?.slot ?? null}
        serviceDuration={serviceDuration}
        onSuccess={() => {
          setRescheduleDialogOpen(false);
          setSelectedBooking(null);
          refetch();
          setFeedback({ type: 'success', message: 'Booking rescheduled successfully.' });
          setTimeout(() => setFeedback(null), 4000);
        }}
        onError={(message) => {
          setFeedback({ type: 'error', message });
          setTimeout(() => setFeedback(null), 6000);
        }}
      />

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  );
}

export default function BookingsPage() {
  return (
    <ProtectedRoute requiredRoles={['customer']}>
      <BookingsContent />
    </ProtectedRoute>
  );
}
