/**
 * Phase 5 (Booking Flow Fix v3.1, 2026-05-02): regression tests pinning the
 * single-mutation submission flow. Two cases cover the success and failure
 * branches that the wizard's "Confirm" button surfaces:
 *
 *   1. Successful mutateAsync → onSuccess(bookingId) is called.
 *   2. Rejected mutateAsync → `error` state is set, wizard state is NOT
 *      reset, onSuccess is NOT called.
 *
 * The legacy submission ran a four-step Stripe pipeline; collapsing it into
 * a single mutation means a single test point and a single failure mode.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks: useCreateBooking — the central spy. We control mutateAsync per test.
// ---------------------------------------------------------------------------

const mutateAsyncSpy = vi.fn();

vi.mock('@/hooks/useBookings', () => ({
  useCreateBooking: () => ({
    mutateAsync: mutateAsyncSpy,
    isPending: false,
    isError: false,
  }),
}));

// auth-provider — the hook reads `user` for the customer name/phone.
vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({
    user: { profile: { displayName: 'Tester', phone: '+919999999999' } },
    firebaseUser: { uid: 'u-1' },
  }),
}));

// useServices — submission reads spaServices to compute totals.
vi.mock('@/hooks/useServices', () => ({
  useSpaServices: () => ({
    data: [
      {
        id: 'svc-1',
        customName: 'Service One',
        priceOverride: 1000,
        durationOverride: 60,
        service: { name: 'Service One', basePrice: 1000, baseDuration: 60 },
      },
    ],
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useBookingSubmission } from '@/app/customer/book-new/_hooks/useBookingSubmission';
import type { WizardState } from '@/app/customer/book-new/_hooks/useBookingWizard';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeWizardState(): WizardState {
  return {
    step: 5,
    selectedSpa: { id: 'spa-1', name: 'Test Spa' } as never,
    selectedServices: [{ id: 'svc-1', quantity: 1 }],
    selectedTherapist: null,
    selectedDate: new Date('2026-05-02T10:00:00.000Z'),
    selectedTime: '14:00',
    bookingLocationKind: 'spa',
    customerLocation: null,
  };
}

beforeEach(() => {
  mutateAsyncSpy.mockReset();
});

describe('useBookingSubmission', () => {
  it('calls onSuccess(bookingId) when the create mutation resolves', async () => {
    mutateAsyncSpy.mockResolvedValueOnce({
      bookingId: 'b1',
      pricing: { services: 1000, addons: 0, tax: 180, discount: 0, platformFee: 50, total: 1230 },
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useBookingSubmission({ wizard: makeWizardState(), onSuccess }),
    );

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('b1');
    });
    expect(mutateAsyncSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('sets error state when the create mutation rejects, and does NOT call onSuccess', async () => {
    mutateAsyncSpy.mockRejectedValueOnce(new Error('booking failed'));

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useBookingSubmission({ wizard: makeWizardState(), onSuccess }),
    );

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
    // The hook does not reset the wizard — that is the presenter's job. Pin
    // the contract by confirming the hook exposes no reset side-effect.
    expect(result.current).not.toHaveProperty('reset');
  });
});
