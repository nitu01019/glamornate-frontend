'use client';

/**
 * Service Hooks - React Query hooks for service data access
 * Provides data fetching for services catalog and spa-specific services
 */

import { useQuery } from '@tanstack/react-query';
import { firebaseClientWrapper, QueryConstraintConfig } from '@/lib/firebase-client-wrapper';
import { isFirebaseConfigured } from '@/lib/firebase';
import { parseError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import type { Service, SpaService, SpaCategory } from '@/types';

// =============================================================================
// Module-scope loggers (avoids new object on every render)
// =============================================================================

const useServicesLogger = logger.child({ component: 'useServices' });
const useServiceLogger = logger.child({ component: 'useService' });
const useSpaServicesLogger = logger.child({ component: 'useSpaServices' }); // used below
const useServiceCategoriesLogger = logger.child({ component: 'useServiceCategories' }); // used below
const usePopularServicesLogger = logger.child({ component: 'usePopularServices' }); // used below

// =============================================================================
// Types
// =============================================================================

export interface ServiceWithId extends Service {
  id: string;
}

export interface SpaServiceWithId extends SpaService {
  id: string;
  service?: ServiceWithId;
}

export interface ServiceFilters {
  /** Filter by category */
  category?: SpaCategory;
  /** Only active services */
  isActive?: boolean;
  /** Filter by tags */
  tags?: string[];
  /** Filter by recommended gender */
  recommendedFor?: 'all' | 'men' | 'women';
  /** Maximum results */
  limit?: number;
}

// =============================================================================
// Query Keys
// =============================================================================

export const serviceQueryKeys = {
  all: ['services'] as const,
  lists: () => [...serviceQueryKeys.all, 'list'] as const,
  list: (filters?: ServiceFilters) => [...serviceQueryKeys.lists(), filters] as const,
  details: () => [...serviceQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...serviceQueryKeys.details(), id] as const,
  categories: () => [...serviceQueryKeys.all, 'categories'] as const,
  spaServices: (spaId: string) => [...serviceQueryKeys.all, 'spa', spaId] as const,
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Fetch list of services from the catalog
 *
 * @param filters - Optional filters for category, active status
 * @returns Query result with service list
 *
 * @example
 * ```tsx
 * const { data: services } = useServices({ category: 'massage' });
 * ```
 */
export function useServices(filters?: ServiceFilters) {
  const hooksLogger = useServicesLogger;

  return useQuery({
    queryKey: serviceQueryKeys.list(filters),
    queryFn: async (): Promise<ServiceWithId[]> => {
      if (!isFirebaseConfigured()) {
        hooksLogger.debug('Firebase not configured, returning empty service list');
        return [];
      }

      try {
        const constraints: QueryConstraintConfig[] = [];

        if (filters?.category) {
          constraints.push({
            type: 'where',
            field: 'category',
            operator: '==',
            value: filters.category,
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

        if (filters?.recommendedFor && filters.recommendedFor !== 'all') {
          constraints.push({
            type: 'where',
            field: 'recommendedFor',
            operator: 'in',
            value: [filters.recommendedFor, 'all'],
          });
        }

        // Order by display ordering
        constraints.push({
          type: 'orderBy',
          field: 'ordering',
          direction: 'asc',
        });

        if (filters?.limit) {
          constraints.push({
            type: 'limit',
            count: filters.limit,
          });
        }

        const result = await firebaseClientWrapper.getDocuments<Service>('services', constraints);

        // Client-side filter for tags if provided
        let documents = result.documents;
        if (filters?.tags?.length) {
          documents = documents.filter((doc) =>
            filters.tags!.some((tag) => doc.data.tags?.includes(tag)),
          );
        }

        return documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        hooksLogger.error('Failed to fetch services', error, { filters });
        throw parseError(error);
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - services are relatively static
  });
}

/**
 * Fetch a single service by ID
 *
 * @param serviceId - The service document ID
 * @returns Query result with service details
 *
 * @example
 * ```tsx
 * const { data: service } = useService('service-123');
 * ```
 */
export function useService(serviceId: string | null | undefined) {
  const hooksLogger = useServiceLogger;

  return useQuery({
    queryKey: serviceQueryKeys.detail(serviceId ?? ''),
    queryFn: async (): Promise<ServiceWithId | null> => {
      if (!serviceId) return null;

      if (!isFirebaseConfigured()) {
        hooksLogger.debug('Firebase not configured, returning null service');
        return null;
      }

      try {
        const result = await firebaseClientWrapper.getDocument<Service>('services', serviceId);

        if (!result) {
          return null;
        }

        return {
          id: result.id,
          ...result.data,
        };
      } catch (error) {
        hooksLogger.error('Failed to fetch service', error, { serviceId });
        throw parseError(error);
      }
    },
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch services for a specific spa with pricing overrides
 *
 * @param spaId - The spa document ID
 * @returns Query result with spa-specific services
 *
 * @example
 * ```tsx
 * const { data: spaServices } = useSpaServices('spa-123');
 * ```
 */
export function useSpaServices(spaId: string | null | undefined) {
  const hooksLogger = useSpaServicesLogger;

  return useQuery({
    queryKey: serviceQueryKeys.spaServices(spaId ?? ''),
    queryFn: async (): Promise<SpaServiceWithId[]> => {
      if (!spaId) return [];

      if (!isFirebaseConfigured()) {
        hooksLogger.debug('Firebase not configured, returning empty spa services');
        return [];
      }

      try {
        // Fetch spa-specific service configurations
        const spaServicesResult = await firebaseClientWrapper.getSubcollectionDocuments<SpaService>(
          'spas',
          spaId,
          'services',
          [
            {
              type: 'where',
              field: 'isActive',
              operator: '==',
              value: true,
            },
          ],
        );

        // Fetch base service details for each spa service
        const servicesWithDetails = await Promise.all(
          spaServicesResult.documents.map(async (spaService) => {
            // Extract service ID from compositeId (format: spaId_serviceId)
            const parts = spaService.data.compositeId?.split('_');
            const serviceId = parts && parts.length > 1 ? parts[1] : spaService.id;

            const baseService = await firebaseClientWrapper.getDocument<Service>(
              'services',
              serviceId,
            );

            return {
              id: spaService.id,
              ...spaService.data,
              service: baseService ? { id: baseService.id, ...baseService.data } : undefined,
            };
          }),
        );

        return servicesWithDetails;
      } catch (error) {
        hooksLogger.error('Failed to fetch spa services', error, { spaId });
        throw parseError(error);
      }
    },
    enabled: !!spaId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch distinct service categories
 *
 * @returns Query result with unique categories
 *
 * @example
 * ```tsx
 * const { data: categories } = useServiceCategories();
 * ```
 */
export function useServiceCategories() {
  const hooksLogger = useServiceCategoriesLogger;

  return useQuery({
    queryKey: serviceQueryKeys.categories(),
    queryFn: async (): Promise<SpaCategory[]> => {
      if (!isFirebaseConfigured()) {
        hooksLogger.debug('Firebase not configured, returning empty categories');
        return [];
      }

      try {
        // Fetch all active services
        const result = await firebaseClientWrapper.getDocuments<Service>('services', [
          {
            type: 'where',
            field: 'isActive',
            operator: '==',
            value: true,
          },
        ]);

        // Extract unique categories
        const categories = new Set<SpaCategory>();
        result.documents.forEach((doc) => {
          if (doc.data.category) {
            categories.add(doc.data.category);
          }
        });

        return Array.from(categories);
      } catch (error) {
        hooksLogger.error('Failed to fetch service categories', error);
        throw parseError(error);
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - categories rarely change
  });
}

/**
 * Fetch services by category
 * Convenience hook for filtering by specific category
 *
 * @param category - The service category
 * @returns Query result with services in category
 */
export function useServicesByCategory(category: SpaCategory) {
  return useServices({
    category,
    isActive: true,
  });
}

/**
 * Fetch popular services (for homepage/recommendations)
 *
 * @returns Query result with popular services
 */
export function usePopularServices() {
  const hooksLogger = usePopularServicesLogger;

  return useQuery({
    queryKey: [...serviceQueryKeys.all, 'popular'] as const,
    queryFn: async (): Promise<ServiceWithId[]> => {
      if (!isFirebaseConfigured()) {
        return [];
      }

      try {
        // Fetch active services ordered by booking count or similar popularity metric
        const constraints: QueryConstraintConfig[] = [
          {
            type: 'where',
            field: 'isActive',
            operator: '==',
            value: true,
          },
          {
            type: 'orderBy',
            field: 'ordering',
            direction: 'asc',
          },
          {
            type: 'limit',
            count: 10,
          },
        ];

        const result = await firebaseClientWrapper.getDocuments<Service>('services', constraints);

        return result.documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        hooksLogger.error('Failed to fetch popular services', error);
        throw parseError(error);
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
