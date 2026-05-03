import { Skeleton } from '@/components/ui/LoadingState';
import type { TherapistWithId } from '@/hooks/useTherapists';
import { formatTime, getDayName } from '../_utils/dateHelpers';
import { TherapistSelector } from './TherapistSelector';
import { formatDateIST, todayIST, istDateAtTimeToUtc } from '@/lib/date-ist';
import { BOOKING_LEAD_TIME_MIN } from '../_utils/booking-config';
import { EARLIER_SLOTS_PASSED, NO_MORE_SLOTS_TODAY } from '@/lib/booking/copy';

export interface AvailabilitySlot {
  start: string;
  available: boolean;
}

interface ScheduleStepProps {
  therapists: TherapistWithId[];
  therapistsLoading: boolean;
  selectedTherapist: TherapistWithId | null;
  onTherapistSelect: (therapist: TherapistWithId | null) => void;
  dates: Date[];
  now: Date | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  onDateSelect: (date: Date) => void;
  onTimeSelect: (time: string) => void;
  slots: AvailabilitySlot[] | undefined;
  slotsLoading: boolean;
}

export function ScheduleStep({
  therapists,
  therapistsLoading,
  selectedTherapist,
  onTherapistSelect,
  dates,
  now,
  selectedDate,
  selectedTime,
  onDateSelect,
  onTimeSelect,
  slots,
  slotsLoading,
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

      {/* Date Selection */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Select Date</h3>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5">
          {dates.map((date) => {
            const isSelected = selectedDate?.toDateString() === date.toDateString();
            return (
              <button
                key={date.toISOString()}
                onClick={() => onDateSelect(date)}
                className={`flex-shrink-0 w-16 py-3 rounded-2xl text-center transition-all ${
                  isSelected ? 'bg-brand-maroon-500 text-white' : 'bg-white text-gray-700'
                }`}
              >
                <div className="text-xs opacity-75">{now ? getDayName(date, now) : ''}</div>
                <div className="text-xl font-bold">{date.getDate()}</div>
                <div className="text-xs opacity-75">
                  {date.toLocaleDateString('en-US', { month: 'short' })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots */}
      {selectedDate && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Available Slots</h3>
          <SlotsGrid
            slots={slots}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            slotsLoading={slotsLoading}
            onTimeSelect={onTimeSelect}
          />
        </div>
      )}
    </div>
  );
}

interface SlotsGridProps {
  slots: AvailabilitySlot[] | undefined;
  selectedDate: Date;
  selectedTime: string | null;
  slotsLoading: boolean;
  onTimeSelect: (time: string) => void;
}

/**
 * Phase 4.5 / Phase 7 (Booking Flow Fix v3.1, 2026-05-02): client-side
 * past-slot filter. When the picked date is the IST "today", drop slots
 * starting before `now + BOOKING_LEAD_TIME_MIN` minutes — they would
 * round-trip to the server's 5-minute lead-time floor and surface as a
 * generic SLOT_IN_PAST toast otherwise. The past-slot hint above the
 * grid + the "no more slots today" empty state are the user-visible
 * replacement for those toasts (Patch DR-4).
 */
function SlotsGrid({
  slots,
  selectedDate,
  selectedTime,
  slotsLoading,
  onTimeSelect,
}: SlotsGridProps) {
  if (slotsLoading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const selectedIsToday = formatDateIST(selectedDate) === todayIST();
  const earliestAllowedMs = Date.now() + BOOKING_LEAD_TIME_MIN * 60 * 1000;
  const dateStr = formatDateIST(selectedDate);

  const filtered = (slots ?? []).filter((slot) => {
    if (!selectedIsToday) return true;
    const slotMs = istDateAtTimeToUtc(dateStr, slot.start).getTime();
    return slotMs >= earliestAllowedMs;
  });

  const hidPastSlots = selectedIsToday && (slots?.length ?? 0) > filtered.length;

  if (!filtered.length) {
    return (
      <div className="text-center py-8 text-gray-500 bg-white rounded-2xl">
        {selectedIsToday ? NO_MORE_SLOTS_TODAY : 'No available slots for this date.'}
      </div>
    );
  }

  return (
    <>
      {hidPastSlots && (
        <p className="mb-2 text-xs text-gray-500" role="note">
          {EARLIER_SLOTS_PASSED}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {filtered.map((slot) => (
          <button
            key={slot.start}
            type="button"
            onClick={() => slot.available && onTimeSelect(slot.start)}
            disabled={!slot.available}
            className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${
              !slot.available
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : selectedTime === slot.start
                ? 'bg-brand-maroon-500 text-white'
                : 'bg-white text-gray-700 hover:bg-brand-maroon-50'
            }`}
          >
            {formatTime(slot.start)}
          </button>
        ))}
      </div>
    </>
  );
}
