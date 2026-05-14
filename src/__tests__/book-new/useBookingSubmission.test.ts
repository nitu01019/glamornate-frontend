/**
 * Regression tests for `useBookingSubmission`.
 *
 * Phase 6 (Booking Flow Fix v3.1, 2026-05-13) rewired the hook to read
 * service name/price/duration directly from cart items instead of joining
 * against `useSpaServices`. The legacy join broke when the cart's catalog
 * Service.id did not match any per-spa subcollection doc id — every lookup
 * returned undefined and the confirm screen rendered ₹0.
 *
 * Test cases:
 *   1. Successful mutateAsync → onSuccess(bookingId) is called, and the
 *      payload's `services[]` reflects cart name/price/duration verbatim.
 *   2. Rejected mutateAsync → `error` state is set, onSuccess is NOT called.
 *   3. Empty cart → silent-bail eliminated: hook sets a user-visible error
 *      ("Please complete every step before confirming.") instead of
 *      returning silently.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mutateAsyncSpy = vi.fn();

vi.mock('@/hooks/useBookings', () => ({
  useCreateBooking: () => ({
    mutateAsync: mutateAsyncSpy,
    isPending: false,
    isError: false,
  }),
}));

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({
    user: { profile: { displayName: 'Tester', phone: '+919999999999' } },
    firebaseUser: { uid: 'u-1' },
  }),
}));

// useActiveSpa — the hook now resolves the spa directly (Phase 7 single-salon
// refactor). Always returns the seeded Glamornate spa.
vi.mock('@/hooks/useSpas', () => ({
  useActiveSpa: () => ({ data: { id: 'spa-1', name: 'Test Spa' } }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useBookingSubmission } from '@/app/customer/book-new/_hooks/useBookingSubmission';
import type { WizardState } from '@/app/customer/book-new/_hooks/useBookingWizard';
import type { CartItem } from '@/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWizardState(): WizardState {
  return {
    step: 3,
    selectedSpa: { id: 'spa-1', name: 'Test Spa' } as never,
    selectedServices: [{ id: 'svc-1', quantity: 1 }],
    selectedTherapist: null,
    selectedDate: new Date('2026-05-02T10:00:00.000Z'),
    selectedTime: '14:00',
    bookingLocationKind: 'spa',
    customerLocation: null,
  };
}

function makeCartItems(): CartItem[] {
  return [
    {
      serviceId: 'svc-1',
      serviceName: 'VLCC Insta Glow Facial',
      categoryName: 'Facials',
      subcategory: '',
      price: 580,
      duration: 45,
      quantity: 1,
    },
  ];
}

beforeEach(() => {
  mutateAsyncSpy.mockReset();
});

describe('useBookingSubmission', () => {
  it('calls onSuccess(bookingId) when the create mutation resolves, with cart-direct service payload', async () => {
    mutateAsyncSpy.mockResolvedValueOnce({
      bookingId: 'b1',
      pricing: { services: 580, addons: 0, tax: 104, discount: 0, platformFee: 50, total: 734 },
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useBookingSubmission({
        wizard: makeWizardState(),
        cartItems: makeCartItems(),
        onSuccess,
      }),
    );

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('b1');
    });
    expect(mutateAsyncSpy).toHaveBeenCalledTimes(1);
    const payload = mutateAsyncSpy.mock.calls[0]?.[0];
    expect(payload.services).toEqual([
      {
        serviceId: 'svc-1',
        name: 'VLCC Insta Glow Facial',
        price: 580,
        duration: 45,
        quantity: 1,
      },
    ]);
    expect(payload.slot.duration).toBe(45);
    expect(payload.pricing.services).toBe(580);
    expect(result.current.error).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('sets error state when the create mutation rejects, and does NOT call onSuccess', async () => {
    mutateAsyncSpy.mockRejectedValueOnce(new Error('booking failed'));

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useBookingSubmission({
        wizard: makeWizardState(),
        cartItems: makeCartItems(),
        onSuccess,
      }),
    );

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current).not.toHaveProperty('reset');
  });

  it('surfaces a user-visible error when the cart is empty (kills the silent-bail path)', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useBookingSubmission({
        wizard: makeWizardState(),
        cartItems: [],
        onSuccess,
      }),
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.error).toBe('Please complete every step before confirming.');
    expect(mutateAsyncSpy).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });
});
