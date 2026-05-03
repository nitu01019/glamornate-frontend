'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, MoreHorizontal, Check, X, AlertCircle, RefreshCw } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-provider';
import { useBookings, useUpdateBookingStatus, BookingWithId } from '@/hooks/useBookings';
import { logger } from '@/lib/logger';
import type { BookingStatus } from '@/types';

type TabType = 'today' | 'upcoming' | 'past' | 'cancelled';

function SpaBookingsContent() {
  const [tab, setTab] = useState<TabType>('today');
  const { user } = useAuth();

  // F6: defer `new Date()` to post-mount to avoid SSR/CSR hydration drift.
  const [todayEpoch, setTodayEpoch] = useState<number | null>(null);
  useEffect(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    setTodayEpoch(t.getTime());
  }, []);

  // Get spaId from user's spaData
  const spaId = user?.spaData?.spaId || null;

  // Fetch all bookings for this spa
  const {
    data: allBookings = [],
    isLoading,
    error,
    refetch,
  } = useBookings({ spaId: spaId || undefined });

  // Update booking status mutation
  const updateBookingStatus = useUpdateBookingStatus();

  // Filter bookings by tab
  const filteredBookings = useMemo(() => {
    if (!allBookings || todayEpoch === null) {
      return { today: [], upcoming: [], past: [], cancelled: [] };
    }

    return {
      today: allBookings.filter((booking: BookingWithId) => {
        const bookingDate = new Date(booking.slot?.date);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() === todayEpoch && booking.bookingStatus !== 'cancelled';
      }),
      upcoming: allBookings.filter((booking: BookingWithId) => {
        const bookingDate = new Date(booking.slot?.date);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() > todayEpoch && booking.bookingStatus !== 'cancelled';
      }),
      past: allBookings.filter((booking: BookingWithId) => {
        const bookingDate = new Date(booking.slot?.date);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() < todayEpoch && booking.bookingStatus !== 'cancelled';
      }),
      cancelled: allBookings.filter(
        (booking: BookingWithId) => booking.bookingStatus === 'cancelled',
      ),
    };
  }, [allBookings, todayEpoch]);

  const currentBookings = filteredBookings[tab] || [];

  // Handle booking status update
  const handleStatusUpdate = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      await updateBookingStatus.mutateAsync({
        bookingId,
        status: newStatus,
      });
    } catch (error) {
      logger.error('Failed to update booking status', error, { component: 'spa/bookings' });
    }
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
            <Check className="w-3 h-3" /> Completed
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
            <Clock className="w-3 h-3" /> In Progress
          </span>
        );
      case 'confirmed':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
            <Check className="w-3 h-3" /> Confirmed
          </span>
        );
      case 'en_route':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
            <Clock className="w-3 h-3" /> En Route
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">
            <X className="w-3 h-3" /> Cancelled
          </span>
        );
      case 'no_show':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-sm">
            <X className="w-3 h-3" /> No Show
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string, time: string) => {
    const date = new Date(dateStr);
    const bookingDate = new Date(dateStr);
    bookingDate.setHours(0, 0, 0, 0);

    // F6: when todayEpoch is unresolved (pre-mount), fall back to the absolute
    // date string; Today/Tomorrow labels are deferred to post-hydration to
    // avoid SSR/CSR drift.
    if (todayEpoch !== null) {
      if (bookingDate.getTime() === todayEpoch) {
        return `Today, ${time}`;
      }
      const tomorrowEpoch = todayEpoch + 24 * 60 * 60 * 1000;
      if (bookingDate.getTime() === tomorrowEpoch) {
        return `Tomorrow, ${time}`;
      }
    }

    return (
      date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }) + `, ${time}`
    );
  };

  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case 'completed':
        return { bg: 'bg-emerald-50', icon: 'text-emerald-500' };
      case 'in_progress':
        return { bg: 'bg-amber-50', icon: 'text-amber-500' };
      case 'cancelled':
        return { bg: 'bg-slate-50', icon: 'text-slate-400' };
      case 'confirmed':
        return { bg: 'bg-blue-50', icon: 'text-blue-500' };
      case 'en_route':
        return { bg: 'bg-purple-50', icon: 'text-purple-500' };
      case 'no_show':
        return { bg: 'bg-rose-50', icon: 'text-rose-500' };
      default:
        return { bg: 'bg-gray-50', icon: 'text-gray-500' };
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="p-4 space-y-6 animate-pulse">
        <div className="h-8 w-32 bg-gray-200 rounded-lg" />
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-24 bg-gray-100 rounded-full shrink-0" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <Card className="border-0 shadow-lg rounded-2xl max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to load bookings</h2>
            <p className="text-sm text-gray-500 mb-4">
              Please check your connection and try again.
            </p>
            <Button
              onClick={() => refetch()}
              className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No spa ID - user not associated with a spa
  if (!spaId) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <Card className="border-0 shadow-lg rounded-2xl max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No Spa Associated</h2>
            <p className="text-sm text-gray-500 mb-4">
              Your account is not associated with any spa.
            </p>
            <Link href="/spa/dashboard">
              <Button className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full">
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Tabs - App-like horizontal scrolling pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {(['today', 'upcoming', 'past', 'cancelled'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all active:scale-95 ${
              tab === t ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <span className="capitalize">{t}</span>
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                tab === t ? 'bg-white/20' : 'bg-gray-200'
              }`}
            >
              {filteredBookings[t]?.length || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Bookings List */}
      <div className="space-y-3">
        {currentBookings.map((booking) => {
          const statusColors = getStatusColor(booking.bookingStatus);
          const serviceName = booking.services?.[0]?.name || 'Service';
          const customerName = booking.customer?.name || 'Guest';
          const bookingTime = booking.slot?.start || '';
          const bookingDate = booking.slot?.date || '';

          return (
            <Link
              key={booking.id}
              href={`/spa/bookings/${booking.id}`}
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-2xl"
              data-testid="spa-booking-list-card"
            >
              <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${statusColors.bg}`}
                    >
                      <Calendar className={`w-5 h-5 ${statusColors.icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{customerName}</h3>
                        {getStatusBadge(booking.bookingStatus)}
                      </div>
                      <p className="text-sm text-gray-600 truncate">{serviceName}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(bookingDate, bookingTime)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Inline status actions. stopPropagation prevents the
                      wrapping <Link> from navigating to the detail page when
                      the user taps an action button. */}
                  <div
                    className="flex gap-2 mt-3 pt-3 border-t border-gray-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                  {booking.bookingStatus === 'confirmed' && (
                    <>
                      <Button
                        size="sm"
                        className="flex-1 h-9 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs"
                        onClick={() => handleStatusUpdate(booking.id!, 'in_progress')}
                        disabled={updateBookingStatus.isPending}
                      >
                        Start
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-9 border-rose-200 text-rose-600 rounded-xl text-xs"
                        onClick={() => handleStatusUpdate(booking.id!, 'cancelled')}
                        disabled={updateBookingStatus.isPending}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {booking.bookingStatus === 'en_route' && (
                    <Button
                      size="sm"
                      className="flex-1 h-9 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs"
                      onClick={() => handleStatusUpdate(booking.id!, 'in_progress')}
                      disabled={updateBookingStatus.isPending}
                    >
                      Start Service
                    </Button>
                  )}
                  {booking.bookingStatus === 'in_progress' && (
                    <Button
                      size="sm"
                      className="flex-1 h-9 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs"
                      onClick={() => handleStatusUpdate(booking.id!, 'completed')}
                      disabled={updateBookingStatus.isPending}
                    >
                      Mark Complete
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-400">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Empty State */}
      {currentBookings.length === 0 && (
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-700 mb-1">No bookings found</h3>
            <p className="text-sm text-gray-500">No {tab} bookings to display</p>
          </CardContent>
        </Card>
      )}

      {/* Loading overlay for status updates */}
      {updateBookingStatus.isPending && (
        <div className="fixed bottom-20 right-4 bg-white shadow-lg rounded-full px-4 py-2 flex items-center gap-2 border border-gray-200 z-50">
          <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
          <span className="text-sm text-gray-600">Updating...</span>
        </div>
      )}
    </div>
  );
}

export default function SpaBookingsPage() {
  return (
    <ProtectedRoute requiredRoles={['spa_owner', 'spa_staff']}>
      <SpaBookingsContent />
    </ProtectedRoute>
  );
}
