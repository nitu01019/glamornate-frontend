import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CartSummary from '../CartSummary';

// Mock the cart store
vi.mock('@/store/cart', () => ({
  useCartStore: (selector: (state: unknown) => unknown) => {
    const state = {
      getItemCount: () => 1,
      getTotal: () => 1500,
      getTotalDuration: () => 60,
      voucherName: null,
      voucherDiscount: 0,
      getDiscountedTotal: () => 0,
    };
    return selector(state);
  },
}));

// Mock CouponInput (its store dependencies aren't needed for this test)
vi.mock('@/components/coupon/CouponInput', () => ({
  default: () => null,
}));

// Mock auth — toggle isAuthenticated per test via the variable below
let mockIsAuthenticated = false;
vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

describe('CartSummary — Proceed to Book button destination (Phase 3.5 SC-11 regression lock)', () => {
  beforeEach(() => {
    mockIsAuthenticated = false;
  });

  it('routes authenticated users to /customer/book-new (NOT the deleted /booking route)', async () => {
    mockIsAuthenticated = true;
    const onProceed = vi.fn();
    render(<CartSummary onProceed={onProceed} />);
    // Wait for the post-mount effect that flips hasMounted=true so the button text is "Proceed to Book"
    const button = await screen.findByRole('button', { name: /proceed to book/i });
    fireEvent.click(button);
    expect(onProceed).toHaveBeenCalledWith('/customer/book-new');
    // Defense-in-depth: explicit lock against regression to deleted /booking
    expect(onProceed).not.toHaveBeenCalledWith('/booking');
  });

  it('routes unauthenticated users to /auth/login', async () => {
    mockIsAuthenticated = false;
    const onProceed = vi.fn();
    render(<CartSummary onProceed={onProceed} />);
    const button = await screen.findByRole('button', { name: /login to book/i });
    fireEvent.click(button);
    expect(onProceed).toHaveBeenCalledWith('/auth/login');
  });
});
