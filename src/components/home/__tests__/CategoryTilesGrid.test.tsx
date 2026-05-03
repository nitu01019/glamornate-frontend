import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock useCategories so we can drive the component's data/error states
// deterministically without a React Query provider.
// ---------------------------------------------------------------------------

interface CategoryRecord {
  readonly slug: string;
  readonly name: string;
  readonly image: string;
  readonly serviceCount: number;
}

interface CategoriesHookResult {
  data: readonly CategoryRecord[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
}

const hookResult: CategoriesHookResult = {
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: () => undefined,
};

vi.mock('@/hooks/useHomeData', () => ({
  useCategories: () => hookResult,
}));

const ALL_THIRTEEN: readonly CategoryRecord[] = [
  { slug: 'facials', name: 'Facials', image: '/images/categories/facials.webp', serviceCount: 40 },
  {
    slug: 'clean-ups',
    name: 'Clean Ups',
    image: '/images/categories/clean-ups.webp',
    serviceCount: 17,
  },
  { slug: 'waxing', name: 'Waxing', image: '/images/categories/waxing.webp', serviceCount: 70 },
  {
    slug: 'manicure-pedicure',
    name: 'Manicure & Pedicure',
    image: '/images/categories/manicure-pedicure.webp',
    serviceCount: 15,
  },
  { slug: 'bleach', name: 'Bleach', image: '/images/categories/bleach.webp', serviceCount: 13 },
  {
    slug: 'de-tan-pack',
    name: 'De-Tan Pack',
    image: '/images/categories/de-tan-pack.webp',
    serviceCount: 8,
  },
  {
    slug: 'threading',
    name: 'Threading',
    image: '/images/categories/threading.webp',
    serviceCount: 5,
  },
  {
    slug: 'body-polishing-massage',
    name: 'Body Polishing & Massage',
    image: '/images/categories/body-polishing-massage.webp',
    serviceCount: 8,
  },
  {
    slug: 'hair-root-touch-up',
    name: 'Hair Root Touch-Up',
    image: '/images/categories/hair-root-touch-up.webp',
    serviceCount: 6,
  },
  {
    slug: 'global-hair-coloring',
    name: 'Global Hair Coloring',
    image: '/images/categories/global-hair-coloring.webp',
    serviceCount: 6,
  },
  {
    slug: 'hair-spa',
    name: 'Hair Spa',
    image: '/images/categories/hair-spa.webp',
    serviceCount: 9,
  },
  {
    slug: 'hair-transformation',
    name: 'Hair Transformation',
    image: '/images/categories/hair-transformation.webp',
    serviceCount: 6,
  },
  {
    slug: 'hair-treatments',
    name: 'Hair Treatments',
    image: '/images/categories/hair-treatments.webp',
    serviceCount: 6,
  },
];

const loadGrid = async () => (await import('../CategoryTilesGrid')).default;

describe('CategoryTilesGrid', () => {
  beforeEach(() => {
    hookResult.data = undefined;
    hookResult.isLoading = false;
    hookResult.isFetching = false;
    hookResult.isError = false;
  });

  it('renders all 13 category cards when 13 categories are provided', async () => {
    hookResult.data = ALL_THIRTEEN;

    const Grid = await loadGrid();
    render(<Grid />);

    expect(screen.getAllByTestId('category-card')).toHaveLength(13);
  });

  it('forwards the animated rotating label to the `facials` hero tile (Most Booked)', async () => {
    hookResult.data = ALL_THIRTEEN;

    const Grid = await loadGrid();
    render(<Grid />);

    const facialsLink = screen.getByRole('link', { name: /view facials category/i });
    expect(within(facialsLink).getByTestId('featured-animated-label')).toBeInTheDocument();
  });

  it('renders the "New" badge on the body-polishing-massage tile', async () => {
    hookResult.data = ALL_THIRTEEN;

    const Grid = await loadGrid();
    render(<Grid />);

    const bodyPolishingLink = screen.getByRole('link', {
      name: /view body polishing & massage category/i,
    });
    const badge = within(bodyPolishingLink).getByTestId('secondary-tile-badge');
    expect(badge).toHaveTextContent('New');
  });

  it('renders gracefully when fewer than 13 categories are provided', async () => {
    hookResult.data = ALL_THIRTEEN.slice(0, 7);

    const Grid = await loadGrid();
    render(<Grid />);

    // 7 tiles rendered, no crash, section still visible.
    expect(screen.getAllByTestId('category-card')).toHaveLength(7);
    expect(screen.getByTestId('category-tiles-grid')).toBeInTheDocument();
  });
});
