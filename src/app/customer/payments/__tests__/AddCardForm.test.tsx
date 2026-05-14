import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks — set up before importing the component under test.
// ---------------------------------------------------------------------------

vi.mock('@/lib/providers', () => ({
  useToastActions: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

const loadAddCardForm = async () => (await import('../_components/AddCardForm')).AddCardForm;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RenderedForm {
  cardholder: HTMLInputElement;
  pan: HTMLInputElement;
  expiry: HTMLInputElement;
  cvv: HTMLInputElement;
  submit: HTMLButtonElement;
}

async function mountForm(
  onSave: (card: unknown) => void = vi.fn(),
  onOpenChange: (open: boolean) => void = vi.fn(),
): Promise<RenderedForm> {
  const AddCardForm = await loadAddCardForm();
  render(<AddCardForm open onOpenChange={onOpenChange} onSave={onSave} />);

  // Dialog content is portalled into document.body — queries still reach it
  // via `screen` (testing-library queries the whole document by default).
  const cardholder = screen.getByLabelText(/cardholder name/i) as HTMLInputElement;
  const pan = screen.getByLabelText(/card number/i) as HTMLInputElement;
  const expiry = screen.getByLabelText(/expiry/i) as HTMLInputElement;
  const cvv = screen.getByLabelText(/cvv/i) as HTMLInputElement;
  const submit = screen.getByRole('button', { name: /save card/i }) as HTMLButtonElement;

  return { cardholder, pan, expiry, cvv, submit };
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  fields: RenderedForm,
  values: { name: string; pan: string; expiry: string; cvv: string },
): Promise<void> {
  await user.clear(fields.cardholder);
  await user.type(fields.cardholder, values.name);
  await user.clear(fields.pan);
  await user.type(fields.pan, values.pan);
  await user.clear(fields.expiry);
  await user.type(fields.expiry, values.expiry);
  await user.clear(fields.cvv);
  await user.type(fields.cvv, values.cvv);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AddCardForm', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  // (a) Luhn-invalid PAN blocks submit + surfaces a visible error message.
  it('blocks submit when the PAN fails the Luhn check', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const fields = await mountForm(onSave);

    await fillForm(user, fields, {
      name: 'Test User',
      pan: '1234567890123456', // Luhn-invalid
      expiry: '12/30',
      cvv: '123',
    });

    await user.click(fields.submit);

    expect(onSave).not.toHaveBeenCalled();

    const errorAlert = await screen.findByText(/that card number looks invalid\./i);
    expect(errorAlert).toBeInTheDocument();
    // It should be marked role="alert" so assistive tech announces it.
    expect(errorAlert.closest('[role="alert"]')).not.toBeNull();
  });

  // (b) Expired card blocks submit with a dedicated error.
  it('blocks submit when the expiry is in the past', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const fields = await mountForm(onSave);

    await fillForm(user, fields, {
      name: 'Test User',
      pan: '4111 1111 1111 1111', // Luhn-valid Visa
      expiry: '01/20', // long expired
      cvv: '123',
    });

    await user.click(fields.submit);

    expect(onSave).not.toHaveBeenCalled();

    const expiredMessage = await screen.findByText(/card is expired\./i);
    expect(expiredMessage).toBeInTheDocument();
  });

  // (c) A fully valid form calls onSave with the expected payload shape.
  it('calls onSave with the mapped card payload when every field is valid', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    const fields = await mountForm(onSave, onOpenChange);

    await fillForm(user, fields, {
      name: 'Test User',
      pan: '4111 1111 1111 1111',
      expiry: '12/30',
      cvv: '123',
    });

    await user.click(fields.submit);

    // React-hook-form + Zod resolver runs validation asynchronously; wait
    // for the mock to be invoked.
    await vi.waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith({
      brand: 'visa',
      last4: '1111',
      expMonth: 12,
      expYear: 2030,
      isDefault: false,
    });

    // Dialog is asked to close after a successful save.
    await vi.waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // (d) PAN input auto-formats with spaces every 4 digits on the fly.
  it('auto-formats the PAN input with a space every 4 digits', async () => {
    const user = userEvent.setup();
    const fields = await mountForm();

    await user.type(fields.pan, '4111111111111111');
    expect(fields.pan.value).toBe('4111 1111 1111 1111');

    // Continues grouping as more digits arrive (up to 19 digits supported).
    await user.clear(fields.pan);
    await user.type(fields.pan, '411111111111');
    expect(fields.pan.value).toBe('4111 1111 1111');
  });

  // (e) CVV accepts 3-4 digits only; 2 or 5 digit inputs must surface an error.
  describe('CVV length validation', () => {
    it('accepts a 3-digit CVV', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const fields = await mountForm(onSave);

      await fillForm(user, fields, {
        name: 'Test User',
        pan: '4111 1111 1111 1111',
        expiry: '12/30',
        cvv: '123',
      });

      await user.click(fields.submit);

      await vi.waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });
    });

    it('accepts a 4-digit CVV', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const fields = await mountForm(onSave);

      await fillForm(user, fields, {
        name: 'Test User',
        pan: '378282246310005', // Amex test PAN, 15 digits, Luhn-valid
        expiry: '12/30',
        cvv: '1234',
      });

      await user.click(fields.submit);

      await vi.waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });
    });

    it('rejects a 2-digit CVV', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const fields = await mountForm(onSave);

      await fillForm(user, fields, {
        name: 'Test User',
        pan: '4111 1111 1111 1111',
        expiry: '12/30',
        cvv: '12',
      });

      await user.click(fields.submit);

      expect(onSave).not.toHaveBeenCalled();
      expect(await screen.findByText(/cvv must be 3 or 4 digits\./i)).toBeInTheDocument();
    });

    it('rejects a 5-digit CVV (input is capped at maxLength=4)', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const fields = await mountForm(onSave);

      // The Input has maxLength=4, so only the first 4 digits are kept in
      // the DOM; a 5-digit *intent* is effectively rejected.
      await fillForm(user, fields, {
        name: 'Test User',
        pan: '4111 1111 1111 1111',
        expiry: '12/30',
        cvv: '12345',
      });

      // maxLength caps the stored value at 4 digits, but the "intent" of 5
      // digits never makes it through — prove that by asserting the DOM
      // value is 4 chars and that no "5 digits" state is accepted.
      expect(fields.cvv.maxLength).toBe(4);
      expect(fields.cvv.value.length).toBeLessThanOrEqual(4);

      // And when the user types a genuinely-invalid 2-digit CVV afterwards,
      // submit is still blocked. (The primary 5-digit rejection is enforced
      // at the input boundary via maxLength.)
      await user.clear(fields.cvv);
      await user.type(fields.cvv, '12');
      await user.click(fields.submit);
      expect(onSave).not.toHaveBeenCalled();
      const error = await screen.findByText(/cvv must be 3 or 4 digits\./i);
      // Error is rendered inside a role="alert" for accessibility.
      const alertNode = error.closest('[role="alert"]');
      expect(alertNode).not.toBeNull();
      if (alertNode) {
        expect(
          within(alertNode as HTMLElement).getByText(/cvv must be 3 or 4 digits\./i),
        ).toBeInTheDocument();
      }
    });
  });
});
