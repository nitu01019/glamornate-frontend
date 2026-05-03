import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { HeroBannerSlide } from '@/data/hero-banners';

// next/image → plain <img> so jsdom can render without the real optimizer.
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { priority, fill, sizes, loading, ...rest } = props as Record<string, unknown>;
    // Mirror priority / loading onto data-attributes so tests can assert
    // which slide got the LCP hint without relying on next/image internals.
    const dataAttrs: Record<string, string> = {};
    if (priority) dataAttrs['data-priority'] = 'true';
    if (loading) dataAttrs['data-loading'] = String(loading);
    void fill;
    void sizes;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} {...dataAttrs} />;
  },
}));

import HomeHeroSlide from '../HomeHeroSlide';

const slide: HeroBannerSlide = {
  id: 'hero-slide-0',
  image: '/images/hero-banners/astaberry-wine-facial.webp',
  title: 'Astaberry Wine Facial',
  subtitle: 'Radiant wine-infused glow',
  serviceSlug: 'astaberry-wine-facial',
};

describe('HomeHeroSlide', () => {
  let onAddToCart: ReturnType<typeof vi.fn<(serviceSlug: string) => void>>;
  let onOpenService: ReturnType<typeof vi.fn<(slideId: string, serviceSlug: string) => void>>;

  beforeEach(() => {
    onAddToCart = vi.fn<(serviceSlug: string) => void>();
    onOpenService = vi.fn<(slideId: string, serviceSlug: string) => void>();
  });

  it('renders only image + Add-to-Cart chip — no painted text inside the image container', () => {
    render(
      <HomeHeroSlide
        slide={slide}
        isActive
        isLcpCandidate
        onAddToCart={onAddToCart}
        onOpenService={onOpenService}
      />,
    );

    const slideRoot = screen.getByTestId('home-hero-slide');
    // The only interactive node beside the CTA is the underlying view link.
    // No <h1>/<h2>/<h3>/<p> should exist inside the slide container.
    expect(within(slideRoot).queryByRole('heading')).toBeNull();
    expect(slideRoot.querySelector('h1')).toBeNull();
    expect(slideRoot.querySelector('h2')).toBeNull();
    expect(slideRoot.querySelector('h3')).toBeNull();
    expect(slideRoot.querySelector('p')).toBeNull();

    // The visible image exists.
    const image = slideRoot.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('alt')).toBe('Astaberry Wine Facial');

    // No "Featured Facial" / "From ₹" painted-on strings.
    expect(slideRoot.textContent ?? '').not.toMatch(/Featured Facial/i);
    expect(slideRoot.textContent ?? '').not.toMatch(/From ₹/);
    expect(slideRoot.textContent ?? '').not.toMatch(/Radiant wine-infused glow/i);

    // Success criterion 3: no image-overlay gradient darker than from-black/30
    // on the upper 60% of the image. We enforce the stronger invariant — the
    // slide renders NO Tailwind gradient utilities AT ALL over the image — so
    // there cannot be a dark scrim that covers the model's face.
    const slideMarkup = slideRoot.innerHTML;
    expect(slideMarkup).not.toMatch(/bg-gradient-to-/);
    expect(slideMarkup).not.toMatch(/from-black\/(4|5|6|7|8|9)\d?/);
  });

  it('active slide has Add-to-Cart chip at bottom-right with 44×44 min tap target and rounded-xl', () => {
    render(
      <HomeHeroSlide
        slide={slide}
        isActive
        isLcpCandidate
        onAddToCart={onAddToCart}
        onOpenService={onOpenService}
      />,
    );

    const chip = screen.getByTestId('home-hero-add-to-cart');
    const wrapper = chip.parentElement;
    expect(wrapper).not.toBeNull();

    // Wrapper positions the chip absolutely in the bottom-right with 20 px breathing room.
    expect(wrapper?.className).toMatch(/absolute/);
    expect(wrapper?.className).toMatch(/bottom-5/);
    expect(wrapper?.className).toMatch(/right-5/);

    // Chip itself hits WCAG 2.5.5 AA size + brand styling.
    const chipClass = chip.className;
    expect(chipClass).toMatch(/min-h-\[44px\]/);
    expect(chipClass).toMatch(/min-w-\[44px\]/);
    expect(chipClass).toMatch(/rounded-xl/);
    expect(chipClass).toMatch(/px-3/);
    expect(chipClass).toMatch(/py-1\.5/);
    expect(chipClass).toMatch(/text-xs/);
    expect(chipClass).toMatch(/font-semibold/);
    expect(chipClass).toMatch(/bg-brand-maroon-500/);
  });

  it('inactive slide does NOT render the Add-to-Cart chip', () => {
    render(
      <HomeHeroSlide
        slide={slide}
        isActive={false}
        isLcpCandidate={false}
        onAddToCart={onAddToCart}
        onOpenService={onOpenService}
      />,
    );

    expect(screen.queryByTestId('home-hero-add-to-cart')).toBeNull();
  });

  it('aria-hidden flips with isActive and tabIndex is set accordingly on the body link', () => {
    const { rerender } = render(
      <HomeHeroSlide
        slide={slide}
        isActive
        isLcpCandidate
        onAddToCart={onAddToCart}
        onOpenService={onOpenService}
      />,
    );

    const slideRoot = screen.getByTestId('home-hero-slide');
    expect(slideRoot.getAttribute('aria-hidden')).toBe('false');
    const link = screen.getByRole('button', {
      name: /view astaberry wine facial in facials/i,
    });
    expect(link.getAttribute('tabindex')).toBe('0');

    rerender(
      <HomeHeroSlide
        slide={slide}
        isActive={false}
        isLcpCandidate={false}
        onAddToCart={onAddToCart}
        onOpenService={onOpenService}
      />,
    );

    const slideRootInactive = screen.getByTestId('home-hero-slide');
    expect(slideRootInactive.getAttribute('aria-hidden')).toBe('true');
    // Inactive slide is aria-hidden, so query with { hidden: true } to reach
    // the inner link from the accessibility-hidden subtree.
    const inactiveLink = screen.getByRole('button', {
      name: /view astaberry wine facial in facials/i,
      hidden: true,
    });
    expect(inactiveLink.getAttribute('tabindex')).toBe('-1');
  });

  it('clicking the body invokes onOpenService; clicking the chip invokes onAddToCart without bubbling', () => {
    render(
      <HomeHeroSlide
        slide={slide}
        isActive
        isLcpCandidate
        onAddToCart={onAddToCart}
        onOpenService={onOpenService}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view astaberry wine facial in facials/i }));
    expect(onOpenService).toHaveBeenCalledWith('hero-slide-0', 'astaberry-wine-facial');
    expect(onAddToCart).not.toHaveBeenCalled();

    onOpenService.mockClear();
    fireEvent.click(screen.getByTestId('home-hero-add-to-cart'));
    expect(onAddToCart).toHaveBeenCalledWith('astaberry-wine-facial');
    // stopPropagation prevents the outer body click handler from firing.
    expect(onOpenService).not.toHaveBeenCalled();
  });

  it('LCP candidate slide renders priority image; non-candidates are lazy', () => {
    const { rerender } = render(
      <HomeHeroSlide
        slide={slide}
        isActive
        isLcpCandidate
        onAddToCart={onAddToCart}
        onOpenService={onOpenService}
      />,
    );
    const priorityImg = screen.getByTestId('home-hero-slide').querySelector('img');
    expect(priorityImg?.getAttribute('data-priority')).toBe('true');
    expect(priorityImg?.getAttribute('data-loading')).toBeNull();

    rerender(
      <HomeHeroSlide
        slide={slide}
        isActive={false}
        isLcpCandidate={false}
        onAddToCart={onAddToCart}
        onOpenService={onOpenService}
      />,
    );
    const lazyImg = screen.getByTestId('home-hero-slide').querySelector('img');
    expect(lazyImg?.getAttribute('data-priority')).toBeNull();
    expect(lazyImg?.getAttribute('data-loading')).toBe('lazy');
  });

  it('uses slide.alt when provided, falling back to slide.title for the image alt', () => {
    const slideWithAlt: HeroBannerSlide = { ...slide, alt: 'Woman receiving a wine facial' };
    render(
      <HomeHeroSlide
        slide={slideWithAlt}
        isActive
        isLcpCandidate
        onAddToCart={onAddToCart}
        onOpenService={onOpenService}
      />,
    );
    const img = screen.getByTestId('home-hero-slide').querySelector('img');
    expect(img?.getAttribute('alt')).toBe('Woman receiving a wine facial');
  });
});
