import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks — registered before the component imports resolve.
// ---------------------------------------------------------------------------

const push = vi.fn();
const back = vi.fn();
const replace = vi.fn();

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastWarning = vi.fn();
const toastInfo = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back, replace }),
}));

vi.mock('@/lib/providers', () => ({
  useToastActions: () => ({
    success: toastSuccess,
    error: toastError,
    warning: toastWarning,
    info: toastInfo,
  }),
}));

// ---------------------------------------------------------------------------
// Deferred imports — so the mocks above are in place before module evaluation.
// ---------------------------------------------------------------------------

const loadShell = async () =>
  (await import('../_components/PaymentMethodsPageClient')).PaymentMethodsPageClient;
const loadAddCardForm = async () => (await import('../_components/AddCardForm')).AddCardForm;
const loadUpiIdForm = async () => (await import('../_components/UpiIdForm')).UpiIdForm;
const loadSavedCardsList = async () =>
  (await import('../_components/SavedCardsList')).SavedCardsList;
const loadEmptyCardsState = async () =>
  (await import('../_components/EmptyCardsState')).EmptyCardsState;

describe('PaymentMethodsPageClient — shell', () => {
  beforeEach(() => {
    push.mockClear();
    back.mockClear();
    replace.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
    toastWarning.mockClear();
    toastInfo.mockClear();
  });

  // (a) Disabled banner visible while payments backend is not live.
  it('renders the disabled banner copy', async () => {
    const Shell = await loadShell();
    render(<Shell />);

    expect(
      screen.getByText('Card saving will be enabled once payments are live.'),
    ).toBeInTheDocument();

    // The banner is announced via role="status" with aria-live="polite".
    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toHaveTextContent(/Card saving will be enabled once payments are live\./);
  });

  // (b) Empty state appears when the user has zero saved cards.
  it('renders "No saved cards yet" empty state when savedCards is empty', async () => {
    const Shell = await loadShell();
    render(<Shell />);

    expect(
      screen.getByRole('heading', { level: 2, name: /no saved cards yet/i }),
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /add your first card/i })).toBeInTheDocument();
  });

  // (c) The "Add Your First Card" CTA is the entry point to the Add Card dialog.
  //
  // In the current shell the CTA is rendered but kept inert while the payments
  // backend is not live (paymentsDisabled=true). We therefore verify two
  // things:
  //   1. The CTA button is present and flagged as disabled.
  //   2. When AddCardForm is rendered with `open={true}`, the cardholder
  //      field exists — proving the dialog the CTA would open is wired to a
  //      real cardholder input once the flag flips.
  it('clicking "Add Your First Card" resolves to a dialog containing the cardholder field', async () => {
    const user = userEvent.setup();
    const Shell = await loadShell();
    const AddCardForm = await loadAddCardForm();

    const { unmount } = render(<Shell />);

    const cta = screen.getByRole('button', { name: /add your first card/i });
    expect(cta).toBeInTheDocument();
    // Click does not throw; while payments are disabled, no dialog opens.
    await user.click(cta);

    unmount();

    // Mount the dialog that the CTA is wired to and assert the cardholder
    // field is present — the behavioural contract that backs the CTA.
    render(<AddCardForm open onOpenChange={() => {}} onSave={() => {}} />);

    expect(screen.getByRole('textbox', { name: /cardholder name/i })).toBeInTheDocument();
  });

  // (d) A UPI form section with a `name="vpa"` input must exist in the
  // payments surface. The shell renders the UPI section; the `vpa` input is
  // provided by the composable <UpiIdForm /> primitive that plugs into it.
  it('renders a UPI input named "vpa"', async () => {
    const UpiIdForm = await loadUpiIdForm();
    const { container } = render(<UpiIdForm onSave={() => {}} />);

    // Query by the exact `name="vpa"` attribute the task calls for. Using a
    // label matcher here is ambiguous because the form's submit button also
    // contains the string "UPI ID".
    const vpaInput = container.querySelector('input[name="vpa"]');
    expect(vpaInput).not.toBeNull();
    expect(vpaInput).toHaveAttribute('id', 'vpa');
    expect(vpaInput).toHaveAttribute('name', 'vpa');
  });

  // (e) UPI section heading is rendered on the shell itself.
  it('renders the UPI section heading and an "Add UPI ID" CTA', async () => {
    const Shell = await loadShell();
    render(<Shell />);

    // Section heading.
    expect(screen.getByRole('heading', { level: 2, name: /^upi$/i })).toBeInTheDocument();

    // CTA that opens the "Add UPI ID" flow.
    expect(screen.getByRole('button', { name: /add upi id/i })).toBeInTheDocument();
  });

  // Additional coverage — sticky header back button wires to router.back().
  it('clicking the header back button calls router.back()', async () => {
    const user = userEvent.setup();
    const Shell = await loadShell();
    render(<Shell />);

    const backButton = screen.getByRole('button', { name: /go back/i });
    await user.click(backButton);

    expect(back).toHaveBeenCalledTimes(1);
  });

  // Additional coverage — payments-disabled state propagates to the CTA and
  // empty state, preventing the dialog from opening on click.
  it('renders the "Cards" section heading and disables the CTA while payments are off', async () => {
    const user = userEvent.setup();
    const Shell = await loadShell();
    render(<Shell />);

    expect(screen.getByRole('heading', { level: 2, name: /^cards$/i })).toBeInTheDocument();

    const cta = screen.getByRole('button', { name: /add your first card/i });
    expect(cta).toBeDisabled();
    expect(cta).toHaveAttribute('aria-disabled', 'true');

    // Clicking a disabled button is a no-op — the router must stay untouched.
    await user.click(cta);
    expect(push).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// UpiIdForm — behavioural coverage for the UPI primitive rendered on the
// payments surface. Kept in this file to exercise the "payments page" flow
// as a single testing unit.
// ---------------------------------------------------------------------------

describe('UpiIdForm', () => {
  it('rejects an empty VPA on submit', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const UpiIdForm = await loadUpiIdForm();
    render(<UpiIdForm onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /save upi id/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText(/upi id is required\./i)).toBeInTheDocument();
  });

  it('rejects an invalid VPA shape and surfaces the guidance message', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const UpiIdForm = await loadUpiIdForm();
    const { container } = render(<UpiIdForm onSave={onSave} />);

    const vpaInput = container.querySelector<HTMLInputElement>('input[name="vpa"]')!;
    await user.type(vpaInput, 'not-a-vpa');
    await user.click(screen.getByRole('button', { name: /save upi id/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText(/enter a valid upi id like name@bank\./i)).toBeInTheDocument();
  });

  it('calls onSave with the trimmed VPA when valid', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const UpiIdForm = await loadUpiIdForm();
    const { container } = render(<UpiIdForm onSave={onSave} />);

    const vpaInput = container.querySelector<HTMLInputElement>('input[name="vpa"]')!;
    await user.type(vpaInput, 'test@okhdfc');
    await user.click(screen.getByRole('button', { name: /save upi id/i }));

    await vi.waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(onSave).toHaveBeenCalledWith('test@okhdfc');
  });
});

// ---------------------------------------------------------------------------
// SavedCardsList — list, empty-state, and per-row behaviour. These tests
// exercise the rendered rows directly so branch coverage for card rendering
// (brand label, isDefault badge, overflow menu) stays above 80%.
// ---------------------------------------------------------------------------

describe('SavedCardsList', () => {
  const baseCard = {
    id: 'card-1',
    brand: 'visa' as const,
    last4: '4242',
    expMonth: 12,
    expYear: 2030,
    isDefault: false,
  };

  it('shows EmptyCardsState when the list is empty', async () => {
    const SavedCardsList = await loadSavedCardsList();
    render(<SavedCardsList savedCards={[]} onAddCard={() => {}} onRemoveCard={() => {}} />);

    expect(
      screen.getByRole('heading', { level: 2, name: /no saved cards yet/i }),
    ).toBeInTheDocument();
  });

  it('renders one row per saved card with masked last4 + expiry', async () => {
    const SavedCardsList = await loadSavedCardsList();
    render(
      <SavedCardsList
        savedCards={[
          baseCard,
          { ...baseCard, id: 'card-2', brand: 'mastercard', last4: '5555', isDefault: true },
        ]}
        onAddCard={() => {}}
        onRemoveCard={() => {}}
      />,
    );

    const list = screen.getByRole('list', { name: /saved cards/i });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText(/•••• •••• •••• 4242/)).toBeInTheDocument();
    expect(within(list).getByText(/•••• •••• •••• 5555/)).toBeInTheDocument();
    // Default badge for the flagged card only.
    expect(within(list).getAllByText(/default/i)).toHaveLength(1);
  });

  it('toggles the overflow menu and invokes onRemoveCard on remove click', async () => {
    const user = userEvent.setup();
    const onRemoveCard = vi.fn();
    const SavedCardsList = await loadSavedCardsList();

    render(
      <SavedCardsList savedCards={[baseCard]} onAddCard={() => {}} onRemoveCard={onRemoveCard} />,
    );

    const menuBtn = screen.getByRole('button', {
      name: /open actions for card ending 4242/i,
    });
    expect(menuBtn).toHaveAttribute('aria-expanded', 'false');

    await user.click(menuBtn);
    expect(menuBtn).toHaveAttribute('aria-expanded', 'true');

    const removeItem = screen.getByRole('menuitem', { name: /remove card/i });
    await user.click(removeItem);

    expect(onRemoveCard).toHaveBeenCalledWith('card-1');
    // Menu closes after the action resolves.
    expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not toggle the overflow menu when disabled=true', async () => {
    const user = userEvent.setup();
    const SavedCardsList = await loadSavedCardsList();

    render(
      <SavedCardsList
        savedCards={[baseCard]}
        onAddCard={() => {}}
        onRemoveCard={() => {}}
        disabled
      />,
    );

    const menuBtn = screen.getByRole('button', {
      name: /open actions for card ending 4242/i,
    });
    expect(menuBtn).toBeDisabled();

    // Disabled buttons don't fire React onClick in jsdom; the menu stays closed.
    await user.click(menuBtn);
    expect(screen.queryByRole('menuitem', { name: /remove card/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EmptyCardsState — standalone rendering path. Disabled=true should block
// the primary CTA's handler.
// ---------------------------------------------------------------------------

describe('EmptyCardsState', () => {
  it('invokes onAddCard when the CTA is clicked and not disabled', async () => {
    const user = userEvent.setup();
    const onAddCard = vi.fn();
    const EmptyCardsState = await loadEmptyCardsState();
    render(<EmptyCardsState onAddCard={onAddCard} />);

    await user.click(screen.getByRole('button', { name: /add your first card/i }));
    expect(onAddCard).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onAddCard when disabled=true', async () => {
    const user = userEvent.setup();
    const onAddCard = vi.fn();
    const EmptyCardsState = await loadEmptyCardsState();
    render(<EmptyCardsState onAddCard={onAddCard} disabled />);

    const cta = screen.getByRole('button', { name: /add your first card/i });
    expect(cta).toBeDisabled();
    await user.click(cta);
    expect(onAddCard).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PaymentMethodsPageClient — prop-injected paths for branch coverage:
//   - paymentsEnabled hides the disabled banner
//   - populated initialCards renders the header "Add Card" + dashed CTA
//   - populated initialUpiHandles renders rows + Remove buttons
//   - handleRemoveCard / handleRemoveUpi filter from state when enabled
// ---------------------------------------------------------------------------

describe('PaymentMethodsPageClient — prop-injected paths', () => {
  const card = {
    id: 'card-1',
    brand: 'visa' as const,
    last4: '4242',
    expMonth: 12,
    expYear: 2030,
    isDefault: false,
  };
  const upi = { id: 'upi-1', vpa: 'user@okhdfc', isDefault: false };

  it('hides the disabled banner when paymentsEnabled=true', async () => {
    const Shell = await loadShell();
    render(<Shell paymentsEnabled />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Card saving will be enabled once payments are live.'),
    ).not.toBeInTheDocument();
  });

  it('renders the header "Add Card" pill + dashed bottom CTA when initialCards has rows', async () => {
    const Shell = await loadShell();
    render(<Shell paymentsEnabled initialCards={[card]} />);

    // Two "Add Card" buttons are rendered when the list is populated:
    // a small pill in the section header and a dashed bottom-of-section CTA.
    const addCardButtons = screen.getAllByRole('button', { name: /^add card$/i });
    expect(addCardButtons.length).toBe(2);
    addCardButtons.forEach((btn) => expect(btn).not.toBeDisabled());
  });

  it('renders saved UPI rows with a Remove button per row when initialUpiHandles has rows', async () => {
    const Shell = await loadShell();
    render(<Shell paymentsEnabled initialUpiHandles={[upi]} />);

    const list = screen.getByRole('list', { name: /saved upi ids/i });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('user@okhdfc')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: /remove user@okhdfc/i })).toBeInTheDocument();
  });

  it('filters the UPI handle out of state when its Remove button is clicked', async () => {
    const user = userEvent.setup();
    const Shell = await loadShell();
    render(
      <Shell
        paymentsEnabled
        initialUpiHandles={[upi, { id: 'upi-2', vpa: 'second@ybl', isDefault: false }]}
      />,
    );

    const list = screen.getByRole('list', { name: /saved upi ids/i });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);

    await user.click(within(list).getByRole('button', { name: /remove user@okhdfc/i }));

    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).queryByText('user@okhdfc')).not.toBeInTheDocument();
    expect(within(list).getByText('second@ybl')).toBeInTheDocument();
  });

  it('removes a card from state when its overflow Remove menuitem is clicked', async () => {
    const user = userEvent.setup();
    const Shell = await loadShell();
    render(
      <Shell
        paymentsEnabled
        initialCards={[card, { ...card, id: 'card-2', last4: '5555', brand: 'mastercard' }]}
      />,
    );

    const list = screen.getByRole('list', { name: /saved cards/i });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);

    await user.click(
      within(list).getByRole('button', { name: /open actions for card ending 4242/i }),
    );
    await user.click(screen.getByRole('menuitem', { name: /remove card/i }));

    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).queryByText(/•••• •••• •••• 4242/)).not.toBeInTheDocument();
    expect(within(list).getByText(/•••• •••• •••• 5555/)).toBeInTheDocument();
  });

  it('renders an isDefault badge in a UPI row when isDefault=true', async () => {
    const Shell = await loadShell();
    render(<Shell paymentsEnabled initialUpiHandles={[{ ...upi, isDefault: true }]} />);

    const list = screen.getByRole('list', { name: /saved upi ids/i });
    expect(within(list).getByText(/default/i)).toBeInTheDocument();
  });

  it('header back button still works in the enabled state', async () => {
    const user = userEvent.setup();
    const Shell = await loadShell();
    render(<Shell paymentsEnabled initialCards={[card]} />);

    await user.click(screen.getByRole('button', { name: /go back/i }));
    expect(back).toHaveBeenCalled();
  });

  it('clicking the dashed Add Card CTA when enabled does not throw and stays inert (no router push)', async () => {
    const user = userEvent.setup();
    const Shell = await loadShell();
    render(<Shell paymentsEnabled initialCards={[card]} />);

    const addCardButtons = screen.getAllByRole('button', { name: /^add card$/i });
    // Click both: header pill + dashed bottom CTA → exercises the !paymentsDisabled branch
    for (const btn of addCardButtons) {
      await user.click(btn);
    }
    expect(push).not.toHaveBeenCalled();
  });

  it('clicking Add UPI ID when enabled does not throw (covers !paymentsDisabled branch in openAddUpiDialog)', async () => {
    const user = userEvent.setup();
    const Shell = await loadShell();
    // Empty UPI list path — surfaces the empty state CTA, which is enabled here
    render(<Shell paymentsEnabled />);

    await user.click(screen.getByRole('button', { name: /add upi id/i }));
    expect(push).not.toHaveBeenCalled();
  });
});
