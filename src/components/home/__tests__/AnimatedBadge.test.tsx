/**
 * Tests for {@link AnimatedBadge}.
 *
 * Coverage:
 *  - Renders the label text regardless of hasEntered state.
 *  - Applies the curtain-sweep class when hasEntered flips to true (under
 *    JSDOM, the hook short-circuits to `hasEntered:true` because
 *    IntersectionObserver is absent — so a default-rendered badge already
 *    has the class applied).
 *  - Applies variant-specific pill colour classes.
 *  - Respects staggerMs by setting inline animationDelay when entered.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnimatedBadge from '../AnimatedBadge';

describe('AnimatedBadge', () => {
  it('renders the label text', () => {
    render(<AnimatedBadge label="Most Booked" variant="most-booked" />);
    expect(screen.getByTestId('animated-badge')).toHaveTextContent('Most Booked');
  });

  it('exposes the pill via data-testid="animated-badge"', () => {
    render(<AnimatedBadge label="Editor's Pick" variant="editor-pick" />);
    expect(screen.getByTestId('animated-badge')).toBeInTheDocument();
  });

  it('renders a curtain overlay element with aria-hidden', () => {
    render(<AnimatedBadge label="New" variant="new" />);
    const curtain = screen.getByTestId('animated-badge-curtain');
    expect(curtain).toBeInTheDocument();
    expect(curtain).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies the curtain-sweep animation class once hasEntered is true (JSDOM fallback)', () => {
    // In JSDOM, useInViewOnce short-circuits to hasEntered:true because
    // `IntersectionObserver === undefined`. So the curtain should render in
    // its revealing state immediately.
    render(<AnimatedBadge label="Most Booked" variant="most-booked" />);
    const curtain = screen.getByTestId('animated-badge-curtain');
    expect(curtain.className).toMatch(/animate-curtain-sweep/);
    expect(curtain.getAttribute('data-state')).toBe('revealing');
  });

  it('marks the host pill as entered via data-entered="true" in JSDOM', () => {
    render(<AnimatedBadge label="Most Booked" />);
    expect(screen.getByTestId('animated-badge')).toHaveAttribute('data-entered', 'true');
  });

  it('applies the most-booked variant pill classes', () => {
    render(<AnimatedBadge label="Most Booked" variant="most-booked" />);
    const pill = screen.getByTestId('animated-badge');
    expect(pill.className).toMatch(/bg-brand-maroon-500/);
    expect(pill.className).toMatch(/text-white/);
  });

  it('applies the editor-pick variant pill classes', () => {
    render(<AnimatedBadge label="Editor's Pick" variant="editor-pick" />);
    const pill = screen.getByTestId('animated-badge');
    expect(pill.className).toMatch(/bg-brand-maroon-400/);
  });

  it('applies the new variant pill classes', () => {
    render(<AnimatedBadge label="New" variant="new" />);
    const pill = screen.getByTestId('animated-badge');
    expect(pill.className).toMatch(/bg-brand-maroon-300/);
  });

  it('uses brand-blush-500 for the curtain overlay', () => {
    render(<AnimatedBadge label="Most Booked" />);
    const curtain = screen.getByTestId('animated-badge-curtain');
    expect(curtain.className).toMatch(/bg-brand-blush-500/);
  });

  it('applies inline animationDelay when staggerMs > 0 and entered', () => {
    render(<AnimatedBadge label="Editor's Pick" variant="editor-pick" staggerMs={120} />);
    const curtain = screen.getByTestId('animated-badge-curtain');
    // JSDOM has hasEntered:true synchronously, so the stagger style applies.
    expect(curtain.style.animationDelay).toBe('120ms');
  });

  it('does not apply inline animationDelay when staggerMs is 0 (default)', () => {
    render(<AnimatedBadge label="Most Booked" variant="most-booked" />);
    const curtain = screen.getByTestId('animated-badge-curtain');
    expect(curtain.style.animationDelay).toBe('');
  });

  it('forwards className to the outer pill', () => {
    render(<AnimatedBadge label="Most Booked" className="absolute top-2 left-2" />);
    const pill = screen.getByTestId('animated-badge');
    expect(pill.className).toMatch(/absolute/);
    expect(pill.className).toMatch(/top-2/);
  });
});
