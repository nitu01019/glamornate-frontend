import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import CategoryTileWide from '../CategoryTileWide';

// Plain <img> so jsdom can render without a real Next image optimizer.
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

const baseProps = {
  slug: 'facials',
  name: 'Facials',
  image: '/images/categories/facials.webp',
} as const;

describe('CategoryTileWide', () => {
  it('renders a link to /services/category/{slug} with an aria-label', () => {
    render(<CategoryTileWide {...baseProps} />);

    const link = screen.getByTestId('category-tile') as HTMLAnchorElement;
    expect(link).toHaveAttribute('href', '/services/category/facials');
    expect(link).toHaveAttribute('aria-label', 'View Facials category');
  });

  it('marks the tile as wide via data-wide="true"', () => {
    render(<CategoryTileWide {...baseProps} />);
    expect(screen.getByTestId('category-tile')).toHaveAttribute(
      'data-wide',
      'true',
    );
  });

  it('renders the name OUTSIDE the tile via figcaption', () => {
    render(<CategoryTileWide {...baseProps} />);
    const tile = screen.getByTestId('category-tile');
    const caption = screen.getByText('Facials');
    expect(caption.tagName.toLowerCase()).toBe('figcaption');
    expect(tile.contains(caption)).toBe(false);
  });

  it('never places a text node inside the tile anchor', () => {
    render(<CategoryTileWide {...baseProps} />);
    const tile = screen.getByTestId('category-tile');
    expect(tile.textContent?.trim() ?? '').toBe('');
  });

  it('never renders a NEW / Most Booked / animated-label badge', () => {
    render(<CategoryTileWide {...baseProps} />);
    expect(screen.queryByTestId('secondary-tile-badge')).toBeNull();
    expect(screen.queryByTestId('featured-animated-label')).toBeNull();
  });

  it('exposes the elevation, radius, and transition tokens on the tile', () => {
    render(<CategoryTileWide {...baseProps} />);
    const tile = screen.getByTestId('category-tile');
    expect(tile.className).toContain('rounded-tile');
    expect(tile.className).toContain('shadow-tile-md');
    expect(tile.className).toContain('active:scale-[0.98]');
    expect(tile.className).toContain('transition-transform');
  });
});
