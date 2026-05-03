import { describe, expect, it, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
// QA-M1 — demonstrate renderWithProviders for future specs that need
// React Query state. HomeCategoryGrid itself does not read the cache, but
// wrapping now makes this spec forward-compatible when the component
// migrates off the `useCategories` hook mock.
import { renderWithProviders as render } from '@/test/wrappers';

// ---------------------------------------------------------------------------
// Mocks
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

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { priority, fill, sizes, ...rest } = props as Record<string, unknown>;
    void priority;
    void fill;
    void sizes;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
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
  {
    slug: 'threading',
    name: 'Threading',
    image: '/images/categories/threading.webp',
    serviceCount: 5,
  },
  { slug: 'bleach', name: 'Bleach', image: '/images/categories/bleach.webp', serviceCount: 13 },
  {
    slug: 'body-polishing-massage',
    name: 'Body Polishing & Massage',
    image: '/images/categories/body-polishing-massage.webp',
    serviceCount: 8,
  },
  {
    slug: 'de-tan-pack',
    name: 'De-Tan Pack',
    image: '/images/categories/de-tan-pack.webp',
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

const loadGrid = async () => (await import('../HomeCategoryGrid')).default;

describe('HomeCategoryGrid', () => {
  beforeEach(() => {
    hookResult.data = undefined;
    hookResult.isLoading = false;
    hookResult.isFetching = false;
    hookResult.isError = false;
  });

  it('renders exactly 13 tiles when 13 categories are provided', async () => {
    hookResult.data = ALL_THIRTEEN;

    const Grid = await loadGrid();
    render(<Grid />);

    expect(screen.getAllByTestId('category-tile')).toHaveLength(13);
  });

  it('marks exactly two tiles as wide at positions 0 and 6', async () => {
    hookResult.data = ALL_THIRTEEN;

    const Grid = await loadGrid();
    render(<Grid />);

    const wideTiles = screen
      .getAllByTestId('category-tile')
      .filter((el) => el.getAttribute('data-wide') === 'true');
    expect(wideTiles).toHaveLength(2);

    const allTiles = screen.getAllByTestId('category-tile');
    const wideIndexes: number[] = [];
    allTiles.forEach((tile, index) => {
      if (tile.getAttribute('data-wide') === 'true') {
        wideIndexes.push(index);
      }
    });
    expect(wideIndexes).toEqual([0, 6]);
  });

  it('has no text descendants inside any tile (names live as siblings)', async () => {
    hookResult.data = ALL_THIRTEEN;

    const Grid = await loadGrid();
    const { container } = render(<Grid />);

    const tiles = container.querySelectorAll('[data-testid="category-tile"]');
    expect(tiles.length).toBe(13);
    tiles.forEach((tile) => {
      expect((tile.textContent ?? '').trim()).toBe('');
    });
  });

  it('renders each category name outside the tile in a figcaption sibling', async () => {
    hookResult.data = ALL_THIRTEEN;

    const Grid = await loadGrid();
    const { container } = render(<Grid />);

    const figures = container.querySelectorAll('figure');
    expect(figures.length).toBe(13);
    figures.forEach((fig) => {
      const tile = fig.querySelector('[data-testid="category-tile"]');
      const caption = fig.querySelector('figcaption');
      expect(tile).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(caption?.textContent?.trim().length).toBeGreaterThan(0);
      if (tile && caption) {
        expect(tile.contains(caption)).toBe(false);
      }
    });
  });

  it('never renders "NEW" / Most Booked / animated-label badge elements', async () => {
    hookResult.data = ALL_THIRTEEN;

    const Grid = await loadGrid();
    const { container } = render(<Grid />);

    expect(container.querySelector('[data-testid="secondary-tile-badge"]')).toBeNull();
    expect(container.querySelector('[data-testid="featured-animated-label"]')).toBeNull();
  });

  it('shows the skeleton while loading', async () => {
    hookResult.isLoading = true;

    const Grid = await loadGrid();
    render(<Grid />);

    expect(screen.getByTestId('home-category-grid-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('home-category-grid')).toBeNull();
  });

  it('falls back to the bundled catalog on error and still renders 13 tiles', async () => {
    hookResult.isError = true;
    hookResult.data = undefined;

    const Grid = await loadGrid();
    render(<Grid />);

    expect(screen.getAllByTestId('category-tile')).toHaveLength(13);
  });

  it('gives the row-1 wide tile an aria-label targeting the Facials category', async () => {
    hookResult.data = ALL_THIRTEEN;

    const Grid = await loadGrid();
    render(<Grid />);

    const wideTiles = screen
      .getAllByTestId('category-tile')
      .filter((el) => el.getAttribute('data-wide') === 'true');
    expect(wideTiles[0]).toHaveAttribute('aria-label', 'View Facials category');
    expect(wideTiles[1]).toHaveAttribute('aria-label', 'View Body Polishing & Massage category');
  });

  it('pads with the catalog fallback when fewer than 13 items are supplied', async () => {
    hookResult.data = ALL_THIRTEEN.slice(0, 5);

    const Grid = await loadGrid();
    render(<Grid />);

    expect(screen.getAllByTestId('category-tile')).toHaveLength(13);
    expect(
      screen
        .getAllByTestId('category-tile')
        .filter((el) => el.getAttribute('data-wide') === 'true'),
    ).toHaveLength(2);
  });

  it('renders the expected heading', async () => {
    hookResult.data = ALL_THIRTEEN;

    const Grid = await loadGrid();
    render(<Grid />);

    const section = screen.getByTestId('home-category-grid');
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Explore Our Categories',
    );
  });
});
