'use client';

/**
 * Notification hook — React Query backed reads (pagination + snapshots).
 *
 * Extracted from the monolithic `useNotifications.ts` (Phase 5 F-L5).
 * These hooks use `useQuery` / `useInfiniteQuery` against the Firestore
 * `notifications` collection through `firebaseClientWrapper.getDocuments`.
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { firebaseClientWrapper, QueryConstraintConfig } from '@/lib/firebase-client-wrapper';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-provider';
import { parseError, AppError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import type { Notification } from '@/types';
import type {
  NotificationFilters,
  NotificationsFeedPage,
  NotificationWithId,
  UseNotificationsFeedResult,
} from './types';
import { notificationQueryKeys } from './types';

// Module-scoped logger — stable reference, never triggers re-renders
const hooksLogger = logger.child({ component: 'useNotifications' });

/**
 * Fetch notifications using React Query (without real-time)
 * Use this for initial page load or when real-time is not needed
 *
 * @param filters - Optional filters
 * @returns Query result with notifications
 */
export function useNotificationsQuery(filters?: NotificationFilters) {
  const { firebaseUser } = useAuth();

  return useQuery({
    queryKey: notificationQueryKeys.list(filters),
    queryFn: async (): Promise<NotificationWithId[]> => {
      if (!firebaseUser?.uid || !isFirebaseConfigured()) {
        return [];
      }

      try {
        const constraints: QueryConstraintConfig[] = [
          {
            type: 'where',
            field: 'userId',
            operator: '==',
            value: firebaseUser.uid,
          },
        ];

        if (filters?.unreadOnly) {
          constraints.push({
            type: 'where',
            field: 'read',
            operator: '==',
            value: false,
          });
        }

        if (filters?.type) {
          constraints.push({
            type: 'where',
            field: 'type',
            operator: '==',
            value: filters.type,
          });
        }

        constraints.push({
          type: 'orderBy',
          field: 'sentAt',
          direction: 'desc',
        });

        if (filters?.limit) {
          constraints.push({
            type: 'limit',
            count: filters.limit,
          });
        }

        const result = await firebaseClientWrapper.getDocuments<Notification>(
          'notifications',
          constraints,
        );

        return result.documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        hooksLogger.error('Failed to fetch notifications', error);
        throw parseError(error);
      }
    },
    enabled: !!firebaseUser?.uid,
    staleTime: 30 * 1000, // 30 seconds - notifications should be fairly fresh
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Cursor-paginated feed backed by React Query's `useInfiniteQuery`.
 *
 * - Reads from the top-level `notifications` collection filtered by
 *   `userId == uid`, ordered by `sentAt desc`.
 * - The cursor is the last row's `sentAt` ISO string; subsequent pages use a
 *   `where('sentAt', '<', cursor)` constraint (Firestore composite index
 *   `(userId ASC, sentAt DESC)` is already deployed — see schema §5).
 * - Pages fewer than `pageSize` set `hasMore = false`.
 * - `fetchMore` is a stable callback suitable for onClick handlers and
 *   IntersectionObserver wires.
 *
 * @param pageSize - Rows per page. Defaults to 20 (matches the feed spec).
 */
export function useNotificationsFeed(pageSize = 20): UseNotificationsFeedResult {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  const query = useInfiniteQuery<NotificationsFeedPage, AppError>({
    queryKey: notificationQueryKeys.feed(pageSize, uid),
    enabled: !!uid && isFirebaseConfigured(),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    queryFn: async ({ pageParam }): Promise<NotificationsFeedPage> => {
      if (!uid || !isFirebaseConfigured()) {
        return { items: [], nextCursor: null };
      }

      try {
        const constraints: QueryConstraintConfig[] = [
          { type: 'where', field: 'userId', operator: '==', value: uid },
        ];

        if (typeof pageParam === 'string' && pageParam.length > 0) {
          // Cursor-based continuation: fetch docs strictly older than the last
          // row we already rendered. Composite index (userId, sentAt DESC)
          // serves this query.
          constraints.push({
            type: 'where',
            field: 'sentAt',
            operator: '<',
            value: pageParam,
          });
        }

        constraints.push({ type: 'orderBy', field: 'sentAt', direction: 'desc' });
        constraints.push({ type: 'limit', count: pageSize });

        const result = await firebaseClientWrapper.getDocuments<Notification>(
          'notifications',
          constraints,
        );

        const items: NotificationWithId[] = result.documents.map((d) => ({
          id: d.id,
          ...d.data,
        }));

        // hasMore signal: if the server returned a full page we assume there
        // may be more. If fewer than pageSize, we know we are at the tail.
        const nextCursor =
          items.length === pageSize ? readSentAtCursor(items[items.length - 1]) : null;

        return { items, nextCursor };
      } catch (error) {
        hooksLogger.error('Notifications feed fetch failed', error);
        throw parseError(error);
      }
    },
  });

  const items = useMemo<NotificationWithId[]>(() => {
    const pages = query.data?.pages ?? [];
    const flat: NotificationWithId[] = [];
    for (const page of pages) {
      for (const item of page.items) flat.push(item);
    }
    return flat;
  }, [query.data]);

  const fetchMore = useCallback(async () => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      await query.fetchNextPage();
    }
  }, [query]);

  return {
    items,
    hasMore: !!query.hasNextPage,
    fetchMore,
    isFetching: query.isFetching || query.isFetchingNextPage,
    error: (query.error as AppError | null) ?? null,
  };
}

function readSentAtCursor(row: NotificationWithId | undefined): string | null {
  if (!row) return null;
  // The firebase-client-wrapper converts Firestore Timestamps to ISO strings;
  // `sentAt` is always a string on the wire out. Defensive check kept for
  // legacy docs that may have a raw Timestamp.
  if (typeof row.sentAt === 'string') return row.sentAt;
  const maybeTs = row.sentAt as unknown as { toDate?: () => Date };
  if (maybeTs && typeof maybeTs.toDate === 'function') {
    return maybeTs.toDate().toISOString();
  }
  return null;
}
