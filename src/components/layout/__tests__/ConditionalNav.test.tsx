import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

const pathnameState = { current: '/' };
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.current,
}));
vi.mock('../AppHeader', () => ({
  default: () => <header data-testid="app-header" />,
}));
vi.mock('../BottomNav', () => ({
  default: () => <nav data-testid="bottom-nav" />,
}));
vi.mock('@/components/home/HomeLocationRow', () => ({
  default: () => <div data-testid="home-location-row" />,
}));

async function loadNav() {
  const mod = await import('../ConditionalNav');
  return mod.default;
}

afterEach(() => {
  cleanup();
  pathnameState.current = '/';
});

describe('ConditionalNav', () => {
  it('on home route (/), renders AppHeader + HomeLocationRow + BottomNav', async () => {
    pathnameState.current = '/';
    const ConditionalNav = await loadNav();
    render(
      <ConditionalNav>
        <div data-testid="page-content">content</div>
      </ConditionalNav>,
    );
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    expect(screen.getByTestId('home-location-row')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });

  it('main element uses pt-28 pb-20 spacing on the home route', async () => {
    pathnameState.current = '/';
    const ConditionalNav = await loadNav();
    render(
      <ConditionalNav>
        <div>x</div>
      </ConditionalNav>,
    );
    const main = screen.getByRole('main');
    expect(main.className).toMatch(/\bpt-28\b/);
    expect(main.className).toMatch(/\bpb-20\b/);
  });

  it.each(['/services', '/cart', '/customer/bookings', '/account', '/offers', '/customer/notifications'])(
    'on non-home customer route %s, renders AppHeader + BottomNav but NOT HomeLocationRow',
    async (route) => {
      pathnameState.current = route;
      const ConditionalNav = await loadNav();
      render(
        <ConditionalNav>
          <div>x</div>
        </ConditionalNav>,
      );
      expect(screen.getByTestId('app-header')).toBeInTheDocument();
      expect(screen.queryByTestId('home-location-row')).toBeNull();
      expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();
      const main = screen.getByRole('main');
      expect(main.className).toMatch(/\bpt-14\b/);
      expect(main.className).toMatch(/\bpb-20\b/);
      expect(main.className).not.toMatch(/\bpt-28\b/);
    },
  );

  it.each(['/admin', '/admin/users', '/spa', '/spa/dashboard', '/auth/login'])(
    'hides all chrome on portal/auth route %s',
    async (route) => {
      pathnameState.current = route;
      const ConditionalNav = await loadNav();
      render(
        <ConditionalNav>
          <div>x</div>
        </ConditionalNav>,
      );
      expect(screen.queryByTestId('app-header')).toBeNull();
      expect(screen.queryByTestId('home-location-row')).toBeNull();
      expect(screen.queryByTestId('bottom-nav')).toBeNull();
    },
  );
});
