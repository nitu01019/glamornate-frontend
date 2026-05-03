import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import CurtainRevealBadge from '../CurtainRevealBadge';

describe('CurtainRevealBadge', () => {
  it('renders the label text inside the badge', () => {
    render(<CurtainRevealBadge label="Most Booked" />);
    expect(screen.getByText('Most Booked')).toBeInTheDocument();
  });

  it('renders a decorative curtain with aria-hidden and animate-curtain-up class', () => {
    const { container } = render(<CurtainRevealBadge label="Most Booked" />);
    const curtain = container.querySelector('[aria-hidden="true"]');
    expect(curtain).not.toBeNull();
    expect(curtain).toHaveClass('animate-curtain-up');
    expect(curtain).toHaveClass('bg-brand-pink-300');
  });

  it('applies the Blush Premium pink-200 background on the wrapper', () => {
    const { container } = render(<CurtainRevealBadge label="Most Booked" />);
    const wrapper = container.firstChild as HTMLElement | null;
    expect(wrapper).not.toBeNull();
    // Tailwind's opacity-modifier syntax `/80` is a distinct class token, so
    // we assert the compiled utility verbatim.
    expect(wrapper?.className).toContain('bg-brand-pink-200/80');
    expect(wrapper?.className).toContain('text-brand-maroon-700');
    expect(wrapper?.className).toContain('overflow-hidden');
  });
});
