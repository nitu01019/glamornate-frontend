'use client';

/**
 * Legacy shim — re-exports from the split `hooks/notifications/` package.
 *
 * Phase 5 F-L5 split the original 594 LoC monolith into four focused modules
 * under `hooks/notifications/`. Existing import sites (`@/hooks/useNotifications`)
 * keep working thanks to this shim — no caller changes required.
 *
 * See `hooks/notifications/index.ts` for the new structure.
 */

export type {
  NotificationWithId,
  NotificationFilters,
  NotificationsFeedPage,
  UseNotificationsFeedResult,
} from './notifications';

export {
  notificationQueryKeys,
  isNotificationUnread,
  useNotifications,
  useUnreadCount,
  useNotificationsByType,
  useNotificationBadge,
  useNotificationsQuery,
  useNotificationsFeed,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from './notifications';
