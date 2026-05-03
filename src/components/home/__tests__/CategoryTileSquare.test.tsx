import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import CategoryTileSquare from '../CategoryTileSquare';

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
  slug: 'clean-ups',
  name: 'Clean Ups',
  image: '/images/categories/clean-ups.webp',
} as const;

describe('CategoryTileSquare', () => {
  it('renders a link to /services/category/{slug} with an aria-label', () => {
    render(<CategoryTileSquare {...baseProps} />);

    const link = screen.getByTestId('category-tile') as HTMLAnchorElement;
    expect(link).toHaveAttribute('href', '/services/category/clean-ups');
    expect(link).toHaveAttribute('aria-label', 'View Clean Ups category');
  });

  it('marks the tile as square via data-wide="false"', () => {
    render(<CategoryTileSquare {...baseProps} />);
    expect(screen.getByTestId('category-tile')).toHaveAttribute(
      'data-wide',
      'false',
    );
  });

  it('renders the name OUTSIDE the tile via figcaption', () => {
    render(<CategoryTileSquare {...baseProps} />);
    const tile = screen.getByTestId('category-tile');
    const caption = screen.getByText('Clean Ups');
    expect(caption.tagName.toLowerCase()).toBe('figcaption');
    expect(tile.contains(caption)).toBe(false);
  });

  it('never places a text node inside the tile anchor', () => {
    render(<CategoryTileSquare {...baseProps} />);
    const tile = screen.getByTestId('category-tile');
    expect(tile.textContent?.trim() ?? '').toBe('');
  });

  it('never renders a NEW / Most Booked / animated-label badge', () => {
    render(<CategoryTileSquare {...baseProps} />);
    expect(screen.queryByTestId('secondary-tile-badge')).toBeNull();
    expect(screen.queryByTestId('featured-animated-label')).toBeNull();
  });

  it('exposes the elevation, radius, and transition tokens on the tile', () => {
    render(<CategoryTileSquare {...baseProps} />);
    const tile = screen.getByTestId('category-tile');
    expect(tile.className).toContain('rounded-tile');
    expect(tile.className).toContain('shadow-tile-md');
    expect(tile.className).toContain('active:scale-[0.98]');
    expect(tile.className).toContain('transition-transform');
  });

  it('uses aspect-square geometry for the tile', () => {
    render(<CategoryTileSquare {...baseProps} />);
    const tile = screen.getByTestId('category-tile');
    expect(tile.className).toContain('aspect-square');
  });
});
