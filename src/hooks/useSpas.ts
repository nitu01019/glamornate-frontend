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

        // Add ordering only when caller asks for it. The legacy default of
        // `createdAt desc` forces a composite index `(filter ASC, createdAt
        // DESC)` for every where-clause variant. For `useActiveSpa` (single
        // result, ordering irrelevant) the orderBy was the silent failure
        // mode that left every customer with no active spa resolved.
        if (filters?.sortBy) {
          const sortField = filters.sortBy === 'rating' ? 'rating.overall' : filters.sortBy;
          constraints.push({
            type: 'orderBy',
            field: sortField,
            direction: filters.sortDirection ?? 'desc',
          });
        }

        // Add limit
        if (filters?.limit) {
          constraints.push({
            type: 'limit',
            count: filters.limit,
          });
        }

        // Temporary diagnostic 2026-05-13: surface raw SDK behavior in logcat
        // so we can tell empty-result from silent-error from queue-stall.
        // eslint-disable-next-line no-console
        console.warn('useSpas.query.start', JSON.stringify({ filters, constraints }));
        const result = await firebaseClientWrapper.getDocuments<Spa>('spas', constraints);
        // eslint-disable-next-line no-console
        console.warn(
          'useSpas.query.ok',
          JSON.stringify({ count: result.documents.length, firstId: result.documents[0]?.id }),
        );

        return result.documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('useSpas.query.error', String(error instanceof Error ? error.message : error));
        hooksLogger.error('Failed to fetch spas', error, { filters });
        throw parseError(error);
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - spas data is relatively static
  });
}

/**
 * Resolve the single active spa for this app (Glamornate is a single-salon
 * app — there is exactly one active spa). Used by the customer booking flow
 * so the wizard auto-stamps `spaId` without ever showing a picker.
 *
 * Implementation: reuses `useSpas({ status: 'active', limit: 1 })` and
 * returns the first match, or `null` while loading / on error. Cached for
 * 5 minutes in TanStack Query.
 *
 * 2026-05-13: introduced to remove every hardcoded spa-id literal from
 * customer-facing code. The Firestore `(default).spas` collection holds the
 * sole active spa; recovery from accidental deletion = reseed (see
 * `backend/scripts/seed-glamornate-spa.mjs`).
 */
/**
 * Resolve the single active spa via a direct Firestore REST call.
 *
 * 2026-05-13 (rev 3): the JS-SDK path (`useSpas`) silently returned empty on
 * Capacitor builds — App Check token retrieval failed repeatedly, the SDK
 * dropped reads on the floor, and the booking wizard saw `activeSpa === null`
 * and refused to submit. Reads are now public (firestore.rules) so a plain
 * `fetch()` with the public API key works without auth or App Check.
 *
 * The REST endpoint runs the same `where status==active, limit 1` query the
 * SDK would, but it's a single HTTP request we can debug with `curl` and
 * doesn't go through the SDK's App-Check / queueing layers.
 */
export function useActiveSpa() {
  return useQuery({
    queryKey: ['activeSpa', 'rest'],
    queryFn: async (): Promise<SpaWithId | null> => {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (!apiKey || !projectId) {
        spasLogger.warn('useActiveSpa.misconfigured', {
          hasApiKey: !!apiKey,
          hasProjectId: !!projectId,
        });
        return null;
      }
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`;
      const body = {
        structuredQuery: {
          from: [{ collectionId: 'spas' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'EQUAL',
              value: { stringValue: 'active' },
            },
          },
          limit: 1,
        },
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        spasLogger.error('useActiveSpa.rest.failed', new Error(text), { status: res.status });
        return null;
      }
      const json = (await res.json()) as Array<{
        document?: { name: string; fields: Record<string, unknown> };
      }>;
      const entry = json.find((e) => e.document);
      if (!entry?.document) return null;
      const id = entry.document.name.split('/').pop() ?? '';
      const data = decodeFirestoreFields(entry.document.fields) as Partial<SpaWithId>;
      return { ...data, id } as SpaWithId;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Minimal decoder for Firestore REST `document.fields` shape. Walks the
 * tagged-union value objects (`stringValue`, `integerValue`, `mapValue`,
 * `arrayValue`, …) and returns the corresponding JS values. Only handles
 * the field types `useActiveSpa` actually consumes.
 */
function decodeFirestoreFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(fields)) {
    out[key] = decodeFirestoreValue(raw);
  }
  return out;
}

function decodeFirestoreValue(raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object') return raw;
  const v = raw as Record<string, unknown>;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) {
    const arr = (v.arrayValue as { values?: unknown[] })?.values ?? [];
    return arr.map(decodeFirestoreValue);
  }
  if ('mapValue' in v) {
    const map = (v.mapValue as { fields?: Record<string, unknown> })?.fields ?? {};
    return decodeFirestoreFields(map);
  }
  return raw;
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
