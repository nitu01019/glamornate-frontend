'use client';

/**
 * Availability Hooks - React Query hooks for time slot availability
 * Provides data fetching for available booking slots
 */

import { useQuery } from '@tanstack/react-query';
import { firebaseClientWrapper } from '@/lib/firebase-client-wrapper';
import { isFirebaseConfigured } from '@/lib/firebase';
import { parseError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import type { Availability, Slot } from '@/types';

const availabilityLogger = logger.child({ component: 'useAvailability' });

// =============================================================================
// Types
// =============================================================================

export interface AvailabilityWithId extends Availability {
  id: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
  therapistId?: string;
  therapistName?: string;
}

export interface AvailableSlotsInput {
  spaId: string;
  therapistId?: string;
  date: string;
  serviceIds?: string[];
  /**
   * Total duration of the requested services in minutes. Renamed from
   * `duration` in Phase 3 (Booking Flow Fix v3.1, 2026-05-02) so the wire
   * contract matches the backend `getAvailableSlots` Zod schema —
   * previously the FE sent `duration` and the BE silently defaulted to 30,
   * shrinking multi-service slot windows and surfacing as
   * `SLOT_UNAVAILABLE` toasts (Issue B). Plan §Phase 3.
   */
  serviceDuration?: number;
  [key: string]: unknown;
}

export interface AvailableSlotsResponse {
  date: string;
  slots: TimeSlot[];
  therapists?: Array<{
    id: string;
    name: string;
    slots: TimeSlot[];
  }>;
}

// =============================================================================
// Query Keys
// =============================================================================

export const availabilityQueryKeys = {
  all: ['availability'] as const,
  slots: (spaId: string, therapistId?: string, date?: string) =>
    [...availabilityQueryKeys.all, 'slots', spaId, therapistId, date] as const,
  calendar: (spaId: string, month: string) =>
    [...availabilityQueryKeys.all, 'calendar', spaId, month] as const,
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Fetch available time slots for booking
 * Calls the getAvailableSlots callable function
 *
 * @param input - Spa ID, optional therapist ID, and date
 * @returns Query result with available time slots
 *
 * @example
 * ```tsx
 * const { data: slots } = useAvailableSlots({
 *   spaId: 'spa-123',
 *   date: '2026-04-01',
 *   therapistId: 'therapist-456',
 * });
 * ```
 */
export function useAvailableSlots(input: AvailableSlotsInput | null) {
  const hooksLogger = availabilityLogger;

  return useQuery({
    queryKey: availabilityQueryKeys.slots(input?.spaId ?? '', input?.therapistId, input?.date),
    queryFn: async (): Promise<AvailableSlotsResponse | null> => {
      if (!input?.spaId || !input?.date) return null;

      if (!isFirebaseConfigured()) {
        hooksLogger.debug('Firebase not configured, returning empty slots');
        return {
          date: input.date,
          slots: [],
        };
      }

      try {
        hooksLogger.debug('Fetching available slots', input);

        const result = await firebaseClientWrapper.callFunction<
          AvailableSlotsInput,
          AvailableSlotsResponse
        >('getAvailableSlots', input);

        return result;
      } catch (error) {
        hooksLogger.error('Failed to fetch available slots', error, { input });
        throw parseError(error);
      }
    },
    enabled: !!input?.spaId && !!input?.date,
    staleTime: 1 * 60 * 1000, // 1 minute - availability changes frequently
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}

/**
 * Check slot availability for a specific time
 *
 * @param spaId - The spa document ID
 * @param therapistId - Optional therapist ID
 * @param slot - The time slot to check
 * @returns Query result with availability status
 */
export function useCheckSlotAvailability(
  spaId: string | null | undefined,
  therapistId: string | null | undefined,
  slot: Slot | null | undefined,
) {
  const hooksLogger = availabilityLogger;

  return useQuery({
    queryKey: [
      ...availabilityQueryKeys.all,
      'check',
      spaId,
      therapistId,
      slot?.date,
      slot?.start,
    ] as const,
    queryFn: async (): Promise<{ available: boolean; reason?: string }> => {
      if (!spaId || !slot) {
        return { available: false, reason: 'Missing required parameters' };
      }

      if (!isFirebaseConfigured()) {
        return { available: false, reason: 'Firebase not configured' };
      }

      try {
        const result = await firebaseClientWrapper.callFunction<
          { spaId: string; therapistId?: string; slot: Slot },
          { available: boolean; reason?: string }
        >('checkSlotAvailability', {
          spaId,
          therapistId: therapistId ?? undefined,
          slot,
        });

        return result;
      } catch (error) {
        hooksLogger.error('Failed to check slot availability', error, { spaId, slot });
        throw parseError(error);
      }
    },
    enabled: !!spaId && !!slot?.date && !!slot?.start,
    staleTime: 30 * 1000, // 30 seconds - check frequently
  });
}

/**
 * Fetch availability calendar for a month
 * Shows which dates have available slots
 *
 * @param spaId - The spa document ID
 * @param month - Month in YYYY-MM format
 * @returns Query result with calendar availability
 *
 * @example
 * ```tsx
 * const { data: calendar } = useAvailabilityCalendar('spa-123', '2026-04');
 * ```
 */
export function useAvailabilityCalendar(
  spaId: string | null | undefined,
  month: string | null | undefined,
) {
  const hooksLogger = availabilityLogger;

  return useQuery({
    queryKey: availabilityQueryKeys.calendar(spaId ?? '', month ?? ''),
    queryFn: async (): Promise<Record<string, boolean> | null> => {
      if (!spaId || !month) return null;

      if (!isFirebaseConfigured()) {
        return {};
      }

      try {
        hooksLogger.debug('Fetching availability calendar', { spaId, month });

        const result = await firebaseClientWrapper.callFunction<
          { spaId: string; month: string },
          { availability: Record<string, boolean> }
        >('getAvailabilityCalendar', {
          spaId,
          month,
        });

        return result.availability;
      } catch (error) {
        hooksLogger.error('Failed to fetch availability calendar', error, { spaId, month });
        throw parseError(error);
      }
    },
    enabled: !!spaId && !!month,
    staleTime: 5 * 60 * 1000, // 5 minutes for calendar overview
  });
}

/**
 * Fetch next available slot
 * Useful for quick booking suggestions
 *
 * @param spaId - The spa document ID
 * @param serviceIds - Service IDs for duration calculation
 * @returns Query result with next available slot
 */
export function useNextAvailableSlot(spaId: string | null | undefined, serviceIds?: string[]) {
  const hooksLogger = availabilityLogger;

  return useQuery({
    queryKey: [...availabilityQueryKeys.all, 'next', spaId, serviceIds] as const,
    queryFn: async (): Promise<{
      date: string;
      slot: TimeSlot;
      therapist?: { id: string; name: string };
    } | null> => {
      if (!spaId) return null;

      if (!isFirebaseConfigured()) {
        return null;
      }

      try {
        const result = await firebaseClientWrapper.callFunction<
          { spaId: string; serviceIds?: string[] },
          { date: string; slot: TimeSlot; therapist?: { id: string; name: string } } | null
        >('getNextAvailableSlot', {
          spaId,
          serviceIds,
        });

        return result;
      } catch (error) {
        hooksLogger.error('Failed to fetch next available slot', error, { spaId });
        throw parseError(error);
      }
    },
    enabled: !!spaId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Fetch therapist-specific availability
 *
 * @param therapistId - The therapist document ID
 * @param date - The date to check
 * @returns Query result with therapist's available slots
 */
export function useTherapistAvailability(
  therapistId: string | null | undefined,
  date: string | null | undefined,
) {
  const hooksLogger = availabilityLogger;

  return useQuery({
    queryKey: [...availabilityQueryKeys.all, 'therapist', therapistId, date] as const,
    queryFn: async (): Promise<TimeSlot[]> => {
      if (!therapistId || !date) return [];

      if (!isFirebaseConfigured()) {
        return [];
      }

      try {
        const result = await firebaseClientWrapper.callFunction<
          { therapistId: string; date: string },
          { slots: TimeSlot[] }
        >('getTherapistAvailability', {
          therapistId,
          date,
        });

        return result.slots;
      } catch (error) {
        hooksLogger.error('Failed to fetch therapist availability', error, { therapistId, date });
        throw parseError(error);
      }
    },
    enabled: !!therapistId && !!date,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Get available dates for the next N days
 *
 * @param spaId - The spa document ID
 * @param daysAhead - Number of days to look ahead (default 30)
 * @returns Query result with available dates
 */
export function useAvailableDates(spaId: string | null | undefined, daysAhead: number = 30) {
  const hooksLogger = availabilityLogger;

  return useQuery({
    queryKey: [...availabilityQueryKeys.all, 'dates', spaId, daysAhead] as const,
    queryFn: async (): Promise<string[]> => {
      if (!spaId) return [];

      if (!isFirebaseConfigured()) {
        return [];
      }

      try {
        const result = await firebaseClientWrapper.callFunction<
          { spaId: string; daysAhead: number },
          { dates: string[] }
        >('getAvailableDates', {
          spaId,
          daysAhead,
        });

        return result.dates;
      } catch (error) {
        hooksLogger.error('Failed to fetch available dates', error, { spaId, daysAhead });
        throw parseError(error);
      }
    },
    enabled: !!spaId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
