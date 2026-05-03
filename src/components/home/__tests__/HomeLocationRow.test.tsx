import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { UserLocation } from '@/lib/location-provider';
import type { SavedAddress } from '@/types';

// ---------------------------------------------------------------------------
// Mutable mock state — reset in beforeEach so each test drives the component
// deterministically without a provider tree.
// ---------------------------------------------------------------------------

interface LocationState {
  location: UserLocation | null;
}

interface DefaultAddressState {
  address: SavedAddress | null;
  isLoading: boolean;
  error: Error | null;
}

const locationState: LocationState = {
  location: null,
};

const defaultAddressState: DefaultAddressState = {
  address: null,
  isLoading: false,
  error: null,
};

vi.mock('@/lib/location-provider', () => ({
  useLocation: () => locationState,
}));

vi.mock('@/hooks/useDefaultAddress', () => ({
  useDefaultAddress: () => defaultAddressState,
}));

// next/dynamic dynamic import with ssr:false — replace with a stub that
// reports its props through data attributes for assertion.
vi.mock('next/dynamic', () => ({
  default: () => {
    const Stub = (props: { open: boolean; onClose: () => void }) => (
      <div data-testid="home-location-sheet-stub" data-open={props.open ? 'true' : 'false'} />
    );
    return Stub;
  },
}));

// Delay importing the component under test until after mocks are registered.
async function loadRow() {
  const mod = await import('../HomeLocationRow');
  return mod.default;
}

function buildAddress(overrides: Partial<SavedAddress> = {}): SavedAddress {
  return {
    id: 'addr-1',
    label: 'home',
    name: 'Aanya',
    phone: '+911234567890',
    flatHouse: 'Flat 2B',
    street: 'MG Road',
    landmark: 'Near Park',
    city: 'Bengaluru',
    state: 'KA',
    pincode: '560001',
    isDefault: true,
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    ...overrides,
  };
}

function resetState() {
  locationState.location = null;
  defaultAddressState.address = null;
  defaultAddressState.isLoading = false;
  defaultAddressState.error = null;
}

describe('HomeLocationRow', () => {
  beforeEach(() => {
    resetState();
    // navigator.onLine defaults to true in jsdom.
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the container with the home-location-row testId', async () => {
    const Row = await loadRow();
    render(<Row />);
    expect(screen.getByTestId('home-location-row')).toBeInTheDocument();
  });

  it('renders the address row fixed under AppHeader (fixed top-14 z-40)', async () => {
    const Row = await loadRow();
    render(<Row />);
    const row = screen.getByTestId('home-location-row');
    expect(row.className).toMatch(/\bfixed\b/);
    expect(row.className).toMatch(/\btop-14\b/);
    expect(row.className).toMatch(/\bz-40\b/);
  });

  it('renders a skeleton for the primary line while the default address is loading', async () => {
    defaultAddressState.isLoading = true;
    const Row = await loadRow();
    render(<Row />);
    expect(screen.getByTestId('home-location-primary-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('home-location-primary')).not.toBeInTheDocument();
  });

  it('renders the default address city as primary and a truncated address as subtitle', async () => {
    defaultAddressState.address = buildAddress();
    const Row = await loadRow();
    render(<Row />);
    expect(screen.getByTestId('home-location-primary')).toHaveTextContent('Bengaluru');
    const subtitle = screen.getByTestId('home-location-subtitle');
    expect(subtitle.textContent?.length).toBeGreaterThan(0);
    expect(subtitle.textContent?.length).toBeLessThanOrEqual(40);
  });

  it('opens the sheet when the location block is activated via Enter key', async () => {
    defaultAddressState.address = buildAddress();
    const Row = await loadRow();
    render(<Row />);
    const tappable = screen.getByRole('button', { name: /change location/i });
    fireEvent.keyDown(tappable, { key: 'Enter' });
    expect(screen.getByTestId('home-location-sheet-stub')).toHaveAttribute('data-open', 'true');
  });

  it('opens the sheet when the location block is activated via Space key', async () => {
    defaultAddressState.address = buildAddress();
    const Row = await loadRow();
    render(<Row />);
    const tappable = screen.getByRole('button', { name: /change location/i });
    fireEvent.keyDown(tappable, { key: ' ' });
    expect(screen.getByTestId('home-location-sheet-stub')).toHaveAttribute('data-open', 'true');
  });

  it('renders the zero-address state and opens the sheet on tap (no deep-link)', async () => {
    const Row = await loadRow();
    render(<Row />);
    expect(screen.getByTestId('home-location-primary')).toHaveTextContent('Add your address');
    expect(screen.getByTestId('home-location-subtitle')).toHaveTextContent(
      'Tap to save your first address',
    );

    fireEvent.click(screen.getByRole('button', { name: /change location/i }));
    // The zero state must open the sheet in-place (Phase 2, B3).
    expect(screen.getByTestId('home-location-sheet-stub')).toHaveAttribute('data-open', 'true');
  });

  it('shows an offline pill when navigator reports offline', async () => {
    defaultAddressState.address = buildAddress();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    const Row = await loadRow();
    render(<Row />);
    expect(screen.getByTestId('home-location-offline')).toHaveTextContent(/offline/i);
  });

  it('falls back to the legacy useLocation city when no default address exists', async () => {
    locationState.location = {
      lat: 12.97,
      lng: 77.59,
      city: 'Mumbai',
      area: 'Andheri',
      fullAddress: '221B Baker Street, Andheri West, Mumbai 400053',
    };
    const Row = await loadRow();
    render(<Row />);
    expect(screen.getByTestId('home-location-primary')).toHaveTextContent('Mumbai');
    // Subtitle truncates at 40 chars.
    const subtitle = screen.getByTestId('home-location-subtitle');
    expect(subtitle.textContent?.length).toBeLessThanOrEqual(40);
  });
});
