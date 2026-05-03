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
  useBookings,
  useCancelBooking,
  useRescheduleBooking,
  type BookingWithId,
} from '@/hooks/useBookings';
import { useAvailableSlots } from '@/hooks/useAvailability';
import { useSpa } from '@/hooks/useSpas';
import { formatDateIST, todayIST } from '@/lib/date-ist';
import { AppCheckError } from '@/lib/error-handler';
import { detectUnlinkedAccounts } from '@/lib/auth/account-linking';
import { Skeleton } from '@/components/ui/LoadingState';
import { EmptyState } from './_components/EmptyState';
import { logger } from '@/lib/logger';
import type { BookingStatus } from '@/types';

// Tab types
type TabType = 'upcoming' | 'past' | 'cancelled';

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
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

// Booking card skeleton
function BookingCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex gap-4">
        <Skeleton className="w-16 h-16 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

// Booking Card
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
  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case 'confirmed':
        return 'bg-brand-gold-100 text-brand-gold-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const serviceName = booking.services?.[0]?.name || 'Service';
  const duration = booking.slot?.duration || booking.services?.[0]?.duration || 60;
  const isUpcoming = booking.bookingStatus === 'confirmed';
  const isPast = booking.bookingStatus === 'completed';

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex gap-4">
        {/* Date Box */}
        <div className="w-16 h-16 bg-gradient-to-br from-brand-maroon-100 to-brand-gold-100 rounded-xl flex flex-col items-center justify-center shrink-0">
          <span className="text-2xl font-bold text-brand-maroon-600">
            {new Date(booking.slot.date).getDate()}
          </span>
          <span className="text-xs text-brand-maroon-500 uppercase">
            {new Date(booking.slot.date).toLocaleDateString('en-US', { month: 'short' })}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 line-clamp-1">{serviceName}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${getStatusColor(
                booking.bookingStatus,
              )}`}
            >
              {STATUS_LABEL[booking.bookingStatus] ?? booking.bookingStatus.replace(/_/g, ' ')}
            </span>
          </div>

          <p className="text-sm text-gray-500 mb-2 line-clamp-1">
            <SpaName spaId={booking.spaId} />
          </p>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatTime(booking.slot.start)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {duration}min
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {isUpcoming && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl border-gray-200"
            onClick={() => onReschedule(booking)}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Reschedule
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl border-gray-200 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => onCancel(booking)}
            disabled={isCancelling}
          >
            <X className="w-4 h-4 mr-1" />
            {isCancelling ? 'Cancelling...' : 'Cancel'}
          </Button>
        </div>
      )}

      {isPast && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <Link href={`/spas/${booking.spaId}/review?booking=${booking.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl border-brand-gold-200 text-brand-gold-600 hover:bg-brand-gold-50"
            >
              <Star className="w-4 h-4 mr-1" />
              Leave a Review
            </Button>
          </Link>
        </div>
      )}
    </div>
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

function BookingsContent() {
  const { authResolved, firebaseUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithId | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
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

  const { data: bookings = [], isLoading, error, refetch } = useBookings();
  const cancelBooking = useCancelBooking();
  const rescheduleBooking = useRescheduleBooking();

  // F6: defer `new Date()` to post-mount to avoid SSR/CSR hydration drift.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // Generate dates for rescheduling
  const dates = useMemo(() => {
    if (!now) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() + i + 1);
      return date;
    });
  }, [now]);

  // Get available slots — Phase 2/3 (Booking Flow Fix v3.1, 2026-05-02):
  // `slot.date` is an IST wall-clock string and the backend's
  // `getAvailableSlots` schema expects `serviceDuration`. The legacy
  // `toISOString().split('T')[0]` shifted late-IST dates by one day;
  // `formatDateIST` keeps the picked date stable.
  const dateStr = selectedDate ? formatDateIST(selectedDate) : null;
  const serviceDuration = selectedBooking?.slot?.duration || 60;
  const { data: availabilityData, isLoading: slotsLoading } = useAvailableSlots(
    selectedBooking?.spaId && dateStr
      ? { spaId: selectedBooking.spaId, date: dateStr, serviceDuration }
      : null,
  );

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
        const bookingDateStr = booking.slot.date;

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
    setSelectedDate(null);
    setSelectedTime(null);
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

  const handleConfirmReschedule = async () => {
    if (!selectedBooking || !selectedDate || !selectedTime) return;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const endHours = hours + Math.floor((minutes + serviceDuration) / 60);
    const endMinutes = (minutes + serviceDuration) % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

    try {
      await rescheduleBooking.mutateAsync({
        bookingId: selectedBooking.id,
        newSlot: {
          // Phase 2 (Booking Flow Fix v3.1, 2026-05-02): IST wall-clock day,
          // not a UTC slice from `toISOString()`.
          date: formatDateIST(selectedDate),
          start: selectedTime,
          end: endTime,
          duration: serviceDuration,
        },
      });
      setRescheduleDialogOpen(false);
      setSelectedBooking(null);
      refetch();
      setFeedback({ type: 'success', message: 'Booking rescheduled successfully.' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      logger.error('Failed to reschedule booking', err, { component: 'customer/bookings' });
      setRescheduleDialogOpen(false);
      setFeedback({ type: 'error', message: 'Failed to reschedule booking. Please try again.' });
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const getDayName = (date: Date): string => {
    if (!now) return '';
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Phase 6 (Booking Flow Fix v3.1, 2026-05-02): wait for the auth SDK to
  // resolve before deciding "no bookings". Without this, the Capacitor
  // cold-start race renders a "no upcoming bookings" empty state for ~200-
  // 500ms even when the user is signed in (Issue C on APK).
  if (!authResolved) {
    return (
      <div className="min-h-screen bg-gray-50 animate-fade-in">
        <div className="bg-white px-4 pt-4 pb-2">
          <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
        </div>
        <div className="px-4 pt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 animate-fade-in">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
      </div>

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

      {/* Tab Bar */}
      <div className="sticky top-14 z-40 bg-white border-b border-gray-100 px-4">
        <div className="flex">
          {(['upcoming', 'past', 'cancelled'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'text-brand-maroon-600 border-brand-maroon-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {/* Loading */}
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
        {!isLoading && (() => {
          if (error instanceof AppCheckError) {
            return <EmptyState tab={activeTab} state="error_app_check" onRetry={() => refetch()} />;
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

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="mx-4 rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reschedule Booking</DialogTitle>
            <DialogDescription>Select a new date and time</DialogDescription>
          </DialogHeader>

          {/* Date Selection */}
          <div className="py-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Select Date</h4>
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
              {dates.map((date) => {
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedTime(null);
                    }}
                    className={`flex-shrink-0 w-14 p-2 rounded-xl text-center transition-all ${
                      isSelected ? 'bg-brand-maroon-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="text-[10px]">{getDayName(date)}</div>
                    <div className="text-lg font-semibold">{date.getDate()}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Selection */}
          {selectedDate && (
            <div className="py-4 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Select Time</h4>
              {slotsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-maroon-500" />
                </div>
              ) : availabilityData?.slots?.length ? (
                <div className="grid grid-cols-4 gap-2">
                  {availabilityData.slots.map((slot) => (
                    <button
                      key={slot.start}
                      onClick={() => slot.available && setSelectedTime(slot.start)}
                      disabled={!slot.available}
                      className={`py-2 text-sm rounded-lg transition-all ${
                        !slot.available
                          ? 'bg-gray-100 text-gray-300'
                          : selectedTime === slot.start
                          ? 'bg-brand-maroon-500 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {formatTime(slot.start)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">No available slots</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 pt-4 border-t border-gray-100">
            <Button
              variant="outline"
              onClick={() => setRescheduleDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmReschedule}
              disabled={!selectedDate || !selectedTime || rescheduleBooking.isPending}
              className="bg-gradient-to-r from-brand-gold-500 to-brand-maroon-500 text-white rounded-xl"
            >
              {rescheduleBooking.isPending ? 'Rescheduling...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
