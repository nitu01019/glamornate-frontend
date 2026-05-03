'use client';

import Link from 'next/link';
import { CheckCircle, Calendar, ArrowRight, Home, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useBooking } from '@/hooks/useBookings';
import { formatTimeLabel } from '@/lib/slot-utils';
import { formatINR } from '@/lib/utils/currency';
import { PaymentDueBlock } from '@/components/booking/PaymentDueBlock';
import { BOOKING_CONFIRMED, MISSED, ON_THE_WAY } from '@/lib/booking/copy';

// Phase 4.5 (Booking Flow Fix v3.1, 2026-05-02): customer-facing labels
// follow the copy.ts mandate. `no_show` reads as "Missed" for customers
// (kinder than the spa-side "No show"); `en_route` reads as "On the way".
const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  en_route: ON_THE_WAY,
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: MISSED,
};

function formatBookingDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function buildShortReference(bookingId: string): string {
  const tail = bookingId.slice(-6).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `GLM-${tail.padStart(6, '0')}`;
}

interface StatusBannerConfig {
  icon: typeof CheckCircle;
  iconClass: string;
  iconBgClass: string;
  containerClass: string;
  titleClass: string;
  bodyClass: string;
  title: string;
  body: string;
  spin?: boolean;
  action?: { href: string; label: string; className: string };
}

function getStatusBannerConfig(bookingStatus: string | undefined): StatusBannerConfig | null {
  if (bookingStatus === 'confirmed') {
    return {
      icon: CheckCircle,
      iconClass: 'text-green-600',
      iconBgClass: 'bg-green-100',
      containerClass: 'bg-green-50 border border-green-200',
      titleClass: 'text-green-800',
      bodyClass: 'text-green-700',
      // Phase 4.5: sentence-case, no exclamation, no Stripe-era subtext.
      title: BOOKING_CONFIRMED,
      body: 'Pay at the spa on the day of your appointment.',
    };
  }
  if (bookingStatus === 'cancelled') {
    return {
      icon: XCircle,
      iconClass: 'text-gray-600',
      iconBgClass: 'bg-gray-100',
      containerClass: 'bg-gray-50 border border-gray-200',
      titleClass: 'text-gray-800',
      bodyClass: 'text-gray-700',
      title: 'Booking cancelled',
      body: 'This booking has been cancelled.',
    };
  }
  return null;
}

function BookingDetailContent({ bookingId }: { bookingId: string }) {
  const { data: booking, isLoading } = useBooking(bookingId);
  const banner = getStatusBannerConfig(booking?.bookingStatus);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <Link href="/customer/bookings" className="text-gray-500 hover:text-gray-700">
          <ArrowRight className="w-5 h-5 rotate-180" />
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Booking Details</h1>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Phase 4.5 (Booking Flow Fix v3.1, 2026-05-02) — render order:
              1. Status banner (compact)
              2. PaymentDueBlock (primary, unmissable)
              3. Booking summary
              4. Cancel CTA (footer, tertiary)
            The banner is `role="status" aria-live="polite"` so screen
            readers announce the confirmation without grabbing focus
            (Patch DR-9). */}
        {banner && (
          <Card
            role="status"
            aria-live="polite"
            className={`border-0 shadow-sm rounded-2xl ${banner.containerClass}`}
          >
            <CardContent className="p-5 flex items-start gap-4">
              <div
                className={`w-12 h-12 ${banner.iconBgClass} rounded-full flex items-center justify-center shrink-0`}
              >
                <banner.icon
                  className={`w-6 h-6 ${banner.iconClass} ${banner.spin ? 'animate-spin' : ''}`}
                />
              </div>
              <div className="flex-1">
                <p className={`font-semibold ${banner.titleClass}`}>{banner.title}</p>
                <p className={`text-sm mt-0.5 ${banner.bodyClass}`}>{banner.body}</p>
                {banner.action && (
                  <Link href={banner.action.href} className="inline-block mt-3">
                    <Button
                      className={`rounded-full h-9 px-4 text-sm font-medium ${banner.action.className}`}
                    >
                      {banner.action.label}
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pay-at-spa amount-due block — only on active bookings. */}
        {booking?.pricing?.total !== undefined &&
          booking.bookingStatus !== 'cancelled' &&
          booking.bookingStatus !== 'completed' &&
          booking.bookingStatus !== 'no_show' && (
            <PaymentDueBlock amountRupees={booking.pricing.total} />
          )}

        {/* Booking info */}
        {isLoading ? (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-5 space-y-3 animate-pulse">
              <div className="h-4 w-1/3 bg-gray-200 rounded" />
              <div className="h-4 w-2/3 bg-gray-100 rounded" />
              <div className="h-4 w-1/2 bg-gray-100 rounded" />
            </CardContent>
          </Card>
        ) : booking ? (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-maroon-100 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-brand-maroon-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Reference</p>
                  <p className="font-semibold text-gray-900 text-sm tracking-wide">
                    {booking.bookingNumber ?? buildShortReference(bookingId)}
                  </p>
                </div>
              </div>

              {booking.slot && (
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <p className="text-sm text-gray-500">Date &amp; Time</p>
                  <p className="font-medium text-gray-900">
                    {formatBookingDate(booking.slot.date)} at {formatTimeLabel(booking.slot.start)}
                  </p>
                </div>
              )}

              {booking.bookingStatus && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500">Status</p>
                  <span className="inline-block mt-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                    {STATUS_LABEL[booking.bookingStatus] ?? booking.bookingStatus}
                  </span>
                </div>
              )}

              {booking.pricing?.total !== undefined && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-bold text-gray-900 text-lg">
                    {formatINR(booking.pricing.total)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-5 text-center text-gray-500">
              <p className="text-sm">Booking details not available.</p>
              <p className="text-xs text-gray-400 mt-1 tracking-wide">
                Reference {buildShortReference(bookingId)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Link href="/customer/bookings" className="block">
            <Button className="w-full bg-gradient-to-r from-brand-maroon-500 to-brand-maroon-600 text-white rounded-full h-12 font-medium">
              View All Bookings
            </Button>
          </Link>
          <Link href="/" className="block">
            <Button
              variant="outline"
              className="w-full rounded-full h-12 border-gray-200 text-gray-600"
            >
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BookingDetailClientPage({ id }: { id: string }) {
  return (
    <ProtectedRoute>
      <BookingDetailContent bookingId={id} />
    </ProtectedRoute>
  );
}
