/**
 * Tests for AddressFormDialog — the "Use Current Location" rewire.
 *
 * Contract under test:
 *  - Tapping the button calls `useCurrentLocation().refresh()`.
 *  - When the hook publishes a fresh `address`, the dialog's street / city
 *    / state / pincode inputs autofill from it (other fields are NOT
 *    touched).
 *  - `error: 'permission-permanent'` renders the amber pill with the
 *    "Open Settings" link, which when clicked invokes `openSettings`.
 *  - `error: 'quota'` renders the stone-tinted pill with "Try again".
 *  - `LocationRationaleModal` is rendered when `isRationaleOpen`.
 *
 * The hook itself is fully unit-tested elsewhere — this test mocks it
 * directly and asserts the wiring.
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseCurrentLocationResult } from '@/lib/location/hooks/useCurrentLocation';

const { mockUseCurrentLocation } = vi.hoisted(() => ({
  mockUseCurrentLocation: vi.fn(),
}));

vi.mock('@/lib/location/hooks/useCurrentLocation', () => ({
  useCurrentLocation: () => mockUseCurrentLocation(),
}));

// The rationale modal mounts a Radix Dialog portal; jsdom handles that, but
// we replace it with a trivial stub so we can assert open-state directly.
vi.mock('@/components/location/LocationRationaleModal', () => ({
  LocationRationaleModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="rationale-modal">rationale</div> : null,
}));

// LocationPulse just renders a status div; assert it's there by test-id.
vi.mock('@/components/location/LocationPulse', () => ({
  LocationPulse: () => <div data-testid="location-pulse" />,
}));

// Radix Dialog + RadioGroup pull in ResizeObserver, focus-trap, and a
// portal — none of which are needed to assert the location wiring. Render
// children as plain divs so the test stays focused.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/radio-group', () => ({
  RadioGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  RadioGroupItem: () => <input type="radio" />,
}));

import { AddressFormDialog } from '../_components/AddressFormDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hookFixture(
  overrides: Partial<UseCurrentLocationResult> = {},
): UseCurrentLocationResult {
  return {
    coords: null,
    address: null,
    status: 'idle',
    source: null,
    error: null,
    isRationaleOpen: false,
    acknowledgeRationale: vi.fn(),
    dismissRationale: vi.fn(),
    openSettings: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
    refreshOpportunistic: vi.fn(async () => undefined),
    ...overrides,
  };
}

function renderDialog() {
  return render(
    <AddressFormDialog
      open
      onOpenChange={() => undefined}
      editingAddress={null}
      onSubmit={async () => undefined}
    />,
  );
}

beforeEach(() => {
  mockUseCurrentLocation.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AddressFormDialog — Use Current Location button', () => {
  it('calls refresh() on tap', () => {
    const fx = hookFixture();
    mockUseCurrentLocation.mockReturnValue(fx);

    renderDialog();
    const button = screen.getByRole('button', { name: /use current location/i });
    fireEvent.click(button);

    expect(fx.refresh).toHaveBeenCalledTimes(1);
  });

  it('shows the radar pulse while fetching', () => {
    mockUseCurrentLocation.mockReturnValue(hookFixture({ status: 'fetching' }));
    renderDialog();
    expect(screen.getByTestId('location-pulse')).toBeInTheDocument();
    expect(screen.getByText(/Detecting your location/i)).toBeInTheDocument();
  });

  it('shows "Refresh location" label after a cache-hit paint', () => {
    mockUseCurrentLocation.mockReturnValue(
      hookFixture({
        status: 'cache-hit',
        source: 'cache',
        coords: { lat: 1, lng: 2 },
        address: { formatted: 'X' },
      }),
    );
    renderDialog();
    expect(screen.getByRole('button', { name: /refresh location/i })).toBeInTheDocument();
  });
});

describe('AddressFormDialog — autofill from address', () => {
  it('populates street / city / state / pincode when address arrives', () => {
    mockUseCurrentLocation.mockReturnValue(
      hookFixture({
        status: 'success',
        source: 'gps',
        coords: { lat: 1, lng: 2 },
        address: {
          formatted: 'MG Road, Bengaluru 560001',
          line1: 'MG Road',
          city: 'Bengaluru',
          state: 'KA',
          pincode: '560001',
        },
      }),
    );

    renderDialog();

    expect(screen.getByPlaceholderText(/MG Road, Indiranagar/i)).toHaveValue('MG Road');
    expect(screen.getByPlaceholderText(/Bangalore/i)).toHaveValue('Bengaluru');
    expect(screen.getByPlaceholderText(/Karnataka/i)).toHaveValue('KA');
    expect(screen.getByPlaceholderText(/560038/)).toHaveValue('560001');
    // Other fields are untouched.
    expect(screen.getByPlaceholderText(/John Doe/i)).toHaveValue('');
    expect(screen.getByPlaceholderText(/9876543210/)).toHaveValue('');
  });
});

describe('AddressFormDialog — error pills', () => {
  it('shows amber "Open Settings" pill for permission-permanent', () => {
    const fx = hookFixture({ error: 'permission-permanent', status: 'error' });
    mockUseCurrentLocation.mockReturnValue(fx);
    renderDialog();

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/Location is turned off/i)).toBeInTheDocument();
    const settingsBtn = within(alert).getByRole('button', { name: /Open Settings/i });
    fireEvent.click(settingsBtn);
    expect(fx.openSettings).toHaveBeenCalledTimes(1);
  });

  it('shows rose "Try again" pill for permission-denied', () => {
    const fx = hookFixture({ error: 'permission-denied', status: 'error' });
    mockUseCurrentLocation.mockReturnValue(fx);
    renderDialog();
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/We need location permission/i)).toBeInTheDocument();
    const retryBtn = within(alert).getByRole('button', { name: /Try again/i });
    fireEvent.click(retryBtn);
    expect(fx.refresh).toHaveBeenCalled();
  });

  it('shows stone "Try again" pill for quota', () => {
    const fx = hookFixture({ error: 'quota', status: 'error' });
    mockUseCurrentLocation.mockReturnValue(fx);
    renderDialog();
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/Too many requests/i)).toBeInTheDocument();
  });

  it('shows stone "Try again" pill for no-results', () => {
    const fx = hookFixture({ error: 'no-results', status: 'error' });
    mockUseCurrentLocation.mockReturnValue(fx);
    renderDialog();
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/Could not resolve your address/i)).toBeInTheDocument();
  });

  it('renders no pill when there is no error', () => {
    mockUseCurrentLocation.mockReturnValue(hookFixture());
    renderDialog();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('AddressFormDialog — rationale modal', () => {
  it('renders the rationale modal when isRationaleOpen is true', () => {
    mockUseCurrentLocation.mockReturnValue(hookFixture({ isRationaleOpen: true }));
    renderDialog();
    expect(screen.getByTestId('rationale-modal')).toBeInTheDocument();
  });

  it('does not render the rationale modal otherwise', () => {
    mockUseCurrentLocation.mockReturnValue(hookFixture());
    renderDialog();
    expect(screen.queryByTestId('rationale-modal')).not.toBeInTheDocument();
  });
});
