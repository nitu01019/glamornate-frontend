/**
 * Tests for HomeLocationSheet.
 *
 * v3 (2026-05-13 — location unification): the sheet now reads from the
 * `users/{uid}/addresses` subcollection via `useAddresses` and runs the
 * GPS flow through `useCurrentLocation`. Saved-address taps go through
 * `setDefaultAddress.mutateAsync` + direct `useLocation().setLocation`.
 * The legacy `setActiveLocation` / `setActiveLocationFromGps` writers
 * are no longer invoked from this sheet — assertions reflect that.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SavedAddress } from '@/types';
import type {
  UseCurrentLocationResult,
  LocationStatus,
  LocationSource,
  LocationErrorCode,
} from '@/lib/location/hooks/useCurrentLocation';

// ---------------------------------------------------------------------------
// Auth / location-provider mocks
// ---------------------------------------------------------------------------

interface AuthMockState {
  firebaseUser: {
    uid: string;
    displayName?: string | null;
    phoneNumber?: string | null;
  } | null;
  user: unknown;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const authState: AuthMockState = {
  firebaseUser: {
    uid: 'uid-1',
    displayName: 'Aanya Sharma',
    phoneNumber: '+919876543210',
  },
  user: null,
  isAuthenticated: true,
  isLoading: false,
};

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => authState,
}));

const setLocation = vi.fn();
vi.mock('@/lib/location-provider', () => ({
  useLocation: () => ({ location: null, setLocation }),
}));

// ---------------------------------------------------------------------------
// useAddresses mock — drives the subcollection-backed list + mutations
// ---------------------------------------------------------------------------

const addAddressMock = vi
  .fn()
  .mockResolvedValue({ addressId: 'addr-new', isDefault: true });
const setDefaultAddressMock = vi.fn().mockResolvedValue({ addressId: 'addr-new' });
const deleteAddressMock = vi.fn().mockResolvedValue({ deleted: true });

let useAddressesState: {
  addresses: readonly SavedAddress[];
  isLoading: boolean;
  migrationState: 'pending' | 'in-flight' | 'done' | 'errored';
} = {
  addresses: [],
  isLoading: false,
  migrationState: 'done',
};

vi.mock('@/lib/addresses/use-addresses', () => ({
  useAddresses: () => ({
    addresses: useAddressesState.addresses,
    isLoading: useAddressesState.isLoading,
    error: null,
    addAddress: { mutateAsync: addAddressMock, isPending: false },
    updateAddress: { mutateAsync: vi.fn(), isPending: false },
    deleteAddress: { mutateAsync: deleteAddressMock, isPending: false },
    setDefaultAddress: { mutateAsync: setDefaultAddressMock, isPending: false },
    migrationState: useAddressesState.migrationState,
    list: { data: useAddressesState.addresses, isLoading: false, error: null },
  }),
}));

// ---------------------------------------------------------------------------
// useCurrentLocation mock — drives the GPS state machine per test
// ---------------------------------------------------------------------------

const refreshMock = vi.fn(async () => undefined);
const refreshOpportunisticMock = vi.fn(async () => undefined);
const acknowledgeRationaleMock = vi.fn();
const dismissRationaleMock = vi.fn();
const openSettingsMock = vi.fn(async () => undefined);

let locState: UseCurrentLocationResult = {
  coords: null,
  address: null,
  status: 'idle',
  source: null,
  error: null,
  isRationaleOpen: false,
  acknowledgeRationale: acknowledgeRationaleMock,
  dismissRationale: dismissRationaleMock,
  openSettings: openSettingsMock,
  refresh: refreshMock,
  refreshOpportunistic: refreshOpportunisticMock,
};

function setLocState(
  patch: Partial<{
    coords: { lat: number; lng: number } | null;
    address: UseCurrentLocationResult['address'];
    status: LocationStatus;
    source: LocationSource | null;
    error: LocationErrorCode | null;
    isRationaleOpen: boolean;
  }>,
): void {
  locState = { ...locState, ...patch };
}

vi.mock('@/lib/location/hooks/useCurrentLocation', () => ({
  useCurrentLocation: () => locState,
}));

// ---------------------------------------------------------------------------
// Toast actions
// ---------------------------------------------------------------------------

const toastCalls = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};
vi.mock('@/lib/providers', () => ({
  useToastActions: () => toastCalls,
}));

// ---------------------------------------------------------------------------
// LocationPulse + LocationRationaleModal — render light stubs so we can
// assert their open state without pulling in Radix portals.
// ---------------------------------------------------------------------------

vi.mock('@/components/location/LocationPulse', () => ({
  LocationPulse: () => <div data-testid="location-pulse" />,
}));

vi.mock('@/components/location/LocationRationaleModal', () => ({
  LocationRationaleModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="rationale-modal" /> : null,
}));

// AddressSheetManualForm stub — silent-save flow no longer triggers it
// from the GPS path; only the "Add a new address" CTA does. Stub renders
// the form when open=true.
vi.mock('@/components/home/AddressSheetManualForm', () => ({
  default: ({
    open,
    onClose,
    onSaved,
  }: {
    open: boolean;
    onClose: () => void;
    onSaved?: (id: string) => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="address-sheet-manual-form-stub">
        <button data-testid="manual-form-stub-close" type="button" onClick={onClose}>
          close
        </button>
        <button
          data-testid="manual-form-stub-save"
          type="button"
          onClick={() => onSaved?.('addr-new')}
        >
          save
        </button>
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAddress(overrides: Partial<SavedAddress> = {}): SavedAddress {
  return {
    id: 'addr-home',
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
    geo: { lat: 12.97, lng: 77.59 },
    ...overrides,
  };
}

async function loadSheet() {
  const mod = await import('../HomeLocationSheet');
  return mod.default;
}

function resetAll(): void {
  addAddressMock
    .mockReset()
    .mockResolvedValue({ addressId: 'addr-new', isDefault: true });
  setDefaultAddressMock.mockReset().mockResolvedValue({ addressId: 'addr-new' });
  deleteAddressMock.mockReset().mockResolvedValue({ deleted: true });
  refreshMock.mockReset().mockResolvedValue(undefined);
  refreshOpportunisticMock.mockReset().mockResolvedValue(undefined);
  acknowledgeRationaleMock.mockReset();
  dismissRationaleMock.mockReset();
  openSettingsMock.mockReset().mockResolvedValue(undefined);
  setLocation.mockReset();
  toastCalls.success.mockReset();
  toastCalls.error.mockReset();
  toastCalls.warning.mockReset();
  toastCalls.info.mockReset();
  useAddressesState = { addresses: [], isLoading: false, migrationState: 'done' };
  locState = {
    coords: null,
    address: null,
    status: 'idle',
    source: null,
    error: null,
    isRationaleOpen: false,
    acknowledgeRationale: acknowledgeRationaleMock,
    dismissRationale: dismissRationaleMock,
    openSettings: openSettingsMock,
    refresh: refreshMock,
    refreshOpportunistic: refreshOpportunisticMock,
  };
  authState.firebaseUser = {
    uid: 'uid-1',
    displayName: 'Aanya Sharma',
    phoneNumber: '+919876543210',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HomeLocationSheet — v3', () => {
  beforeEach(() => {
    resetAll();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the GPS row, saved-address list, and manage link when open', async () => {
    useAddressesState.addresses = [
      buildAddress(),
      buildAddress({ id: 'addr-work', label: 'work', city: 'Mumbai', isDefault: false }),
    ];
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('home-location-sheet-gps')).toHaveTextContent(
      /use current location/i,
    );
    expect(screen.getByTestId('home-location-sheet-saved-heading')).toHaveTextContent(
      /your saved addresses/i,
    );
    expect(screen.getByTestId('home-location-sheet-address-addr-home')).toBeInTheDocument();
    expect(screen.getByTestId('home-location-sheet-address-addr-work')).toBeInTheDocument();
    expect(screen.getByTestId('home-location-sheet-manage')).toHaveAttribute(
      'href',
      '/customer/addresses',
    );
  });

  it('shows the empty state with manual-entry CTA when no saved addresses', async () => {
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);

    const empty = screen.getByTestId('home-location-sheet-empty');
    expect(empty).toHaveTextContent(/no saved addresses yet/i);
    const cta = within(empty).getByTestId('home-location-sheet-add-first');
    expect(cta.tagName).toBe('BUTTON');
    expect(cta).not.toHaveAttribute('href');
    expect(screen.queryByTestId('home-location-sheet-saved-heading')).not.toBeInTheDocument();
  });

  it('promotes a saved address via setDefaultAddress + setLocation and closes the sheet', async () => {
    useAddressesState.addresses = [buildAddress()];
    const onClose = vi.fn();
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={onClose} />);

    const row = screen.getByTestId('home-location-sheet-address-addr-home');
    await act(async () => {
      fireEvent.click(row);
    });

    await waitFor(() => {
      expect(setDefaultAddressMock).toHaveBeenCalledTimes(1);
    });
    expect(setDefaultAddressMock.mock.calls[0][0]).toEqual({ addressId: 'addr-home' });
    expect(setLocation).toHaveBeenCalled();
    const passed = setLocation.mock.calls[0][0];
    expect(passed.city).toBe('Bengaluru');
    expect(passed.lat).toBe(12.97);
    expect(passed.lng).toBe(77.59);
    expect(onClose).toHaveBeenCalled();
  });

  it('tapping the GPS row calls useCurrentLocation.refreshOpportunistic()', async () => {
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('home-location-sheet-gps'));
    });

    // refreshOpportunistic closes the loop instantly from cache when fresh;
    // falls through to runFetch when stale. Either way, the sheet wires
    // it as the single GPS entry-point now.
    expect(refreshOpportunisticMock).toHaveBeenCalledTimes(1);
  });

  it('silently auto-saves a "detected" address on a complete reverseGeocode result', async () => {
    const onClose = vi.fn();
    const Sheet = await loadSheet();
    const { rerender } = render(<Sheet open={true} onClose={onClose} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('home-location-sheet-gps'));
    });

    setLocState({
      status: 'success',
      coords: { lat: 12.97, lng: 77.59 },
      source: 'gps',
      address: {
        formatted: 'MG Road, Bengaluru 560001',
        line1: 'MG Road',
        city: 'Bengaluru',
        state: 'KA',
        pincode: '560001',
      },
    });
    rerender(<Sheet open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(addAddressMock).toHaveBeenCalledTimes(1);
    });
    const payload = addAddressMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      label: 'detected',
      city: 'Bengaluru',
      state: 'KA',
      pincode: '560001',
      isDefault: false,
      geo: { lat: 12.97, lng: 77.59 },
    });
    expect(payload.name).toMatch(/Detected/);
    expect(setLocation).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByTestId('address-sheet-manual-form-stub')).not.toBeInTheDocument();
  });

  it('uses sentinel values when reverseGeocode is missing pincode (no manual form)', async () => {
    const onClose = vi.fn();
    const Sheet = await loadSheet();
    const { rerender } = render(<Sheet open={true} onClose={onClose} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('home-location-sheet-gps'));
    });

    // Hook resolves but no pincode — silent save still proceeds with
    // sentinel '000000' so the user is never blocked by partial geocode.
    setLocState({
      status: 'success',
      coords: { lat: 12.97, lng: 77.59 },
      source: 'gps',
      address: {
        formatted: 'MG Road, Bengaluru',
        line1: 'MG Road',
        city: 'Bengaluru',
        state: 'KA',
      },
    });
    rerender(<Sheet open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(addAddressMock).toHaveBeenCalledTimes(1);
    });
    expect(addAddressMock.mock.calls[0][0]).toMatchObject({
      label: 'detected',
      pincode: '000000',
      city: 'Bengaluru',
    });
    expect(screen.queryByTestId('address-sheet-manual-form-stub')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('uses sentinel phone when the auth user has no displayName/phone (no manual form)', async () => {
    authState.firebaseUser = { uid: 'uid-1', displayName: null, phoneNumber: null };
    const onClose = vi.fn();
    const Sheet = await loadSheet();
    const { rerender } = render(<Sheet open={true} onClose={onClose} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('home-location-sheet-gps'));
    });

    setLocState({
      status: 'success',
      coords: { lat: 12.97, lng: 77.59 },
      source: 'gps',
      address: {
        formatted: 'MG Road, Bengaluru 560001',
        line1: 'MG Road',
        city: 'Bengaluru',
        state: 'KA',
        pincode: '560001',
      },
    });
    rerender(<Sheet open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(addAddressMock).toHaveBeenCalledTimes(1);
    });
    const payload = addAddressMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      label: 'detected',
      phone: '0000000',
      name: expect.stringMatching(/Detected location/),
    });
    expect(screen.queryByTestId('address-sheet-manual-form-stub')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('prunes prior "detected" entries before inserting the new GPS snapshot', async () => {
    useAddressesState.addresses = [
      buildAddress({ id: 'addr-stale', label: 'detected' }),
      buildAddress({ id: 'addr-home', label: 'home' }),
    ];
    const Sheet = await loadSheet();
    const { rerender } = render(<Sheet open={true} onClose={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('home-location-sheet-gps'));
    });

    setLocState({
      status: 'success',
      coords: { lat: 12.97, lng: 77.59 },
      source: 'gps',
      address: {
        formatted: 'MG Road, Bengaluru 560001',
        line1: 'MG Road',
        city: 'Bengaluru',
        state: 'KA',
        pincode: '560001',
      },
    });
    rerender(<Sheet open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(addAddressMock).toHaveBeenCalledTimes(1);
    });
    // Stale 'detected' entry was deleted; the 'home' entry is untouched.
    expect(deleteAddressMock).toHaveBeenCalledWith({ addressId: 'addr-stale' });
    expect(deleteAddressMock).not.toHaveBeenCalledWith({ addressId: 'addr-home' });
  });

  it('surfaces a friendly error pill on permission-permanent without opening manual form', async () => {
    const Sheet = await loadSheet();
    const { rerender } = render(<Sheet open={true} onClose={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('home-location-sheet-gps'));
    });

    setLocState({ status: 'error', error: 'permission-permanent' });
    rerender(<Sheet open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('home-location-sheet-error')).toHaveTextContent(
        /Location is turned off/i,
      );
    });
    expect(addAddressMock).not.toHaveBeenCalled();
    // v4 (2026-05-14): error never opens manual form — user retries
    // explicitly or picks a saved address.
    expect(screen.queryByTestId('address-sheet-manual-form-stub')).not.toBeInTheDocument();
  });

  it('surfaces a friendly error pill on quota', async () => {
    const Sheet = await loadSheet();
    const { rerender } = render(<Sheet open={true} onClose={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('home-location-sheet-gps'));
    });

    setLocState({ status: 'error', error: 'quota' });
    rerender(<Sheet open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('home-location-sheet-error')).toHaveTextContent(
        /Too many requests/i,
      );
    });
  });

  it('renders the manage-addresses link and closes the sheet on tap', async () => {
    useAddressesState.addresses = [buildAddress()];
    const onClose = vi.fn();
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={onClose} />);

    const link = screen.getByTestId('home-location-sheet-manage');
    expect(link).toHaveAttribute('href', '/customer/addresses');
    fireEvent.click(link);
    expect(onClose).toHaveBeenCalled();
  });

  it('expands the manual form when "Add a new address" is tapped (saved addresses exist)', async () => {
    useAddressesState.addresses = [buildAddress()];
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('home-location-sheet-add-new'));
    expect(screen.getByTestId('address-sheet-manual-form-stub')).toBeInTheDocument();
  });

  it('expands the manual form when the empty-state CTA is tapped', async () => {
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('home-location-sheet-add-first'));
    expect(screen.getByTestId('address-sheet-manual-form-stub')).toBeInTheDocument();
  });

  it('closes the sheet when the manual form reports success', async () => {
    const onClose = vi.fn();
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('home-location-sheet-add-first'));
    fireEvent.click(screen.getByTestId('manual-form-stub-save'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the manual form on migration-errored + empty addresses (no stranded user)', async () => {
    useAddressesState.migrationState = 'errored';
    useAddressesState.addresses = [];
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('home-location-sheet-empty')).toBeInTheDocument();
  });

  it('renders the rationale modal when loc.isRationaleOpen is true', async () => {
    setLocState({ isRationaleOpen: true });
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('rationale-modal')).toBeInTheDocument();
  });

  it('shows the LocationPulse while the hook is fetching', async () => {
    setLocState({ status: 'fetching' });
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('location-pulse')).toBeInTheDocument();
  });
});
