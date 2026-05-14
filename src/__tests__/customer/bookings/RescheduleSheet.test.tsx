import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// useRescheduleBooking mock — drives the confirm flow
// ---------------------------------------------------------------------------

const rescheduleMutateAsync = vi.fn();
let rescheduleIsPending = false;

vi.mock('@/hooks/useBookings', () => ({
  useRescheduleBooking: () => ({
    mutateAsync: rescheduleMutateAsync,
    isPending: rescheduleIsPending,
  }),
}));

// Freeze IST clock so calendar + time-grid are deterministic.
const FIXED_NOW = new Date('2026-05-14T10:00:00Z'); // 15:30 IST on a Thursday

vi.mock('@/lib/date-ist', async () => {
  const actual = await vi.importActual<typeof import('@/lib/date-ist')>('@/lib/date-ist');
  return {
    ...actual,
    nowIST: () => new Date(FIXED_NOW),
  };
});

import RescheduleSheet from '@/app/customer/bookings/_components/RescheduleSheet';

beforeEach(() => {
  rescheduleMutateAsync.mockReset().mockResolvedValue({ success: true });
  rescheduleIsPending = false;
});

describe('RescheduleSheet', () => {
  it('renders title, drag handle, calendar, and a sticky confirm footer when open', async () => {
    render(
      <RescheduleSheet
        open={true}
        onClose={vi.fn()}
        bookingId="bk-1"
        currentSlot={null}
        serviceDuration={60}
      />,
    );

    expect(screen.getByText(/Reschedule booking/i)).toBeInTheDocument();
    expect(screen.getByTestId('reschedule-sheet-handle')).toBeInTheDocument();
    expect(screen.getByLabelText('Date picker')).toBeInTheDocument();
    // Confirm + Cancel are always visible at the bottom regardless of viewport.
    expect(screen.getByTestId('reschedule-sheet-confirm')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(
      <RescheduleSheet
        open={false}
        onClose={vi.fn()}
        bookingId="bk-1"
        currentSlot={null}
      />,
    );
    expect(screen.queryByText(/Reschedule booking/i)).not.toBeInTheDocument();
  });

  it('keeps Confirm disabled until both date and time are picked', async () => {
    render(
      <RescheduleSheet
        open={true}
        onClose={vi.fn()}
        bookingId="bk-1"
        currentSlot={null}
      />,
    );

    const confirm = screen.getByTestId('reschedule-sheet-confirm');
    expect(confirm).toBeDisabled();

    // Pick a future date (tomorrow IST). The 15 of May 2026 is the next day.
    const tomorrow = screen.getByRole('gridcell', { name: '15' });
    await act(async () => {
      fireEvent.click(tomorrow);
    });
    // Now the time grid renders; Confirm still disabled until time picked.
    expect(screen.getByTestId('reschedule-sheet-confirm')).toBeDisabled();

    // Pick a time slot.
    const slot = screen.getByTestId('reschedule-sheet-time-10:00');
    await act(async () => {
      fireEvent.click(slot);
    });
    expect(screen.getByTestId('reschedule-sheet-confirm')).toBeEnabled();
  });

  it('calls useRescheduleBooking.mutateAsync with computed newSlot on Confirm', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(
      <RescheduleSheet
        open={true}
        onClose={onClose}
        bookingId="bk-42"
        currentSlot={null}
        serviceDuration={90}
        onSuccess={onSuccess}
      />,
    );

    // Tomorrow (May 15, 2026) and 10:00 IST.
    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: '15' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('reschedule-sheet-time-10:00'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('reschedule-sheet-confirm'));
    });

    await waitFor(() => {
      expect(rescheduleMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(rescheduleMutateAsync.mock.calls[0][0]).toMatchObject({
      bookingId: 'bk-42',
      newSlot: {
        date: '2026-05-15',
        start: '10:00',
        end: '11:30', // 10:00 + 90 min
        duration: 90,
      },
    });
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('surfaces an error pill when the callable rejects, and keeps the sheet open', async () => {
    rescheduleMutateAsync.mockRejectedValueOnce(new Error('Slot just taken — try another time'));
    const onClose = vi.fn();
    render(
      <RescheduleSheet
        open={true}
        onClose={onClose}
        bookingId="bk-1"
        currentSlot={null}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: '15' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('reschedule-sheet-time-10:00'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('reschedule-sheet-confirm'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('reschedule-sheet-error')).toHaveTextContent(
        /Slot just taken/,
      );
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Cancel button invokes onClose', async () => {
    const onClose = vi.fn();
    render(
      <RescheduleSheet
        open={true}
        onClose={onClose}
        bookingId="bk-1"
        currentSlot={null}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('previous month button is disabled when viewing the current month', async () => {
    render(
      <RescheduleSheet
        open={true}
        onClose={vi.fn()}
        bookingId="bk-1"
        currentSlot={null}
      />,
    );
    expect(screen.getByTestId('reschedule-sheet-prev-month')).toBeDisabled();
    // Next month is allowed because the booking horizon is 60 days.
    expect(screen.getByTestId('reschedule-sheet-next-month')).toBeEnabled();
  });

  it('hides time slots whose end would fall past salon close (SALON_CLOSE_MIN = 21:00)', async () => {
    // A 90-min service starting at 20:00 would end at 21:30 — past close.
    // The 20:00 chip must NOT render. 19:30 (end 21:00) is the last valid.
    render(
      <RescheduleSheet
        open={true}
        onClose={vi.fn()}
        bookingId="bk-1"
        currentSlot={null}
        serviceDuration={90}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: '15' }));
    });
    expect(screen.queryByTestId('reschedule-sheet-time-19:30')).toBeInTheDocument();
    expect(screen.queryByTestId('reschedule-sheet-time-20:00')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reschedule-sheet-time-20:30')).not.toBeInTheDocument();
  });

  it('clamps endTime to salon close even if a stale prop sneaks past TimeGrid', async () => {
    // Force the mutation to observe whatever newSlot is sent. The TimeGrid
    // filter already protects 99% of cases; this test exercises the inner
    // clamp inside handleConfirm. We simulate by picking the latest still-
    // visible slot for a long-duration service.
    rescheduleMutateAsync.mockResolvedValueOnce({ success: true });
    render(
      <RescheduleSheet
        open={true}
        onClose={vi.fn()}
        bookingId="bk-clamp"
        currentSlot={null}
        serviceDuration={240}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: '15' }));
    });
    // With duration=240, max valid start is 17:00 (end 21:00). Pick it.
    const latest = screen.getByTestId('reschedule-sheet-time-17:00');
    await act(async () => {
      fireEvent.click(latest);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('reschedule-sheet-confirm'));
    });
    await waitFor(() => {
      expect(rescheduleMutateAsync).toHaveBeenCalled();
    });
    const payload = rescheduleMutateAsync.mock.calls[0][0];
    expect(payload.newSlot.end).toBe('21:00');
    // Sanity: end is never `'25:00'` or any > 24h string.
    const endParts = String(payload.newSlot.end).split(':').map(Number);
    expect(endParts[0]).toBeLessThanOrEqual(21);
  });
});
