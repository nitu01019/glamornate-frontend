/**
 * Phase 5 (Booking Flow Fix v3.1, 2026-05-02): regression test that the
 * wizard's RESET action zeroes every field. The Issue D root cause was
 * the legacy 11-useState wizard had no atomic reset — this test pins
 * that the new useReducer one does.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBookingWizard } from '../../app/customer/book-new/_hooks/useBookingWizard';

describe('useBookingWizard', () => {
  it('starts at step 1 with empty selections', () => {
    // 2026-05-13 (r2): step 1 is Home/Salon. The reducer default
    // `bookingLocationKind: 'spa'` satisfies the canProceed gate on mount
    // (the user can tap Next without touching anything — the salon is the
    // implicit default location for a single-salon app).
    const { result } = renderHook(() => useBookingWizard());
    expect(result.current.state.step).toBe(1);
    expect(result.current.state.selectedSpa).toBeNull();
    expect(result.current.state.selectedServices).toEqual([]);
    expect(result.current.canProceed).toBe(true);
  });

  it('SET_SPA stores the spa silently — step 1 is location, not spa/services', () => {
    // 2026-05-13 (r2): wizard collapsed to 3 cart-driven steps. Step 1 is
    // Home/Salon — services come pre-loaded from cart and spa is auto-set by
    // the presenter, so neither SET_SPA nor TOGGLE_SERVICE affects step-1
    // canProceed. The default `bookingLocationKind: 'spa'` already passes.
    const { result } = renderHook(() => useBookingWizard());
    act(() => {
      result.current.actions.setSpa({ id: 'spa-1', name: 'Test Spa' } as never);
    });
    expect(result.current.state.selectedSpa?.id).toBe('spa-1');
    // Step 1 canProceed gates on location decided, which the initial
    // 'spa' kind satisfies — adding services / spa is no longer required.
    expect(result.current.canProceed).toBe(true);
  });

  it('SET_SPA to a different spa clears downstream selections', () => {
    const { result } = renderHook(() => useBookingWizard());
    act(() => {
      result.current.actions.setSpa({ id: 'spa-1', name: 'A' } as never);
      result.current.actions.toggleService('svc-1');
      result.current.actions.setTime('14:00');
    });
    expect(result.current.state.selectedServices).toHaveLength(1);

    act(() => {
      result.current.actions.setSpa({ id: 'spa-2', name: 'B' } as never);
    });
    expect(result.current.state.selectedServices).toEqual([]);
    expect(result.current.state.selectedTime).toBeNull();
  });

  it('SET_DATE clears selectedTime', () => {
    const { result } = renderHook(() => useBookingWizard());
    act(() => {
      result.current.actions.setTime('14:00');
      result.current.actions.setDate(new Date('2026-05-02T14:00:00Z'));
    });
    expect(result.current.state.selectedTime).toBeNull();
  });

  it('TOGGLE_SERVICE adds then removes', () => {
    const { result } = renderHook(() => useBookingWizard());
    act(() => result.current.actions.toggleService('svc-1'));
    expect(result.current.state.selectedServices).toEqual([{ id: 'svc-1', quantity: 1 }]);
    act(() => result.current.actions.toggleService('svc-1'));
    expect(result.current.state.selectedServices).toEqual([]);
  });

  it('UPDATE_SERVICE_QUANTITY clamps at 1', () => {
    const { result } = renderHook(() => useBookingWizard());
    act(() => {
      result.current.actions.toggleService('svc-1');
      result.current.actions.updateServiceQuantity('svc-1', -5);
    });
    expect(result.current.state.selectedServices[0].quantity).toBe(1);
  });

  it('reset() returns every field to its initial value', () => {
    const { result } = renderHook(() => useBookingWizard());
    act(() => {
      result.current.actions.setSpa({ id: 'spa-1', name: 'Test' } as never);
      result.current.actions.toggleService('svc-1');
      result.current.actions.setDate(new Date('2026-05-02T14:00:00Z'));
      result.current.actions.setTime('14:00');
      result.current.actions.nextStep();
      result.current.actions.nextStep();
    });
    expect(result.current.state.step).toBeGreaterThan(1);

    act(() => result.current.reset());

    expect(result.current.state).toMatchObject({
      step: 1,
      selectedSpa: null,
      selectedServices: [],
      selectedTherapist: null,
      selectedDate: null,
      selectedTime: null,
      bookingLocationKind: 'spa',
      customerLocation: null,
    });
    // Reset returns to step 1 (Home/Salon) with default `bookingLocationKind:
    // 'spa'`, which satisfies canProceed — same invariant as initial mount.
    expect(result.current.canProceed).toBe(true);
  });

  it('NEXT_STEP / PREV_STEP clamps to [1, 3]', () => {
    // 2026-05-13 (r2): wizard now 3 cart-driven steps (Location → Time → Confirm).
    const { result } = renderHook(() => useBookingWizard());
    act(() => {
      for (let i = 0; i < 10; i++) result.current.actions.nextStep();
    });
    expect(result.current.state.step).toBe(3);
    act(() => {
      for (let i = 0; i < 10; i++) result.current.actions.prevStep();
    });
    expect(result.current.state.step).toBe(1);
  });
});
