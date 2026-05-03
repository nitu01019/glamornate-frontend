/**
 * Phase 2 (Booking Flow Fix v3.1, 2026-05-02): all date strings the booking
 * flow emits MUST be IST wall-clock days. The legacy `formatDateForStorage`
 * called `toISOString().split('T')[0]` which interpreted the input as UTC,
 * so a 23:30 IST `Date` rendered as the *next* day's string and the
 * "today" Confirm button was effectively dead (Issue A).
 *
 * The helpers below now go through `frontend/src/lib/date-ist.ts` so the
 * client and backend agree on what "today" means.
 */
import { formatDateIST, IST_TIMEZONE } from '@/lib/date-ist';
import { formatInTimeZone } from 'date-fns-tz';

/** Format a 24-hour `HH:MM` string as 12-hour with AM/PM. Pure string op. */
export function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Generate the next 14 IST midnights starting at the IST day containing
 * `now`. Each returned `Date` is the UTC instant for the corresponding
 * 00:00 IST so downstream `formatDateIST` / direct epoch comparisons all
 * stay symmetric.
 *
 * F6: callers pass the mounted `now` rather than reading the clock so this
 * function stays SSR-safe and pure.
 */
export function generateDates(now: Date): Date[] {
  const istToday = formatDateIST(now);
  return Array.from({ length: 14 }, (_, i) => {
    const [y, m, d] = istToday.split('-').map(Number);
    // Construct the IST midnight then offset by `i` IST days.
    // `Date.UTC(y, m-1, d - 330min, ...)` is brittle; we round-trip via
    // `Date.UTC` and add the days as 24h blocks. IST has no DST so 24h
    // increments are exact.
    const istMidnightUtc = Date.UTC(y, m - 1, d, -5, -30);
    const dayMs = 24 * 60 * 60 * 1000;
    return new Date(istMidnightUtc + i * dayMs);
  });
}

/**
 * Human label for a date, evaluated against `now` in IST. "Today" / "Tomorrow"
 * are computed by comparing the IST date strings, not by calling
 * `toDateString()` (which uses the runtime's local zone — UTC on Vercel).
 */
export function getDayName(date: Date, now: Date): string {
  const istDate = formatDateIST(date);
  const istNow = formatDateIST(now);
  const istTomorrow = formatDateIST(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (istDate === istNow) return 'Today';
  if (istDate === istTomorrow) return 'Tomorrow';
  return formatInTimeZone(date, IST_TIMEZONE, 'EEE');
}

/**
 * The single function the booking flow uses to write `slot.date` into
 * Firestore: an IST wall-clock day, never UTC. Round-trip with `todayIST`
 * is exact.
 */
export function formatDateForStorage(date: Date): string {
  return formatDateIST(date);
}
