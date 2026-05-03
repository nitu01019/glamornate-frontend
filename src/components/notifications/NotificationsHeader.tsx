'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NotificationsHeaderProps {
  /** Count of unread notifications. Rendered next to the title and drives the
   *  disabled state of the "Mark all read" button. */
  readonly unreadCount: number;
  /** Callback fired when the user taps "Mark all read". */
  readonly onMarkAllRead: () => void;
  /** True while the mutation is in-flight — disables the action + toggles
   *  the visible label. */
  readonly isMarkAllPending?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Sticky top bar for the feed. The title is announced via `aria-live="polite"`
 * so screen readers get a heads-up when new unread notifications arrive —
 * this is the a11y requirement from the success contract (#9).
 */
export default function NotificationsHeader({
  unreadCount,
  onMarkAllRead,
  isMarkAllPending = false,
}: NotificationsHeaderProps) {
  const router = useRouter();
  const hasUnread = unreadCount > 0;
  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <header
      data-testid="notifications-header"
      className="sticky top-0 z-10 bg-white border-b border-gray-100"
    >
      <div className="flex items-center h-14 px-3 max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="w-10 h-10 flex items-center justify-center -ml-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700" aria-hidden="true" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="font-bold text-gray-900">Notifications</h1>
          <p
            className="text-xs text-gray-500 min-h-4"
            aria-live="polite"
            data-testid="notifications-unread-count"
          >
            {hasUnread ? `${displayCount} unread` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={!hasUnread || isMarkAllPending}
          aria-label="Mark all notifications as read"
          data-testid="notifications-mark-all"
          className={cn(
            'text-sm font-medium px-2 py-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500',
            hasUnread && !isMarkAllPending
              ? 'text-brand-maroon-500'
              : 'text-gray-300 cursor-not-allowed',
          )}
        >
          {isMarkAllPending ? 'Marking…' : 'Mark all read'}
        </button>
      </div>
    </header>
  );
}
