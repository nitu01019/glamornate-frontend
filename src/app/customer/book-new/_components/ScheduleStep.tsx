'use client';

/**
 * ScheduleStep
 * ------------
 * Step 2 of the booking wizard. Lets the customer pick a preferred therapist
 * (optional), a date (from a month calendar), and a 30-minute time slot.
 *
 * 2026-05-13 refactor:
 *   - Calendar replaces the 14-day horizontal strip (user feedback).
 *   - "Slots" concept dropped. Every salon-hour time is always selectable;
 *     the salon's ops side handles conflicts manually. Backend
 *     `createBookingDraft` already skips slot enforcement when no cached
 *     availability doc exists, so no server change is needed.
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/LoadingState';
import type { TherapistWithId } from '@/hooks/useTherapists';
import { formatTime } from '../_utils/dateHelpers';
import { TherapistSelector } from './TherapistSelector';
import { formatDateIST, todayIST, istDateAtTimeToUtc } from '@/lib/date-ist';
import { BOOKING_LEAD_TIME_MIN } from '../_utils/booking-config';
import { EARLIER_SLOTS_PASSED } from '@/lib/booking/copy';

interface ScheduleStepProps {
  therapists: TherapistWithId[];
  therapistsLoading: boolean;
  selectedTherapist: TherapistWithId | null;
  onTherapistSelect: (therapist: TherapistWithId | null) => void;
  // `dates` is kept on the props for backward compatibility with the page
  // wiring; the calendar derives its own range from `now`.
  dates: Date[];
  now: Date | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  onDateSelect: (date: Date) => void;
  onTimeSelect: (time: string) => void;
  /** Advances to the Confirm step. Mirrors the fixed BookingBottomBar's
   *  "Continue" button so the action stays visible if the fixed bar is
   *  clipped by a device's nav inset. */
  onContinue: () => void;
  /** True when date + time are both selected. */
  canProceed: boolean;
}

const BOOKING_HORIZON_DAYS = 60;

// Salon operating hours — every 30 minutes between 09:00 and 21:00 IST.
// Generated once at module load (pure function of the constants below) so
// re-renders don't reallocate.
const SALON_OPEN_MIN = 9 * 60;
const SALON_CLOSE_MIN = 21 * 60;
const SLOT_INTERVAL_MIN = 30;

const DAY_TIMES: readonly string[] = (() => {
  const out: string[] = [];
  for (let m = SALON_OPEN_MIN; m + SLOT_INTERVAL_MIN <= SALON_CLOSE_MIN; m += SLOT_INTERVAL_MIN) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return out;
})();

export function ScheduleStep({
  therapists,
  therapistsLoading,
  selectedTherapist,
  onTherapistSelect,
  now,
  selectedDate,
  selectedTime,
  onDateSelect,
  onTimeSelect,
  onContinue,
  canProceed,
}: ScheduleStepProps) {
  return (
    <div className="p-5 space-y-6">
      {/* Therapist Selection */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Preferred Therapist</h3>
        <TherapistSelector
          therapists={therapists}
          selected={selectedTherapist}
          onSelect={onTherapistSelect}
          isLoading={therapistsLoading}
        />
      </div>

      {/* Date Selection — month calendar */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Select Date</h3>
        {now ? (
          <MonthCalendar
            now={now}
            selectedDate={selectedDate}
            onSelect={onDateSelect}
            horizonDays={BOOKING_HORIZON_DAYS}
          />
        ) : (
          <Skeleton className="h-72 w-full rounded-2xl" />
        )}
      </div>

      {/* Time selection */}
      {selectedDate && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Pick a Time</h3>
          <TimeGrid
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onTimeSelect={onTimeSelect}
          />
        </div>
      )}

      {/* Inline "Continue to Confirm" CTA — mirrors the fixed bottom bar.
          Renders only when date + time are both picked so it does not crowd
          the layout before there is a meaningful action. Some devices clip
          the fixed bottom bar behind their gesture inset; this in-flow
          button guarantees the path forward is always visible. */}
      <button
        type="button"
        onClick={onContinue}
        disabled={!canProceed}
        aria-disabled={!canProceed}
        className={`w-full min-h-[56px] rounded-2xl text-white font-semibold transition-all flex items-center justify-center gap-2 ${
          canProceed
            ? 'bg-gradient-to-r from-brand-maroon-500 to-brand-maroon-600 active:scale-[0.99] shadow-md'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        Continue to Confirm
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MonthCalendar
// ---------------------------------------------------------------------------

interface MonthCalendarProps {
  readonly now: Date;
  readonly selectedDate: Date | null;
  readonly onSelect: (date: Date) => void;
  readonly horizonDays: number;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/**
 * Construct a `Date` representing 00:00 IST for a given IST y/m/d. IST has
 * no daylight saving, so this is a straight UTC offset.
 */
function istMidnight(yearIst: number, monthIstZeroIndexed: number, dayIst: number): Date {
  return new Date(Date.UTC(yearIst, monthIstZeroIndexed, dayIst, -5, -30));
}

function parseIstParts(date: Date): { y: number; m: number; d: number } {
  const [y, m, d] = formatDateIST(date).split('-').map(Number);
  return { y, m, d };
}

function MonthCalendar({ now, selectedDate, onSelect, horizonDays }: MonthCalendarProps) {
  const today = useMemo(() => parseIstParts(now), [now]);

  // The month being viewed — initialised to the month containing `now`.
  const [viewYear, setViewYear] = useState(today.y);
  const [viewMonth, setViewMonth] = useState(today.m - 1); // zero-indexed

  // Selection signature for highlighting cells.
  const selectedKey = selectedDate ? formatDateIST(selectedDate) : null;
  const todayKey = `${today.y.toString().padStart(4, '0')}-${today.m
    .toString()
    .padStart(2, '0')}-${today.d.toString().padStart(2, '0')}`;

  // Booking window upper bound — `horizonDays` IST days after today.
  const maxDate = useMemo(() => {
    const base = istMidnight(today.y, today.m - 1, today.d);
    return new Date(base.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  }, [today, horizonDays]);

  const minDate = useMemo(() => istMidnight(today.y, today.m - 1, today.d), [today]);

  // 6×7 grid of cells. Start from the Sunday on/before viewMonth day 1.
  const cells = useMemo(() => {
    const firstOfMonth = istMidnight(viewYear, viewMonth, 1);
    const firstWeekdayInIst = Number(formatDateIST(firstOfMonth, 'i')); // 1=Mon..7=Sun
    const sundayOffset = firstWeekdayInIst === 7 ? 0 : firstWeekdayInIst;
    const dayMs = 24 * 60 * 60 * 1000;
    return Array.from({ length: 42 }, (_, idx) => {
      const cellTime = firstOfMonth.getTime() + (idx - sundayOffset) * dayMs;
      const cell = new Date(cellTime);
      const parts = parseIstParts(cell);
      const key = formatDateIST(cell);
      const inMonth = parts.m - 1 === viewMonth && parts.y === viewYear;
      const isToday = key === todayKey;
      const isSelected = key === selectedKey;
      const isPast = cellTime < minDate.getTime();
      const isBeyondHorizon = cellTime > maxDate.getTime();
      const isDisabled = isPast || isBeyondHorizon;
      return { cell, parts, key, inMonth, isToday, isSelected, isDisabled };
    });
  }, [viewYear, viewMonth, todayKey, selectedKey, minDate, maxDate]);

  const monthLabel = useMemo(
    () => formatDateIST(istMidnight(viewYear, viewMonth, 1), 'MMMM yyyy'),
    [viewYear, viewMonth],
  );

  const prevAllowed = useMemo(() => {
    if (viewYear > today.y) return true;
    if (viewYear < today.y) return false;
    return viewMonth > today.m - 1;
  }, [viewYear, viewMonth, today]);

  const nextAllowed = useMemo(() => {
    const maxParts = parseIstParts(maxDate);
    if (viewYear < maxParts.y) return true;
    if (viewYear > maxParts.y) return false;
    return viewMonth < maxParts.m - 1;
  }, [viewYear, viewMonth, maxDate]);

  const handlePrev = () => {
    if (!prevAllowed) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNext = () => {
    if (!nextAllowed) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={handlePrev}
          disabled={!prevAllowed}
          aria-label="Previous month"
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 hover:bg-brand-maroon-50 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="text-sm font-semibold text-gray-900" aria-live="polite">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={handleNext}
          disabled={!nextAllowed}
          aria-label="Next month"
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 hover:bg-brand-maroon-50 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className="text-[10px] font-medium uppercase tracking-wide text-gray-400 text-center"
            aria-hidden="true"
          >
            {d}
          </div>
        ))}
      </div>

      <div role="grid" aria-label="Date picker" className="grid grid-cols-7 gap-1">
        {cells.map((c, idx) => (
          <CalendarCell
            key={`${c.key}-${idx}`}
            day={c.parts.d}
            isOutsideMonth={!c.inMonth}
            isToday={c.isToday}
            isSelected={c.isSelected}
            isDisabled={c.isDisabled}
            onClick={() => onSelect(c.cell)}
          />
        ))}
      </div>
    </div>
  );
}

interface CalendarCellProps {
  readonly day: number;
  readonly isOutsideMonth: boolean;
  readonly isToday: boolean;
  readonly isSelected: boolean;
  readonly isDisabled: boolean;
  readonly onClick: () => void;
}

function CalendarCell({
  day,
  isOutsideMonth,
  isToday,
  isSelected,
  isDisabled,
  onClick,
}: CalendarCellProps) {
  const base =
    'aspect-square w-full rounded-full text-sm flex items-center justify-center transition-colors';
  let tone = 'text-gray-700';
  if (isOutsideMonth) tone = 'text-gray-300';
  if (isDisabled) tone = 'text-gray-300';
  if (isToday && !isSelected)
    tone = 'text-brand-maroon-600 font-semibold ring-1 ring-inset ring-brand-maroon-300';
  const interactive = !isDisabled
    ? 'hover:bg-brand-maroon-50 active:scale-95 cursor-pointer'
    : 'cursor-not-allowed';
  const selectedTone = isSelected
    ? 'bg-gradient-to-br from-brand-maroon-500 to-brand-maroon-600 text-white font-semibold shadow-sm hover:bg-brand-maroon-600'
    : '';
  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={isSelected}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      onClick={onClick}
      className={`${base} ${tone} ${interactive} ${selectedTone}`}
      tabIndex={isDisabled ? -1 : 0}
    >
      {day}
    </button>
  );
}

// ---------------------------------------------------------------------------
// TimeGrid — static every-30-min times. No availability fetch.
// ---------------------------------------------------------------------------

interface TimeGridProps {
  readonly selectedDate: Date;
  readonly selectedTime: string | null;
  readonly onTimeSelect: (time: string) => void;
}

function TimeGrid({ selectedDate, selectedTime, onTimeSelect }: TimeGridProps) {
  const selectedIsToday = formatDateIST(selectedDate) === todayIST();
  const earliestAllowedMs = Date.now() + BOOKING_LEAD_TIME_MIN * 60 * 1000;
  const dateStr = formatDateIST(selectedDate);

  // For today's date, drop times that have already passed (plus the lead-time
  // buffer). For future dates every time is always offered.
  const visible = DAY_TIMES.filter((time) => {
    if (!selectedIsToday) return true;
    const slotMs = istDateAtTimeToUtc(dateStr, time).getTime();
    return slotMs >= earliestAllowedMs;
  });

  const hidPast = selectedIsToday && visible.length < DAY_TIMES.length;

  if (visible.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 bg-white rounded-2xl">
        All times for today have passed. Pick a date from tomorrow onwards.
      </div>
    );
  }

  return (
    <>
      {hidPast && (
        <p className="mb-2 text-xs text-gray-500" role="note">
          {EARLIER_SLOTS_PASSED}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {visible.map((time) => (
          <button
            key={time}
            type="button"
            onClick={() => onTimeSelect(time)}
            className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${
              selectedTime === time
                ? 'bg-brand-maroon-500 text-white'
                : 'bg-white text-gray-700 hover:bg-brand-maroon-50'
            }`}
          >
            {formatTime(time)}
          </button>
        ))}
      </div>
    </>
  );
}
