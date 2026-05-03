'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/contracts';
import type { ServiceCategory, HomeService, Promotion } from '@/lib/mock-data';
import { catalogCategories, catalogServices } from '@/data/glamornate-catalog';
import { promotions as catalogPromotions } from '@/lib/mock-data';

type FallbackLevel = 'city' | 'backfill' | 'platform';

/**
 * Bundled catalog fallback used when the live backend is unreachable
 * (APK launched before Firebase Functions are deployed, offline Capacitor
 * WebView, transient network error). Resolving to local data keeps the
 * home feed visible. When the API starts responding, subsequent refetches
 * transparently replace the fallback with live data.
 */
const FALLBACK_CATEGORIES: ServiceCategory[] = catalogCategories;
const FALLBACK_SERVICES: HomeService[] = catalogServices;
const FALLBACK_PROMOTIONS: Promotion[] = catalogPromotions;

function sortByBookings(services: HomeService[], limit = 10): HomeService[] {
  return [...services]
    .sort((a, b) => (b.bookingCount ?? 0) - (a.bookingCount ?? 0))
    .slice(0, limit);
}

/**
 * Return type for most-booked including the fallback level echoed by the
 * backend (`city` → `backfill` → `platform`).
 */
export interface MostBookedResult {
  services: HomeService[];
  fallbackLevel: FallbackLevel;
}

/** Fetch service categories with bundled-catalog fallback on failure. */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<ServiceCategory[]> => {
      try {
        return await apiClient.get<ServiceCategory[]>('/services/categories');
      } catch {
        return FALLBACK_CATEGORIES;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    placeholderData: FALLBACK_CATEGORIES,
  });
}

/**
 * Fetch most-booked services, optionally filtered by category and city,
 * with bundled-catalog fallback on failure. The backend returns a raw
 * envelope with `fallbackLevel` at the root; on failure we mark the
 * result as `platform` so UI can reflect offline state.
 */
export function useMostBooked(category?: string, city?: string) {
  return useQuery({
    queryKey: ['most-booked', category ?? 'all', city ?? 'all'],
    queryFn: async (): Promise<MostBookedResult> => {
      try {
        const envelope = await apiClient.get<ApiResponse<HomeService[]>>(
          '/services/most-booked',
          { params: { category, city }, raw: true },
        );
        return {
          services: envelope.data ?? [],
          fallbackLevel: envelope.fallbackLevel ?? 'platform',
        };
      } catch {
        const filtered = category
          ? FALLBACK_SERVICES.filter((s) => s.categorySlug === category)
          : FALLBACK_SERVICES;
        return {
          services: sortByBookings(filtered, 10),
          fallbackLevel: 'platform',
        };
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    placeholderData: {
      services: sortByBookings(
        category
          ? FALLBACK_SERVICES.filter((s) => s.categorySlug === category)
          : FALLBACK_SERVICES,
        10,
      ),
      fallbackLevel: 'platform' as FallbackLevel,
    } satisfies MostBookedResult,
  });
}

/** Fetch promotions with bundled-catalog fallback on failure. */
export function usePromotions() {
  return useQuery({
    queryKey: ['promotions'],
    queryFn: async (): Promise<Promotion[]> => {
      try {
        return await apiClient.get<Promotion[]>('/promotions');
      } catch {
        return FALLBACK_PROMOTIONS.filter((p) => p.isActive);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    placeholderData: FALLBACK_PROMOTIONS.filter((p) => p.isActive),
  });
}
