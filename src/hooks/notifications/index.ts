/**
 * Notification hooks barrel — public surface.
 *
 * Phase 5 F-L5 split the monolithic `useNotifications.ts` (594 LoC) into
 * four focused modules:
 *
 *   - `types.ts`        — shared types, query keys, `isNotificationUnread`
 *   - `subscriptions.ts` — onSnapshot-backed hooks (`useNotifications`,
 *                          `useUnreadCount`, `useNotificationsByType`,
 *                          `useNotificationBadge`)
 *   - `queries.ts`       — React Query `useQuery`/`useInfiniteQuery`
 *                          (`useNotificationsQuery`, `useNotificationsFeed`)
 *   - `mutations.ts`     — `useMarkNotificationRead`,
 *                          `useMarkAllNotificationsRead`,
 *                          `useDeleteNotification`
 *
 * Existing `import { ... } from '@/hooks/useNotifications'` call sites keep
 * working because the legacy shim re-exports this barrel.
 */

export type {
  NotificationWithId,
  NotificationFilters,
  NotificationsFeedPage,
  UseNotificationsFeedResult,
} from './types';

export { notificationQueryKeys, isNotificationUnread } from './types';

export {
  useNotifications,
  useUnreadCount,
  useNotificationsByType,
  useNotificationBadge,
} from './subscriptions';

export { useNotificationsQuery, useNotificationsFeed } from './queries';

export {
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from './mutations';
