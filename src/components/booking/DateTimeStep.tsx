'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useBookingStore } from '@/store/booking';
import { generateTimeSlots, getNextSevenDays } from '@/lib/slot-utils';
import { getBookingsForDate } from '@/lib/firebase-client/bookings';
import type { TimeSlot } from '@/types';

interface DateTimeStepProps {
  onNext: () => void;
  onBack: () => void;
}

export default function DateTimeStep({ onNext, onBack }: DateTimeStepProps) {
  const {
    selectedDate,
    selectedTimeSlot,
    setDate,
    setTimeSlot,
    setAvailableSlots,
    availableSlots,
  } = useBookingStore();

  const days = useRef(getNextSevenDays()).current;
  const [currentDate, setCurrentDate] = useState(selectedDate ?? days[0].date);
  const [currentSlot, setCurrentSlot] = useState<string | null>(selectedTimeSlot);
  const [slots, setSlots] = useState<TimeSlot[]>(availableSlots);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotWarning, setSlotWarning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadSlots = useCallback(
    async (date: string) => {
      setLoadingSlots(true);
      try {
        const booked = await getBookingsForDate(date);
        const bookedSlots = booked.map((b) => ({
          time: b.timeSlot,
          duration: b.totalDuration,
        }));
        const generated = generateTimeSlots(date, bookedSlots);
        setSlots(generated);
        setAvailableSlots(generated);
        setSlotWarning(false);
      } catch {
        const generated = generateTimeSlots(date);
        setSlots(generated);
        setAvailableSlots(generated);
        setSlotWarning(true);
      } finally {
        setLoadingSlots(false);
      }
    },
    [setAvailableSlots],
  );

  useEffect(() => {
    loadSlots(currentDate);
  }, [currentDate, loadSlots]);

  const handleDateSelect = useCallback(
    (date: string) => {
      setCurrentDate(date);
      setDate(date);
      setCurrentSlot(null);
      setTimeSlot('');
    },
    [setDate, setTimeSlot],
  );

  const handleSlotSelect = useCallback(
    (slot: TimeSlot) => {
      if (!slot.available) return;
      setCurrentSlot(slot.time);
      setTimeSlot(slot.time);
    },
    [setTimeSlot],
  );

  const canProceed = currentDate.length > 0 && currentSlot !== null && currentSlot.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Pick a date &amp; time</h2>
        <p className="mt-1 text-sm text-gray-500">Select your preferred appointment slot</p>
      </div>

      {/* Date chips (horizontal scroll) */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Date</p>
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {days.map((day) => {
            const isSelected = day.date === currentDate;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => handleDateSelect(day.date)}
                className={cn(
                  'flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
                  isSelected
                    ? 'bg-brand-maroon-500 text-white shadow-maroon'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95',
                )}
              >
                <span className="text-xs">{day.isToday ? 'Today' : day.dayName}</span>
                <span className="text-lg font-bold">{day.dayNumber}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Time</p>

        {slotWarning && (
          <div className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-700 font-medium">
              Could not verify live availability. Some slots may already be booked.
            </p>
          </div>
        )}

        {loadingSlots ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => {
              const isSelected = slot.time === currentSlot;
              const isUnavailable = !slot.available;

              return (
                <button
                  key={slot.time}
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => handleSlotSelect(slot)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200',
                    isSelected &&
                      'border-brand-maroon-500 bg-brand-maroon-500 text-white shadow-maroon',
                    !isSelected &&
                      !isUnavailable &&
                      'border-gray-200 bg-white text-gray-700 hover:border-brand-maroon-300 active:scale-95',
                    isUnavailable &&
                      'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300 line-through',
                  )}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed} className="flex-1" size="lg">
          Next
        </Button>
      </div>
    </div>
  );
}
