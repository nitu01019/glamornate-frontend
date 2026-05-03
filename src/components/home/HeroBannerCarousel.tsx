'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { HERO_BANNER_SLIDES, resolveHeroBannerService } from '@/data/hero-banners';
import { useCartStore } from '@/store/cart';
import { useToastActions } from '@/lib/providers';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

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
 * @deprecated Use HomeHeroCarousel behind NEXT_PUBLIC_HOME_V2_GRID. Will be
 * removed after flag flip.
 */
export default function HeroBannerCarousel() {
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

  // Autoplay — suspended when paused or when user prefers reduced motion.
  useEffect(() => {
    if (prefersReducedMotion || isPaused) return;
    const timer = window.setInterval(advance, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [advance, isPaused, prefersReducedMotion]);

  // Keyboard: arrow keys cycle slides when carousel is focused.
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

  const handleBodyTap = useCallback(
    (slideId: string, serviceSlug: string) => {
      const service = resolveHeroBannerService(serviceSlug);
      if (service) {
        router.push(`${FACIALS_ROUTE}#${service.id}`);
      } else {
        router.push(FACIALS_ROUTE);
      }
      // Reference slideId so linting doesn't complain if we ever expand analytics.
      void slideId;
    },
    [router],
  );

  const handleAddToCart = useCallback(
    (serviceSlug: string) => {
      const service = resolveHeroBannerService(serviceSlug);
      if (!service) {
        toast.error('Service unavailable', 'Please try another from the facials section.');
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
  const slideStyles = useMemo(() => {
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
        } as React.CSSProperties;
      }
      return {
        transform: `translateX(${offset * 90}%) translateZ(${isActive ? 0 : -200}px) rotateY(${offset * -18}deg)`,
        opacity: isActive ? 1 : 0.25,
        pointerEvents: isActive ? 'auto' : 'none',
        zIndex: isActive ? 3 : 2 - Math.abs(offset),
        transition: 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.5s ease',
      } as React.CSSProperties;
    });
  }, [activeIndex, prefersReducedMotion, slides, total]);

  return (
    <section
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured facials"
      tabIndex={0}
      className="px-4 pb-2 focus-visible:outline-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div
        className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-card-md focus-visible:ring-2 focus-visible:ring-brand-maroon-500"
        style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={slide.id}
              className="absolute inset-0 rounded-2xl overflow-hidden"
              style={slideStyles[index]}
              aria-hidden={!isActive}
            >
              <button
                type="button"
                onClick={() => handleBodyTap(slide.id, slide.serviceSlug)}
                className="relative block w-full h-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500"
                aria-label={`View ${slide.title} in facials`}
                tabIndex={isActive ? 0 : -1}
              >
                <Image
                  src={slide.image}
                  alt={slide.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                  priority={isActive}
                  fetchPriority={isActive ? 'high' : undefined}
                  loading={isActive ? undefined : 'lazy'}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent" />

                <div className="absolute inset-0 z-10 flex flex-col justify-end px-6 pb-6">
                  <p className="text-white/80 text-xs font-medium tracking-wide uppercase mb-1">
                    Featured Facial
                  </p>
                  <h3 className="text-white text-2xl font-bold leading-tight mb-1">
                    {slide.title}
                  </h3>
                  <p className="text-white/70 text-sm mb-3">{slide.subtitle}</p>
                </div>
              </button>

              {isActive && (
                <div className="absolute bottom-6 right-6 z-20">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleAddToCart(slide.serviceSlug);
                    }}
                    className="inline-flex items-center gap-2 bg-brand-maroon-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-maroon-600 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-400"
                    aria-label={`Add ${slide.title} to cart`}
                  >
                    Add to Cart
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* aria-live announcer for active slide title */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {`Slide ${activeIndex + 1} of ${total}: ${activeSlide?.title ?? ''}`}
        </div>

        {/* Dot indicators */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
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
