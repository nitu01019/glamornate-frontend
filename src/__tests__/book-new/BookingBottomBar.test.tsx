/**
 * Phase 4.5 / Patch DR-9 (Booking Flow Fix v3.1, 2026-05-02): regression test
 * pinning the a11y minimums on the bottom-bar primary action — accessible name
 * toggling between "Confirm" / "Confirming…", `aria-busy` reflecting in-flight
 * state, and `aria-disabled` redundant with `disabled` for screen readers.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookingBottomBar } from '../../app/customer/book-new/_components/BookingBottomBar';

vi.mock('lucide-react', () => ({
  ChevronRight: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-right" {...props} />
  ),
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="icon-loader" {...props} />
  ),
}));

interface OverrideProps {
  step?: number;
  totalSteps?: number;
  selectedServices?: Array<{ id: string; quantity: number }>;
  total?: number;
  subtotal?: number;
  isCreating?: boolean;
  canProceed?: boolean;
}

function renderBar(overrides: OverrideProps = {}) {
  const props = {
    step: 5,
    totalSteps: 5,
    selectedServices: [{ id: 'svc-1', quantity: 1 }],
    total: 1000,
    subtotal: 800,
    isCreating: false,
    canProceed: true,
    onNext: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  return render(<BookingBottomBar {...props} />);
}

describe('BookingBottomBar (Patch DR-9 a11y)', () => {
  it('idle final step: accessible name "Confirm" and aria-busy=false', () => {
    renderBar({ isCreating: false });
    const button = screen.getByRole('button', { name: 'Confirm' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-busy', 'false');
  });

  it('busy final step: accessible name "Confirming…" and aria-busy=true', () => {
    renderBar({ isCreating: true });
    const button = screen.getByRole('button', { name: 'Confirming…' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('non-final step with canProceed=false: button disabled and aria-disabled=true', () => {
    renderBar({ step: 2, canProceed: false, isCreating: false });
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});
