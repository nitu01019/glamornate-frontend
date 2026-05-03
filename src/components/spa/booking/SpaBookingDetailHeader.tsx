'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import type { BookingStatus } from '@/types';

const STATUS_CHIP: Record<BookingStatus, { label: string; className: string }> = {
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-700' },
  en_route: { label: 'En Route', className: 'bg-purple-100 text-purple-700' },
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600' },
  no_show: { label: 'No Show', className: 'bg-rose-100 text-rose-700' },
};

function buildShortReference(bookingId: string): string {
  const tail = bookingId.slice(-6).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `GLM-${tail.padStart(6, '0')}`;
}

function formatScheduled(scheduledAt: string | undefined): { date: string; time: string } | null {
  if (!scheduledAt) return null;
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

export interface SpaBookingDetailHeaderProps {
  booking: {
    id: string;
    bookingStatus: BookingStatus;
    scheduledAt?: string;
  };
}

export function SpaBookingDetailHeader({ booking }: SpaBookingDetailHeaderProps) {
  const router = useRouter();
  const chip = STATUS_CHIP[booking.bookingStatus] ?? STATUS_CHIP.confirmed;
  const scheduled = formatScheduled(booking.scheduledAt);
  const ref = buildShortReference(booking.id);

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="text-gray-500 hover:text-gray-700 active:scale-95 transition-transform"
          data-testid="spa-booking-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Booking Details</h1>
      </div>
      <div className="px-4 pb-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">{ref}</p>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${chip.className}`}
            data-testid="spa-booking-status-badge"
          >
            {chip.label}
          </span>
        </div>
        {scheduled && (
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-brand-maroon-500" />
              {scheduled.date}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-brand-maroon-500" />
              {scheduled.time}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
