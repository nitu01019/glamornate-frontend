'use client';

/**
 * Booking wizard state machine.
 *
 * Phase 5 (Booking Flow Fix v3.1, 2026-05-02): the legacy implementation
 * scattered eleven `useState` hooks across `book-new/page.tsx`, set them
 * one-by-one in the success path, and never reset them when the wizard
 * remounted. Combined with `router.push` (which keeps the page mounted),
 * a returning customer landed on a fully-populated wizard pointed at the
 * booking they had just made (Issue D — stuck on same booking).
 *
 * `useBookingWizard` collapses every wizard field into one `useReducer`
 * state plus an explicit `RESET` action. The presenter calls `reset()`
 * inside its success handler, then `router.replace()` to the detail
 * page; the next mount of `/customer/book-new` sees a clean state.
 *
 * The hook intentionally exposes only typed setter actions (no raw
 * dispatch) so call sites cannot drift state into impossible shapes
 * (e.g. step 5 with no spa).
 */
import { useReducer, useCallback } from 'react';
import type { BookingCustomerLocation } from '@/shared/contracts';
import type { SpaWithId } from '@/hooks/useSpas';
import type { TherapistWithId } from '@/hooks/useTherapists';

export interface ServiceSelection {
  id: string;
  quantity: number;
}

/**
 * 2026-05-13 (revision 2): wizard collapsed further to 3 steps after the user
 * clarified that services are already chosen in cart before the wizard mounts.
 * Cart → "Proceed to Book" → wizard hydrates `selectedServices` from the cart
 * store and lands directly on step 1.
 *   1 = Home or Salon (BookingLocationStep)
 *   2 = Pick Date + Time (ScheduleStep)
 *   3 = Confirm (ConfirmStep)
 * `selectedSpa` is auto-resolved via `useActiveSpa()`; `selectedServices` is
 * hydrated from `useCartStore` items on mount.
 */
export type WizardStep = 1 | 2 | 3;

export type BookingLocationKind = 'spa' | 'home';

export interface WizardState {
  step: WizardStep;
  selectedSpa: SpaWithId | null;
  selectedServices: ServiceSelection[];
  selectedTherapist: TherapistWithId | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  bookingLocationKind: BookingLocationKind;
  customerLocation: BookingCustomerLocation | null;
}

const INITIAL_STATE: WizardState = {
  step: 1,
  selectedSpa: null,
  selectedServices: [],
  selectedTherapist: null,
  selectedDate: null,
  selectedTime: null,
  bookingLocationKind: 'spa',
  customerLocation: null,
};

type WizardAction =
  | { type: 'SET_SPA'; spa: SpaWithId | null }
  | { type: 'SET_SERVICES'; services: ServiceSelection[] }
  | { type: 'TOGGLE_SERVICE'; serviceId: string }
  | { type: 'UPDATE_SERVICE_QUANTITY'; serviceId: string; delta: number }
  | { type: 'SET_THERAPIST'; therapist: TherapistWithId | null }
  | { type: 'SET_DATE'; date: Date | null }
  | { type: 'SET_TIME'; time: string | null }
  | { type: 'SET_LOCATION_KIND'; kind: BookingLocationKind }
  | { type: 'SET_CUSTOMER_LOCATION'; location: BookingCustomerLocation | null }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'RESET' };

function clampStep(n: number): WizardStep {
  if (n < 1) return 1;
  if (n > 3) return 3;
  return n as WizardStep;
}

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_SPA':
      // Switching spas invalidates downstream selections — protects against
      // booking a service the new spa doesn't offer (Phase 9C invariant).
      if (state.selectedSpa?.id === action.spa?.id) {
        return { ...state, selectedSpa: action.spa };
      }
      return {
        ...state,
        selectedSpa: action.spa,
        selectedServices: [],
        selectedTherapist: null,
        selectedDate: null,
        selectedTime: null,
      };
    case 'SET_SERVICES':
      return { ...state, selectedServices: action.services };
    case 'TOGGLE_SERVICE': {
      const has = state.selectedServices.some((s) => s.id === action.serviceId);
      return {
        ...state,
        selectedServices: has
          ? state.selectedServices.filter((s) => s.id !== action.serviceId)
          : [...state.selectedServices, { id: action.serviceId, quantity: 1 }],
      };
    }
    case 'UPDATE_SERVICE_QUANTITY':
      return {
        ...state,
        selectedServices: state.selectedServices.map((s) =>
          s.id === action.serviceId
            ? { ...s, quantity: Math.max(1, s.quantity + action.delta) }
            : s,
        ),
      };
    case 'SET_THERAPIST':
      return { ...state, selectedTherapist: action.therapist };
    case 'SET_DATE':
      return { ...state, selectedDate: action.date, selectedTime: null };
    case 'SET_TIME':
      return { ...state, selectedTime: action.time };
    case 'SET_LOCATION_KIND':
      return { ...state, bookingLocationKind: action.kind };
    case 'SET_CUSTOMER_LOCATION':
      return { ...state, customerLocation: action.location };
    case 'NEXT_STEP':
      return { ...state, step: clampStep(state.step + 1) };
    case 'PREV_STEP':
      return { ...state, step: clampStep(state.step - 1) };
    case 'RESET':
      return INITIAL_STATE;
    default:
      return state;
  }
}

export interface BookingWizardActions {
  setSpa(spa: SpaWithId | null): void;
  setServices(services: ServiceSelection[]): void;
  toggleService(serviceId: string): void;
  updateServiceQuantity(serviceId: string, delta: number): void;
  setTherapist(therapist: TherapistWithId | null): void;
  setDate(date: Date | null): void;
  setTime(time: string | null): void;
  setLocationKind(kind: BookingLocationKind): void;
  setCustomerLocation(location: BookingCustomerLocation | null): void;
  nextStep(): void;
  prevStep(): void;
}

export interface UseBookingWizardResult {
  state: WizardState;
  actions: BookingWizardActions;
  /** Atomically resets every wizard field to its initial value. */
  reset(): void;
  /** True when the user can advance past the current step. */
  canProceed: boolean;
}

export function useBookingWizard(): UseBookingWizardResult {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const actions: BookingWizardActions = {
    setSpa: useCallback((spa) => dispatch({ type: 'SET_SPA', spa }), []),
    setServices: useCallback((services) => dispatch({ type: 'SET_SERVICES', services }), []),
    toggleService: useCallback((serviceId) => dispatch({ type: 'TOGGLE_SERVICE', serviceId }), []),
    updateServiceQuantity: useCallback(
      (serviceId, delta) => dispatch({ type: 'UPDATE_SERVICE_QUANTITY', serviceId, delta }),
      [],
    ),
    setTherapist: useCallback((therapist) => dispatch({ type: 'SET_THERAPIST', therapist }), []),
    setDate: useCallback((date) => dispatch({ type: 'SET_DATE', date }), []),
    setTime: useCallback((time) => dispatch({ type: 'SET_TIME', time }), []),
    setLocationKind: useCallback((kind) => dispatch({ type: 'SET_LOCATION_KIND', kind }), []),
    setCustomerLocation: useCallback(
      (location) => dispatch({ type: 'SET_CUSTOMER_LOCATION', location }),
      [],
    ),
    nextStep: useCallback(() => dispatch({ type: 'NEXT_STEP' }), []),
    prevStep: useCallback(() => dispatch({ type: 'PREV_STEP' }), []),
  };

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  // 3-step flow (post 2026-05-13 r2 cart-driven refactor):
  //   1 location decided · 2 date+time picked · 3 confirm
  // `selectedSpa` is auto-resolved via `useActiveSpa()` in the presenter.
  // `selectedServices` is hydrated from `useCartStore` on mount; the wizard
  // redirects to `/services` if neither cart nor state has any services.
  let canProceed = false;
  if (state.step === 1)
    canProceed = state.bookingLocationKind === 'spa' || state.customerLocation !== null;
  else if (state.step === 2) canProceed = !!state.selectedDate && !!state.selectedTime;
  else if (state.step === 3) canProceed = true;

  return { state, actions, reset, canProceed };
}
