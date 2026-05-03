'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  MapPin,
  Heart,
  History,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import { useUpcomingBookings, useBookingHistory } from '@/hooks/useBookings';
import { useSpa } from '@/hooks/useSpas';
import { Skeleton } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

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

// F6: `now` must be resolved post-mount (via `useState` + `useEffect`) and
// passed in; calling `new Date()` during SSR render would drift from CSR.
function formatDate(dateString: string, now: Date | null): string {
  const date = new Date(dateString);
  if (now) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === now.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format time
function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const {
    data: upcomingBookings,
    isLoading: upcomingLoading,
    error: upcomingError,
  } = useUpcomingBookings();
  const { data: bookingHistory, isLoading: historyLoading } = useBookingHistory(5);

  // F6: defer `new Date()` to post-mount to avoid SSR/CSR hydration drift.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  const displayName = user?.profile?.displayName?.split(' ')[0] || 'there';
  const nextBooking = upcomingBookings?.[0];
  const isLoading = upcomingLoading || historyLoading;

  if (upcomingError) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6">
        <ErrorState
          title="Error Loading Dashboard"
          message="Unable to load your bookings."
          showRetry
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Hi, {displayName}!</h1>
        <p className="text-sm text-gray-500 mt-1">Here&apos;s your activity</p>
      </div>

      {/* Next Appointment Card */}
      {isLoading ? (
        <div className="px-4 -mt-2">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <Skeleton className="h-6 w-1/3 mb-4" />
            <div className="flex gap-4">
              <Skeleton className="w-20 h-20 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </div>
        </div>
      ) : nextBooking ? (
        <div className="px-4 -mt-2">
          <div className="bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 rounded-2xl p-4 shadow-lg text-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium opacity-90">Next Appointment</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {STATUS_LABEL[nextBooking.bookingStatus] ?? nextBooking.bookingStatus}
              </span>
            </div>

            <h3 className="font-semibold text-lg mb-1">
              {nextBooking.services[0]?.name || 'Service'}
            </h3>
            <p className="text-sm opacity-90 mb-3">
              <SpaName spaId={nextBooking.spaId} />
            </p>

            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(nextBooking.slot.date, now)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatTime(nextBooking.slot.start)}
              </span>
            </div>

            <Link href="/customer/bookings" className="mt-4 block">
              <Button className="w-full bg-white text-brand-maroon-600 hover:bg-white/90 rounded-xl h-10 font-medium">
                View Details
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="px-4 -mt-2">
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h3 className="font-medium text-gray-800 mb-1">No upcoming bookings</h3>
            <p className="text-sm text-gray-500 mb-4">Find your perfect spa experience</p>
            <Link href="/spas">
              <Button className="bg-gradient-to-r from-brand-gold-500 to-brand-maroon-500 text-white rounded-xl">
                Explore Spas
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 py-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3">
          <Link href="/spas" className="block">
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-full bg-brand-maroon-50 flex items-center justify-center mx-auto mb-2">
                <MapPin className="w-6 h-6 text-brand-maroon-500" />
              </div>
              <span className="text-sm font-medium text-gray-700">Find Spa</span>
            </div>
          </Link>

          <Link href="/customer/favorites" className="block">
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-full bg-brand-gold-50 flex items-center justify-center mx-auto mb-2">
                <Heart className="w-6 h-6 text-brand-gold-500" />
              </div>
              <span className="text-sm font-medium text-gray-700">Favorites</span>
            </div>
          </Link>

          <Link href="/customer/history" className="block">
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-2">
                <History className="w-6 h-6 text-purple-500" />
              </div>
              <span className="text-sm font-medium text-gray-700">History</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <Link
            href="/customer/bookings"
            className="text-brand-maroon-600 text-sm font-medium flex items-center gap-1"
          >
            See All
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex gap-3">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : bookingHistory && bookingHistory.length > 0 ? (
          <div className="space-y-3">
            {bookingHistory.slice(0, 5).map((booking) => (
              <Link key={booking.id} href={`/customer/bookings`} className="block">
                <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        booking.bookingStatus === 'completed'
                          ? 'bg-green-50'
                          : booking.bookingStatus === 'cancelled'
                          ? 'bg-red-50'
                          : 'bg-brand-gold-50'
                      }`}
                    >
                      <Sparkles
                        className={`w-6 h-6 ${
                          booking.bookingStatus === 'completed'
                            ? 'text-green-500'
                            : booking.bookingStatus === 'cancelled'
                            ? 'text-red-500'
                            : 'text-brand-gold-500'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 line-clamp-1">
                        {booking.services[0]?.name || 'Service'}
                      </h4>
                      <p className="text-sm text-gray-500 line-clamp-1">
                        <SpaName spaId={booking.spaId} />
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          booking.bookingStatus === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : booking.bookingStatus === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-brand-gold-100 text-brand-gold-700'
                        }`}
                      >
                        {STATUS_LABEL[booking.bookingStatus] ?? booking.bookingStatus}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(booking.slot.date, now)}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-brand-maroon-50 flex items-center justify-center mb-4">
                <History className="w-8 h-8 text-brand-maroon-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No recent activity</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Your booking history will appear here
              </p>
              <Link
                href="/services"
                className="px-6 py-2.5 bg-brand-maroon-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-maroon-600 transition-colors"
              >
                Browse Services
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  );
}
