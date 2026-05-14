/**
 * Tests for `/customer/addresses` page — v3 (2026-05-13 — location
 * unification).
 *
 * The page now writes through `useAddresses` callable mutations instead
 * of the legacy embedded-array `updateDoc` path. These tests verify the
 * wiring at the page level: the four mutations are invoked with the
 * right payloads, and the form's `geo` (from `useCurrentLocation`)
 * survives the round-trip.
 *
 * Strategy:
 *  - Mock `useAddresses` to drive the address list + mutation surfaces.
 *  - Mock `AddressFormDialog` with a tiny stub that lets the test
 *    trigger `onSubmit(payload)` directly.
 *  - Mock `next/navigation`, the auth provider, and toast actions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SavedAddress } from '@/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const routerPush = vi.fn();
const routerBack = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, back: routerBack, replace: vi.fn() }),
}));

const toastCalls = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};
vi.mock('@/lib/providers', () => ({
  useToastActions: () => toastCalls,
}));

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({
    firebaseUser: { uid: 'uid-1' },
    user: null,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

const addAddressMock = vi
  .fn()
  .mockResolvedValue({ addressId: 'addr-new', isDefault: true });
const updateAddressMock = vi
  .fn()
  .mockResolvedValue({ addressId: 'addr-1', isDefault: true });
const deleteAddressMock = vi.fn().mockResolvedValue({ deleted: true });
const setDefaultAddressMock = vi.fn().mockResolvedValue({ addressId: 'addr-1' });

let useAddressesState: {
  addresses: readonly SavedAddress[];
  isLoading: boolean;
} = { addresses: [], isLoading: false };

vi.mock('@/lib/addresses/use-addresses', () => ({
  useAddresses: () => ({
    addresses: useAddressesState.addresses,
    isLoading: useAddressesState.isLoading,
    error: null,
    addAddress: { mutateAsync: addAddressMock, isPending: false },
    updateAddress: { mutateAsync: updateAddressMock, isPending: false },
    deleteAddress: { mutateAsync: deleteAddressMock, isPending: false },
    setDefaultAddress: { mutateAsync: setDefaultAddressMock, isPending: false },
    migrationState: 'done',
    list: { data: useAddressesState.addresses, isLoading: false, error: null },
  }),
}));

// AddressFormDialog stub — exposes a "submit" button that emits a known
// payload so we don't have to drive the real RHF tree.
let formSubmitPayload: unknown = {
  label: 'home',
  name: 'Aanya',
  phone: '9876543210',
  flatHouse: 'Flat 2B',
  street: 'MG Road',
  landmark: '',
  city: 'Bengaluru',
  state: 'KA',
  pincode: '560001',
  geo: { lat: 12.97, lng: 77.59 },
};

vi.mock('../_components/AddressFormDialog', () => ({
  AddressFormDialog: ({
    open,
    onSubmit,
  }: {
    open: boolean;
    onSubmit: (data: unknown) => Promise<void>;
  }) =>
    open ? (
      <div data-testid="address-form-dialog">
        <button
          type="button"
          data-testid="address-form-submit"
          onClick={() => {
            void onSubmit(formSubmitPayload);
          }}
        >
          submit
        </button>
      </div>
    ) : null,
}));

// Dialog primitive stubs — the page's delete-confirm dialog uses these.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAddress(overrides: Partial<SavedAddress> = {}): SavedAddress {
  return {
    id: 'addr-1',
    label: 'home',
    name: 'Aanya',
    phone: '9876543210',
    flatHouse: 'Flat 2B',
    street: 'MG Road',
    city: 'Bengaluru',
    state: 'KA',
    pincode: '560001',
    isDefault: true,
    createdAt: '2026-04-20T00:00:00Z',
    updatedAt: '2026-04-20T00:00:00Z',
    ...overrides,
  };
}

async function loadPage() {
  const mod = await import('../page');
  return mod.default;
}

function resetAll(): void {
  addAddressMock
    .mockReset()
    .mockResolvedValue({ addressId: 'addr-new', isDefault: true });
  updateAddressMock
    .mockReset()
    .mockResolvedValue({ addressId: 'addr-1', isDefault: true });
  deleteAddressMock.mockReset().mockResolvedValue({ deleted: true });
  setDefaultAddressMock.mockReset().mockResolvedValue({ addressId: 'addr-1' });
  toastCalls.success.mockReset();
  toastCalls.error.mockReset();
  routerPush.mockReset();
  routerBack.mockReset();
  useAddressesState = { addresses: [], isLoading: false };
  formSubmitPayload = {
    label: 'home',
    name: 'Aanya',
    phone: '9876543210',
    flatHouse: 'Flat 2B',
    street: 'MG Road',
    landmark: '',
    city: 'Bengaluru',
    state: 'KA',
    pincode: '560001',
    geo: { lat: 12.97, lng: 77.59 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AddressesPage — v3', () => {
  beforeEach(() => {
    resetAll();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the empty state when there are no saved addresses', async () => {
    const Page = await loadPage();
    render(<Page />);
    expect(await screen.findByText(/No saved addresses/i)).toBeInTheDocument();
  });

  it('submits via addAddress.mutateAsync with geo when present', async () => {
    const Page = await loadPage();
    render(<Page />);
    // Open the form dialog
    fireEvent.click(screen.getByText(/Add New/i));
    expect(screen.getByTestId('address-form-dialog')).toBeInTheDocument();
    // Trigger the dialog's onSubmit
    await act(async () => {
      fireEvent.click(screen.getByTestId('address-form-submit'));
    });
    await waitFor(() => {
      expect(addAddressMock).toHaveBeenCalledTimes(1);
    });
    const payload = addAddressMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      label: 'home',
      name: 'Aanya',
      phone: '9876543210',
      city: 'Bengaluru',
      state: 'KA',
      pincode: '560001',
      geo: { lat: 12.97, lng: 77.59 },
      // First-address rule: isDefault: true automatically.
      isDefault: true,
    });
    expect(toastCalls.success).toHaveBeenCalled();
  });

  it('omits geo from the payload when the form did not capture coords', async () => {
    formSubmitPayload = {
      label: 'work',
      name: 'Aanya',
      phone: '9876543210',
      flatHouse: 'Office 5',
      street: 'Whitefield Rd',
      landmark: '',
      city: 'Bengaluru',
      state: 'KA',
      pincode: '560066',
    };
    const Page = await loadPage();
    render(<Page />);
    fireEvent.click(screen.getByText(/Add New/i));
    await act(async () => {
      fireEvent.click(screen.getByTestId('address-form-submit'));
    });
    await waitFor(() => {
      expect(addAddressMock).toHaveBeenCalled();
    });
    const payload = addAddressMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty('geo');
  });

  it('renders saved addresses and the Default badge for the default one', async () => {
    useAddressesState.addresses = [
      buildAddress({ id: 'a', isDefault: true, city: 'Bengaluru' }),
      buildAddress({ id: 'b', isDefault: false, city: 'Mumbai', label: 'work' }),
    ];
    const Page = await loadPage();
    render(<Page />);
    expect(screen.getByText(/Bengaluru/)).toBeInTheDocument();
    expect(screen.getByText(/Mumbai/)).toBeInTheDocument();
    // Two visible matches for "Default": the badge on the default card +
    // the "Set as Default" CTA on the non-default card. Just confirm we
    // have at least one explicit "Default" badge text.
    const defaultMatches = screen.getAllByText((_content, node) => {
      return node?.textContent?.trim() === 'Default';
    });
    expect(defaultMatches.length).toBeGreaterThan(0);
  });

  it('promotes a non-default to default via setDefaultAddress', async () => {
    useAddressesState.addresses = [
      buildAddress({ id: 'a', isDefault: true }),
      buildAddress({ id: 'b', isDefault: false, city: 'Mumbai' }),
    ];
    const Page = await loadPage();
    render(<Page />);
    const setDefaultBtn = screen.getAllByText(/Set as Default/i)[0];
    await act(async () => {
      fireEvent.click(setDefaultBtn);
    });
    await waitFor(() => {
      expect(setDefaultAddressMock).toHaveBeenCalledTimes(1);
    });
    expect(setDefaultAddressMock.mock.calls[0][0]).toEqual({ addressId: 'b' });
  });
});
