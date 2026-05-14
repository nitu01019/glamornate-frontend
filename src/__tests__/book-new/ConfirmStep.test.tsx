/**
 * ConfirmStep render contract (Phase 6, 2026-05-13 cart-direct rewrite).
 *
 * After dropping the broken `spaServices` join, the Confirm screen renders
 * service name + price + duration straight from the cart. These tests pin:
 *   1. Cart-direct values reach the DOM unchanged.
 *   2. The inline Confirm CTA labels the total and fires onConfirm.
 *   3. An `errorMessage` prop produces an inline alert (replaces the legacy
 *      floating toast that overlapped the CTA and got dismissed on re-tap).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmStep } from '@/app/customer/book-new/_components/ConfirmStep';
import type { CartItem } from '@/types';

// next/image renders <img> in test env, so no mock needed.

function baseProps(overrides: Record<string, unknown> = {}) {
  const cartItems: CartItem[] = [
    {
      serviceId: 'svc-1',
      serviceName: 'VLCC Insta Glow Facial',
      categoryName: 'Facials',
      subcategory: '',
      price: 580,
      duration: 45,
      quantity: 1,
    },
  ];
  return {
    selectedSpa: { id: 'spa-1', name: 'Premium Spa' } as never,
    cartItems,
    selectedDate: new Date('2026-05-14T10:00:00.000Z'),
    selectedTime: '15:00',
    selectedTherapist: null,
    bookingLocation: 'spa' as const,
    customerLocation: null,
    onConfirm: vi.fn(),
    isCreating: false,
    errorMessage: null as string | null,
    onDismissError: vi.fn(),
    ...overrides,
  };
}

describe('ConfirmStep', () => {
  it('renders service name, price, and duration directly from cartItems', () => {
    render(<ConfirmStep {...baseProps()} />);

    expect(screen.getByText('VLCC Insta Glow Facial')).toBeInTheDocument();
    // "45 min" appears in both the Services row and the Schedule Duration
    // row, so we assert there is at least one occurrence.
    expect(screen.getAllByText('45 min').length).toBeGreaterThanOrEqual(1);
    // Two occurrences of ₹580 are acceptable (per-service row + button label).
    expect(screen.getAllByText(/₹580/).length).toBeGreaterThanOrEqual(1);
  });

  it('labels the Confirm CTA with the cart total and fires onConfirm on tap', () => {
    const onConfirm = vi.fn();
    render(<ConfirmStep {...baseProps({ onConfirm })} />);

    const button = screen.getByRole('button', { name: /Confirm booking · ₹580/ });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders an inline error alert when errorMessage is set', () => {
    const onDismissError = vi.fn();
    render(<ConfirmStep {...baseProps({ errorMessage: 'Network exploded', onDismissError })} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Network exploded');

    const dismiss = screen.getByRole('button', { name: 'Dismiss error' });
    fireEvent.click(dismiss);
    expect(onDismissError).toHaveBeenCalledTimes(1);
  });

  it('disables the Confirm CTA while a submission is in flight', () => {
    render(<ConfirmStep {...baseProps({ isCreating: true })} />);
    const button = screen.getByRole('button', { name: /Confirming/ });
    expect(button).toBeDisabled();
  });
});
