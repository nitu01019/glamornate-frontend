/**
 * IST (Asia/Kolkata) date helpers — frontend mirror of
 * `backend/functions/src/utils/date-ist.ts`.
 *
 * Phase 2 (Booking Flow Fix v3.1, 2026-05-02): the booking flow assembles
 * "today's date" and "this slot's UTC instant" from user-perceived IST
 * wall-clock values. The legacy implementation called `toISOString()` /
 * `new Date('YYYY-MM-DDTHH:MM:SS')` which interpret the input as UTC, so
 * a user picking 11:30 PM IST today saw their slot land on tomorrow's
 * date string (Issue A — same-day Confirm dead).
 *
 * The four functions here are the only timezone-translating primitives
 * the booking flow may use:
 *   - `todayIST()`        → "YYYY-MM-DD" of the current IST wall-clock day
 *   - `nowIST()`          → a `Date` whose components reflect IST
 *   - `formatDateIST()`   → format an arbitrary `Date` in IST with a pattern
 *   - `istDateAtTimeToUtc()` → take an IST date string + IST HH:MM and
 *                              return the matching UTC `Date` instant.
 *
 * IST is fixed at UTC+05:30, no DST since 1947 — but we still go through
 * `date-fns-tz` so the helper survives any future zone-data change without
 * an ad-hoc rewrite, and so the mental model matches the backend mirror.
 *
 * Plan §Phase 2.
 */
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

export const IST_TIMEZONE = 'Asia/Kolkata';

/** YYYY-MM-DD of the current IST wall-clock day. */
export function todayIST(): string {
  return formatInTimeZone(new Date(), IST_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * A `Date` whose component getters (`getHours()`, `getDate()`, etc.) return
 * the IST wall-clock view of "now". The underlying epoch is shifted by the
 * IST offset, so this `Date` is **not** suitable as an instant — only for
 * formatting / extracting components. Use `istDateAtTimeToUtc()` whenever
 * you need a real UTC instant.
 */
export function nowIST(): Date {
  return toZonedTime(new Date(), IST_TIMEZONE);
}

/**
 * Format a `Date` as IST wall-clock using a date-fns-style pattern.
 * Defaults to `yyyy-MM-dd` so it round-trips with `todayIST()` / Firestore
 * `slot.date` strings.
 */
export function formatDateIST(date: Date, pattern: string = 'yyyy-MM-dd'): string {
  return formatInTimeZone(date, IST_TIMEZONE, pattern);
}

/**
 * Compose an IST date string + IST HH:MM into the corresponding UTC
 * `Date` instant. Used by the booking-create / availability paths so the
 * client and server agree on what "11:30 PM IST today" means.
 */
export function istDateAtTimeToUtc(dateStr: string, timeHHMM: string): Date {
  return fromZonedTime(`${dateStr} ${timeHHMM}:00`, IST_TIMEZONE);
}

/**
 * Phase 10 (Booking Flow Fix v3.1, 2026-05-02): drift detector. Logs a
 * warning when the IST and UTC dates disagree AND we're inside the
 * sensitive 00:00 IST → 05:30 IST window. The window matters because
 * outside it the two zones share a date string, so a drift wouldn't
 * tell us anything useful. Inside it, a mismatch confirms the legacy
 * UTC-shaped `slot.date` would have shifted by a day.
 *
 * Returns the warning string when drift is detected (so call sites can
 * forward it to Sentry), or null otherwise.
 */
export function detectMidnightDrift(now: Date = new Date()): string | null {
  const istDate = formatDateIST(now);
  const utcDate = now.toISOString().slice(0, 10);
  if (istDate === utcDate) return null;
  const istHour = Number(formatInTimeZone(now, IST_TIMEZONE, 'HH'));
  if (istHour < 0 || istHour > 5) return null;
  return `IST/UTC drift detected at IST hour ${istHour}: IST=${istDate}, UTC=${utcDate}`;
}
