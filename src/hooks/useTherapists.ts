'use client';

/**
 * Therapist Hooks - React Query hooks for therapist data access
 * Provides data fetching for therapists and their availability
 */

import { useQuery } from '@tanstack/react-query';
import { 
  firebaseClientWrapper, 
  QueryConstraintConfig 
} from '@/lib/firebase-client-wrapper';
import { isFirebaseConfigured } from '@/lib/firebase';
import { parseError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import type { Therapist } from '@/types';

const therapistsLogger = logger.child({ component: 'useTherapists' });

// =============================================================================
// Types
// =============================================================================

export interface TherapistWithId extends Therapist {
  id: string;
}

export interface TherapistFilters {
  /** Filter by spa ID */
  spaId?: string;
  /** Filter by specialty */
  specialty?: string;
  /** Filter by gender */
  gender?: 'male' | 'female' | 'other';
  /** Only active therapists */
  isActive?: boolean;
  /** Only online therapists */
  isOnline?: boolean;
  /** Filter by language */
  language?: string;
  /** Maximum results */
  limit?: number;
}

// =============================================================================
// Query Keys
// =============================================================================

export const therapistQueryKeys = {
  all: ['therapists'] as const,
  lists: () => [...therapistQueryKeys.all, 'list'] as const,
  list: (filters?: TherapistFilters) => [...therapistQueryKeys.lists(), filters] as const,
  details: () => [...therapistQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...therapistQueryKeys.details(), id] as const,
  spaTherapists: (spaId: string) => [...therapistQueryKeys.all, 'spa', spaId] as const,
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Fetch list of therapists with optional filtering
 * 
 * @param filters - Optional filters for spa, specialty, gender
 * @returns Query result with therapist list
 * 
 * @example
 * ```tsx
 * const { data: therapists } = useTherapists({ spaId: 'spa-123' });
 * ```
 */
export function useTherapists(filters?: TherapistFilters) {
  const hooksLogger = therapistsLogger;

  return useQuery({
    queryKey: therapistQueryKeys.list(filters),
    queryFn: async (): Promise<TherapistWithId[]> => {
      if (!isFirebaseConfigured()) {
        hooksLogger.debug('Firebase not configured, returning empty therapist list');
        return [];
      }

      try {
        const constraints: QueryConstraintConfig[] = [];

        // Always filter for active therapists unless explicitly disabled
        if (filters?.isActive !== false) {
          constraints.push({
            type: 'where',
            field: 'isActive',
            operator: '==',
            value: true,
          });
        }

        if (filters?.spaId) {
          constraints.push({
            type: 'where',
            field: 'spaId',
            operator: '==',
            value: filters.spaId,
          });
        }

        if (filters?.gender) {
          constraints.push({
            type: 'where',
            field: 'gender',
            operator: '==',
            value: filters.gender,
          });
        }

        if (filters?.isOnline) {
          constraints.push({
            type: 'where',
            field: 'status',
            operator: '==',
            value: 'online',
          });
        }

        // Order by rating
        constraints.push({
          type: 'orderBy',
          field: 'rating.overall',
          direction: 'desc',
        });

        if (filters?.limit) {
          constraints.push({
            type: 'limit',
            count: filters.limit,
          });
        }

        const result = await firebaseClientWrapper.getDocuments<Therapist>('therapists', constraints);
        
        // Client-side filtering for complex conditions
        let documents = result.documents;

        if (filters?.specialty) {
          documents = documents.filter((doc) =>
            doc.data.specialties?.includes(filters.specialty!)
          );
        }

        if (filters?.language) {
          documents = documents.filter((doc) =>
            doc.data.languages?.includes(filters.language!)
          );
        }

        return documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        hooksLogger.error('Failed to fetch therapists', error, { filters });
        throw parseError(error);
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch a single therapist by ID
 * 
 * @param therapistId - The therapist document ID
 * @returns Query result with therapist details
 * 
 * @example
 * ```tsx
 * const { data: therapist } = useTherapist('therapist-123');
 * ```
 */
export function useTherapist(therapistId: string | null | undefined) {
  const hooksLogger = therapistsLogger;

  return useQuery({
    queryKey: therapistQueryKeys.detail(therapistId ?? ''),
    queryFn: async (): Promise<TherapistWithId | null> => {
      if (!therapistId) return null;

      if (!isFirebaseConfigured()) {
        hooksLogger.debug('Firebase not configured, returning null therapist');
        return null;
      }

      try {
        const result = await firebaseClientWrapper.getDocument<Therapist>('therapists', therapistId);
        
        if (!result) {
          return null;
        }

        return {
          id: result.id,
          ...result.data,
        };
      } catch (error) {
        hooksLogger.error('Failed to fetch therapist', error, { therapistId });
        throw parseError(error);
      }
    },
    enabled: !!therapistId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch therapists for a specific spa
 * 
 * @param spaId - The spa document ID
 * @returns Query result with spa's therapists
 * 
 * @example
 * ```tsx
 * const { data: therapists } = useSpaTherapists('spa-123');
 * ```
 */
export function useSpaTherapists(spaId: string | null | undefined) {
  const hooksLogger = therapistsLogger;

  return useQuery({
    queryKey: therapistQueryKeys.spaTherapists(spaId ?? ''),
    queryFn: async (): Promise<TherapistWithId[]> => {
      if (!spaId) return [];

      if (!isFirebaseConfigured()) {
        hooksLogger.debug('Firebase not configured, returning empty spa therapists');
        return [];
      }

      try {
        // Do NOT filter by onLeave here — spa owners/staff need to see ALL
        // therapists (including those on leave) on the Staff management page.
        // Customer-facing hooks (useAvailableTherapists) already apply
        // the onLeave + online filters.
        const constraints: QueryConstraintConfig[] = [
          {
            type: 'where',
            field: 'spaId',
            operator: '==',
            value: spaId,
          },
          {
            type: 'where',
            field: 'isActive',
            operator: '==',
            value: true,
          },
          {
            type: 'orderBy',
            field: 'rating.overall',
            direction: 'desc',
          },
        ];

        const result = await firebaseClientWrapper.getDocuments<Therapist>('therapists', constraints);

        return result.documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        hooksLogger.error('Failed to fetch spa therapists', error, { spaId });
        throw parseError(error);
      }
    },
    enabled: !!spaId,
    staleTime: 2 * 60 * 1000, // 2 minutes - therapist status can change
  });
}

/**
 * Fetch available therapists for a specific spa and time slot
 * 
 * @param spaId - The spa document ID
 * @param date - The date to check availability
 * @returns Query result with available therapists
 */
export function useAvailableTherapists(spaId: string | null | undefined, date?: string) {
  const hooksLogger = therapistsLogger;

  return useQuery({
    queryKey: [...therapistQueryKeys.spaTherapists(spaId ?? ''), 'available', date] as const,
    queryFn: async (): Promise<TherapistWithId[]> => {
      if (!spaId) return [];

      if (!isFirebaseConfigured()) {
        return [];
      }

      try {
        const constraints: QueryConstraintConfig[] = [
          {
            type: 'where',
            field: 'spaId',
            operator: '==',
            value: spaId,
          },
          {
            type: 'where',
            field: 'isActive',
            operator: '==',
            value: true,
          },
          {
            type: 'where',
            field: 'onLeave',
            operator: '==',
            value: false,
          },
          {
            type: 'where',
            field: 'status',
            operator: '==',
            value: 'online',
          },
          {
            type: 'orderBy',
            field: 'rating.overall',
            direction: 'desc',
          },
        ];

        const result = await firebaseClientWrapper.getDocuments<Therapist>('therapists', constraints);
        
        return result.documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        hooksLogger.error('Failed to fetch available therapists', error, { spaId, date });
        throw parseError(error);
      }
    },
    enabled: !!spaId,
    staleTime: 1 * 60 * 1000, // 1 minute - availability changes frequently
  });
}

/**
 * Fetch top-rated therapists (for featured/recommendations)
 * 
 * @param limitCount - Maximum number of results
 * @returns Query result with top therapists
 */
export function useTopTherapists(limitCount: number = 10) {
  const hooksLogger = therapistsLogger;

  return useQuery({
    queryKey: [...therapistQueryKeys.all, 'top', limitCount] as const,
    queryFn: async (): Promise<TherapistWithId[]> => {
      if (!isFirebaseConfigured()) {
        return [];
      }

      try {
        const constraints: QueryConstraintConfig[] = [
          {
            type: 'where',
            field: 'isActive',
            operator: '==',
            value: true,
          },
          {
            type: 'where',
            field: 'onLeave',
            operator: '==',
            value: false,
          },
          {
            type: 'orderBy',
            field: 'rating.overall',
            direction: 'desc',
          },
          {
            type: 'limit',
            count: limitCount,
          },
        ];

        const result = await firebaseClientWrapper.getDocuments<Therapist>('therapists', constraints);
        
        return result.documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        hooksLogger.error('Failed to fetch top therapists', error);
        throw parseError(error);
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
