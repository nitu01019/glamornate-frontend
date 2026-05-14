import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let currentPathname = '/services';
vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}));

let cartItemCount = 0;
vi.mock('@/store/cart', () => ({
  useCartStore: <T,>(selector: (state: unknown) => T): T => {
    const state = {
      openCart: vi.fn(),
      getItemCount: () => cartItemCount,
    };
    return selector(state);
  },
}));

import FloatingCartButton from '../FloatingCartButton';

beforeEach(() => {
  currentPathname = '/services';
  cartItemCount = 0;
});

describe('FloatingCartButton', () => {
  it('renders the pill when on /services with items in cart', async () => {
    currentPathname = '/services';
    cartItemCount = 3;
    render(<FloatingCartButton />);
    // hasMounted runs in useEffect — flush it.
    await Promise.resolve();
    expect(screen.queryByRole('button', { name: /View cart/i })).toBeInTheDocument();
  });

  it('hides on /cart even when the cart has items (redundant pill)', async () => {
    currentPathname = '/cart';
    cartItemCount = 3;
    const { container } = render(<FloatingCartButton />);
    await Promise.resolve();
    expect(container.firstChild).toBeNull();
  });

  it('hides when itemCount === 0 regardless of route', async () => {
    currentPathname = '/services';
    cartItemCount = 0;
    const { container } = render(<FloatingCartButton />);
    await Promise.resolve();
    expect(container.firstChild).toBeNull();
  });

  it('hides when itemCount === 0 AND on /cart', async () => {
    currentPathname = '/cart';
    cartItemCount = 0;
    const { container } = render(<FloatingCartButton />);
    await Promise.resolve();
    expect(container.firstChild).toBeNull();
  });
});
