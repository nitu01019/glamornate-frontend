'use client';

/**
 * Notification hook — real-time Firestore subscription based surfaces.
 *
 * Extracted from the monolithic `useNotifications.ts` (Phase 5 F-L5).
 * These hooks rely on `firebaseClientWrapper.subscribeToQuery` (onSnapshot
 * under the hood) and derive their data from a live Firestore listener.
 */

import { useState, useEffect, useMemo } from 'react';
import { firebaseClientWrapper, QueryConstraintConfig } from '@/lib/firebase-client-wrapper';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-provider';
import { AppError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import type { Notification, NotificationType } from '@/types';
import type { NotificationFilters, NotificationWithId } from './types';

// Module-scoped logger — stable reference, never triggers re-renders
const hooksLogger = logger.child({ component: 'useNotifications' });

/**
 * Fetch user's notifications with real-time updates
 * Uses Firestore onSnapshot for live updates
 *
 * @param filters - Optional filters for read status, type
 * @returns Object containing notifications and loading state
 *
 * @example
 * ```tsx
 * const { notifications, isLoading } = useNotifications({ unreadOnly: true });
 * ```
 */
export function useNotifications(filters?: NotificationFilters) {
  const { firebaseUser } = useAuth();
  const [notifications, setNotifications] = useState<NotificationWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  // Stabilize deps — always the same array length regardless of whether filters exist
  const uid = firebaseUser?.uid ?? null;
  const unreadOnly = filters?.unreadOnly ?? false;
  const filterType = filters?.type ?? null;
  const filterLimit = filters?.limit ?? 50;

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      setNotifications((prev) => (prev.length === 0 ? prev : []));
      setIsLoading(false);
      return;
    }

    hooksLogger.debug('Setting up notification subscription', { userId: uid });

    const constraints: QueryConstraintConfig[] = [
      { type: 'where', field: 'userId', operator: '==', value: uid },
    ];

    if (unreadOnly) {
      constraints.push({ type: 'where', field: 'read', operator: '==', value: false });
    }

    if (filterType) {
      constraints.push({ type: 'where', field: 'type', operator: '==', value: filterType });
    }

    constraints.push({ type: 'orderBy', field: 'sentAt', direction: 'desc' });
    constraints.push({ type: 'limit', count: filterLimit });

    const unsubscribe = firebaseClientWrapper.subscribeToQuery<Notification>(
      'notifications',
      constraints,
      (data, err) => {
        setIsLoading(false);

        if (err) {
          hooksLogger.error('Notification subscription error', err);
          setError(err);
          return;
        }

        const notificationsWithId = data.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));

        setNotifications(notificationsWithId);
        setError(null);
      },
    );

    return () => {
      hooksLogger.debug('Cleaning up notification subscription');
      unsubscribe();
    };
  }, [uid, unreadOnly, filterType, filterLimit]);

  return { notifications, isLoading, error };
}

/**
 * Get unread notification count
 *
 * @returns Object with unread count and loading state
 *
 * @example
 * ```tsx
 * const { count: unreadCount } = useUnreadCount();
 * ```
 */
export function useUnreadCount() {
  const { notifications, isLoading, error } = useNotifications({ unreadOnly: true });

  const count = useMemo(() => notifications.length, [notifications]);

  return { count, isLoading, error };
}

/**
 * Get notifications by type
 *
 * @param type - Notification type to filter by
 * @returns Query result with filtered notifications
 */
export function useNotificationsByType(type: NotificationType) {
  return useNotifications({ type });
}

/**
 * Subscribe to notification count changes
 * Useful for displaying badge count in navigation
 *
 * @returns Object with count, loading state, and whether there are new notifications
 */
export function useNotificationBadge() {
  const { count, isLoading, error } = useUnreadCount();

  const hasNewNotifications = count > 0;
  const displayCount = count > 99 ? '99+' : String(count);

  return {
    count,
    displayCount,
    hasNewNotifications,
    isLoading,
    error,
  };
}
