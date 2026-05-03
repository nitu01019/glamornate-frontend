/**
 * Tests for HomeLocationSheet.
 *
 * Strategy:
 *  - Mock `@/lib/location-writer` so we can assert the single-writer call
 *    shape without touching Firestore or the location-provider.
 *  - Mock `@/lib/auth-provider`, `@/lib/location-provider`,
 *    `@/hooks/useDefaultAddress`, and `firebase/firestore` so nothing crosses
 *    the component boundary.
 *  - Drive the saved-addresses `onSnapshot` subscription synchronously by
 *    capturing the `next` callback and invoking it in `act(...)`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SavedAddress } from '@/types';

// ---------------------------------------------------------------------------
// Capacitor.isNativePlatform mock — settable per test
// ---------------------------------------------------------------------------

let isNativePlatformValue = false;
function setIsNativePlatform(value: boolean): void {
  isNativePlatformValue = value;
  (globalThis as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor = {
    isNativePlatform: () => isNativePlatformValue,
  };
}

// ---------------------------------------------------------------------------
// @capacitor/geolocation mock
// ---------------------------------------------------------------------------

const capacitorGetCurrentPosition = vi.fn();
const capacitorRequestPermissions = vi.fn();
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    getCurrentPosition: capacitorGetCurrentPosition,
    requestPermissions: capacitorRequestPermissions,
  },
}));

// ---------------------------------------------------------------------------
// location-writer mock — captures payloads for assertions
// ---------------------------------------------------------------------------

const setActiveLocation = vi.fn().mockResolvedValue(undefined);
const setActiveLocationFromGps = vi.fn().mockResolvedValue(undefined);

class LocationWriteError extends Error {
  readonly code: string;
  readonly cause: unknown;
  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}

vi.mock('@/lib/location-writer', () => ({
  setActiveLocation,
  setActiveLocationFromGps,
  LocationWriteError,
}));

// ---------------------------------------------------------------------------
// auth / location / default-address hook mocks
// ---------------------------------------------------------------------------

const authState: {
  firebaseUser: { uid: string } | null;
  user: unknown;
  isAuthenticated: boolean;
  isLoading: boolean;
} = {
  firebaseUser: { uid: 'uid-1' },
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

// Toast actions — the sheet uses these for the `not-configured` branch.
const toastCalls = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};
vi.mock('@/lib/providers', () => ({
  useToastActions: () => toastCalls,
}));

// Stub the manual form so we don't pull in the `useAddresses` stack in
// these sheet-level tests. The real form has its own test file.
vi.mock('@/components/home/AddressSheetManualForm', () => ({
  default: ({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: (id: string) => void }) => {
    if (!open) return null;
    return (
      <div data-testid="address-sheet-manual-form-stub">
        <button
          type="button"
          data-testid="manual-form-stub-close"
          onClick={onClose}
        >
          close
        </button>
        <button
          type="button"
          data-testid="manual-form-stub-save"
          onClick={() => onSaved?.('addr-new')}
        >
          save
        </button>
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------
// firebase-client + firebase/firestore mocks — capture snapshot `next`
// ---------------------------------------------------------------------------

vi.mock('@/lib/firebase-client', () => ({
  getFirebaseFirestore: vi.fn(() => ({})),
  getFirebaseAuth: vi.fn(() => ({ currentUser: { uid: 'uid-1' } })),
}));

interface SnapshotCapture {
  next: (snap: { exists: () => boolean; data: () => unknown }) => void;
  error: (err: unknown) => void;
}
const snapshotHandlers: SnapshotCapture[] = [];
const unsubscribeSpies: Array<ReturnType<typeof vi.fn>> = [];

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ type: 'document' })),
  onSnapshot: vi.fn(
    (_ref: unknown, next: SnapshotCapture['next'], error: SnapshotCapture['error']) => {
      snapshotHandlers.push({ next, error });
      const unsubscribe = vi.fn();
      unsubscribeSpies.push(unsubscribe);
      return unsubscribe;
    },
  ),
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
    ...overrides,
  };
}

function emitAddresses(addresses: readonly SavedAddress[]): void {
  const handler = snapshotHandlers[snapshotHandlers.length - 1];
  if (!handler) return;
  act(() => {
    handler.next({
      exists: () => true,
      data: () => ({ addresses }),
    });
  });
}

async function loadSheet() {
  const mod = await import('../HomeLocationSheet');
  return mod.default;
}

function resetAll(): void {
  snapshotHandlers.length = 0;
  unsubscribeSpies.length = 0;
  setActiveLocation.mockReset().mockResolvedValue(undefined);
  setActiveLocationFromGps.mockReset().mockResolvedValue({ status: 'ok' });
  setLocation.mockReset();
  capacitorGetCurrentPosition.mockReset();
  capacitorRequestPermissions.mockReset();
  toastCalls.success.mockReset();
  toastCalls.error.mockReset();
  toastCalls.warning.mockReset();
  toastCalls.info.mockReset();
  authState.firebaseUser = { uid: 'uid-1' };
  setIsNativePlatform(false);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HomeLocationSheet', () => {
  beforeEach(() => {
    resetAll();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the GPS, saved addresses, and manage rows when the sheet is open', async () => {
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);

    // After mount, the onSnapshot subscription fires — emit two addresses.
    emitAddresses([
      buildAddress(),
      buildAddress({ id: 'addr-work', label: 'work', city: 'Mumbai', isDefault: false }),
    ]);

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

  it('shows the empty state with manual-entry CTA (no deep-link) when the user has no saved addresses', async () => {
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);

    emitAddresses([]);

    const empty = screen.getByTestId('home-location-sheet-empty');
    expect(empty).toHaveTextContent(/no saved addresses yet/i);
    const cta = within(empty).getByTestId('home-location-sheet-add-first');
    // The Phase 2 refactor replaces the deep-link with an inline trigger.
    expect(cta.tagName).toBe('BUTTON');
    expect(cta).not.toHaveAttribute('href');

    // Heading should NOT render in the empty state.
    expect(screen.queryByTestId('home-location-sheet-saved-heading')).not.toBeInTheDocument();
  });

  it('routes a saved-address tap through setActiveLocation and closes the sheet', async () => {
    const onClose = vi.fn();
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={onClose} />);
    emitAddresses([buildAddress()]);

    const row = screen.getByTestId('home-location-sheet-address-addr-home');
    await act(async () => {
      fireEvent.click(row);
    });

    expect(setActiveLocation).toHaveBeenCalledTimes(1);
    const [input, options] = setActiveLocation.mock.calls[0];
    expect(input).toEqual({ kind: 'saved-address', addressId: 'addr-home' });
    expect(options.provider.setLocation).toBe(setLocation);
    expect(onClose).toHaveBeenCalled();
  });

  it('falls back to GPS via setActiveLocationFromGps on native platform', async () => {
    setIsNativePlatform(true);
    const onClose = vi.fn();
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={onClose} />);
    emitAddresses([]);

    const gps = screen.getByTestId('home-location-sheet-gps');
    await act(async () => {
      fireEvent.click(gps);
    });

    expect(setActiveLocationFromGps).toHaveBeenCalledTimes(1);
    const [options] = setActiveLocationFromGps.mock.calls[0];
    expect(options.provider.setLocation).toBe(setLocation);
    expect(onClose).toHaveBeenCalled();
  });

  it('also uses setActiveLocationFromGps on web (non-native) — single writer owns the branch', async () => {
    setIsNativePlatform(false);
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);
    emitAddresses([]);

    await act(async () => {
      fireEvent.click(screen.getByTestId('home-location-sheet-gps'));
    });

    expect(setActiveLocationFromGps).toHaveBeenCalledTimes(1);
    // We do NOT call the Capacitor geolocation plugin directly from the
    // component — the location-writer owns platform routing.
    expect(capacitorGetCurrentPosition).not.toHaveBeenCalled();
  });

  it('surfaces a friendly error when setActiveLocation rejects', async () => {
    setActiveLocation.mockRejectedValueOnce(
      new LocationWriteError('firestore-write-failed', 'Could not set default address'),
    );

    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);
    emitAddresses([buildAddress()]);

    await act(async () => {
      fireEvent.click(screen.getByTestId('home-location-sheet-address-addr-home'));
    });

    const alert = await screen.findByTestId('home-location-sheet-error');
    expect(alert).toHaveTextContent('Could not set default address');
  });

  it('renders the manage-addresses link with the expected href and closes on tap', async () => {
    const onClose = vi.fn();
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={onClose} />);
    emitAddresses([buildAddress()]);

    const manage = screen.getByTestId('home-location-sheet-manage');
    expect(manage).toHaveAttribute('href', '/customer/addresses');

    fireEvent.click(manage);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps keyboard focus within the sheet when the user tabs (focus trap)', async () => {
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);
    emitAddresses([buildAddress()]);

    // Radix auto-focuses the first focusable; our onOpenAutoFocus diverts it
    // to the GPS button. Assert the GPS button receives initial focus.
    const gps = screen.getByTestId('home-location-sheet-gps');
    expect(document.activeElement).toBe(gps);

    // Tab should move forward inside the sheet; after several tabs the focus
    // must still land on an element that lives inside the dialog content.
    const sheet = screen.getByTestId('home-location-sheet');
    for (let i = 0; i < 6; i++) {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab' });
    }
    // Radix installs the focus trap via focus-scope — assert the active
    // element is either still the sheet itself or a descendant.
    const active = document.activeElement as HTMLElement | null;
    expect(active).not.toBeNull();
    expect(sheet.contains(active as Node) || active === sheet).toBe(true);
  });

  it('expands the manual entry form when "Add a new address" is tapped (with saved addresses)', async () => {
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);
    emitAddresses([buildAddress()]);

    // Not rendered until the user opts in.
    expect(
      screen.queryByTestId('address-sheet-manual-form-stub'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('home-location-sheet-add-new'));

    expect(
      screen.getByTestId('address-sheet-manual-form-stub'),
    ).toBeInTheDocument();
    // The "Add a new address" trigger hides while the form is open.
    expect(
      screen.queryByTestId('home-location-sheet-add-new'),
    ).not.toBeInTheDocument();
  });

  it('expands the manual entry form when the empty-state CTA is tapped', async () => {
    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);
    emitAddresses([]);

    fireEvent.click(screen.getByTestId('home-location-sheet-add-first'));

    expect(
      screen.getByTestId('address-sheet-manual-form-stub'),
    ).toBeInTheDocument();
  });

  it('closes the sheet when the manual form reports success', async () => {
    const Sheet = await loadSheet();
    const onClose = vi.fn();
    render(<Sheet open={true} onClose={onClose} />);
    emitAddresses([buildAddress()]);

    fireEvent.click(screen.getByTestId('home-location-sheet-add-new'));
    fireEvent.click(screen.getByTestId('manual-form-stub-save'));

    expect(onClose).toHaveBeenCalled();
  });

  it('auto-expands manual form + toasts on GPS `not-configured` result', async () => {
    setActiveLocationFromGps.mockReset().mockResolvedValue({ status: 'not-configured' });

    const Sheet = await loadSheet();
    render(<Sheet open={true} onClose={vi.fn()} />);
    emitAddresses([]);

    await act(async () => {
      fireEvent.click(screen.getByTestId('home-location-sheet-gps'));
    });

    expect(
      screen.getByTestId('address-sheet-manual-form-stub'),
    ).toBeInTheDocument();
    expect(toastCalls.info).toHaveBeenCalled();
    const [title] = toastCalls.info.mock.calls[0];
    expect(title).toMatch(/not set up/i);
  });

  it('unsubscribes from the addresses listener when the sheet closes', async () => {
    const Sheet = await loadSheet();
    const { rerender } = render(<Sheet open={true} onClose={vi.fn()} />);
    emitAddresses([buildAddress()]);

    rerender(<Sheet open={false} onClose={vi.fn()} />);

    // The listener opened while `open=true` should be torn down — the
    // unsubscribe spy fires on cleanup.
    const spy = unsubscribeSpies[unsubscribeSpies.length - 1];
    expect(spy).toHaveBeenCalled();
  });
});
