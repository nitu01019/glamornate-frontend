import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { NotificationWithId } from '@/hooks/useNotifications';

// next/image brings Next.js runtime plumbing into jsdom tests — replace with a
// pass-through img so we can assert on the rendered element without a router.
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fill, sizes, unoptimized, priority, ...rest } = props as Record<string, unknown>;
    void fill;
    void sizes;
    void unoptimized;
    void priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

async function loadRow() {
  const mod = await import('../NotificationRow');
  return mod.default;
}

function buildNotification(
  overrides: Partial<NotificationWithId> = {},
): NotificationWithId {
  return {
    id: 'notif-1',
    userId: 'uid-1',
    type: 'booking_confirmed',
    title: 'Booking confirmed',
    body: 'Your appointment is confirmed for 5 pm.',
    data: {},
    read: false,
    deliveryStatus: 'delivered',
    sentAt: new Date().toISOString(),
    channels: { push: false, email: false, sms: false },
    ...overrides,
  } as NotificationWithId;
}

describe('NotificationRow', () => {
  afterEach(() => {
    cleanup();
  });

  it('marks the row as unread when readAt is absent', async () => {
    const Row = await loadRow();
    render(
      <ul>
        <Row notification={buildNotification()} onOpen={vi.fn()} onDelete={vi.fn()} />
      </ul>,
    );
    const row = screen.getByTestId('notification-row');
    expect(row).toHaveAttribute('data-unread', 'true');
    expect(screen.getByTestId('notification-unread-dot')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Booking confirmed.*unread/i }),
    ).toBeInTheDocument();
  });

  it('marks the row as read when readAt is set (even if read flag missing)', async () => {
    const Row = await loadRow();
    render(
      <ul>
        <Row
          notification={buildNotification({
            readAt: '2026-04-20T11:00:00.000Z',
            read: false,
          })}
          onOpen={vi.fn()}
          onDelete={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByTestId('notification-row')).toHaveAttribute('data-unread', 'false');
    expect(screen.queryByTestId('notification-unread-dot')).toBeNull();
  });

  it('invokes onOpen with the notification id + ctaUrl when the body is tapped', async () => {
    const Row = await loadRow();
    const onOpen = vi.fn();
    const notif = {
      ...buildNotification(),
      ctaUrl: '/customer/bookings/abc',
    } as NotificationWithId & { ctaUrl: string };
    render(
      <ul>
        <Row notification={notif} onOpen={onOpen} onDelete={vi.fn()} />
      </ul>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Booking confirmed/i }));
    expect(onOpen).toHaveBeenCalledWith('notif-1', '/customer/bookings/abc');
  });

  it('falls back to data.targetUrl when ctaUrl is absent', async () => {
    const Row = await loadRow();
    const onOpen = vi.fn();
    render(
      <ul>
        <Row
          notification={buildNotification({
            data: { targetUrl: '/customer/bookings/xyz' },
          })}
          onOpen={onOpen}
          onDelete={vi.fn()}
        />
      </ul>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Booking confirmed/i }));
    expect(onOpen).toHaveBeenCalledWith('notif-1', '/customer/bookings/xyz');
  });

  it('invokes onDelete and does NOT invoke onOpen when the delete button is tapped', async () => {
    const Row = await loadRow();
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    render(
      <ul>
        <Row notification={buildNotification()} onOpen={onOpen} onDelete={onDelete} />
      </ul>,
    );
    fireEvent.click(screen.getByTestId('notification-delete'));
    expect(onDelete).toHaveBeenCalledWith('notif-1');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('renders the imageUrl thumbnail when present', async () => {
    const Row = await loadRow();
    render(
      <ul>
        <Row
          notification={buildNotification({
            imageUrl: 'https://cdn.example.com/banner.jpg',
          })}
          onOpen={vi.fn()}
          onDelete={vi.fn()}
        />
      </ul>,
    );
    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/banner.jpg');
  });
});
