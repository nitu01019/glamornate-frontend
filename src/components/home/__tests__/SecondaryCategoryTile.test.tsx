import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import SecondaryCategoryTile from '../SecondaryCategoryTile';

describe('SecondaryCategoryTile', () => {
  const baseProps = {
    slug: 'body-polishing-massage',
    name: 'Body Polishing',
    image: '/images/categories/body-polishing-massage.webp',
  } as const;

  it('renders the badge text when badge prop is provided', () => {
    render(<SecondaryCategoryTile {...baseProps} badge="New" />);
    expect(screen.getByTestId('secondary-tile-badge')).toHaveTextContent('New');
  });

  it('does not render the badge element when badge prop is absent', () => {
    render(<SecondaryCategoryTile {...baseProps} />);
    expect(screen.queryByTestId('secondary-tile-badge')).not.toBeInTheDocument();
  });

  it('links to /services/category/{slug} and exposes category-card testid', () => {
    render(<SecondaryCategoryTile {...baseProps} badge="Most Booked" />);
    const link = screen.getByTestId('category-card') as HTMLAnchorElement;
    expect(link).toHaveAttribute('href', '/services/category/body-polishing-massage');
  });
});
