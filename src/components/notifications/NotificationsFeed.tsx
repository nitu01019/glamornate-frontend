'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  useNotifications,
  useMarkNotificationRead,
  useDeleteNotification,
  type NotificationWithId,
} from '@/hooks/useNotifications';
import NotificationRow from './NotificationRow';
import NotificationsEmpty from './NotificationsEmpty';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FeedLoading() {
  return (
    <div
      data-testid="notifications-loading"
      className="flex items-center justify-center py-16 text-gray-400"
    >
      <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
      <span className="sr-only">Loading notifications</span>
    </div>
  );
}

function FeedError({ message }: { readonly message: string }) {
  return (
    <div
      role="alert"
      data-testid="notifications-error"
      className="flex flex-col items-center justify-center px-8 py-16 text-center"
    >
      <AlertCircle className="w-10 h-10 text-brand-maroon-500 mb-3" aria-hidden="true" />
      <h2 className="text-base font-semibold text-gray-900 mb-1">
        We couldn&apos;t load your notifications
      </h2>
      <p className="text-sm text-gray-500 max-w-xs">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

/**
 * Main feed list. Reads live notifications via `useNotifications()`, handles
 * three display states (loading, error, empty) and delegates row rendering
 * to `NotificationRow`.
 *
 * Read semantics: the Phase-4 schema forbids client writes to any field other
 * than `readAt`, so we only rely on `readAt`'s presence to mark a row as
 * read. The hook still writes both `read` and `readAt` today — if the rule
 * rejects that write, B2 will update the hook. This component stays correct
 * against the schema either way.
 */
export default function NotificationsFeed() {
  const router = useRouter();
  const { notifications, isLoading, error } = useNotifications();
  const markRead = useMarkNotificationRead();
  const deleteNotification = useDeleteNotification();

  const handleOpen = useCallback(
    (id: string, ctaUrl?: string) => {
      markRead.mutate({ notificationId: id });
      if (!ctaUrl) return;
      if (isExternalUrl(ctaUrl)) {
        if (typeof window !== 'undefined') {
          window.location.assign(ctaUrl);
        }
        return;
      }
      router.push(ctaUrl);
    },
    [markRead, router],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteNotification.mutate({ notificationId: id });
    },
    [deleteNotification],
  );

  if (isLoading) {
    return <FeedLoading />;
  }

  if (error) {
    return <FeedError message={error.message ?? 'Please try again in a moment.'} />;
  }

  if (notifications.length === 0) {
    return <NotificationsEmpty />;
  }

  return (
    <ul
      role="list"
      data-testid="notifications-feed"
      className="bg-white divide-y divide-gray-100"
    >
      {notifications.map((notification: NotificationWithId) => (
        <NotificationRow
          key={notification.id}
          notification={notification}
          onOpen={handleOpen}
          onDelete={handleDelete}
        />
      ))}
    </ul>
  );
}
