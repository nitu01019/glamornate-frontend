'use client';

import Image from 'next/image';
import { Plus } from 'lucide-react';
import { useEffect, type CSSProperties } from 'react';
import type { HeroBannerSlide } from '@/data/hero-banners';
import { cn } from '@/lib/utils';
import { logHomeAddToCartChipClick, logHomeHeroSlideView } from '@/lib/analytics/home-events';

export interface HomeHeroSlideProps {
  readonly slide: HeroBannerSlide;
  readonly isActive: boolean;
  /**
   * Only the first-ever slide (index 0) must receive `priority` so that
   * next/image can hint the browser to preload it as the LCP candidate.
   * All other slides — including later-activated ones — must use
   * `loading="lazy"` to avoid contending for the LCP slot.
   */
  readonly isLcpCandidate: boolean;
  readonly style?: CSSProperties;
  readonly onAddToCart: (serviceSlug: string) => void;
  readonly onOpenService: (slideId: string, serviceSlug: string) => void;
}

/**
 * A single slide in the clean Home hero carousel.
 *
 * Contract (Phase 1, §3.2):
 * - Renders image + (on the active slide) an Add-to-Cart chip.
 * - ZERO painted-on text inside the image container.
 * - Add-to-Cart chip is absolutely positioned at `bottom-5 right-5`,
 *   `min-h-[44px] min-w-[44px]` (WCAG AA tap target), `rounded-xl`,
 *   `px-3 py-1.5`, `text-xs font-semibold`, maroon brand color.
 * - No gradient scrim darker than `from-black/30` touches the upper 60%
 *   of the image. (We render no overlay at all on the image.)
 */
export default function HomeHeroSlide({
  slide,
  isActive,
  isLcpCandidate,
  style,
  onAddToCart,
  onOpenService,
}: HomeHeroSlideProps) {
  // Accessible image description: alt if provided, else the slide title.
  // The title itself is NOT painted on the image; it only reaches users
  // through the image alt + the button aria-label.
  const accessibleName = slide.alt ?? slide.title;

  // Fire `home_hero_slide_view` whenever this slide becomes the active one.
  // Analytics is no-op SSR-safe and swallows its own errors, so this is
  // safe to run unconditionally in effect.
  useEffect(() => {
    if (isActive) {
      logHomeHeroSlideView(slide.id);
    }
  }, [isActive, slide.id]);

  return (
    <div
      data-testid="home-hero-slide"
      data-slide-id={slide.id}
      className={cn('absolute inset-0 rounded-tile overflow-hidden', isActive ? 'z-30' : 'z-20')}
      style={style}
      aria-hidden={!isActive}
    >
      <button
        type="button"
        onClick={() => onOpenService(slide.id, slide.serviceSlug)}
        className="relative block w-full h-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500"
        aria-label={`View ${slide.title} in facials`}
        tabIndex={isActive ? 0 : -1}
      >
        <Image
          src={slide.image}
          alt={accessibleName}
          fill
          sizes="(max-width: 768px) 100vw, 600px"
          className="object-cover"
          priority={isLcpCandidate}
          fetchPriority={isLcpCandidate ? 'high' : undefined}
          loading={isLcpCandidate ? undefined : 'lazy'}
        />
        {/*
          NO painted title/subtitle overlay.
          NO dark gradient covering the image — the model's face stays visible.
        */}
      </button>

      {isActive && (
        <div className="absolute bottom-5 right-5 z-40">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              logHomeAddToCartChipClick(slide.serviceSlug);
              onAddToCart(slide.serviceSlug);
            }}
            data-testid="home-hero-add-to-cart"
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-maroon-500 text-white shadow-maroon transition-all hover:bg-brand-maroon-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-400"
            aria-label={`Add ${slide.title} to cart`}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Add to Cart
          </button>
        </div>
      )}
    </div>
  );
}
