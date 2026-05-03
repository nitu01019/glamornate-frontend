import type { TimeSlot } from '@/types';

const SLOT_START_HOUR = 9;
const SLOT_END_HOUR = 20;
const SLOT_INTERVAL_MINUTES = 30;

/**
 * Convert a 24h "HH:MM" string to a 12-hour label like "9:00 AM" or "1:30 PM".
 */
export function formatTimeLabel(time: string): string {
  const [hourStr, minuteStr] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute} ${period}`;
}

/**
 * Generate 30-minute time slots from 9:00 AM to 7:30 PM (last slot at 19:30).
 *
 * - If `date` is today, slots whose time has already passed are marked unavailable.
 * - If `bookedSlots` is provided, any generated slot that overlaps with a booked
 *   slot (start-time + duration window) is marked unavailable.
 */
export function generateTimeSlots(
  date: string,
  bookedSlots?: { time: string; duration: number }[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  const now = new Date();
  const isToday = date === toISODateString(now);

  for (
    let totalMinutes = SLOT_START_HOUR * 60;
    totalMinutes < SLOT_END_HOUR * 60;
    totalMinutes += SLOT_INTERVAL_MINUTES
  ) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const label = formatTimeLabel(time);

    let available = true;

    if (isToday) {
      const slotDate = new Date(date);
      slotDate.setHours(hour, minute, 0, 0);
      if (slotDate <= now) {
        available = false;
      }
    }

    if (available && bookedSlots) {
      available = !isSlotOverlapping(totalMinutes, bookedSlots);
    }

    slots.push({ time, label, available });
  }

  return slots;
}

/**
 * Return the next 7 days starting from today.
 */
export function getNextSevenDays(): {
  date: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}[] {
  const days: {
    date: string;
    dayName: string;
    dayNumber: number;
    isToday: boolean;
  }[] = [];

  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    days.push({
      date: toISODateString(d),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: d.getDate(),
      isToday: i === 0,
    });
  }

  return days;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toISODateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function isSlotOverlapping(
  slotStartMinutes: number,
  bookedSlots: { time: string; duration: number }[]
): boolean {
  const slotEndMinutes = slotStartMinutes + SLOT_INTERVAL_MINUTES;

  return bookedSlots.some((booked) => {
    const bookedStart = timeToMinutes(booked.time);
    const bookedEnd = bookedStart + booked.duration;
    return slotStartMinutes < bookedEnd && slotEndMinutes > bookedStart;
  });
}
