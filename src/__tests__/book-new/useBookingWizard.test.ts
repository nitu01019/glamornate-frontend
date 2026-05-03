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
    const { result } = renderHook(() => useBookingWizard());
    expect(result.current.state.step).toBe(1);
    expect(result.current.state.selectedSpa).toBeNull();
    expect(result.current.state.selectedServices).toEqual([]);
    expect(result.current.canProceed).toBe(false);
  });

  it('SET_SPA on first call selects the spa and arms canProceed', () => {
    const { result } = renderHook(() => useBookingWizard());
    act(() => {
      result.current.actions.setSpa({ id: 'spa-1', name: 'Test Spa' } as never);
    });
    expect(result.current.state.selectedSpa?.id).toBe('spa-1');
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
    expect(result.current.canProceed).toBe(false);
  });

  it('NEXT_STEP / PREV_STEP clamps to [1, 5]', () => {
    const { result } = renderHook(() => useBookingWizard());
    act(() => {
      for (let i = 0; i < 10; i++) result.current.actions.nextStep();
    });
    expect(result.current.state.step).toBe(5);
    act(() => {
      for (let i = 0; i < 10; i++) result.current.actions.prevStep();
    });
    expect(result.current.state.step).toBe(1);
  });
});
