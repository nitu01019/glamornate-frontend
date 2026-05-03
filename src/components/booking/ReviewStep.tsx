'use client';

import { useState, useCallback, useRef } from 'react';
import { ChevronLeft, Loader2, MapPin, Clock, Calendar, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useBookingStore } from '@/store/booking';
import { useCartStore } from '@/store/cart';
import { useCreateBooking } from '@/hooks/useBookings';
import { useAuth } from '@/lib/auth-provider';
import { formatTimeLabel } from '@/lib/slot-utils';
import { firebaseClientWrapper } from '@/lib/firebase-client-wrapper';
import { logger } from '@/lib/logger';
import { getUserFriendlyMessage } from '@/lib/error-handler';
import * as Sentry from '@sentry/nextjs';
import CouponInput from '@/components/coupon/CouponInput';

const log = logger.child({ component: 'ReviewStep' });

interface ReviewStepProps {
  onNext: () => void;
  onBack: () => void;
}

function formatBookingDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

/**
 * Calculate end time from a start time string (HH:MM) and duration in minutes.
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMins = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
}

export default function ReviewStep({ onNext, onBack }: ReviewStepProps) {
  const {
    spaId,
    therapistId,
    location,
    address,
    selectedDate,
    selectedTimeSlot,
    notes,
    isSubmitting,
    setNotes,
    setSubmitting,
    setBookingResult,
  } = useBookingStore();

  const { firebaseUser } = useAuth();
  const items = useCartStore((s) => s.items);
  const getTotal = useCartStore((s) => s.getTotal);
  const getTotalDuration = useCartStore((s) => s.getTotalDuration);
  const voucherCode = useCartStore((s) => s.voucherCode);
  const voucherDiscount = useCartStore((s) => s.voucherDiscount);
  const voucherName = useCartStore((s) => s.voucherName);
  const getDiscountedTotal = useCartStore((s) => s.getDiscountedTotal);
  const createBooking = useCreateBooking();

  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = getTotal();
  const finalTotal = getDiscountedTotal();
  const totalDuration = getTotalDuration();

  const locationLabel =
    location === 'spa'
      ? 'At Salon \u2014 Glamornate, Jammu'
      : `At Home \u2014 ${address?.fullAddress ?? ''}`;

  const handleConfirm = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    if (!selectedDate || !selectedTimeSlot || !location) {
      submittingRef.current = false;
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // Build serviceIds and services (with prices) from cart items
      const serviceIds = items.map((item) => item.serviceId);
      const services = items.map((item) => ({
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        price: item.price,
        quantity: item.quantity,
      }));

      // Calculate end time from selected start time + total duration
      const endTime = calculateEndTime(selectedTimeSlot, totalDuration || 60);

      const result = await createBooking.mutateAsync({
        spaId: spaId || 'glamornate-default',
        serviceIds,
        services,
        therapistId: therapistId || undefined,
        slot: {
          date: selectedDate,
          start: selectedTimeSlot,
          end: endTime,
          duration: totalDuration || 60,
        },
        customer: {
          name: firebaseUser?.displayName || 'Guest',
          phone: address?.phone || '',
          notes: notes.trim() || undefined,
        },
        specialRequests: notes.trim() || undefined,
      });

      // Redeem voucher if one was applied
      if (voucherCode) {
        try {
          await firebaseClientWrapper.callFunction('redeemVoucher', {
            code: voucherCode,
            bookingId: result.bookingId,
          });
        } catch (redeemError: unknown) {
          // Log but don't block -- booking is already created
          // The voucher will be applied server-side even if this fails
          log.warn('Failed to redeem voucher', {
            code: voucherCode,
            bookingId: result.bookingId,
            error: redeemError instanceof Error ? redeemError.message : String(redeemError),
          });
        }
      }

      setBookingResult({
        bookingId: result.bookingId,
      });
      onNext();
    } catch (err: unknown) {
      const message = getUserFriendlyMessage(err);
      setError(message);
      Sentry.captureException(err, { tags: { source: 'review-step' } });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    selectedDate,
    selectedTimeSlot,
    location,
    spaId,
    therapistId,
    items,
    totalDuration,
    notes,
    firebaseUser,
    address,
    voucherCode,
    createBooking,
    setSubmitting,
    setBookingResult,
    onNext,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Review your booking</h2>
        <p className="mt-1 text-sm text-gray-500">Please confirm the details below</p>
      </div>

      {/* Summary card */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {/* Services list */}
        <div className="border-b border-gray-100 p-4">
          <p className="mb-2 text-sm font-semibold text-gray-700">Services</p>
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item.serviceId} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {item.serviceName}
                  {item.quantity > 1 && (
                    <span className="ml-1 text-gray-400">x{item.quantity}</span>
                  )}
                </span>
                <span className="font-medium text-gray-900">
                  {'\u20B9'}
                  {(item.price * item.quantity).toLocaleString('en-IN')}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Date / Time / Location */}
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-2 text-sm">
            <Calendar className="mt-0.5 h-4 w-4 text-brand-maroon-500" />
            <span className="text-gray-700">
              {selectedDate ? formatBookingDate(selectedDate) : '---'}
            </span>
          </div>

          <div className="flex items-start gap-2 text-sm">
            <Clock className="mt-0.5 h-4 w-4 text-brand-maroon-500" />
            <span className="text-gray-700">
              {selectedTimeSlot ? formatTimeLabel(selectedTimeSlot) : '---'}
              {totalDuration > 0 && (
                <span className="ml-1 text-gray-400">({formatDuration(totalDuration)})</span>
              )}
            </span>
          </div>

          <div className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 text-brand-maroon-500" />
            <span className="text-gray-700">{locationLabel}</span>
          </div>
        </div>

        {/* Coupon input */}
        <div className="border-t border-gray-100 px-4 py-3">
          <CouponInput />
        </div>

        {/* Billing breakdown */}
        <div className="border-t border-gray-100 px-4 py-3 space-y-2">
          {/* Subtotal */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Services</span>
            <span className="font-medium text-gray-900">
              {'\u20B9'}
              {subtotal.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Discount line (only when voucher applied) */}
          {voucherCode && voucherDiscount > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm text-brand-green-600">
                <Ticket className="h-3.5 w-3.5" />
                Coupon: {voucherName ?? voucherCode}
              </span>
              <span className="font-medium text-brand-green-600">
                -{'\u20B9'}
                {voucherDiscount.toLocaleString('en-IN')}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-gray-900">
              {'\u20B9'}
              {finalTotal.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Savings badge */}
          {voucherCode && voucherDiscount > 0 && (
            <div className="flex justify-end">
              <span className="bg-brand-green-50 text-brand-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                You save {'\u20B9'}
                {voucherDiscount.toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Special instructions */}
      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-gray-700">
          Special instructions (optional)
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any preferences or requests..."
          className="flex w-full rounded-lg border border-brand-maroon-200 bg-background px-3 py-2 text-sm placeholder:text-brand-maroon-400 focus-visible:outline-none focus-visible:border-brand-gold-500 focus-visible:ring-2 focus-visible:ring-brand-gold-500 focus-visible:ring-offset-0"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700 font-medium">
            Failed to create booking. Please try again.
          </p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className={cn('flex-1 gap-2', isSubmitting && 'cursor-wait')}
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Confirming...
            </>
          ) : (
            'Confirm Booking'
          )}
        </Button>
      </div>
    </div>
  );
}
