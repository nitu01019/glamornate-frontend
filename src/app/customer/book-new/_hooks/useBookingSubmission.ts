'use client';

/**
 * Booking submission hook — single mutation, cart-direct.
 *
 * Phase 5 (Booking Flow Fix v3.1, 2026-05-02) collapsed the legacy
 * createBookingDraft → createPaymentIntent → PaymentSheet → webhook pipeline
 * into a single server-side write. Phase 6 (2026-05-13) further removed the
 * `useSpaServices` join: the cart already snapshots `serviceName`, `price`,
 * and `duration` from the catalog at add-time, so the wizard never needs to
 * re-derive them.
 *
 * The hook accepts a typed `wizard` snapshot, the live `cartItems`, and an
 * `onSuccess(bookingId)` callback. The early-bail path now sets a
 * user-visible error and logs a warning — the previous silent return made
 * "tap does nothing" a debugging hellscape.
 */
import { useCallback, useMemo, useState } from 'react';
import { useCreateBooking } from '@/hooks/useBookings';
import { useAuth } from '@/lib/auth-provider';
import { useActiveSpa, type SpaWithId } from '@/hooks/useSpas';
import { logger } from '@/lib/logger';
import { getUserFriendlyMessage } from '@/lib/error-handler';
import { formatDateForStorage } from '../_utils/dateHelpers';
import { istDateAtTimeToUtc } from '@/lib/date-ist';
import type { WizardState } from './useBookingWizard';
import type { CartItem } from '@/types';

export interface UseBookingSubmissionArgs {
  wizard: WizardState;
  cartItems: CartItem[];
  onSuccess: (bookingId: string) => void;
}

export interface UseBookingSubmissionResult {
  submit(): Promise<void>;
  isSubmitting: boolean;
  error: string | null;
  clearError(): void;
}

export function useBookingSubmission({
  wizard,
  cartItems,
  onSuccess,
}: UseBookingSubmissionArgs): UseBookingSubmissionResult {
  const { user } = useAuth();
  const createBookingMutation = useCreateBooking();
  // Phase 7 (2026-05-13): resolve the spa from the canonical hook instead of
  // relying on the wizard's `selectedSpa` being stamped in time. Glamornate
  // is single-salon — there is only ever one active spa — so we always use
  // `useActiveSpa()` as the source of truth. Previously the wizard's
  // spa-stamping effect (page.tsx) could race the user's tap, leading to
  // `selectedSpa: null` at submit time and a silent abort.
  const { data: activeSpa } = useActiveSpa();
  // Single-salon: backend validates spaId server-side, so we don't need a
  // runtime Firestore round-trip to know it. Falling back to the canonical
  // constant keeps the submit path resilient when useActiveSpa hasn't resolved
  // (cold start, transient network failure, App Check token retrieval delay).
  // Keep the literal in sync with backend/scripts/seed-glamornate-spa.mjs.
  // useMemo stabilises the reference so useCallback deps below don't churn.
  const spa = useMemo<SpaWithId>(
    () => activeSpa ?? wizard.selectedSpa ?? ({ id: 'glamornate-default' } as SpaWithId),
    [activeSpa, wizard.selectedSpa],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!spa || !wizard.selectedDate || !wizard.selectedTime || cartItems.length === 0) {
      const bailReason = {
        hasSpa: !!spa,
        spaId: spa?.id ?? null,
        hasDate: !!wizard.selectedDate,
        dateIso: wizard.selectedDate?.toISOString?.() ?? null,
        hasTime: !!wizard.selectedTime,
        time: wizard.selectedTime ?? null,
        cartCount: cartItems.length,
      };
      // eslint-disable-next-line no-console
      console.warn('booking.submit.aborted', JSON.stringify(bailReason));
      logger.warn(
        'booking.submit.aborted',
        { component: 'book-new/useBookingSubmission' },
        bailReason,
      );
      setError('Please complete every step before confirming.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const totalDuration = cartItems.reduce((sum, item) => sum + item.duration * item.quantity, 0);

      const [hours, minutes] = wizard.selectedTime.split(':').map(Number);
      const endHours = hours + Math.floor((minutes + totalDuration) / 60);
      const endMinutes = (minutes + totalDuration) % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

      const bookingServices = cartItems.map((item) => ({
        serviceId: item.serviceId,
        name: item.serviceName,
        price: item.price,
        duration: item.duration,
        quantity: item.quantity,
      }));

      const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const tax = Math.round(subtotal * 0.18);
      const platformFee = 50;
      const total = subtotal + tax + platformFee;

      const bookingData = {
        spaId: spa.id,
        therapistId: wizard.selectedTherapist?.id,
        serviceIds: cartItems.map((i) => i.serviceId),
        slot: {
          date: formatDateForStorage(wizard.selectedDate),
          start: wizard.selectedTime,
          end: endTime,
          duration: totalDuration,
        },
        services: bookingServices,
        pricing: { services: subtotal, addons: 0, tax, discount: 0, platformFee, total },
        customer: {
          name: user?.profile?.displayName || 'Guest',
          phone: user?.profile?.phone || '',
        },
        reminderSent: { at_24hr: false, at_2hr: false },
        createdBy: 'customer' as const,
        // scheduledAt is the IST wall-clock instant in UTC.
        scheduledAt: istDateAtTimeToUtc(
          formatDateForStorage(wizard.selectedDate),
          wizard.selectedTime,
        ).toISOString(),
        bookingLocation: wizard.bookingLocationKind,
        ...(wizard.bookingLocationKind === 'home' &&
          wizard.customerLocation && { customerLocation: wizard.customerLocation }),
      };

      logger.info(
        'booking.submit.start',
        { component: 'book-new/useBookingSubmission' },
        {
          spaId: bookingData.spaId,
          serviceCount: cartItems.length,
          totalDuration,
        },
      );

      const { bookingId } = await createBookingMutation.mutateAsync(bookingData);

      logger.info(
        'booking.submit.ok',
        { component: 'book-new/useBookingSubmission' },
        { bookingId },
      );

      onSuccess(bookingId);
    } catch (err) {
      logger.error('booking.submit.failed', err, {
        component: 'book-new/useBookingSubmission',
      });
      setError(getUserFriendlyMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [spa, wizard, cartItems, user, createBookingMutation, onSuccess]);

  const clearError = useCallback(() => setError(null), []);

  return { submit, isSubmitting, error, clearError };
}
