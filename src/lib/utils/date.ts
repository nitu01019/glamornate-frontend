import { format, formatDistanceToNow, isToday, isYesterday, isTomorrow, addDays, addHours, addMinutes, parseISO, isValid } from 'date-fns';

/**
 * Format a date to a readable string
 */
export function formatDate(date: Date | string, formatStr: string = 'PPP'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid date';
  return format(d, formatStr);
}

/**
 * Format date to 'EEEE, MMM d, yyyy' e.g., "Monday, Mar 24, 2026"
 */
export function formatDateLong(date: Date | string): string {
  return formatDate(date, 'EEEE, MMM d, yyyy');
}

/**
 * Format date to 'MMM d, yyyy' e.g., "Mar 24, 2026"
 */
export function formatDateShort(date: Date | string): string {
  return formatDate(date, 'MMM d, yyyy');
}

/**
 * Format date to 'dd/MM/yyyy' e.g., "24/03/2026"
 */
export function formatDateNumeric(date: Date | string): string {
  return formatDate(date, 'dd/MM/yyyy');
}

/**
 * Format time to 'h:mm a' e.g., "9:30 AM"
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid time';
  return format(d, 'h:mm a');
}

/**
 * Format datetime to 'PPP at p' e.g., "March 24, 2026 at 9:30 AM"
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid date';
  return format(d, 'PPP \'at\' p');
}

/**
 * Get relative time from now e.g., "2 hours ago"
 */
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid date';
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Get a human readable date relative to today
 */
export function getReadableDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid date';

  if (isToday(d)) {
    return `Today, ${formatTime(d)}`;
  }
  if (isYesterday(d)) {
    return `Yesterday, ${formatTime(d)}`;
  }
  if (isTomorrow(d)) {
    return `Tomorrow, ${formatTime(d)}`;
  }
  return formatDate(date, 'MMM d \'at\' h:mm a');
}

/**
 * Parse time string "HH:mm" to minutes from midnight
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Format minutes from midnight to time string "HH:mm"
 */
export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) && d < new Date();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) && d > new Date();
}

/**
 * Get time slots for a given date range
 */
export function generateTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number = 30
): Array<{ start: string; end: string }> {
  const slots: Array<{ start: string; end: string }> = [];
  let currentMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  while (currentMinutes + intervalMinutes <= endMinutes) {
    slots.push({
      start: formatMinutesToTime(currentMinutes),
      end: formatMinutesToTime(currentMinutes + intervalMinutes),
    });
    currentMinutes += intervalMinutes;
  }

  return slots;
}

/**
 * Calculate duration between two time strings in minutes
 */
export function calculateDuration(startTime: string, endTime: string): number {
  return parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
}

/**
 * Add hours to a date
 */
export function addHoursToDate(date: Date, hours: number): Date {
  return addHours(date, hours);
}

/**
 * Add minutes to a date
 */
export function addMinutesToDate(date: Date, minutes: number): Date {
  return addMinutes(date, minutes);
}

/**
 * Add days to a date
 */
export function addDaysToDate(date: Date, days: number): Date {
  return addDays(date, days);
}

/**
 * Format duration in minutes to human readable string
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Validate date string format (YYYY-MM-DD)
 */
export function isValidDateString(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const date = parseISO(dateStr);
  return isValid(date);
}

/**
 * Validate time string format (HH:mm)
 */
export function isValidTimeString(timeStr: string): boolean {
  const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(timeStr);
}

/**
 * Get array of dates for next N days
 */
export function getNextNDays(n: number, startDate: Date = new Date()): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < n; i++) {
    dates.push(addDaysToDate(startDate, i));
  }
  return dates;
}

/**
 * Get day name from date
 */
export function getDayName(date: Date | string, locale: string = 'en-US'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return d.toLocaleDateString(locale, { weekday: 'long' });
}

/**
 * Get day abbreviation from date
 */
export function getDayAbbr(date: Date | string, locale: string = 'en-US'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return d.toLocaleDateString(locale, { weekday: 'short' });
}
