/**
 * Phase 4.5 / Patch DR-4 (Booking Flow Fix v3.1, 2026-05-02): regression
 * test for the client-side past-slot filter inside `ScheduleStep`. With
 * the IST clock pinned at 14:00 IST and `BOOKING_LEAD_TIME_MIN = 60`, only
 * slots starting at or after 15:00 IST should be rendered, and the
 * `EARLIER_SLOTS_PASSED` hint MUST appear above the grid.
 *
 * Without the filter, a user lands on a 14:30 slot at 14:25 IST and sees
 * a generic SLOT_IN_PAST toast after server-side validation rejects it.
 */
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { withFakeIST } from '@/test/helpers/withFakeIST';
import { EARLIER_SLOTS_PASSED } from '@/lib/booking/copy';
import { ScheduleStep } from '@/app/customer/book-new/_components/ScheduleStep';
import { istDateAtTimeToUtc } from '@/lib/date-ist';

// TherapistSelector renders a button list; for this regression we only
// care about the slot grid and hint, so stub it out to avoid pulling in
// extra component complexity.
vi.mock('@/app/customer/book-new/_components/TherapistSelector', () => ({
  TherapistSelector: () => React.createElement('div', { 'data-testid': 'therapist-stub' }),
}));

afterEach(() => {
  vi.useRealTimers();
});

describe('ScheduleStep — past-slot filter (Patch DR-4)', () => {
  it('renders only future slots (>=15:00 IST) at 14:00 IST and shows EARLIER_SLOTS_PASSED hint', () => {
    withFakeIST('2026-05-02 14:00');
    // The IST "today" is 2026-05-02; ScheduleStep's filter compares slot
    // start times against `Date.now() + 60min`. We pass selectedDate as
    // the IST midnight UTC instant for that day so `formatDateIST` matches
    // `todayIST()` inside the component.
    const selectedDate = istDateAtTimeToUtc('2026-05-02', '00:00');

    const slots = [
      { start: '10:00', available: true },
      { start: '11:00', available: true },
      { start: '12:00', available: true },
      { start: '13:00', available: true },
      { start: '14:00', available: true },
      { start: '15:00', available: true },
      { start: '16:00', available: true },
    ];

    // Slots are no longer fetched — the static every-30-min grid drives the
    // UI. We still verify the past-slot filter behaviour, which is
    // orthogonal to the data source.
    void slots;
    render(
      React.createElement(ScheduleStep, {
        therapists: [],
        therapistsLoading: false,
        selectedTherapist: null,
        onTherapistSelect: vi.fn(),
        dates: [selectedDate],
        now: new Date(),
        selectedDate,
        selectedTime: null,
        onDateSelect: vi.fn(),
        onTimeSelect: vi.fn(),
        onContinue: vi.fn(),
        canProceed: false,
      }),
    );

    // EARLIER_SLOTS_PASSED hint is visible because past slots were filtered.
    expect(screen.getByText(EARLIER_SLOTS_PASSED)).toBeInTheDocument();

    // Only 15:00 and 16:00 are rendered. The component formats times via
    // `formatTime` ("3:00 PM" / "4:00 PM"), so we check both representations
    // are present and earlier slots are absent.
    expect(screen.getByText('3:00 PM')).toBeInTheDocument();
    expect(screen.getByText('4:00 PM')).toBeInTheDocument();
    // Past slots are gone (10:00 AM through 2:00 PM).
    expect(screen.queryByText('10:00 AM')).not.toBeInTheDocument();
    expect(screen.queryByText('11:00 AM')).not.toBeInTheDocument();
    expect(screen.queryByText('12:00 PM')).not.toBeInTheDocument();
    expect(screen.queryByText('1:00 PM')).not.toBeInTheDocument();
    expect(screen.queryByText('2:00 PM')).not.toBeInTheDocument();
  });
});
