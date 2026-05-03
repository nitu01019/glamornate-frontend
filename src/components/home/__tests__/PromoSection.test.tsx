import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Promotion } from '@/lib/mock-data';

// ---------------------------------------------------------------------------
// Mocks — stub the React Query hook and the voucher/cart hooks so we can
// render <PromoSection /> synchronously with controlled inputs.
// ---------------------------------------------------------------------------

type PromotionsResult = {
  data: Promotion[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const mockPromotionsResult: PromotionsResult = {
  data: undefined,
  isLoading: false,
  isError: false,
  refetch: () => undefined,
};

vi.mock('@/hooks/useHomeData', () => ({
  usePromotions: () => mockPromotionsResult,
}));

vi.mock('@/hooks/useVoucher', () => ({
  useApplyVoucher: () => ({
    mutateAsync: async () => undefined,
    isPending: false,
  }),
}));

vi.mock('@/store/cart', () => ({
  useCartStore: Object.assign(
    (selector: (s: { voucherCode: string | null }) => unknown) => selector({ voucherCode: null }),
    { getState: () => ({ getItemCount: () => 0 }) },
  ),
}));

// Delay importing PromoSection until after the mocks above are registered.
const loadPromoSection = async () => {
  const mod = await import('../PromoSection');
  return mod.default;
};

function makePromo(overrides: Partial<Promotion>): Promotion {
  return {
    id: overrides.id ?? 'p1',
    title: overrides.title ?? 'Sample Deal',
    subtitle: overrides.subtitle ?? 'Sub',
    description: overrides.description ?? 'Desc',
    image: overrides.image ?? '/img.webp',
    ctaText: overrides.ctaText ?? 'Book Now',
    ctaLink: overrides.ctaLink ?? '/offers',
    bgColor: overrides.bgColor ?? '#fff',
    ordering: overrides.ordering ?? 0,
    isActive: overrides.isActive ?? true,
    ...overrides,
  };
}

describe('PromoSection', () => {
  beforeEach(() => {
    mockPromotionsResult.data = undefined;
    mockPromotionsResult.isLoading = false;
    mockPromotionsResult.isError = false;
  });

  it('renders an explicit empty-state card when no deal is available', async () => {
    mockPromotionsResult.data = [];
    const PromoSection = await loadPromoSection();

    render(<PromoSection />);

    expect(screen.getByText(/no deal available today/i)).toBeInTheDocument();
    expect(screen.getByText(/check back tomorrow/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse all offers/i })).toHaveAttribute(
      'href',
      '/offers',
    );
  });

  it('renders an empty-state card when all promotions are inactive', async () => {
    mockPromotionsResult.data = [
      makePromo({ id: 'a', isActive: false }),
      makePromo({ id: 'b', isActive: false }),
    ];
    const PromoSection = await loadPromoSection();

    render(<PromoSection />);

    expect(screen.getByText(/no deal available today/i)).toBeInTheDocument();
  });

  it('does not return null when the promotions list is empty (parent relies on a non-null render)', async () => {
    mockPromotionsResult.data = [];
    const PromoSection = await loadPromoSection();

    const { container } = render(<PromoSection />);
    // Even with no deal we must render SOME content so the parent heading
    // is never orphaned.
    expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });
});
