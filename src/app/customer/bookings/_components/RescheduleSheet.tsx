'use client';

/**
 * RescheduleSheet
 * ---------------
 * Mobile-first bottom sheet for rescheduling a confirmed booking. Replaces
 * the previous centered shadcn `<Dialog>` which overflowed off-screen on
 * 375 × 667 viewports and had a non-sticky footer.
 *
 * Pattern source: `frontend/src/components/account/ChangePasswordSheet.tsx`
 * — the canonical branded bottom-sheet template in this codebase. Slides
 * up from the bottom, sticky header (drag handle + title + close), a
 * scrollable body, and a sticky footer with Cancel + Confirm that always
 * stays inside the viewport.
 *
 * Calendar + time-grid layout mirrors the booking wizard's `ScheduleStep`
 * visual structure (month calendar with prev/next nav, 3-column 30-minute
 * time chips) so users feel they're in the same picker, not two
 * different worlds. Each component is locally defined here rather than
 * imported from `ScheduleStep` so the wizard's parallel redesign can
 * evolve independently — we can consolidate to a shared `SchedulePicker`
 * later once both surfaces have settled.
 *
 * Wiring (follow-up): `frontend/src/app/customer/bookings/page.tsx`
 * currently renders an inline `<Dialog>` for reschedule at lines
 * 651-733. Swap that block out for `<RescheduleSheet …>` after the
 * page's parallel BookingCard redesign lands so this commit doesn't
 * collide with that work.
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { formatDateIST, istDateAtTimeToUtc, nowIST, todayIST } from '@/lib/date-ist';
import { cn } from '@/lib/utils';
import { useRescheduleBooking } from '@/hooks/useBookings';
import type { Slot } from '@/types';

// ---------------------------------------------------------------------------
// Salon operating hours — every 30 min between 09:00 and 21:00 IST.
// Mirrors `ScheduleStep`'s static grid (no slot-availability fetch — the
// salon ops side handles conflicts manually, same policy as the wizard).
// ---------------------------------------------------------------------------

const SALON_OPEN_MIN = 9 * 60;
const SALON_CLOSE_MIN = 21 * 60;
const SLOT_INTERVAL_MIN = 30;
const BOOKING_HORIZON_DAYS = 60;
const BOOKING_LEAD_TIME_MIN = 60; // 1 h lead-time for reschedules
// 2-letter abbreviations to disambiguate Tuesday vs Thursday and Saturday
// vs Sunday at 320 px viewport widths. Aria-hidden so screen readers see
// the column position via the parent grid pattern, not these glyphs.
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

const DAY_TIMES: readonly string[] = (() => {
  const out: string[] = [];
  for (let m = SALON_OPEN_MIN; m + SLOT_INTERVAL_MIN <= SALON_CLOSE_MIN; m += SLOT_INTERVAL_MIN) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return out;
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function istMidnight(yearIst: number, monthIstZeroIndexed: number, dayIst: number): Date {
  return new Date(Date.UTC(yearIst, monthIstZeroIndexed, dayIst, -5, -30));
}

function parseIstParts(date: Date): { y: number; m: number; d: number } {
  const [y, m, d] = formatDateIST(date).split('-').map(Number);
  return { y, m, d };
}

function formatTimeLabel(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = Number(hStr);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${mStr.padStart(2, '0')} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface RescheduleSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly bookingId: string | null;
  /** The booking's current slot, used to highlight the currently-booked date. */
  readonly currentSlot?: Slot | null;
  /**
   * Service duration in minutes. Determines the `newSlot.end` time so the
   * backend can write a slot that matches the existing booking shape.
   */
  readonly serviceDuration?: number;
  readonly onSuccess?: () => void;
  readonly onError?: (message: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RescheduleSheet({
  open,
  onClose,
  bookingId,
  currentSlot,
  serviceDuration = 60,
  onSuccess,
  onError,
}: RescheduleSheetProps): JSX.Element {
  const reschedule = useRescheduleBooking();
  const [now, setNow] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hydrate `now` on open (and re-hydrate on each open) so the calendar
  // and lead-time filters reflect the latest clock. We do this in an
  // effect rather than at module top-level so SSR + tests stay deterministic.
  useEffect(() => {
    if (!open) return;
    setNow(nowIST());
    setSelectedDate(null);
    setSelectedTime(null);
    setError(null);
  }, [open]);

  const canConfirm = Boolean(bookingId && selectedDate && selectedTime && !reschedule.isPending);

  const handleConfirm = useCallback(async () => {
    if (!bookingId || !selectedDate || !selectedTime) return;
    const dateStr = formatDateIST(selectedDate);
    // Compute newSlot.end from start + serviceDuration. TimeGrid only
    // surfaces times whose end falls within salon hours, but we clamp
    // here too so a stale prop never produces an invalid `"25:00"`-style
    // string. End is clamped to salon close (21:00 = 1260 min).
    const startMinutes = (() => {
      const [h, m] = selectedTime.split(':').map(Number);
      return h * 60 + m;
    })();
    const endMinutes = Math.min(startMinutes + serviceDuration, SALON_CLOSE_MIN);
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    const newSlot: Slot = {
      date: dateStr,
      start: selectedTime,
      end: endTime,
      duration: serviceDuration,
    };
    try {
      await reschedule.mutateAsync({ bookingId, newSlot });
      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not reschedule booking';
      setError(message);
      onError?.(message);
    }
  }, [
    bookingId,
    selectedDate,
    selectedTime,
    serviceDuration,
    reschedule,
    onSuccess,
    onClose,
    onError,
  ]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next && !reschedule.isPending) onClose();
    },
    [onClose, reschedule.isPending],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-testid="reschedule-sheet-overlay"
          className={cn(
            'fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <DialogPrimitive.Content
          data-testid="reschedule-sheet"
          className={cn(
            'fixed inset-x-0 bottom-0 z-[70] flex max-h-[92vh] flex-col',
            'rounded-t-3xl bg-white shadow-2xl focus:outline-none',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-full',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full',
            'duration-300 ease-out',
          )}
        >
          {/* Drag handle (sticky header) */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div
              aria-hidden="true"
              className="w-10 h-1 rounded-full bg-gray-300"
              data-testid="reschedule-sheet-handle"
            />
          </div>

          <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold text-gray-900">
                Reschedule booking
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-gray-500 mt-0.5">
                Pick a new date and time. We&apos;ll let the salon know.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close reschedule sheet"
              disabled={reschedule.isPending}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-300 disabled:opacity-60"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
            <section aria-labelledby="reschedule-date-heading">
              <h3 id="reschedule-date-heading" className="font-semibold text-gray-900 mb-3">
                Select Date
              </h3>
              {now ? (
                <MonthCalendar
                  now={now}
                  selectedDate={selectedDate}
                  onSelect={(d) => {
                    setSelectedDate(d);
                    setSelectedTime(null);
                    setError(null);
                  }}
                  highlightDate={currentSlot?.date ?? null}
                  horizonDays={BOOKING_HORIZON_DAYS}
                />
              ) : (
                <div className="h-72 rounded-2xl bg-gray-100 animate-pulse" aria-hidden="true" />
              )}
            </section>

            {selectedDate && (
              <section aria-labelledby="reschedule-time-heading">
                <h3 id="reschedule-time-heading" className="font-semibold text-gray-900 mb-3">
                  Pick a Time
                </h3>
                <TimeGrid
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  serviceDuration={serviceDuration}
                  onTimeSelect={(t) => {
                    setSelectedTime(t);
                    setError(null);
                  }}
                />
              </section>
            )}

            {error && (
              <p
                role="alert"
                data-testid="reschedule-sheet-error"
                className="text-sm text-brand-maroon-700 bg-brand-maroon-50 rounded-xl px-4 py-3"
              >
                {error}
              </p>
            )}
          </div>

          {/* Sticky footer */}
          <div className="flex-shrink-0 border-t border-gray-100 px-5 pt-3 pb-4 safe-area-bottom flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={reschedule.isPending}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-300 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              aria-busy={reschedule.isPending}
              data-testid="reschedule-sheet-confirm"
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white',
                'bg-gradient-to-r from-brand-gold-500 to-brand-maroon-500',
                'shadow-md transition hover:brightness-105',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-300',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              {reschedule.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Rescheduling…
                </>
              ) : (
                'Confirm'
              )}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// MonthCalendar — local mirror of ScheduleStep's calendar pattern.
// ---------------------------------------------------------------------------

interface MonthCalendarProps {
  readonly now: Date;
  readonly selectedDate: Date | null;
  readonly onSelect: (date: Date) => void;
  readonly horizonDays: number;
  readonly highlightDate: string | null;
}

function MonthCalendar({
  now,
  selectedDate,
  onSelect,
  horizonDays,
  highlightDate,
}: MonthCalendarProps) {
  const today = useMemo(() => parseIstParts(now), [now]);
  const [viewYear, setViewYear] = useState(today.y);
  const [viewMonth, setViewMonth] = useState(today.m - 1);

  const selectedKey = selectedDate ? formatDateIST(selectedDate) : null;
  const todayKey = `${today.y.toString().padStart(4, '0')}-${today.m
    .toString()
    .padStart(2, '0')}-${today.d.toString().padStart(2, '0')}`;

  const minDate = useMemo(() => istMidnight(today.y, today.m - 1, today.d), [today]);
  const maxDate = useMemo(
    () => new Date(minDate.getTime() + horizonDays * 24 * 60 * 60 * 1000),
    [minDate, horizonDays],
  );

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
      const isHighlighted = key === highlightDate;
      const isPast = cellTime < minDate.getTime();
      const isBeyondHorizon = cellTime > maxDate.getTime();
      const isDisabled = isPast || isBeyondHorizon;
      return { cell, parts, key, inMonth, isToday, isSelected, isHighlighted, isDisabled };
    });
  }, [viewYear, viewMonth, todayKey, selectedKey, highlightDate, minDate, maxDate]);

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
    <div className="bg-white rounded-2xl shadow-sm p-4 ring-1 ring-inset ring-gray-100">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={handlePrev}
          disabled={!prevAllowed}
          aria-label="Previous month"
          data-testid="reschedule-sheet-prev-month"
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 hover:bg-brand-maroon-50 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <p className="text-sm font-semibold text-gray-900" aria-live="polite">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={handleNext}
          disabled={!nextAllowed}
          aria-label="Next month"
          data-testid="reschedule-sheet-next-month"
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 hover:bg-brand-maroon-50 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
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

      {/* ARIA grid pattern: <grid><row><gridcell/></row></grid>. Red-team
          T-B1 flagged that the flat cells without intermediate `role="row"`
          wrappers broke TalkBack/VoiceOver date-picker navigation. We now
          wrap each 7-cell week in its own role="row" container so screen
          readers announce row + cell positions correctly. */}
      <div role="grid" aria-label="Date picker" className="grid grid-cols-1 gap-1">
        {Array.from({ length: 6 }, (_, weekIdx) => (
          <div role="row" key={`week-${weekIdx}`} className="grid grid-cols-7 gap-1">
            {cells.slice(weekIdx * 7, weekIdx * 7 + 7).map((c, idx) => (
              <CalendarCell
                key={`${c.key}-${idx}`}
                day={c.parts.d}
                isOutsideMonth={!c.inMonth}
                isToday={c.isToday}
                isSelected={c.isSelected}
                isHighlighted={c.isHighlighted}
                isDisabled={c.isDisabled}
                onClick={() => onSelect(c.cell)}
              />
            ))}
          </div>
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
  readonly isHighlighted: boolean;
  readonly isDisabled: boolean;
  readonly onClick: () => void;
}

function CalendarCell({
  day,
  isOutsideMonth,
  isToday,
  isSelected,
  isHighlighted,
  isDisabled,
  onClick,
}: CalendarCellProps) {
  const base =
    'aspect-square w-full rounded-full text-sm flex items-center justify-center transition-colors';
  let tone = 'text-gray-700';
  if (isOutsideMonth) tone = 'text-gray-300';
  if (isDisabled) tone = 'text-gray-300';
  if (isToday && !isSelected) {
    tone = 'text-brand-maroon-600 font-semibold ring-1 ring-inset ring-brand-maroon-300';
  }
  const interactive = !isDisabled
    ? 'hover:bg-brand-maroon-50 active:scale-95 cursor-pointer'
    : 'cursor-not-allowed';
  const selectedTone = isSelected
    ? 'bg-gradient-to-br from-brand-maroon-500 to-brand-maroon-600 text-white font-semibold shadow-sm hover:bg-brand-maroon-600'
    : '';
  // Indicate the booking's current slot with a subtle gold dot below the
  // number so users know which date the booking is currently on.
  const highlightRing =
    isHighlighted && !isSelected ? 'ring-1 ring-inset ring-brand-gold-400 bg-brand-gold-50/50' : '';
  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={isSelected}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      onClick={onClick}
      className={cn(base, tone, interactive, selectedTone, highlightRing)}
      tabIndex={isDisabled ? -1 : 0}
    >
      {day}
    </button>
  );
}

// ---------------------------------------------------------------------------
// TimeGrid — 3-column 30-min static grid; matches the booking wizard layout.
// ---------------------------------------------------------------------------

interface TimeGridProps {
  readonly selectedDate: Date;
  readonly selectedTime: string | null;
  readonly serviceDuration: number;
  readonly onTimeSelect: (time: string) => void;
}

function TimeGrid({ selectedDate, selectedTime, serviceDuration, onTimeSelect }: TimeGridProps) {
  const selectedIsToday = formatDateIST(selectedDate) === todayIST();
  const earliestAllowedMs = Date.now() + BOOKING_LEAD_TIME_MIN * 60 * 1000;
  const dateStr = formatDateIST(selectedDate);

  // Filter by:
  //   (a) lead-time, for today only (drops times that have already passed +
  //       the 1-hour booking lead-time buffer).
  //   (b) duration, so a `serviceDuration`-long appointment starting at the
  //       chosen time finishes before salon close (SALON_CLOSE_MIN = 21:00).
  //       Without this guard a 90-min booking could start at 20:30 and end
  //       at 22:00, past the salon's hours.
  const visible = DAY_TIMES.filter((time) => {
    const [h, m] = time.split(':').map(Number);
    const startMinutes = h * 60 + m;
    if (startMinutes + serviceDuration > SALON_CLOSE_MIN) return false;
    if (!selectedIsToday) return true;
    const slotMs = istDateAtTimeToUtc(dateStr, time).getTime();
    return slotMs >= earliestAllowedMs;
  });

  const hidPast = selectedIsToday && visible.length < DAY_TIMES.length;

  if (visible.length === 0) {
    return (
      <div
        className="text-center py-8 text-gray-500 bg-white rounded-2xl ring-1 ring-inset ring-gray-100"
        data-testid="reschedule-sheet-no-slots-today"
      >
        All times for today have passed. Pick a date from tomorrow onwards.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hidPast && (
        <p className="text-xs text-gray-500" role="note">
          Earlier slots have passed. Showing what&apos;s still available today.
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {visible.map((time) => (
          <button
            key={time}
            type="button"
            data-testid={`reschedule-sheet-time-${time}`}
            onClick={() => onTimeSelect(time)}
            className={cn(
              'py-3 px-4 rounded-xl text-sm font-medium transition-all',
              selectedTime === time
                ? 'bg-brand-maroon-500 text-white shadow-sm'
                : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-100 hover:bg-brand-maroon-50',
            )}
          >
            {formatTimeLabel(time)}
          </button>
        ))}
      </div>
    </div>
  );
}
