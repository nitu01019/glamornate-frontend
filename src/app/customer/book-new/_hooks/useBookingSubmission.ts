'use client';

/**
 * Booking submission hook — single mutation, no Stripe.
 *
 * Phase 5 (Booking Flow Fix v3.1, 2026-05-02): the legacy submission
 * pipeline ran createBookingDraft → createPaymentIntent → PaymentSheet →
 * webhook → router.push. Phase 1 collapsed all that into one server-side
 * write that lands directly on `'confirmed'`, so the client side reduces
 * to a single mutation.
 *
 * The hook owns nothing about the wizard's UI shape — it accepts a typed
 * `wizard` snapshot and an `onSuccess(bookingId)` callback. The presenter
 * decides what reset / route policy to apply.
 */
import { useCallback, useState } from 'react';
import { useCreateBooking } from '@/hooks/useBookings';
import { useAuth } from '@/lib/auth-provider';
import { useSpaServices } from '@/hooks/useServices';
import { logger } from '@/lib/logger';
import { getUserFriendlyMessage } from '@/lib/error-handler';
import { formatDateForStorage } from '../_utils/dateHelpers';
import { istDateAtTimeToUtc } from '@/lib/date-ist';
import type { WizardState } from './useBookingWizard';

export interface UseBookingSubmissionArgs {
  wizard: WizardState;
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
  onSuccess,
}: UseBookingSubmissionArgs): UseBookingSubmissionResult {
  const { user } = useAuth();
  const createBookingMutation = useCreateBooking();
  const { data: spaServices = [] } = useSpaServices(wizard.selectedSpa?.id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (
      !wizard.selectedSpa ||
      !wizard.selectedDate ||
      !wizard.selectedTime ||
      wizard.selectedServices.length === 0
    ) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const totalDuration = wizard.selectedServices.reduce((sum, sel) => {
        const svc = spaServices.find((s) => s.id === sel.id);
        const d = svc?.durationOverride ?? svc?.service?.baseDuration ?? 60;
        return sum + d * sel.quantity;
      }, 0);

      const [hours, minutes] = wizard.selectedTime.split(':').map(Number);
      const endHours = hours + Math.floor((minutes + totalDuration) / 60);
      const endMinutes = (minutes + totalDuration) % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

      const bookingServices = wizard.selectedServices.map((sel) => {
        const svc = spaServices.find((s) => s.id === sel.id);
        return {
          serviceId: sel.id,
          name: svc?.customName || svc?.service?.name || '',
          price: svc?.priceOverride ?? svc?.service?.basePrice ?? 0,
          duration: svc?.durationOverride ?? svc?.service?.baseDuration ?? 0,
          quantity: sel.quantity,
        };
      });

      const subtotal = wizard.selectedServices.reduce((sum, sel) => {
        const svc = spaServices.find((s) => s.id === sel.id);
        const price = svc?.priceOverride ?? svc?.service?.basePrice ?? 0;
        return sum + price * sel.quantity;
      }, 0);
      const tax = Math.round(subtotal * 0.18);
      const platformFee = 50;
      const total = subtotal + tax + platformFee;

      const bookingData = {
        spaId: wizard.selectedSpa.id,
        therapistId: wizard.selectedTherapist?.id,
        serviceIds: wizard.selectedServices.map((s) => s.id),
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
        // Phase 2 (Booking Flow Fix v3.1, 2026-05-02): scheduledAt is the
        // IST wall-clock instant in UTC. The legacy `new Date(`${date}T${time}`)`
        // shifted the timestamp by +05:30 because the runtime parsed the
        // string as UTC.
        scheduledAt: istDateAtTimeToUtc(
          formatDateForStorage(wizard.selectedDate),
          wizard.selectedTime,
        ).toISOString(),
        bookingLocation: wizard.bookingLocationKind,
        ...(wizard.bookingLocationKind === 'home' &&
          wizard.customerLocation && { customerLocation: wizard.customerLocation }),
      };

      const { bookingId } = await createBookingMutation.mutateAsync(bookingData);
      onSuccess(bookingId);
    } catch (err) {
      logger.error('useBookingSubmission.submit failed', err, {
        component: 'book-new/useBookingSubmission',
      });
      setError(getUserFriendlyMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [wizard, spaServices, user, createBookingMutation, onSuccess]);

  const clearError = useCallback(() => setError(null), []);

  return { submit, isSubmitting, error, clearError };
}
