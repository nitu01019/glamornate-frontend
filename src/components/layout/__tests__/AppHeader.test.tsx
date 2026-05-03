import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import type { UserLocation } from '@/lib/location-provider';

// ---------------------------------------------------------------------------
// Mocks — configured per-test via mutable state objects.
// ---------------------------------------------------------------------------

interface AuthState {
  user: { profile?: { displayName?: string } } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface LocationState {
  location: UserLocation | null;
}

const authState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
};

const locationState: LocationState = {
  location: null,
};

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/location-provider', () => ({
  useLocation: () => locationState,
}));

vi.mock('@/hooks/useNotifications', () => ({
  useUnreadCount: () => ({ count: 0 }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/components/home/LocationPicker', () => ({
  default: () => null,
}));

vi.mock('@/components/layout/AnimatedBrandName', () => ({
  default: () => <span data-testid="animated-brand-name">Glamornate</span>,
}));

// Delay import of AppHeader until after mocks are registered.
const loadAppHeader = async () => {
  const mod = await import('../AppHeader');
  return mod.default;
};

async function renderAppHeader() {
  const AppHeader = await loadAppHeader();
  // AppHeader defers auth/location reads behind a hasMounted effect; wrapping
  // render in act() flushes that useEffect so the first render reflects the
  // hooks' current values.
  await act(async () => {
    render(<AppHeader />);
  });
}

describe('AppHeader', () => {
  beforeEach(() => {
    cleanup();
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isLoading = false;
    locationState.location = null;
  });

  it('unauthenticated → renders brand sparkle, no chip', async () => {
    authState.isAuthenticated = false;
    await renderAppHeader();

    expect(screen.getByTestId('animated-brand-name')).toBeInTheDocument();
    expect(screen.queryByText('Set Location')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-header-location-chip')).not.toBeInTheDocument();
  });

  it('authenticated → still no location chip (Round 5: chip moved to HomeLocationRow only)', async () => {
    authState.isAuthenticated = true;
    authState.user = { profile: { displayName: 'Ada' } };
    locationState.location = null;
    await renderAppHeader();

    expect(screen.queryByText('Set Location')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-header-location-chip')).not.toBeInTheDocument();
    expect(screen.getByTestId('animated-brand-name')).toBeInTheDocument();
  });

  it('authenticated with location set → still no BrandStatusBar in header (Round 5)', async () => {
    authState.isAuthenticated = true;
    authState.user = { profile: { displayName: 'Ada' } };
    locationState.location = {
      lat: 32.7266,
      lng: 74.857,
      city: 'Jammu',
      area: 'Gandhi Nagar',
      fullAddress: 'Gandhi Nagar, Jammu',
    };
    await renderAppHeader();

    expect(screen.queryByTestId('brand-status-bar')).not.toBeInTheDocument();
    expect(screen.queryByText('Set Location')).not.toBeInTheDocument();
    expect(screen.getByTestId('animated-brand-name')).toBeInTheDocument();
  });
});
