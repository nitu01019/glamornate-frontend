'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import type { BookingCustomerLocation } from '@/lib/contracts';
import { useBookingRealtime } from '@/hooks/useBookings';
import { useSpa } from '@/hooks/useSpas';
import { SpaBookingDetailHeader } from '@/components/spa/booking/SpaBookingDetailHeader';
import { SpaBookingCustomerCard } from '@/components/spa/booking/SpaBookingCustomerCard';
import { SpaBookingLocationCard } from '@/components/spa/booking/SpaBookingLocationCard';
import { SpaBookingServiceList } from '@/components/spa/booking/SpaBookingServiceList';
import { SpaBookingNotesCard } from '@/components/spa/booking/SpaBookingNotesCard';
import { SpaBookingStatusActions } from '@/components/spa/booking/SpaBookingStatusActions';

function SpaBookingDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-4 animate-pulse">
        <div className="h-5 w-40 bg-gray-200 rounded" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="h-3 w-20 bg-gray-100 rounded" />
          <div className="h-5 w-24 bg-gray-100 rounded-full" />
        </div>
      </div>
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function SpaBookingDetailNotFound({ bookingId }: { bookingId: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="border-0 shadow-sm rounded-2xl max-w-sm w-full">
        <CardContent className="p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Booking not available
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              We couldn&apos;t load this booking. It may have been removed or
              you may not have access.
            </p>
            <p className="text-xs text-gray-400 mt-2 tracking-wide">
              ID: {bookingId}
            </p>
          </div>
          <Link href="/spa/bookings" className="block">
            <Button className="w-full rounded-full h-11 bg-brand-maroon-500 hover:bg-brand-maroon-600 text-white">
              Back to bookings
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function SpaBookingDetailContent({ bookingId }: { bookingId: string }) {
  const booking = useBookingRealtime(bookingId);
  const { data: spa } = useSpa(booking?.spaId);

  if (!booking) {
    return <SpaBookingDetailSkeleton />;
  }

  const headerBooking = {
    id: booking.id,
    bookingStatus: booking.bookingStatus,
    scheduledAt: booking.scheduledAt,
  };

  const customer = {
    name: booking.customer?.name,
    phone: booking.customer?.phone,
  };

  const spaForCard = {
    name: spa?.name ?? 'the spa',
    location: spa?.location,
  };

  // BookingCustomerLocation/bookingLocation aren't yet on the local `Booking`
  // type (contracts updated, types/index.ts not regenerated). Read via a
  // narrow projection from the realtime doc — Firestore returns the fields
  // when present.
  const bookingForLocationCard: {
    bookingLocation?: 'spa' | 'home';
    customerLocation?: BookingCustomerLocation | null;
  } = {
    bookingLocation: (booking as { bookingLocation?: 'spa' | 'home' })
      .bookingLocation,
    customerLocation: (
      booking as { customerLocation?: BookingCustomerLocation | null }
    ).customerLocation,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SpaBookingDetailHeader booking={headerBooking} />
      <div className="p-4 space-y-3">
        <SpaBookingCustomerCard customer={customer} />
        <SpaBookingLocationCard
          booking={bookingForLocationCard}
          spa={spaForCard}
          customerPhone={booking.customer?.phone}
        />
        <SpaBookingServiceList services={booking.services ?? []} />
        <SpaBookingNotesCard
          notes={booking.notes}
          specialRequests={booking.specialRequests}
        />
        <SpaBookingStatusActions
          booking={{ id: booking.id, bookingStatus: booking.bookingStatus }}
        />
      </div>
    </div>
  );
}

export default function PageClient({ bookingId }: { bookingId: string }) {
  if (bookingId === '_') {
    return <SpaBookingDetailNotFound bookingId={bookingId} />;
  }

  return (
    <ProtectedRoute requiredRoles={['spa_owner', 'spa_staff', 'admin']}>
      <SpaBookingDetailContent bookingId={bookingId} />
    </ProtectedRoute>
  );
}
