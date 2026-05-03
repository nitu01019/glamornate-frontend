import { parseTimeToMinutes, formatMinutesToTime } from './date';

export interface Slot {
  start: string; // HH:mm
  end: string; // HH:mm
  duration: number; // minutes
  available: boolean;
  bookingId?: string | null;
}

export interface TimeRange {
  start: string; // HH:mm
  end: string; // HH:mm
}

/**
 * Generate time slots for a date range
 */
export function generateSlots(
  openTime: string,
  closeTime: string,
  intervalMinutes: number = 30
): Slot[] {
  const slots: Slot[] = [];
  let currentMinutes = parseTimeToMinutes(openTime);
  const endMinutes = parseTimeToMinutes(closeTime);

  while (currentMinutes + intervalMinutes <= endMinutes) {
    slots.push({
      start: formatMinutesToTime(currentMinutes),
      end: formatMinutesToTime(currentMinutes + intervalMinutes),
      duration: intervalMinutes,
      available: true,
    });
    currentMinutes += intervalMinutes;
  }

  return slots;
}

/**
 * Check if a specific time slot is available
 */
export function checkAvailability(
  slots: Slot[],
  targetStart: string,
  targetEnd: string
): boolean {
  for (const slot of slots) {
    if (slot.start === targetStart && slot.end === targetEnd) {
      return slot.available;
    }
  }
  return false;
}

/**
 * Filter available slots from a list
 */
export function filterAvailableSlots(slots: Slot[]): Slot[] {
  return slots.filter((slot) => slot.available);
}

/**
 * Filter slots by time
 */
export function filterSlotsByTime(
  slots: Slot[],
  startTime?: string,
  endTime?: string
): Slot[] {
  if (!startTime && !endTime) {
    return slots;
  }

  return slots.filter((slot) => {
    if (startTime && slot.start < startTime) {
      return false;
    }
    if (endTime && slot.end > endTime) {
      return false;
    }
    return true;
  });
}

/**
 * Get slots for a specific duration
 */
export function getSlotsByDuration(slots: Slot[], duration: number): Slot[] {
  return slots.filter((slot) => slot.duration === duration);
}

/**
 * Get next available slot
 */
export function getNextAvailableSlot(slots: Slot[]): Slot | null {
  return filterAvailableSlots(slots)[0] || null;
}

/**
 * Find adjacent slots (for combining)
 */
export function findAdjacentSlots(
  slots: Slot[],
  slot: Slot
): Slot[] {
  const startMinutes = parseTimeToMinutes(slot.start);
  const endMinutes = parseTimeToMinutes(slot.end);

  return slots.filter((s) => {
    const sStart = parseTimeToMinutes(s.start);
    const sEnd = parseTimeToMinutes(s.end);

    // Slot immediately before
    if (sEnd === startMinutes) {
      return true;
    }

    // Slot immediately after
    if (sStart === endMinutes) {
      return true;
    }

    return false;
  });
}

/**
 * Book a slot
 */
export function bookSlot(slots: Slot[], bookingId: string, start: string, end: string): Slot[] {
  return slots.map((slot) => {
    if (slot.start === start && slot.end === end) {
      return { ...slot, available: false, bookingId };
    }
    return slot;
  });
}

/**
 * Release a slot
 */
export function releaseSlot(slots: Slot[], start: string, end: string): Slot[] {
  return slots.map((slot) => {
    if (slot.start === start && slot.end === end) {
      return { ...slot, available: true, bookingId: null };
    }
    return slot;
  });
}

/**
 * Get slot availability count
 */
export function getAvailableCount(slots: Slot[]): number {
  return filterAvailableSlots(slots).length;
}

/**
 * Group slots by hour
 */
export function groupSlotsByHour(slots: Slot[]): Record<string, Slot[]> {
  const grouped: Record<string, Slot[]> = {};

  for (const slot of slots) {
    const hour = parseInt(slot.start.split(':')[0]);
    const hourKey = `${hour.toString().padStart(2, '0')}:00`;

    if (!grouped[hourKey]) {
      grouped[hourKey] = [];
    }
    grouped[hourKey].push(slot);
  }

  return grouped;
}

/**
 * Check if time ranges overlap
 */
export function isOverlapping(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = parseTimeToMinutes(start1);
  const e1 = parseTimeToMinutes(end1);
  const s2 = parseTimeToMinutes(start2);
  const e2 = parseTimeToMinutes(end2);

  return s1 < e2 && e1 > s2;
}

/**
 * Filter out slots that overlap with bookings
 */
export function filterSlotsByAvailability(
  slots: Slot[],
  bookings: Array<{ start: string; end: string }>
): Slot[] {
  return slots.filter((slot) => {
    for (const booking of bookings) {
      if (isOverlapping(slot.start, slot.end, booking.start, booking.end)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Get slots between two times
 */
export function getSlotsBetween(
  slots: Slot[],
  startTime: string,
  endTime: string
): Slot[] {
  return slots.filter((slot) => {
    return slot.start >= startTime && slot.end <= endTime;
  });
}

/**
 * Merge consecutive available slots
 */
export function mergeConsecutiveSlots(slots: Slot[]): Slot[] {
  if (slots.length === 0) {
    return [];
  }

  const merged: Slot[] = [slots[0]];

  for (let i = 1; i < slots.length; i++) {
    const last = merged[merged.length - 1];
    const current = slots[i];

    // Check if they're consecutive and both available
    if (
      last.available === true &&
      current.available === true &&
      last.end === current.start
    ) {
      // Merge
      merged[merged.length - 1] = {
        start: last.start,
        end: current.end,
        duration: parseTimeToMinutes(current.end) - parseTimeToMinutes(last.start),
        available: true,
      };
    } else {
      merged.push(current);
    }
  }

  return merged;
}
