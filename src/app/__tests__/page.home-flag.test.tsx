/**
 * Unit tests for the Home page's Phase-1 feature-flag branching.
 *
 * As of the 2026-04-20 hotfix, the hero and category-grid blocks are gated
 * by independent flags:
 *   - `NEXT_PUBLIC_HOME_V2_HERO === '1'` → v2 hero (`HomeHeroCarousel`)
 *   - `NEXT_PUBLIC_HOME_V2_GRID === '1'` → v2 grid (`HomeCategoryGrid`)
 *
 * Verifies that `src/app/page.tsx`:
 *   - Renders the legacy `HeroBannerCarousel` + `CategoryTilesGrid` when both
 *     flags are unset or `'0'`.
 *   - Renders the new `HomeHeroCarousel` + `HomeCategoryGrid` when both flags
 *     are exactly `'1'`.
 *   - Renders the v2 hero alongside the legacy grid for the post-hotfix
 *     default (hero=1, grid=0).
 *   - Never renders both hero components (or both grid components) at once.
 *   - Preserves the canonical section order around the gated sections.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Every child component is mocked to a tiny marker element so we can assert
// which branch of the flag rendered without pulling in the full component
// implementations, React Query, providers, etc.
// ---------------------------------------------------------------------------

vi.mock('@/components/home/HeroBannerCarousel', () => ({
  default: () => <div data-testid="legacy-hero" />,
}));

vi.mock('@/components/home/HomeHeroCarousel', () => ({
  default: () => <div data-testid="v2-hero" />,
}));

vi.mock('@/components/home/EliteBanner', () => ({
  default: () => <div data-testid="elite-banner" />,
}));

vi.mock('@/components/home/CategoryTilesGrid', () => ({
  default: () => <div data-testid="legacy-grid" />,
}));

vi.mock('@/components/home/HomeCategoryGrid', () => ({
  default: ({ heading }: { heading?: string }) => (
    <div data-testid="v2-grid" data-heading={heading ?? ''} />
  ),
}));

vi.mock('@/components/home/HomePageClient', () => ({
  default: () => <div data-testid="home-page-client" />,
}));

vi.mock('@/components/home/PromoSection', () => ({
  default: () => <div data-testid="promo-section" />,
}));

vi.mock('@/components/home/BrandFooter', () => ({
  default: () => <div data-testid="brand-footer" />,
}));

vi.mock('@/components/home/HomeSkeletons', () => ({
  HeroBannerSkeleton: () => <div data-testid="skeleton-legacy-hero" />,
  HomeHeroCarouselSkeleton: () => <div data-testid="skeleton-v2-hero" />,
  CategoriesGridSkeleton: () => <div data-testid="skeleton-legacy-grid" />,
  HomeCategoryGridSkeleton: () => <div data-testid="skeleton-v2-grid" />,
  MostBookedSkeleton: () => <div data-testid="skeleton-most-booked" />,
  PromoBannerSkeleton: () => <div data-testid="skeleton-promo" />,
}));

const loadPage = async () => (await import('../page')).default;

describe('HomePage — NEXT_PUBLIC_HOME_V2_HERO / NEXT_PUBLIC_HOME_V2_GRID flags', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('renders the legacy hero and legacy grid when both flags are unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_HERO', '');
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_GRID', '');

    const HomePage = await loadPage();
    render(<HomePage />);

    expect(screen.getByTestId('legacy-hero')).toBeInTheDocument();
    expect(screen.getByTestId('legacy-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('v2-hero')).toBeNull();
    expect(screen.queryByTestId('v2-grid')).toBeNull();
  });

  it('renders the legacy hero and legacy grid when both flags are "0"', async () => {
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_HERO', '0');
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_GRID', '0');

    const HomePage = await loadPage();
    render(<HomePage />);

    expect(screen.getByTestId('legacy-hero')).toBeInTheDocument();
    expect(screen.getByTestId('legacy-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('v2-hero')).toBeNull();
    expect(screen.queryByTestId('v2-grid')).toBeNull();
  });

  it('renders the v2 hero and v2 grid when both flags are exactly "1"', async () => {
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_HERO', '1');
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_GRID', '1');

    const HomePage = await loadPage();
    render(<HomePage />);

    expect(screen.getByTestId('v2-hero')).toBeInTheDocument();
    expect(screen.getByTestId('v2-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-hero')).toBeNull();
    expect(screen.queryByTestId('legacy-grid')).toBeNull();
  });

  it('renders v2 hero AND legacy grid when hero=1 grid=0 (post-hotfix default)', async () => {
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_HERO', '1');
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_GRID', '0');

    const HomePage = await loadPage();
    render(<HomePage />);

    expect(screen.getByTestId('v2-hero')).toBeInTheDocument();
    expect(screen.getByTestId('legacy-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-hero')).toBeNull();
    expect(screen.queryByTestId('v2-grid')).toBeNull();
  });

  it('passes the "Explore all categories" heading to the v2 grid', async () => {
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_HERO', '1');
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_GRID', '1');

    const HomePage = await loadPage();
    render(<HomePage />);

    const grid = screen.getByTestId('v2-grid');
    expect(grid.getAttribute('data-heading')).toBe('Explore all categories');
  });

  it('preserves the canonical section order around the gated sections', async () => {
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_HERO', '1');
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_GRID', '1');

    const HomePage = await loadPage();
    const { container } = render(<HomePage />);

    const markerIds = [
      'v2-hero',
      'elite-banner',
      'v2-grid',
      'home-page-client',
      'promo-section',
      'brand-footer',
    ];

    const positions = markerIds.map((id) => {
      const node = container.querySelector(`[data-testid="${id}"]`);
      expect(node).not.toBeNull();
      return node ? Array.from(container.querySelectorAll('*')).indexOf(node) : -1;
    });

    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it('preserves section order when both flags are off (legacy path)', async () => {
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_HERO', '');
    vi.stubEnv('NEXT_PUBLIC_HOME_V2_GRID', '');

    const HomePage = await loadPage();
    const { container } = render(<HomePage />);

    const markerIds = [
      'legacy-hero',
      'elite-banner',
      'legacy-grid',
      'home-page-client',
      'promo-section',
      'brand-footer',
    ];

    const positions = markerIds.map((id) => {
      const node = container.querySelector(`[data-testid="${id}"]`);
      expect(node).not.toBeNull();
      return node ? Array.from(container.querySelectorAll('*')).indexOf(node) : -1;
    });

    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });
});
