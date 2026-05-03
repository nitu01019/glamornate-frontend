'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Calendar, Share2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBookingStore } from '@/store/booking';
import { useCartStore } from '@/store/cart';
import { formatTimeLabel } from '@/lib/slot-utils';
import { formatINR } from '@/lib/utils/currency';

function formatConfirmationDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function buildShortReference(bookingId: string): string {
  // Last 6 chars of the Firestore doc ID, uppercased — gives a friendly,
  // support-traceable code (e.g. "GLM-9F2A1B") without exposing the full ID.
  const tail = bookingId.slice(-6).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `GLM-${tail.padStart(6, '0')}`;
}

function buildEndTime(start: string, durationMinutes: number): string {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + durationMinutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function buildGoogleCalendarUrl(opts: {
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  details?: string;
}): string {
  const compactDate = opts.date.replace(/-/g, '');
  const startCompact = opts.startTime.replace(':', '') + '00';
  const endTime = buildEndTime(opts.startTime, opts.durationMinutes);
  const endCompact = endTime.replace(':', '') + '00';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${compactDate}T${startCompact}/${compactDate}T${endCompact}`,
    details: opts.details ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function ConfirmationStep() {
  const { bookingResult, selectedDate, selectedTimeSlot } = useBookingStore();
  const clearCart = useCartStore((s) => s.clearCart);
  const clearedRef = useRef(false);

  // Snapshot the cart synchronously on first render — BEFORE the clear-cart
  // effect runs — so the confirmation card can show service names and total
  // even after the cart is emptied.
  const snapshotRef = useRef<{
    servicesCount: number;
    servicesSummary: string;
    totalAmount: number;
    totalDurationMinutes: number;
  } | null>(null);
  if (snapshotRef.current === null) {
    const cart = useCartStore.getState();
    const names = cart.items.map((i) => i.serviceName);
    const joined = names.join(', ');
    const summary = joined.length > 60 ? joined.slice(0, 57) + '…' : joined;
    snapshotRef.current = {
      servicesCount: cart.items.reduce((acc, i) => acc + i.quantity, 0),
      servicesSummary: summary,
      totalAmount: Math.max(0, cart.getTotal() - (cart.voucherDiscount ?? 0)),
      totalDurationMinutes: cart.getTotalDuration(),
    };
  }

  const [bounce, setBounce] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (!clearedRef.current && bookingResult?.bookingId) {
      clearedRef.current = true;
      clearCart();
    }
  }, [clearCart, bookingResult]);

  useEffect(() => {
    setBounce(true);
    const t = setTimeout(() => setBounce(false), 1100);
    return () => clearTimeout(t);
  }, []);

  // Guard: booking result missing — page refresh, direct URL navigation, or confirmation failure
  if (!bookingResult?.bookingId) {
    return (
      <div className="flex flex-col items-center gap-4 text-center animate-fade-in-up">
        <AlertCircle className="h-16 w-16 text-red-400" />
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 w-full text-left">
          <p className="text-sm text-red-700 font-medium">
            We could not confirm your booking. Your payment has not been charged.
          </p>
          <p className="mt-1 text-xs text-red-600">
            Please try booking again or contact support if the issue persists.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 mt-2">
          <Button
            asChild
            size="lg"
            className="w-full bg-brand-maroon-500 text-white rounded-xl px-6 py-2.5 text-sm font-semibold"
          >
            <Link href="/booking">Try Again</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full rounded-xl">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const snap = snapshotRef.current;
  const reference =
    bookingResult.bookingNumber ?? buildShortReference(bookingResult.bookingId);
  const dateLabel = selectedDate ? formatConfirmationDate(selectedDate) : '';
  const timeLabel = selectedTimeSlot ? formatTimeLabel(selectedTimeSlot) : '';

  const calendarUrl =
    selectedDate && selectedTimeSlot
      ? buildGoogleCalendarUrl({
          title: snap.servicesSummary
            ? `Glamornate · ${snap.servicesSummary}`
            : 'Glamornate booking',
          date: selectedDate,
          startTime: selectedTimeSlot,
          durationMinutes: Math.max(30, snap.totalDurationMinutes || 60),
          details: `Reference: ${reference}`,
        })
      : null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setShareError('Could not copy. Try again.');
      setTimeout(() => setShareError(null), 2500);
    }
  };

  const handleShare = async () => {
    const shareText = [
      `My Glamornate booking is confirmed!`,
      snap.servicesSummary ? `Service: ${snap.servicesSummary}` : null,
      dateLabel && timeLabel ? `${dateLabel} at ${timeLabel}` : null,
      `Reference: ${reference}`,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'Glamornate booking',
          text: shareText,
        });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // User cancelled the share sheet — DOMException AbortError is expected; ignore.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setShareError('Could not share. Try copying instead.');
      setTimeout(() => setShareError(null), 2500);
    }
  };

  return (
    <div className="flex flex-col items-center text-center animate-fade-in-up">
      {/* Success icon with decorative glow */}
      <div className="relative mb-2">
        <div className="absolute inset-0 w-20 h-20 bg-green-200 rounded-full blur-xl opacity-50" />
        <CheckCircle
          className={`relative h-20 w-20 text-green-500 ${bounce ? 'animate-bounce' : ''}`}
        />
      </div>

      <h2 className="mt-4 text-2xl font-bold text-gray-900">Booking confirmed</h2>
      <p className="mt-1 text-sm text-gray-500">You&rsquo;re all set. Pay at the spa on arrival.</p>

      {/* Reference chip — tap to copy */}
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy booking reference ${reference}`}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-maroon-100 bg-brand-maroon-50 px-4 py-1.5 text-sm font-medium text-brand-maroon-700 transition-colors hover:bg-brand-maroon-100 active:scale-95"
      >
        <span className="tracking-wide">Booking #{reference}</span>
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5 opacity-70" />
        )}
      </button>

      {/* Summary card */}
      <div className="mt-6 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 text-left text-sm text-gray-700 space-y-2">
        {snap.servicesSummary ? (
          <p className="font-medium text-gray-900">{snap.servicesSummary}</p>
        ) : (
          <p className="font-medium text-gray-900">
            {snap.servicesCount} {snap.servicesCount === 1 ? 'service' : 'services'}
          </p>
        )}
        {dateLabel && (
          <p className="text-gray-600">
            <span className="text-gray-500">When · </span>
            {dateLabel}
            {timeLabel ? ` · ${timeLabel}` : ''}
          </p>
        )}
        {snap.totalAmount > 0 && (
          <p className="text-gray-900">
            <span className="text-gray-500">Total · </span>
            <span className="font-semibold">{formatINR(snap.totalAmount)}</span>
          </p>
        )}
      </div>

      {/* Interactive row */}
      <div className="mt-5 grid w-full grid-cols-3 gap-2">
        {calendarUrl ? (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 active:scale-95"
          >
            <Calendar className="h-5 w-5 text-brand-maroon-500" />
            Add to Calendar
          </a>
        ) : (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 px-2 py-3 text-xs font-medium text-gray-400">
            <Calendar className="h-5 w-5" />
            Add to Calendar
          </div>
        )}

        <button
          type="button"
          onClick={handleShare}
          className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 active:scale-95"
        >
          <Share2 className="h-5 w-5 text-brand-maroon-500" />
          Share
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 active:scale-95"
        >
          {copied ? (
            <Check className="h-5 w-5 text-green-600" />
          ) : (
            <Copy className="h-5 w-5 text-brand-maroon-500" />
          )}
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>

      {shareError && (
        <p className="mt-2 text-xs text-red-600" role="status">
          {shareError}
        </p>
      )}

      {/* Primary CTAs */}
      <div className="mt-6 flex w-full flex-col gap-3">
        <Button
          asChild
          size="lg"
          className="w-full bg-brand-maroon-500 hover:bg-brand-maroon-600 text-white rounded-xl"
        >
          <Link href="/customer/bookings">View My Bookings</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full rounded-xl">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}
