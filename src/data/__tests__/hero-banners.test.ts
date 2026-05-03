import { describe, it, expect } from 'vitest';
import { HERO_BANNER_SLIDES, resolveHeroBannerService } from '../hero-banners';

describe('hero-banners seeds', () => {
  it('exposes exactly 6 slides with stable ids', () => {
    expect(HERO_BANNER_SLIDES).toHaveLength(6);
    HERO_BANNER_SLIDES.forEach((slide, index) => {
      expect(slide.id).toBe(`hero-slide-${index}`);
      expect(slide.serviceSlug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
      expect(slide.image).toMatch(/^\/images\/hero-banners\/.+\.webp$/);
    });
  });

  it.each(HERO_BANNER_SLIDES.map((s) => [s.serviceSlug]))(
    'slug %s resolves to a facials-category HomeService',
    (slug) => {
      const service = resolveHeroBannerService(slug);
      expect(service, `expected catalog entry for slug "${slug}"`).toBeDefined();
      expect(service!.categorySlug).toBe('facials');
      expect(service!.slug).toBe(slug);
      // Sanity: each resolved service should have a non-empty id and name.
      expect(service!.id).toMatch(/^svc-\d+$/);
      expect(service!.name.length).toBeGreaterThan(0);
    },
  );

  it('returns undefined for unknown slugs (no crash)', () => {
    expect(resolveHeroBannerService('nonexistent-service-slug')).toBeUndefined();
  });
});
