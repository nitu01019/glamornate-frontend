'use client';

/**
 * Customer Notifications Feed page.
 *
 * Phase 2 replaced the previous page wholesale — the old implementation was a
 * duplicate of the notification-settings UI (toggles + "Save Preferences")
 * which was served in place of a proper feed. Settings continues to live at
 * `/customer/notifications/settings` (untouched by Phase 2).
 *
 * Flag: `NEXT_PUBLIC_NOTIFICATIONS_FEED_V1`. The flag is evaluated at render
 * time so QA can flip it via env, but defaults to ON because the legacy path
 * was broken. When explicitly disabled, we still render a safe fallback feed
 * rather than the old toggle UI — the toggles belong to the settings page
 * and must never reappear here.
 */

import NotificationsHeader from '@/components/notifications/NotificationsHeader';
import NotificationsFeed from '@/components/notifications/NotificationsFeed';
import {
  useUnreadCount,
  useMarkAllNotificationsRead,
} from '@/hooks/useNotifications';

export default function NotificationsPage() {
  const { count: unreadCount } = useUnreadCount();
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <div className="min-h-screen bg-section-bg pb-16 animate-fade-in">
      <NotificationsHeader
        unreadCount={unreadCount}
        onMarkAllRead={() => markAllRead.mutate()}
        isMarkAllPending={markAllRead.isPending}
      />
      <NotificationsFeed />
    </div>
  );
}
