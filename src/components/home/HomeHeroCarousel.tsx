'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { HERO_BANNER_SLIDES, resolveHeroBannerService } from '@/data/hero-banners';
import { useCartStore } from '@/store/cart';
import { useToastActions } from '@/lib/providers';
import { logHomeHeroView } from '@/lib/analytics/home-events';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import HomeHeroSlide from './HomeHeroSlide';

const AUTOPLAY_MS = 4500;
const SWIPE_THRESHOLD_PX = 50;
const FACIALS_ROUTE = '/services/category/facials';

/**
 * Clamp a signed slide offset so we rotate via the shortest path around
 * the carousel. For N total slides, offsets > N/2 wrap to negative.
 */
function normalizeOffset(rawOffset: number, total: number): number {
  const half = total / 2;
  if (rawOffset > half) return rawOffset - total;
  if (rawOffset < -half) return rawOffset + total;
  return rawOffset;
}

/**
 * HomeHeroCarousel — the clean Phase 1 Home hero.
 *
 * Contract (PHASE_1.md §3.1):
 * - Image-only slides (no painted text, no dark scrim).
 * - Compact Add-to-Cart chip bottom-right (see `HomeHeroSlide`).
 * - Autoplay 4500 ms; paused on hover, focus, swipe, and when the user
 *   prefers reduced motion.
 * - Arrow-key navigation when the carousel region has focus.
 * - `role="region"` + `aria-roledescription="carousel"` + polite live
 *   announcer for slide changes.
 */
export default function HomeHeroCarousel() {
  const slides = HERO_BANNER_SLIDES;
  const total = slides.length;
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const toast = useToastActions();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  const activeSlide = slides[activeIndex];

  const goTo = useCallback(
    (next: number) => {
      setActiveIndex(((next % total) + total) % total);
    },
    [total],
  );

  const advance = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const retreat = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  // Autoplay — suspended when paused or when the user prefers reduced motion.
  useEffect(() => {
    if (prefersReducedMotion || isPaused) return;
    const timer = window.setInterval(advance, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [advance, isPaused, prefersReducedMotion]);

  // One-shot hero impression on mount.
  useEffect(() => {
    logHomeHeroView({ slideCount: total });
  }, [total]);

  // Keyboard: arrow keys cycle slides when the carousel region has focus.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        advance();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        retreat();
      }
    };
    node.addEventListener('keydown', handler);
    return () => node.removeEventListener('keydown', handler);
  }, [advance, retreat]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    setIsPaused(true);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    setIsPaused(false);
    if (startX == null) return;
    const endX = event.changedTouches[0]?.clientX;
    if (endX == null) return;
    const delta = endX - startX;
    if (delta <= -SWIPE_THRESHOLD_PX) advance();
    else if (delta >= SWIPE_THRESHOLD_PX) retreat();
  };

  const handleOpenService = useCallback(
    (_slideId: string, serviceSlug: string) => {
      const service = resolveHeroBannerService(serviceSlug);
      if (service) {
        router.push(`${FACIALS_ROUTE}#${service.id}`);
      } else {
        router.push(FACIALS_ROUTE);
      }
    },
    [router],
  );

  const handleAddToCart = useCallback(
    (serviceSlug: string) => {
      const service = resolveHeroBannerService(serviceSlug);
      if (!service) {
        toast.error(
          'Service unavailable',
          'Please try another from the facials section.',
        );
        router.push(FACIALS_ROUTE);
        return;
      }
      addItem({
        serviceId: service.id,
        serviceName: service.name,
        categoryName: service.category,
        subcategory: service.subcategory ?? '',
        price: service.basePrice,
        originalPrice: service.originalPrice ?? service.basePrice,
        discount: service.discountPercent ?? 0,
        duration: service.durationMinutes,
        image: service.image,
      });
      toast.success('Added to cart', service.name);
      router.push(FACIALS_ROUTE);
    },
    [addItem, router, toast],
  );

  // Precompute per-slide transform / opacity so the JSX stays readable.
  const slideStyles = useMemo<CSSProperties[]>(() => {
    return slides.map((_, index) => {
      const rawOffset = index - activeIndex;
      const offset = normalizeOffset(rawOffset, total);
      const isActive = offset === 0;
      if (prefersReducedMotion) {
        return {
          transform: 'none',
          opacity: isActive ? 1 : 0,
          pointerEvents: isActive ? 'auto' : 'none',
          zIndex: isActive ? 3 : 0,
          transition: 'opacity 0.2s linear',
        };
      }
      return {
        transform: `translateX(${offset * 90}%) translateZ(${isActive ? 0 : -200}px) rotateY(${offset * -18}deg)`,
        opacity: isActive ? 1 : 0.25,
        pointerEvents: isActive ? 'auto' : 'none',
        zIndex: isActive ? 3 : 2 - Math.abs(offset),
        transition:
          'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.5s ease',
      };
    });
  }, [activeIndex, prefersReducedMotion, slides, total]);

  return (
    <section
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured facials"
      tabIndex={0}
      data-testid="home-hero"
      className="px-4 pt-3 pb-4 focus-visible:outline-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div
        className="relative w-full aspect-[16/9] rounded-tile overflow-hidden shadow-tile-md bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-maroon-500"
        style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {slides.map((slide, index) => {
          // Only the VERY FIRST slide (index 0) gets `priority` — that's the
          // LCP candidate. Everything else lazy-loads, regardless of which
          // slide happens to be active at render time.
          const isLcpCandidate = index === 0;
          return (
            <HomeHeroSlide
              key={slide.id}
              slide={slide}
              isActive={index === activeIndex}
              isLcpCandidate={isLcpCandidate}
              style={slideStyles[index]}
              onAddToCart={handleAddToCart}
              onOpenService={handleOpenService}
            />
          );
        })}

        {/* aria-live announcer for the active slide — screen-reader only. */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {`Slide ${activeIndex + 1} of ${total}: ${activeSlide?.title ?? ''}`}
        </div>

        {/* Dot indicators — centered, do not collide with the bottom-right CTA. */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
          {slides.map((slide, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={`dot-${slide.id}`}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={isActive ? 'true' : 'false'}
                className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-400 ${
                  isActive ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/75'
                }`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
