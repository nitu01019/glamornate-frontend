/**
 * Mock Availability Data
 *
 * Sample availability/slots data for testing purposes.
 */

import type { Availability, AvailabilitySlot } from '@/types';

// Helper to create time slots from 9 AM to 9 PM
function createDaySlots(
  bookings: { start: string; duration: number }[] = []
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const startHour = 9;
  const endHour = 21;
  const slotDuration = 30; // 30-minute slots

  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += slotDuration) {
      const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const endMin = min + slotDuration;
      const endHourStr = endMin >= 60 ? (hour + 1).toString().padStart(2, '0') : hour.toString().padStart(2, '0');
      const endTime = `${endHourStr}:${(endMin % 60).toString().padStart(2, '0')}`;

      // Check if this slot is booked
      let isAvailable = true;
      let bookingId: string | undefined;

      for (const booking of bookings) {
        const [bHour, bMin] = booking.start.split(':').map(Number);
        const bookingStartHour = bHour;
        const bookingEndHour = bMin + booking.duration >= 60
          ? bHour + Math.floor((bMin + booking.duration) / 60)
          : bHour;

        if (
          hour >= bookingStartHour &&
          hour < bookingEndHour
        ) {
          isAvailable = false;
          bookingId = 'booking_001';
          break;
        }
      }

      slots.push({
        start: startTime,
        end: endTime,
        available: isAvailable,
        bookingId: isAvailable ? undefined : bookingId,
      });
    }
  }

  return slots;
}

export const mockAvailability: Availability[] = [
  {
    compositeId: 'spa_mumbai_serenity_2026-03-24_any',
    date: '2026-03-24',
    spaId: 'spa_mumbai_serenity',
    therapistId: undefined,
    slots: createDaySlots([
      { start: '10:00', duration: 60 },
      { start: '14:00', duration: 60 },
      { start: '16:00', duration: 90 },
    ]),
    lastCalculatedAt: '2026-03-24T08:00:00Z',
    expiresAt: '2026-03-25T08:00:00Z',
  },
  {
    compositeId: 'spa_mumbai_serenity_2026-03-25_any',
    date: '2026-03-25',
    spaId: 'spa_mumbai_serenity',
    therapistId: undefined,
    slots: createDaySlots([
      { start: '11:00', duration: 90 },
      { start: '15:00', duration: 60 },
    ]),
    lastCalculatedAt: '2026-03-24T08:00:00Z',
    expiresAt: '2026-03-26T08:00:00Z',
  },
  {
    compositeId: 'spa_mumbai_serenity_2026-03-26_therapist_001',
    date: '2026-03-26',
    spaId: 'spa_mumbai_serenity',
    therapistId: 'therapist_001',
    slots: createDaySlots([
      { start: '10:00', duration: 90 },
    ]),
    lastCalculatedAt: '2026-03-24T08:00:00Z',
    expiresAt: '2026-03-27T08:00:00Z',
  },
  {
    compositeId: 'spa_mumbai_serenity_2026-03-27_any',
    date: '2026-03-27',
    spaId: 'spa_mumbai_serenity',
    therapistId: undefined,
    slots: createDaySlots([
      { start: '07:00', duration: 60 },
    ]),
    lastCalculatedAt: '2026-03-24T08:00:00Z',
    expiresAt: '2026-03-28T08:00:00Z',
  },
  {
    compositeId: 'spa_delhi_bliss_2026-03-24_any',
    date: '2026-03-24',
    spaId: 'spa_delhi_bliss',
    therapistId: undefined,
    slots: createDaySlots([
      { start: '10:00', duration: 60 },
      { start: '14:00', duration: 75 },
    ]),
    lastCalculatedAt: '2026-03-24T08:00:00Z',
    expiresAt: '2026-03-25T08:00:00Z',
  },
  {
    compositeId: 'spa_delhi_bliss_2026-03-25_any',
    date: '2026-03-25',
    spaId: 'spa_delhi_bliss',
    therapistId: undefined,
    slots: createDaySlots([
      { start: '09:00', duration: 60 },
    ]),
    lastCalculatedAt: '2026-03-24T08:00:00Z',
    expiresAt: '2026-03-26T08:00:00Z',
  },
  {
    compositeId: 'spa_bangalore_urban_2026-03-24_any',
    date: '2026-03-24',
    spaId: 'spa_bangalore_urban',
    therapistId: undefined,
    slots: createDaySlots(),
    lastCalculatedAt: '2026-03-24T08:00:00Z',
    expiresAt: '2026-03-25T08:00:00Z',
  },
  {
    compositeId: 'spa_bangalore_urban_2026-03-23_any',
    date: '2026-03-23',
    spaId: 'spa_bangalore_urban',
    therapistId: undefined,
    slots: createDaySlots([
      { start: '16:00', duration: 90 },
    ]),
    lastCalculatedAt: '2026-03-23T08:00:00Z',
    expiresAt: '2026-03-24T08:00:00Z',
  },
  {
    compositeId: 'spa_bangalore_urban_2026-03-23_therapist_003',
    date: '2026-03-23',
    spaId: 'spa_bangalore_urban',
    therapistId: 'therapist_003',
    slots: createDaySlots([
      { start: '16:00', duration: 90 },
    ]),
    lastCalculatedAt: '2026-03-23T08:00:00Z',
    expiresAt: '2026-03-24T08:00:00Z',
  },
  {
    compositeId: 'spa_mumbai_serenity_2026-03-28_any',
    date: '2026-03-28',
    spaId: 'spa_mumbai_serenity',
    therapistId: undefined,
    slots: createDaySlots(),
    lastCalculatedAt: '2026-03-24T08:00:00Z',
    expiresAt: '2026-03-29T08:00:00Z',
  },
];

export const getAvailabilityBySpaAndDate = (spaId: string, date: string): Availability | undefined =>
  mockAvailability.find(a => a.spaId === spaId && a.date === date && !a.therapistId);

export const getAvailabilityBySpaDateAndTherapist = (
  spaId: string,
  date: string,
  therapistId: string
): Availability | undefined =>
  mockAvailability.find(a => a.spaId === spaId && a.date === date && a.therapistId === therapistId);

export const getAvailableSlots = (spaId: string, date: string, therapistId?: string): AvailabilitySlot[] => {
  const availability = therapistId
    ? getAvailabilityBySpaDateAndTherapist(spaId, date, therapistId)
    : getAvailabilityBySpaAndDate(spaId, date);

  return availability?.slots.filter(s => s.available) || [];
};

export const getNextAvailableSlot = (spaId: string, therapistId?: string): AvailabilitySlot | undefined => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const timeStr = `${today.getHours()}:${today.getMinutes().toString().padStart(2, '0')}`;

  // Check today first
  const todayAvailability = therapistId
    ? getAvailabilityBySpaDateAndTherapist(spaId, dateStr, therapistId)
    : getAvailabilityBySpaAndDate(spaId, dateStr);

  if (todayAvailability) {
    const nextSlot = todayAvailability.slots.find(
      s => s.available && s.start >= timeStr
    );
    if (nextSlot) return nextSlot;
  }

  // Check next 7 days
  for (let i = 1; i <= 7; i++) {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + i);
    const dateStr = nextDate.toISOString().split('T')[0];

    const dayAvailability = therapistId
      ? getAvailabilityBySpaDateAndTherapist(spaId, dateStr, therapistId)
      : getAvailabilityBySpaAndDate(spaId, dateStr);

    if (dayAvailability && dayAvailability.slots.some(s => s.available)) {
      return dayAvailability.slots.find(s => s.available);
    }
  }

  return undefined;
};

export const isSlotAvailable = (spaId: string, date: string, time: string): boolean => {
  const availability = getAvailabilityBySpaAndDate(spaId, date);
  return availability?.slots.some(s => s.start === time && s.available) || false;
};
