/**
 * Notification hook — shared types, query keys, and pure helpers.
 *
 * Extracted from the monolithic `useNotifications.ts` (Phase 5 F-L5).
 *
 * Phase 4 schema contract (see docs/plans/2026-04-20-industry-overhaul/NOTIFICATIONS_SCHEMA.md):
 *   - Firestore rules only allow the owner to patch `readAt` on an update.
 *   - `read` is server-managed by the `markAllNotificationsRead` callable.
 *   - The client MUST therefore write only `{ readAt: <Timestamp> }` and treat
 *     `readAt` presence as the source of truth in the UI.
 *   - Backward compat: legacy docs may still carry `read === true` without a
 *     `readAt`; consumers should OR the two signals together when computing
 *     "unread".
 */

import type { AppError } from '@/lib/error-handler';
import type { Notification, NotificationType } from '@/types';

// =============================================================================
// Types
// =============================================================================

export interface NotificationWithId extends Notification {
  id: string;
}

export interface NotificationFilters {
  /** Only unread notifications */
  unreadOnly?: boolean;
  /** Filter by notification type */
  type?: NotificationType;
  /** Maximum results */
  limit?: number;
}

/**
 * Cursor-based pagination page returned from `useNotificationsFeed`'s
 * `useInfiniteQuery`. Each page carries the notifications it fetched plus the
 * `sentAt` cursor (ISO string) to be used as `startAfter` on the next call.
 */
export interface NotificationsFeedPage {
  readonly items: NotificationWithId[];
  readonly nextCursor: string | null;
}

/**
 * Return shape of the `useNotificationsFeed` public hook.
 */
export interface UseNotificationsFeedResult {
  readonly items: NotificationWithId[];
  readonly hasMore: boolean;
  readonly fetchMore: () => Promise<void>;
  readonly isFetching: boolean;
  readonly error: AppError | null;
}

// =============================================================================
// Query Keys
// =============================================================================

export const notificationQueryKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationQueryKeys.all, 'list'] as const,
  list: (filters?: NotificationFilters) => [...notificationQueryKeys.lists(), filters] as const,
  feed: (pageSize: number, uid: string | null) =>
    [...notificationQueryKeys.all, 'feed', uid, pageSize] as const,
  unreadCount: () => [...notificationQueryKeys.all, 'unread-count'] as const,
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Returns `true` when the notification should be treated as unread in the UI.
 *
 * Backward-compat rules (see schema doc §4 "Consumer implications"):
 *
 *   - New docs post Phase-4: `readAt` present ⇒ read.
 *   - Legacy docs: `read === true` ⇒ read (server may have flipped this via
 *     the `markAllNotificationsRead` callable before `readAt` was added).
 *
 * If EITHER signal says "read", the notification is read. The UI treats
 * `readAt` presence as the authoritative flag.
 */
export function isNotificationUnread(notification: Pick<Notification, 'read' | 'readAt'>): boolean {
  if (notification.readAt) return false;
  if (notification.read === true) return false;
  return true;
}
