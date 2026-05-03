'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks the window's vertical scroll position.
 *
 * Returns the current `window.scrollY` (0 during SSR / before mount).
 *
 * The listener is registered passively for scroll-performance parity with a
 * raw `addEventListener`, and is torn down on unmount. A consumer can pass a
 * `threshold` helper via `useIsScrolled` if they only care about
 * "has-scrolled-past-X" boolean state.
 *
 * @example
 * ```tsx
 * const scrollY = useScrollPosition();
 * const isScrolled = scrollY > 20;
 * ```
 */
export function useScrollPosition(): number {
  const [scrollY, setScrollY] = useState<number>(0);

  useEffect(() => {
    const handleScroll = (): void => {
      setScrollY(window.scrollY);
    };

    // Seed initial value on mount (may be non-zero if route restored a scroll).
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return scrollY;
}

/**
 * Convenience boolean variant of {@link useScrollPosition}: returns `true`
 * once the viewport has scrolled past `threshold` pixels.
 *
 * Internally still uses a single scroll listener per mount.
 *
 * @param threshold Pixels of Y-scroll before the boolean flips.
 */
export function useIsScrolled(threshold = 0): boolean {
  const [isScrolled, setIsScrolled] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = (): void => {
      setIsScrolled(window.scrollY > threshold);
    };

    // Seed initial value on mount.
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return isScrolled;
}
