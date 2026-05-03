import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import FeaturedCategoryTile from '../FeaturedCategoryTile';

describe('FeaturedCategoryTile', () => {
  const baseProps = {
    slug: 'facials',
    name: 'HydraGlo Facials',
    image: '/images/categories/facials.webp',
  } as const;

  it('renders the category name', () => {
    render(<FeaturedCategoryTile {...baseProps} />);
    expect(screen.getByText('HydraGlo Facials')).toBeInTheDocument();
  });

  it('links to /services/category/{slug}', () => {
    render(<FeaturedCategoryTile {...baseProps} />);
    const link = screen.getByTestId('category-card') as HTMLAnchorElement;
    expect(link).toHaveAttribute('href', '/services/category/facials');
  });

  it('renders the animated label slot when animatedLabels prop is provided', () => {
    render(
      <FeaturedCategoryTile
        {...baseProps}
        animatedLabels={['Most Booked', 'Loved by 5,000+', 'Top Rated']}
      />,
    );

    expect(screen.getByTestId('featured-animated-label')).toBeInTheDocument();
  });

  it('does not render the animated label slot when animatedLabels is absent', () => {
    render(<FeaturedCategoryTile {...baseProps} />);
    expect(screen.queryByTestId('featured-animated-label')).not.toBeInTheDocument();
  });
});
