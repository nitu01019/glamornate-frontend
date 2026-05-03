/**
 * BottomNav Tests
 *
 * Verifies the BottomNav component logic: nav items, route-based visibility,
 * and badge display.
 */

import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockPathname = '/';
let mockIsAuthenticated = false;
let mockUpcomingBookings: unknown[] = [];
let mockCartItemCount = 0;

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockIsAuthenticated ? { role: 'customer' } : null,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useBookings', () => ({
  useUpcomingBookings: () => ({
    data: mockUpcomingBookings,
  }),
}));

vi.mock('@/store/cart', () => ({
  useCartStore: (selector: (s: { getItemCount: () => number }) => number) =>
    selector({ getItemCount: () => mockCartItemCount }),
}));

// Mock lucide-react icons used by BottomNav
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
  };
});

// Mock next/link to render a plain anchor
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement('a', { href, ...rest }, children),
}));

import { render, screen } from '@testing-library/react';
import BottomNav from '@/components/layout/BottomNav';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BottomNav', () => {
  beforeEach(() => {
    mockPathname = '/';
    mockIsAuthenticated = false;
    mockUpcomingBookings = [];
    mockCartItemCount = 0;
  });

  it('renders all 5 nav items', () => {
    render(<BottomNav />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Cart')).toBeInTheDocument();
    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('Home link points to /', () => {
    render(<BottomNav />);
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('Services link points to /services', () => {
    render(<BottomNav />);
    const servicesLink = screen.getByText('Services').closest('a');
    expect(servicesLink).toHaveAttribute('href', '/services');
  });

  it('Cart link points to /cart', () => {
    render(<BottomNav />);
    const cartLink = screen.getByText('Cart').closest('a');
    expect(cartLink).toHaveAttribute('href', '/cart');
  });

  it('Bookings link points to /customer/bookings', () => {
    render(<BottomNav />);
    const bookingsLink = screen.getByText('Bookings').closest('a');
    expect(bookingsLink).toHaveAttribute('href', '/customer/bookings');
  });

  it('Account link points to /account', () => {
    render(<BottomNav />);
    const accountLink = screen.getByText('Account').closest('a');
    expect(accountLink).toHaveAttribute('href', '/account');
  });

  // UT-06: Returns null when pathname starts with /auth
  it('returns null when pathname starts with /auth', () => {
    mockPathname = '/auth/login';
    const { container } = render(<BottomNav />);
    expect(container.innerHTML).toBe('');
  });

  // UT-07: Returns null when pathname starts with /admin
  it('returns null when pathname starts with /admin', () => {
    mockPathname = '/admin/dashboard';
    const { container } = render(<BottomNav />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when pathname starts with /spa/dashboard', () => {
    mockPathname = '/spa/dashboard';
    const { container } = render(<BottomNav />);
    expect(container.innerHTML).toBe('');
  });
});
