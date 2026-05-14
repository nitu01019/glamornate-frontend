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
import { useActiveSpa } from '@/hooks/useSpas';
import { useSpaTherapists } from '@/hooks/useTherapists';
import { BookingBottomBar } from './_components/BookingBottomBar';
import { BookingHeader } from './_components/BookingHeader';
import { BookingLocationStep } from './_components/BookingLocationStep';
import { BookingSuccessOverlay } from './_components/BookingSuccessOverlay';
import { ConfirmStep } from './_components/ConfirmStep';
import { ScheduleStep } from './_components/ScheduleStep';
import { generateDates } from './_utils/dateHelpers';
import { useBookingWizard } from './_hooks/useBookingWizard';
import { useBookingSubmission } from './_hooks/useBookingSubmission';
import { FRESH_START_HINT } from '@/lib/booking/copy';
import { useCartStore, useHasHydrated } from '@/store/cart';

// 2026-05-13 (r2): wizard reduced to 3 cart-driven steps. Services come from
// the cart store; no in-wizard service picker. Spa auto-resolved via
// `useActiveSpa()`. Flow: Location → Time → Confirm.
const STEP_TITLES = ['Home or Salon', 'Pick Date & Time', 'Confirm'];
const TOTAL_STEPS = 3;

function NewBookingContent() {
  const router = useRouter();
  const { authResolved } = useAuth();
  const { state, actions, reset, canProceed } = useBookingWizard();
  const {
    step,
    selectedSpa,
    selectedServices,
    selectedTherapist,
    selectedDate,
    selectedTime,
    bookingLocationKind,
    customerLocation,
  } = state;

  // Phase 4.5 (Booking Flow Fix v3.1, 2026-05-02, Patch DR-5): post-success
  // mount hint. After a booking succeeds and we router.replace, the user
  // hardware-backs into a fresh wizard — without this affordance the
  // jump feels abrupt. Auto-dismisses in 10 s; reduced-motion bypasses
  // the animation via the CSS `motion-reduce:` modifier.
  const [showFreshStart, setShowFreshStart] = useState(false);

  // Post-submit celebration. Renders `BookingSuccessOverlay` for ~1.8 s,
  // then `router.replace`s to the booking detail page. Keeps the wizard
  // state live during the animation (we reset right before navigating)
  // so the confetti can read the last total etc. if we ever surface it.
  const [showSuccess, setShowSuccess] = useState(false);

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

  // Single-salon: read the one active spa from Firestore and stamp it onto
  // the wizard. Downstream queries (services, therapists, availability) read
  // from `selectedSpa.id`, so this is the only place the resolution happens.
  const activeSpaQuery = useActiveSpa();
  const activeSpa = activeSpaQuery.data;
  // Temporary debug — surface the activeSpa state to logcat so we can see
  // whether the query is loading, errored, or returned null.
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.warn(
      'page.book-new.activeSpa',
      JSON.stringify({
        loading: activeSpaQuery.isLoading,
        error: activeSpaQuery.error ? String(activeSpaQuery.error) : null,
        spaId: activeSpa?.id ?? null,
        spaName: activeSpa?.name ?? null,
      }),
    );
  }, [activeSpaQuery.isLoading, activeSpaQuery.error, activeSpa]);
  useEffect(() => {
    if (activeSpa && state.selectedSpa?.id !== activeSpa.id) {
      actions.setSpa(activeSpa);
    }
  }, [activeSpa, state.selectedSpa, actions]);

  // Cart → wizard hydration. The user picks services on the catalog pages and
  // they land in `useCartStore.items`. When the wizard mounts, we copy those
  // items into `selectedServices` once (only when the wizard is still empty
  // and the cart store has finished hydrating from localStorage). If the
  // cart is empty AND the wizard has no services, the user reached this
  // route directly — bounce them back to /services so they can pick something.
  const cartHydrated = useHasHydrated();
  const cartItems = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  useEffect(() => {
    if (!cartHydrated) return;
    if (state.selectedServices.length > 0) return;
    if (cartItems.length === 0) {
      router.replace('/services');
      return;
    }
    actions.setServices(cartItems.map((i) => ({ id: i.serviceId, quantity: i.quantity })));
  }, [cartHydrated, cartItems, state.selectedServices.length, actions, router]);

  const { data: therapists = [], isLoading: therapistsLoading } = useSpaTherapists(selectedSpa?.id);

  const dates = useMemo(() => (now ? generateDates(now) : []), [now]);

  // Cart-direct totals (Phase 6, 2026-05-13). Was previously joined against
  // `useSpaServices(spaId)`, which mismatched the cart's catalog `Service.id`
  // against the per-spa subcollection's `compositeId` → every lookup
  // returned undefined → ₹0/60min/"Service". The cart already snapshots
  // name+price+duration at add-time, so we read it directly here.
  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems],
  );

  const {
    submit,
    isSubmitting,
    error: submitError,
    clearError,
  } = useBookingSubmission({
    wizard: state,
    cartItems,
    onSuccess: (bookingId) => {
      // Booking confirmed — clear the cart so the next mount starts fresh,
      // surface the celebration overlay for the user, then navigate to the
      // booking detail. 1.8 s gives the check-pop animation + the message
      // its full run; longer feels sluggish, shorter feels rushed.
      clearCart();
      setShowSuccess(true);
      setShowFreshStart(true);
      window.setTimeout(() => {
        reset();
        router.replace(`/customer/bookings/${bookingId}`);
      }, 1800);
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

      <main className="flex-1 overflow-y-auto pb-40">
        {/* Step 1 — Home or Salon. Services already loaded from cart by the
            effect above; spa auto-resolved via useActiveSpa(). */}
        {step === 1 && (
          // <APIProviderRoot> moved to /customer/layout.tsx so Maps JS
          // is available across the whole customer surface. Plan §6 Step 7.
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
            onContinue={actions.nextStep}
            canProceed={canProceed}
          />
        )}

        {step === 2 && (
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
            onContinue={actions.nextStep}
            canProceed={canProceed}
          />
        )}

        {step === 3 && (
          <ConfirmStep
            selectedSpa={selectedSpa}
            cartItems={cartItems}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            selectedTherapist={selectedTherapist}
            bookingLocation={bookingLocationKind}
            customerLocation={customerLocation}
            onConfirm={submit}
            isCreating={isSubmitting}
            errorMessage={submitError}
            onDismissError={clearError}
          />
        )}
      </main>

      {/* Bottom bar is rendered only on steps 1-2; Step 3 owns its own
          inline Confirm CTA (single source of truth, removes z-index
          overlap that previously let the error toast eat the tap). */}
      {step < TOTAL_STEPS && (
        <BookingBottomBar
          step={step}
          totalSteps={TOTAL_STEPS}
          selectedServices={selectedServices}
          total={cartTotal}
          subtotal={cartTotal}
          isCreating={isSubmitting}
          canProceed={canProceed}
          onNext={actions.nextStep}
          onConfirm={submit}
        />
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

      <BookingSuccessOverlay open={showSuccess} />
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
