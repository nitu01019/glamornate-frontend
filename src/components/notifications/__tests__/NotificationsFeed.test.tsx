import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { NotificationWithId } from '@/hooks/useNotifications';

// ---------------------------------------------------------------------------
// Mutable mock state — reset in beforeEach so each test owns its scenario.
// ---------------------------------------------------------------------------

interface HookState {
  notifications: NotificationWithId[];
  isLoading: boolean;
  error: Error | null;
}

const hookState: HookState = {
  notifications: [],
  isLoading: false,
  error: null,
};

const markReadMutate = vi.fn();
const deleteMutate = vi.fn();
const markAllMutate = vi.fn();
const routerPush = vi.fn();

vi.mock('@/hooks/useNotifications', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useNotifications')>(
    '@/hooks/useNotifications',
  );
  return {
    ...actual,
    useNotifications: () => hookState,
    useUnreadCount: () => ({
      count: hookState.notifications.filter((n) => !n.readAt).length,
      isLoading: false,
      error: null,
    }),
    useMarkNotificationRead: () => ({ mutate: markReadMutate, isPending: false }),
    useDeleteNotification: () => ({ mutate: deleteMutate, isPending: false }),
    useMarkAllNotificationsRead: () => ({
      mutate: markAllMutate,
      isPending: false,
    }),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
    back: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, sizes, unoptimized, priority, ...rest } = props as Record<string, unknown>;
    void fill;
    void sizes;
    void unoptimized;
    void priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function buildNotification(
  overrides: Partial<NotificationWithId> = {},
): NotificationWithId {
  return {
    id: 'notif-1',
    userId: 'uid-1',
    type: 'booking_confirmed',
    title: 'Booking confirmed',
    body: 'Your appointment is confirmed.',
    data: {},
    read: false,
    deliveryStatus: 'delivered',
    sentAt: new Date().toISOString(),
    channels: { push: false, email: false, sms: false },
    ...overrides,
  } as NotificationWithId;
}

async function loadFeed() {
  const mod = await import('../NotificationsFeed');
  return mod.default;
}

async function loadPage() {
  const mod = await import('@/app/customer/notifications/page');
  return mod.default;
}

describe('NotificationsFeed', () => {
  beforeEach(() => {
    hookState.notifications = [];
    hookState.isLoading = false;
    hookState.error = null;
    markReadMutate.mockReset();
    deleteMutate.mockReset();
    markAllMutate.mockReset();
    routerPush.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading indicator while fetching', async () => {
    hookState.isLoading = true;
    const Feed = await loadFeed();
    render(<Feed />);
    expect(screen.getByTestId('notifications-loading')).toBeInTheDocument();
  });

  it('renders error state when the hook reports an error', async () => {
    hookState.error = new Error('Network down');
    const Feed = await loadFeed();
    render(<Feed />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Network down/);
  });

  it('renders the empty state when loading finished with zero rows', async () => {
    const Feed = await loadFeed();
    render(<Feed />);
    expect(screen.getByTestId('notifications-empty')).toBeInTheDocument();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it('renders each notification and marks read on tap', async () => {
    hookState.notifications = [
      buildNotification({ id: 'n-1', title: 'First' }),
      buildNotification({ id: 'n-2', title: 'Second' }),
    ];
    const Feed = await loadFeed();
    render(<Feed />);
    const rows = screen.getAllByTestId('notification-row');
    expect(rows).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /First/i }));
    expect(markReadMutate).toHaveBeenCalledWith({ notificationId: 'n-1' });
  });

  it('routes in-app when ctaUrl is internal', async () => {
    const notif = {
      ...buildNotification({ id: 'n-1', title: 'Go check' }),
      ctaUrl: '/customer/bookings/1',
    } as NotificationWithId & { ctaUrl: string };
    hookState.notifications = [notif];
    const Feed = await loadFeed();
    render(<Feed />);
    fireEvent.click(screen.getByRole('button', { name: /Go check/i }));
    expect(routerPush).toHaveBeenCalledWith('/customer/bookings/1');
  });

  it('delete button triggers delete mutation', async () => {
    hookState.notifications = [buildNotification({ id: 'n-1' })];
    const Feed = await loadFeed();
    render(<Feed />);
    fireEvent.click(screen.getByTestId('notification-delete'));
    expect(deleteMutate).toHaveBeenCalledWith({ notificationId: 'n-1' });
  });
});

describe('Notifications page composition', () => {
  beforeEach(() => {
    hookState.notifications = [];
    hookState.isLoading = false;
    hookState.error = null;
    markReadMutate.mockReset();
    deleteMutate.mockReset();
    markAllMutate.mockReset();
    routerPush.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('composes Header + Feed + Empty when there are no notifications', async () => {
    const Page = await loadPage();
    render(<Page />);
    expect(screen.getByTestId('notifications-header')).toBeInTheDocument();
    expect(screen.getByTestId('notifications-empty')).toBeInTheDocument();
  });

  it('contains NO settings-era copy (critical regression guard)', async () => {
    hookState.notifications = [buildNotification()];
    const Page = await loadPage();
    render(<Page />);
    // These strings were the smoking gun of the old duplicate-of-settings page.
    expect(screen.queryByText(/Save Preferences/i)).toBeNull();
    expect(screen.queryByText(/Notification Preferences/i)).toBeNull();
    expect(screen.queryByText(/Booking Updates/i)).toBeNull();
    expect(screen.queryByText(/Promotions & Offers/i)).toBeNull();
    expect(screen.queryByText(/Account & Security/i)).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('tracks the unread badge via useUnreadCount()', async () => {
    hookState.notifications = [
      buildNotification({ id: 'n-1' }),
      buildNotification({ id: 'n-2' }),
      buildNotification({ id: 'n-3', readAt: new Date().toISOString() }),
    ];
    const Page = await loadPage();
    render(<Page />);
    expect(screen.getByTestId('notifications-unread-count')).toHaveTextContent('2 unread');
  });

  it('shows no unread text when all notifications are read', async () => {
    hookState.notifications = [
      buildNotification({ id: 'n-1', readAt: new Date().toISOString() }),
    ];
    const Page = await loadPage();
    render(<Page />);
    // The live region still exists (for a11y announcements) but is empty.
    expect(screen.getByTestId('notifications-unread-count').textContent).toBe('');
  });

  it('mark-all button triggers useMarkAllNotificationsRead and is disabled when empty', async () => {
    const Page = await loadPage();
    render(<Page />);
    const btn = screen.getByTestId('notifications-mark-all');
    expect(btn).toBeDisabled();

    hookState.notifications = [buildNotification({ id: 'n-1' })];
    cleanup();
    const Page2 = await loadPage();
    render(<Page2 />);
    const btn2 = screen.getByTestId('notifications-mark-all');
    expect(btn2).not.toBeDisabled();
    fireEvent.click(btn2);
    expect(markAllMutate).toHaveBeenCalled();
  });

  it('header unread-count live region is aria-live polite', async () => {
    hookState.notifications = [buildNotification({ id: 'n-1' })];
    const Page = await loadPage();
    render(<Page />);
    expect(screen.getByTestId('notifications-unread-count')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });
});
