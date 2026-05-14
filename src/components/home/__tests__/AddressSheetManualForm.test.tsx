/**
 * Tests for AddressSheetManualForm.
 *
 * Strategy
 * --------
 * - Mock `@/lib/addresses/use-addresses` to capture the `addAddress`
 *   mutation payload without touching Firebase.
 * - Mock `@/lib/location-writer` so we can assert
 *   `setActiveLocation({ kind: 'saved-address' })` is called with the new id.
 * - Mock `@/lib/providers` (toast) + `@/lib/auth-provider` +
 *   `@/lib/location-provider` at the module boundary.
 *
 * Coverage
 * --------
 *   - Renders all fields when `open`.
 *   - Validates Indian pincode (6 digits) and phone (10 digits).
 *   - Auto-formats pincode / phone (digits-only, max-length).
 *   - Submits → calls `addAddress` → calls `setActiveLocation` → fires
 *     `onSaved` + `onClose`.
 *   - Cancel fires `onClose` without mutating.
 *   - On mutation error, the form stays open and surfaces an error.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type {
  AddAddressInput,
  AddAddressResponse,
} from '@/lib/addresses/use-addresses';

// ---------------------------------------------------------------------------
// Toast mock
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
// Auth / Location mocks
// ---------------------------------------------------------------------------

const authState = {
  firebaseUser: { uid: 'uid-1' },
  user: { profile: { displayName: 'Aanya Sharma' } },
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
// use-addresses mock
// ---------------------------------------------------------------------------
//
// v3 (2026-05-13 — location unification): the form no longer uses the
// legacy `setActiveLocation('saved-address')` writer. It now promotes the
// new address to default via `setDefaultAddress.mutateAsync` and mirrors
// to the in-memory `LocationProvider` via the `setLocation` mock above.

interface AddMutationMock {
  mutateAsync: (payload: AddAddressInput) => Promise<AddAddressResponse>;
  isPending: boolean;
}

let addAddressMutation: AddMutationMock = {
  mutateAsync: vi.fn().mockResolvedValue({
    addressId: 'addr-new',
    isDefault: true,
  }),
  isPending: false,
};

const setDefaultAddressMock = vi.fn().mockResolvedValue({ addressId: 'addr-new' });

vi.mock('@/lib/addresses/use-addresses', () => ({
  useAddresses: () => ({
    addresses: [],
    isLoading: false,
    error: null,
    addAddress: addAddressMutation,
    updateAddress: { mutateAsync: vi.fn(), isPending: false },
    deleteAddress: { mutateAsync: vi.fn(), isPending: false },
    setDefaultAddress: { mutateAsync: setDefaultAddressMock, isPending: false },
    migrationState: 'done',
    list: { data: [], isLoading: false, error: null },
  }),
}));

// ---------------------------------------------------------------------------
// Dynamic import — AFTER mocks are registered.
// ---------------------------------------------------------------------------

async function loadForm() {
  return (await import('../AddressSheetManualForm')).default;
}

function resetAll(): void {
  toastCalls.success.mockReset();
  toastCalls.error.mockReset();
  toastCalls.warning.mockReset();
  toastCalls.info.mockReset();
  setLocation.mockReset();
  setDefaultAddressMock.mockReset().mockResolvedValue({ addressId: 'addr-new' });
  addAddressMutation = {
    mutateAsync: vi.fn().mockResolvedValue({
      addressId: 'addr-new',
      isDefault: true,
    }),
    isPending: false,
  };
}

function fillValidForm(): void {
  fireEvent.change(screen.getByTestId('address-form-name'), {
    target: { value: 'Aanya Sharma' },
  });
  fireEvent.change(screen.getByTestId('address-form-phone'), {
    target: { value: '9876543210' },
  });
  fireEvent.change(screen.getByTestId('address-form-flat'), {
    target: { value: 'Flat 2B' },
  });
  fireEvent.change(screen.getByTestId('address-form-street'), {
    target: { value: 'MG Road' },
  });
  fireEvent.change(screen.getByTestId('address-form-city'), {
    target: { value: 'Bengaluru' },
  });
  fireEvent.change(screen.getByTestId('address-form-state'), {
    target: { value: 'Karnataka' },
  });
  fireEvent.change(screen.getByTestId('address-form-pincode'), {
    target: { value: '560001' },
  });
}

beforeEach(() => {
  resetAll();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AddressSheetManualForm', () => {
  it('returns null when `open` is false', async () => {
    const Form = await loadForm();
    const { container } = render(
      <Form open={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all fields when open', async () => {
    const Form = await loadForm();
    render(<Form open={true} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByTestId('address-sheet-manual-form')).toBeInTheDocument();
    expect(screen.getByTestId('address-form-name')).toBeInTheDocument();
    expect(screen.getByTestId('address-form-phone')).toBeInTheDocument();
    expect(screen.getByTestId('address-form-flat')).toBeInTheDocument();
    expect(screen.getByTestId('address-form-street')).toBeInTheDocument();
    expect(screen.getByTestId('address-form-landmark')).toBeInTheDocument();
    expect(screen.getByTestId('address-form-city')).toBeInTheDocument();
    expect(screen.getByTestId('address-form-state')).toBeInTheDocument();
    expect(screen.getByTestId('address-form-pincode')).toBeInTheDocument();
    expect(screen.getByTestId('address-manual-submit')).toBeInTheDocument();
    expect(screen.getByTestId('address-form-cancel')).toBeInTheDocument();
  });

  it('submits valid form → addAddress → setDefaultAddress + setLocation → onSaved + onClose', async () => {
    const Form = await loadForm();
    const onClose = vi.fn();
    const onSaved = vi.fn();

    render(<Form open={true} onClose={onClose} onSaved={onSaved} />);
    fillValidForm();

    await act(async () => {
      fireEvent.submit(
        screen.getByTestId('address-manual-submit').closest('form')!,
      );
    });

    await waitFor(() => {
      expect(addAddressMutation.mutateAsync).toHaveBeenCalledTimes(1);
    });

    const payload = (addAddressMutation.mutateAsync as unknown as {
      mock: { calls: Array<[AddAddressInput]> };
    }).mock.calls[0][0];

    expect(payload).toMatchObject({
      label: 'home',
      name: 'Aanya Sharma',
      phone: '9876543210',
      flatHouse: 'Flat 2B',
      street: 'MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      isDefault: true,
    });

    // v3: post-save the form promotes via the modern callable + syncs the
    // in-memory provider. No more legacy `setActiveLocation` writer.
    await waitFor(() => {
      expect(setDefaultAddressMock).toHaveBeenCalledTimes(1);
    });
    expect(setDefaultAddressMock.mock.calls[0][0]).toEqual({ addressId: 'addr-new' });
    expect(setLocation).toHaveBeenCalled();
    const provided = setLocation.mock.calls[0][0];
    expect(provided.city).toBe('Bengaluru');
    expect(provided.fullAddress).toContain('Bengaluru');

    expect(onSaved).toHaveBeenCalledWith('addr-new');
    expect(onClose).toHaveBeenCalled();
    expect(toastCalls.success).toHaveBeenCalled();
  });

  it('rejects pincode shorter than 6 digits', async () => {
    const Form = await loadForm();
    render(<Form open={true} onClose={vi.fn()} onSaved={vi.fn()} />);
    fillValidForm();
    fireEvent.change(screen.getByTestId('address-form-pincode'), {
      target: { value: '12345' },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByTestId('address-manual-submit').closest('form')!,
      );
    });

    const err = await screen.findByText(/6-digit pincode/i);
    expect(err).toBeInTheDocument();
    expect(addAddressMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('rejects phone not matching 10 digits', async () => {
    const Form = await loadForm();
    render(<Form open={true} onClose={vi.fn()} onSaved={vi.fn()} />);
    fillValidForm();
    fireEvent.change(screen.getByTestId('address-form-phone'), {
      target: { value: '12345' },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByTestId('address-manual-submit').closest('form')!,
      );
    });

    const err = await screen.findByText(/10-digit phone number/i);
    expect(err).toBeInTheDocument();
    expect(addAddressMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('auto-formats pincode to digits-only and max 6', async () => {
    const Form = await loadForm();
    render(<Form open={true} onClose={vi.fn()} onSaved={vi.fn()} />);

    const pincode = screen.getByTestId('address-form-pincode') as HTMLInputElement;
    fireEvent.change(pincode, { target: { value: '56a0b0x15678' } });
    expect(pincode.value).toBe('560015');
  });

  it('auto-formats phone to digits-only and max 10', async () => {
    const Form = await loadForm();
    render(<Form open={true} onClose={vi.fn()} onSaved={vi.fn()} />);

    const phone = screen.getByTestId('address-form-phone') as HTMLInputElement;
    fireEvent.change(phone, { target: { value: '98x7y6z5 4321 12345' } });
    expect(phone.value).toBe('9876543211');
  });

  it('rejects empty required fields', async () => {
    const Form = await loadForm();
    render(<Form open={true} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Submit empty form.
    await act(async () => {
      fireEvent.submit(
        screen.getByTestId('address-manual-submit').closest('form')!,
      );
    });

    expect(addAddressMutation.mutateAsync).not.toHaveBeenCalled();
    // At least one required error is shown.
    const errs = screen.getAllByRole('alert');
    expect(errs.length).toBeGreaterThan(0);
  });

  it('Cancel calls onClose without invoking the mutation', async () => {
    const Form = await loadForm();
    const onClose = vi.fn();
    render(<Form open={true} onClose={onClose} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByTestId('address-form-cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(addAddressMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('switches label chips (home → work → other)', async () => {
    const Form = await loadForm();
    render(<Form open={true} onClose={vi.fn()} onSaved={vi.fn()} />);

    const homeBtn = screen.getByTestId('address-form-label-home');
    const workBtn = screen.getByTestId('address-form-label-work');
    const otherBtn = screen.getByTestId('address-form-label-other');

    expect(homeBtn).toHaveAttribute('aria-checked', 'true');
    expect(workBtn).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(workBtn);
    expect(workBtn).toHaveAttribute('aria-checked', 'true');
    expect(homeBtn).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(otherBtn);
    expect(otherBtn).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps the form open and surfaces an error on mutation failure', async () => {
    addAddressMutation.mutateAsync = vi
      .fn()
      .mockRejectedValue(new Error('functions/internal'));

    const Form = await loadForm();
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<Form open={true} onClose={onClose} onSaved={onSaved} />);
    fillValidForm();

    await act(async () => {
      fireEvent.submit(
        screen.getByTestId('address-manual-submit').closest('form')!,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('address-form-submit-error')).toHaveTextContent(
        /functions\/internal/,
      );
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(toastCalls.error).toHaveBeenCalled();
  });

  it('focuses the first input when opened', async () => {
    const Form = await loadForm();
    const { rerender } = render(
      <Form open={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    rerender(<Form open={true} onClose={vi.fn()} onSaved={vi.fn()} />);

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByTestId('address-form-name'),
      );
    });
  });
});
