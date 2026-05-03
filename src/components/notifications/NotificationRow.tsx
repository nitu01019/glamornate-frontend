'use client';

import { Bell, Trash2 } from 'lucide-react';
import Image from 'next/image';
import type { NotificationWithId } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { relativeTimeFrom } from './utils/relative-time';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NotificationRowProps {
  readonly notification: NotificationWithId;
  /** Fired when the user taps the row body — feed marks the row as read and
   *  optionally navigates to `ctaUrl`. */
  readonly onOpen: (id: string, ctaUrl?: string) => void;
  /** Fired when the user taps the delete button. Event propagation is stopped
   *  in the handler so this never triggers `onOpen`. */
  readonly onDelete: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * New Phase-4 rules only allow the owner to patch `readAt`. The server-managed
 * `read` boolean may still be present on legacy docs, but the UI treats
 * `readAt` presence as the source of truth so the new rules don't cause a
 * visual regression.
 */
function isUnread(notification: NotificationWithId): boolean {
  return !notification.readAt;
}

/**
 * Pull a usable deep-link out of the notification. Phase-4 schema prefers
 * `ctaUrl`, but older docs wrote `data.targetUrl`; we honour both.
 */
function resolveCtaUrl(notification: NotificationWithId): string | undefined {
  const schema = notification as NotificationWithId & {
    ctaUrl?: string | null;
  };
  if (typeof schema.ctaUrl === 'string' && schema.ctaUrl.length > 0) {
    return schema.ctaUrl;
  }
  const data = notification.data as Record<string, unknown> | undefined;
  const legacy = data && typeof data.targetUrl === 'string' ? data.targetUrl : undefined;
  return legacy;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Single notification row. Composed inside `NotificationsFeed` — it does NOT
 * subscribe to Firestore itself. Accessibility:
 *
 * - The whole row is a button with an `aria-label` that includes the unread
 *   state so screen readers announce it redundantly with the visual dot.
 * - The delete button is a distinct button so tab order is row → delete →
 *   next row.
 */
export default function NotificationRow({
  notification,
  onOpen,
  onDelete,
}: NotificationRowProps) {
  const unread = isUnread(notification);
  const time = relativeTimeFrom(notification.sentAt);
  const ctaUrl = resolveCtaUrl(notification);
  const imageUrl = notification.imageUrl;

  return (
    <li
      data-testid="notification-row"
      data-unread={unread ? 'true' : 'false'}
      className={cn(
        'flex items-start gap-3 px-4 py-3 border-b border-gray-100 transition-colors',
        unread && 'bg-brand-maroon-50/40',
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(notification.id, ctaUrl)}
        aria-label={`${notification.title}${unread ? ', unread' : ''}`}
        className="flex items-start gap-3 flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500 rounded-lg"
      >
        {imageUrl ? (
          <div className="relative w-10 h-10 flex-shrink-0 rounded-full overflow-hidden bg-gray-100">
            <Image
              src={imageUrl}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-10 h-10 flex-shrink-0 rounded-full bg-brand-maroon-50 flex items-center justify-center">
            <Bell className="w-5 h-5 text-brand-maroon-500" aria-hidden="true" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                'text-sm truncate',
                unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800',
              )}
            >
              {notification.title}
            </p>
            {unread && (
              <span
                data-testid="notification-unread-dot"
                aria-hidden="true"
                className="w-2 h-2 rounded-full bg-brand-maroon-500 flex-shrink-0"
              />
            )}
            {time && (
              <span className="text-xs text-gray-500 flex-shrink-0 ml-auto">{time}</span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{notification.body}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(notification.id);
        }}
        aria-label="Delete notification"
        data-testid="notification-delete"
        className="p-2 -m-2 text-gray-400 hover:text-brand-maroon-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500 rounded-full"
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>
    </li>
  );
}
