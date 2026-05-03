'use client';

/**
 * Notification hook — write-side mutations (mark read / mark all read / delete).
 *
 * Extracted from the monolithic `useNotifications.ts` (Phase 5 F-L5).
 * All mutations use `useMutation` with optimistic cache patches scoped to
 * `notificationQueryKeys.all`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseClientWrapper } from '@/lib/firebase-client-wrapper';
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-provider';
import { parseError, AppError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import type { NotificationWithId, NotificationsFeedPage } from './types';
import { notificationQueryKeys } from './types';

// Module-scoped logger — stable reference, never triggers re-renders
const hooksLogger = logger.child({ component: 'useNotifications' });

/**
 * Mark a notification as read.
 *
 * Phase-4 schema rules only permit `readAt` in client-side updates — `read` is
 * server-managed. This hook therefore writes ONLY `{ readAt: serverTimestamp() }`
 * via a direct `updateDoc` call (the shared `firebase-client-wrapper` injects
 * `updatedAt` and would trip the rule's `affectedKeys().hasOnly(['readAt'])`).
 *
 * Optimistic update: the React Query cache is patched to flip `readAt` on the
 * target row BEFORE the network resolves, so consumers don't flicker. On
 * error the previous cache is restored.
 *
 * @returns Mutation for marking notification read
 *
 * @example
 * ```tsx
 * const { mutate: markRead } = useMarkNotificationRead();
 * markRead({ notificationId: 'notif-123' });
 * ```
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { notificationId: string }): Promise<void> => {
      hooksLogger.info('Marking notification as read', { notificationId: data.notificationId });

      if (!isFirebaseConfigured()) {
        throw new AppError('Firebase is not configured', { isRetryable: false });
      }

      try {
        const db = getFirestoreDb();
        const ref = doc(db, 'notifications', data.notificationId);
        // ONLY readAt — Phase-4 rules reject any other diff key.
        await updateDoc(ref, { readAt: serverTimestamp() });
      } catch (error) {
        hooksLogger.error('Mark notification read failed', error);
        throw parseError(error);
      }
    },
    onMutate: async (variables) => {
      // Optimistic patch — applied to every cached notifications list and feed.
      await queryClient.cancelQueries({ queryKey: notificationQueryKeys.all });

      const optimisticReadAt = new Date().toISOString();
      const snapshots = queryClient.getQueriesData({ queryKey: notificationQueryKeys.all });

      queryClient.setQueriesData<unknown>(
        { queryKey: notificationQueryKeys.all },
        (current: unknown) =>
          patchNotificationCache(current, variables.notificationId, optimisticReadAt),
      );

      return { snapshots } as const;
    },
    onError: (error, _vars, context) => {
      hooksLogger.error('Mark notification read failed', error);
      // Rollback — restore every cache entry exactly as it was.
      const snapshots = context?.snapshots ?? [];
      for (const [key, value] of snapshots) {
        queryClient.setQueryData(key, value);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    },
  });
}

/**
 * Immutable helper: patches any cached notification list / feed page so the
 * row identified by `notificationId` carries a new `readAt`. Unknown shapes
 * pass through unchanged so we never mangle unrelated cache entries.
 */
function patchNotificationCache(current: unknown, notificationId: string, readAt: string): unknown {
  if (!current) return current;

  // Flat list shape — `NotificationWithId[]`.
  if (Array.isArray(current)) {
    return current.map((entry) => patchRow(entry, notificationId, readAt));
  }

  // Infinite-query shape — `{ pages: NotificationsFeedPage[], pageParams: ... }`.
  if (typeof current === 'object' && 'pages' in current) {
    const infinite = current as { pages: unknown[]; pageParams: unknown };
    const nextPages = infinite.pages.map((page) => {
      if (
        page &&
        typeof page === 'object' &&
        'items' in page &&
        Array.isArray((page as { items: unknown[] }).items)
      ) {
        const typed = page as NotificationsFeedPage;
        return {
          ...typed,
          items: typed.items.map((item) => patchRow(item, notificationId, readAt)),
        };
      }
      return page;
    });
    return { ...infinite, pages: nextPages };
  }

  return current;
}

function patchRow(entry: unknown, notificationId: string, readAt: string): unknown {
  if (
    entry &&
    typeof entry === 'object' &&
    'id' in entry &&
    (entry as { id: unknown }).id === notificationId
  ) {
    const typed = entry as NotificationWithId;
    return { ...typed, readAt };
  }
  return entry;
}

/**
 * Mark all notifications as read
 *
 * @returns Mutation for marking all notifications read
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { firebaseUser } = useAuth();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      if (!firebaseUser?.uid) {
        throw new Error('User not authenticated');
      }

      hooksLogger.info('Marking all notifications as read');

      await firebaseClientWrapper.callFunction('markAllNotificationsRead', {
        userId: firebaseUser.uid,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    },
    onError: (error) => {
      hooksLogger.error('Mark all notifications read failed', error);
    },
  });
}

/**
 * Delete a notification
 *
 * @returns Mutation for deleting notification
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { notificationId: string }): Promise<void> => {
      hooksLogger.info('Deleting notification', { notificationId: data.notificationId });

      await firebaseClientWrapper.deleteDocument('notifications', data.notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    },
    onError: (error) => {
      hooksLogger.error('Delete notification failed', error);
    },
  });
}
