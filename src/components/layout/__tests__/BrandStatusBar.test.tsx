import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandStatusBar } from '@/components/layout/BrandStatusBar';

describe('BrandStatusBar', () => {
  it('renders the brand status pill with Our Premium copy', () => {
    render(<BrandStatusBar />);
    const pill = screen.getByTestId('brand-status-bar');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent('Glamornate');
    expect(pill).toHaveTextContent('Our Premium');
  });
});
