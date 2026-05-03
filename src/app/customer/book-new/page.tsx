'use client';

/**
 * Booking wizard presenter.
 *
 * Phase 5 (Booking Flow Fix v3.1, 2026-05-02) — full rewrite per plan
 * §Wave 4 W4-C. The previous implementation owned eleven `useState` hooks
 * inline and never reset them on success, so a returning customer landed
 * on a fully-populated wizard pointing at the booking they had just made
 * (Issue D). This presenter delegates state to `useBookingWizard` and
 * mutation to `useBookingSubmission`. On success it `wizard.reset()`s the
 * state atomically, then `router.replace`s to the detail page so hardware
 * back lands on `/customer/bookings`.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-provider';
import { useSpas } from '@/hooks/useSpas';
import { useSpaServices } from '@/hooks/useServices';
import { useSpaTherapists } from '@/hooks/useTherapists';
import { useAvailableSlots } from '@/hooks/useAvailability';
import { APIProviderRoot } from '@/components/maps/APIProviderRoot';
import { BookingBottomBar } from './_components/BookingBottomBar';
import { BookingHeader } from './_components/BookingHeader';
import { BookingLocationStep } from './_components/BookingLocationStep';
import { ConfirmStep } from './_components/ConfirmStep';
import { ScheduleStep } from './_components/ScheduleStep';
import { ServiceListStep } from './_components/ServiceListStep';
import { SpaListStep } from './_components/SpaListStep';
import { formatDateForStorage, generateDates } from './_utils/dateHelpers';
import { useBookingWizard } from './_hooks/useBookingWizard';
import { useBookingSubmission } from './_hooks/useBookingSubmission';
import { FRESH_START_HINT } from '@/lib/booking/copy';

const STEP_TITLES = [
  'Select Spa',
  'Choose Services',
  'Pick Time',
  'Confirm Location',
  'Confirm',
];
const TOTAL_STEPS = 5;

function NewBookingContent() {
  const router = useRouter();
  const { authResolved } = useAuth();
  const { state, actions, reset, canProceed } = useBookingWizard();
  const { step, selectedSpa, selectedServices, selectedTherapist, selectedDate, selectedTime, bookingLocationKind, customerLocation } = state;

  // Phase 4.5 (Booking Flow Fix v3.1, 2026-05-02, Patch DR-5): post-success
  // mount hint. After a booking succeeds and we router.replace, the user
  // hardware-backs into a fresh wizard — without this affordance the
  // jump feels abrupt. Auto-dismisses in 10 s; reduced-motion bypasses
  // the animation via the CSS `motion-reduce:` modifier.
  const [showFreshStart, setShowFreshStart] = useState(false);

  // Defer `new Date()` to post-mount to avoid SSR/CSR hydration drift.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  useEffect(() => {
    if (!showFreshStart) return;
    const id = setTimeout(() => setShowFreshStart(false), 10_000);
    return () => clearTimeout(id);
  }, [showFreshStart]);

  const { data: spas = [], isLoading: spasLoading, error: spasError, refetch: refetchSpas } =
    useSpas({ status: 'active' });
  const { data: spaServices = [], isLoading: servicesLoading } = useSpaServices(selectedSpa?.id);
  const { data: therapists = [], isLoading: therapistsLoading } = useSpaTherapists(selectedSpa?.id);

  const dates = useMemo(() => (now ? generateDates(now) : []), [now]);

  const totalDuration = useMemo(
    () =>
      selectedServices.reduce((total, sel) => {
        const svc = spaServices.find((s) => s.id === sel.id);
        const d = svc?.durationOverride ?? svc?.service?.baseDuration ?? 60;
        return total + d * sel.quantity;
      }, 0),
    [selectedServices, spaServices],
  );

  const dateStr = selectedDate ? formatDateForStorage(selectedDate) : null;
  const { data: availabilityData, isLoading: slotsLoading } = useAvailableSlots(
    selectedSpa?.id && dateStr
      ? {
          spaId: selectedSpa.id,
          date: dateStr,
          therapistId: selectedTherapist?.id,
          serviceDuration: totalDuration,
        }
      : null,
  );

  const subtotal = selectedServices.reduce((sum, sel) => {
    const svc = spaServices.find((s) => s.id === sel.id);
    const price = svc?.priceOverride ?? svc?.service?.basePrice ?? 0;
    return sum + price * sel.quantity;
  }, 0);
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax + 50;

  const { submit, isSubmitting, error: submitError, clearError } = useBookingSubmission({
    wizard: state,
    onSuccess: (bookingId) => {
      reset();
      setShowFreshStart(true);
      router.replace(`/customer/bookings/${bookingId}`);
    },
  });

  const prevStep = () => {
    if (step > 1) actions.prevStep();
    else router.back();
  };

  // Phase 6 (Booking Flow Fix v3.1, 2026-05-02): wait for `authResolved`
  // before rendering the wizard chrome. The legacy gate on `firebaseUser`
  // alone evaluated to `false` during the Capacitor cold-start race and
  // briefly rendered a "no spas" state.
  if (!authResolved) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <BookingHeader
        step={step}
        totalSteps={TOTAL_STEPS}
        stepTitle={STEP_TITLES[step - 1]}
        onBack={prevStep}
        onClose={() => router.push('/customer/dashboard')}
      />

      <main className="flex-1 overflow-y-auto pb-32">
        {step === 1 && (
          <SpaListStep
            spas={spas}
            isLoading={spasLoading}
            error={spasError}
            selectedSpa={selectedSpa}
            onSelect={actions.setSpa}
            onRetry={() => refetchSpas()}
          />
        )}

        {step === 2 && (
          <ServiceListStep
            spaServices={spaServices}
            isLoading={servicesLoading}
            selectedServices={selectedServices}
            onToggle={actions.toggleService}
            onQuantityChange={actions.updateServiceQuantity}
          />
        )}

        {step === 3 && (
          <ScheduleStep
            therapists={therapists}
            therapistsLoading={therapistsLoading}
            selectedTherapist={selectedTherapist}
            onTherapistSelect={actions.setTherapist}
            dates={dates}
            now={now}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onDateSelect={actions.setDate}
            onTimeSelect={actions.setTime}
            slots={availabilityData?.slots}
            slotsLoading={slotsLoading}
          />
        )}

        {step === 4 && (
          <APIProviderRoot>
            <BookingLocationStep
              spaCoords={
                selectedSpa?.location?.geo
                  ? { lat: selectedSpa.location.geo.lat, lng: selectedSpa.location.geo.lng }
                  : null
              }
              spaName={selectedSpa?.name ?? null}
              bookingLocationKind={bookingLocationKind}
              onKindChange={actions.setLocationKind}
              onChange={actions.setCustomerLocation}
            />
          </APIProviderRoot>
        )}

        {step === 5 && (
          <ConfirmStep
            selectedSpa={selectedSpa}
            selectedServices={selectedServices}
            spaServices={spaServices}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            selectedTherapist={selectedTherapist}
            totalDuration={totalDuration}
            subtotal={subtotal}
            tax={tax}
            total={total}
            bookingLocation={bookingLocationKind}
            customerLocation={customerLocation}
          />
        )}
      </main>

      <BookingBottomBar
        step={step}
        totalSteps={TOTAL_STEPS}
        selectedServices={selectedServices}
        total={total}
        subtotal={subtotal}
        isCreating={isSubmitting}
        canProceed={canProceed}
        onNext={actions.nextStep}
        onConfirm={submit}
      />

      {submitError && (
        <div
          role="alert"
          aria-live="polite"
          className="fixed bottom-32 left-4 right-4 z-50 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 shadow-lg md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-md"
          onClick={clearError}
        >
          {submitError}
        </div>
      )}

      {showFreshStart && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 left-4 right-4 z-50 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 shadow-lg md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-md transition-opacity motion-reduce:transition-none"
        >
          {FRESH_START_HINT}
        </div>
      )}
    </div>
  );
}

export default function NewBookingPage() {
  return (
    <ProtectedRoute requiredRoles={['customer']}>
      <NewBookingContent />
    </ProtectedRoute>
  );
}
