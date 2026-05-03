/**
 * Hero banner seed data — maps 6 facial-category banners to real services
 * in `catalogServices`. Kept as a tiny read-only module so it can be
 * consumed by both the carousel UI and unit tests.
 *
 * All slugs MUST resolve to an entry in `catalogServices` — the companion
 * Vitest test prevents slug drift if `CATALOG.md` ever renames a service.
 */

import { catalogServices } from './glamornate-catalog';
import type { HomeService } from '@/lib/mock-data';

export interface HeroBannerSlide {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  serviceSlug: string;
  /**
   * Optional accessible image description. When omitted, consumers should
   * fall back to `title`. New clean hero surfaces (Phase 1) render the
   * image without painted-on text, so this is the only textual anchor for
   * screen readers describing the image.
   */
  alt?: string;
}

/**
 * Seeds (pre-id). Order defines carousel rotation order.
 * Keep this in sync with `public/images/hero-banners/*.webp`.
 */
const BANNER_SEEDS: ReadonlyArray<Omit<HeroBannerSlide, 'id'>> = [
  {
    image: '/images/hero-banners/astaberry-wine-facial.webp',
    title: 'Astaberry Wine Facial',
    subtitle: 'Radiant wine-infused glow',
    serviceSlug: 'astaberry-wine-facial',
  },
  {
    image: '/images/hero-banners/aroma-magic-fruit-facial.webp',
    title: 'Aroma Magic Fruit Facial',
    subtitle: 'Fresh fruit-infused care',
    serviceSlug: 'aroma-magic-fruit-facial',
  },
  {
    image: '/images/hero-banners/vlcc-skin-tightening-facial.webp',
    title: 'VLCC Skin Tightening',
    subtitle: 'Glow and lift',
    serviceSlug: 'vlcc-skin-tightening-facial',
  },
  {
    image: '/images/hero-banners/vlcc-insta-glow-facial.webp',
    title: 'VLCC Insta Glow Facial',
    subtitle: 'Instant radiance',
    serviceSlug: 'vlcc-insta-glow-facial',
  },
  {
    image: '/images/hero-banners/oxylife-professional-facial.webp',
    title: 'OxyLife Professional',
    subtitle: 'Oxygen-powered glow',
    serviceSlug: 'oxylife-professional-facial',
  },
  {
    image: '/images/hero-banners/vlcc-papaya-fruit-facial.webp',
    title: 'Papaya Glow Facial',
    subtitle: 'Gentle papaya care',
    serviceSlug: 'vlcc-papaya-fruit-facial',
  },
];

/**
 * Final slide list with derived stable ids (`hero-slide-N`).
 * Declared `as const` so each entry is treated as a literal by TS.
 */
export const HERO_BANNER_SLIDES: ReadonlyArray<HeroBannerSlide> = BANNER_SEEDS.map(
  (seed, index) => ({
    ...seed,
    id: `hero-slide-${index}`,
  }),
);

/**
 * Resolve a banner slug to its concrete `HomeService` record.
 * Returns `undefined` if the catalog no longer contains the slug —
 * callers should guard the result before reading fields.
 */
export function resolveHeroBannerService(slug: string): HomeService | undefined {
  return catalogServices.find((service) => service.slug === slug);
}
