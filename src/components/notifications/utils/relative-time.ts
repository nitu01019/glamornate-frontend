/**
 * Relative-time formatter for the notifications feed.
 *
 * Colocated under `components/notifications/utils/` on purpose — we must not
 * re-export this from `src/lib/utils/` because that would add a new cross-
 * community edge (`notifications` → `utils-format`) and every consumer that
 * already depends on `utils-format` (login, skeletons, etc.) would pick up
 * notification-specific formatting churn. Keep it local.
 *
 * Output grammar (shortest suitable unit):
 *   < 60s        → "just now"
 *   < 60m        → "5m"
 *   < 24h        → "2h"
 *   < 48h        → "Yesterday"
 *   < 7d         → day-of-week ("Mon")
 *   else         → month + day ("Apr 12")
 *
 * We do NOT use `Intl.RelativeTimeFormat` because we want the compact
 * Yes-Madam-style output (`5m`, not `5 minutes ago`). Day names are English
 * only — the rest of the UI is English today; when we localise, this file
 * becomes the single swap-point.
 */

/** Parsed input can be a Date, an ISO string, or a Firestore-ish `_seconds` map. */
export type RelativeTimeInput =
  | Date
  | string
  | number
  | { _seconds: number; _nanoseconds?: number }
  | { seconds: number; nanoseconds?: number }
  | null
  | undefined;

/**
 * Converts tolerant inputs into a stable `Date`. Returns `null` for invalid
 * inputs — callers render a fallback rather than throwing.
 */
export function toDate(input: RelativeTimeInput): Date | null {
  if (input === null || input === undefined) return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'object') {
    if ('_seconds' in input && typeof input._seconds === 'number') {
      return new Date(input._seconds * 1000);
    }
    if ('seconds' in input && typeof input.seconds === 'number') {
      return new Date(input.seconds * 1000);
    }
  }
  return null;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Formats a timestamp relative to `now`. Returns `''` when the input cannot
 * be parsed so callers can fall back gracefully in the row UI.
 */
export function relativeTimeFrom(
  input: RelativeTimeInput,
  now: Date = new Date(),
): string {
  const date = toDate(input);
  if (date === null) return '';

  const diffMs = now.getTime() - date.getTime();

  // Future timestamps (clock skew) collapse to "just now" — the feed never
  // shows "in 5m" for server-sent notifications.
  if (diffMs < 0) return 'just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 2) return 'Yesterday';
  if (diffDay < 7) return DAY_NAMES[date.getDay()];

  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}
