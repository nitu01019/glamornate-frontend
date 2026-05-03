'use client';

/**
 * Spa Hooks - React Query hooks for spa data access
 * Provides data fetching, caching, and search capabilities for spas
 */

import { useQuery } from '@tanstack/react-query';
import { firebaseClientWrapper, QueryConstraintConfig } from '@/lib/firebase-client-wrapper';
import { isFirebaseConfigured } from '@/lib/firebase';
import { parseError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

const spasLogger = logger.child({ component: 'useSpas' });

import type { Spa, SpaTier, SpaStatus, SpaCategory } from '@/types';

// =============================================================================
// Types
// =============================================================================

export interface SpaWithId extends Spa {
  id: string;
}

export interface SpaFilters {
  /** Filter by city */
  city?: string;
  /** Filter by category */
  category?: SpaCategory;
  /** Minimum rating (1-5) */
  minRating?: number;
  /** Filter by tier */
  tier?: SpaTier;
  /** Filter by status */
  status?: SpaStatus;
  /** Only active spas */
  isActive?: boolean;
  /** Sort field */
  sortBy?: 'rating' | 'name' | 'createdAt';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Maximum results */
  limit?: number;
}

// =============================================================================
// Query Keys
// =============================================================================

export const spaQueryKeys = {
  all: ['spas'] as const,
  lists: () => [...spaQueryKeys.all, 'list'] as const,
  list: (filters?: SpaFilters) => [...spaQueryKeys.lists(), filters] as const,
  details: () => [...spaQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...spaQueryKeys.details(), id] as const,
  featured: () => [...spaQueryKeys.all, 'featured'] as const,
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Fetch list of spas with optional filtering
 *
 * @param filters - Optional filters for city, category, rating, tier
 * @returns Query result with spa list
 *
 * @example
 * ```tsx
 * const { data: spas, isLoading } = useSpas({ city: 'Mumbai', minRating: 4 });
 * ```
 */
export function useSpas(filters?: SpaFilters) {
  const hooksLogger = spasLogger;

  return useQuery({
    queryKey: spaQueryKeys.list(filters),
    queryFn: async (): Promise<SpaWithId[]> => {
      // Return empty array if Firebase not configured
      if (!isFirebaseConfigured()) {
        hooksLogger.debug('Firebase not configured, returning empty spa list');
        return [];
      }

      try {
        const constraints: QueryConstraintConfig[] = [];

        // Build query constraints
        if (filters?.city) {
          constraints.push({
            type: 'where',
            field: 'location.city',
            operator: '==',
            value: filters.city,
          });
        }

        if (filters?.category) {
          constraints.push({
            type: 'where',
            field: 'categories',
            operator: 'array-contains',
            value: filters.category,
          });
        }

        if (filters?.minRating) {
          constraints.push({
            type: 'where',
            field: 'rating.overall',
            operator: '>=',
            value: filters.minRating,
          });
        }

        if (filters?.tier) {
          constraints.push({
            type: 'where',
            field: 'tier',
            operator: '==',
            value: filters.tier,
          });
        }

        if (filters?.status) {
          constraints.push({
            type: 'where',
            field: 'status',
            operator: '==',
            value: filters.status,
          });
        }

        if (filters?.isActive !== undefined) {
          constraints.push({
            type: 'where',
            field: 'isActive',
            operator: '==',
            value: filters.isActive,
          });
        }

        // Add ordering
        const sortField =
          filters?.sortBy === 'rating' ? 'rating.overall' : (filters?.sortBy ?? 'createdAt');
        constraints.push({
          type: 'orderBy',
          field: sortField,
          direction: filters?.sortDirection ?? 'desc',
        });

        // Add limit
        if (filters?.limit) {
          constraints.push({
            type: 'limit',
            count: filters.limit,
          });
        }

        const result = await firebaseClientWrapper.getDocuments<Spa>('spas', constraints);

        return result.documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        hooksLogger.error('Failed to fetch spas', error, { filters });
        throw parseError(error);
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - spas data is relatively static
  });
}

/**
 * Fetch a single spa by ID
 *
 * @param spaId - The spa document ID
 * @returns Query result with spa details
 *
 * @example
 * ```tsx
 * const { data: spa, isLoading } = useSpa('spa-123');
 * ```
 */
export function useSpa(spaId: string | null | undefined) {
  const hooksLogger = spasLogger;

  return useQuery({
    queryKey: spaQueryKeys.detail(spaId ?? ''),
    queryFn: async (): Promise<SpaWithId | null> => {
      if (!spaId) return null;

      // Return null if Firebase not configured
      if (!isFirebaseConfigured()) {
        hooksLogger.debug('Firebase not configured, returning null spa');
        return null;
      }

      try {
        const result = await firebaseClientWrapper.getDocument<Spa>('spas', spaId);

        if (!result) {
          return null;
        }

        return {
          id: result.id,
          ...result.data,
        };
      } catch (error) {
        hooksLogger.error('Failed to fetch spa', error, { spaId });
        throw parseError(error);
      }
    },
    enabled: !!spaId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch featured/top-rated spas for homepage
 *
 * @returns Query result with featured spas (top rated, active)
 *
 * @example
 * ```tsx
 * const { data: featuredSpas } = useFeaturedSpas();
 * ```
 */
export function useFeaturedSpas() {
  const hooksLogger = spasLogger;

  return useQuery({
    queryKey: spaQueryKeys.featured(),
    queryFn: async (): Promise<SpaWithId[]> => {
      // Return empty array if Firebase not configured
      if (!isFirebaseConfigured()) {
        hooksLogger.debug('Firebase not configured, returning empty featured spas');
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
            field: 'status',
            operator: 'in',
            value: ['active', 'verified'],
          },
          {
            type: 'orderBy',
            field: 'rating.overall',
            direction: 'desc',
          },
          {
            type: 'limit',
            count: 8,
          },
        ];

        const result = await firebaseClientWrapper.getDocuments<Spa>('spas', constraints);

        return result.documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        hooksLogger.error('Failed to fetch featured spas', error);
        throw parseError(error);
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - featured list is fairly static
  });
}

/**
 * Fetch spas by tier (basic, premium, partner)
 *
 * @param tier - The spa tier to filter by
 * @param limitCount - Maximum number of results
 * @returns Query result with spas of specified tier
 */
export function useSpasByTier(tier: SpaTier, limitCount: number = 10) {
  return useSpas({
    tier,
    isActive: true,
    sortBy: 'rating',
    sortDirection: 'desc',
    limit: limitCount,
  });
}

/**
 * Fetch spas by category
 *
 * @param category - The spa category to filter by
 * @param limitCount - Maximum number of results
 * @returns Query result with spas of specified category
 */
export function useSpasByCategory(category: SpaCategory, limitCount: number = 20) {
  return useSpas({
    category,
    isActive: true,
    sortBy: 'rating',
    sortDirection: 'desc',
    limit: limitCount,
  });
}
