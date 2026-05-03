/**
 * M-NOTIFY recovery (2026-04-25): real implementation restored from iCloud
 * ghost during Phase 1 stabilisation. The previous body was a placeholder stub
 * left after `git clean -fd` lost the original; this version reinstates the
 * `useLayoutEffect` reduced-motion branch and the JSDOM fallback path.
 */
'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface UseInViewOnceOptions {
  /** Fraction of element that must be visible to trigger. Default: 0.1 */
  readonly threshold?: number;
  /** Margin around root. Default: '0px' */
  readonly rootMargin?: string;
  /**
   * When `true`, users with `prefers-reduced-motion: reduce` skip the observer
   * and get `hasEntered: true` synchronously on first mount. Default: `false`
   * (preserves the existing call-site contract).
   */
  readonly reducedMotionDefault?: boolean;
}

export interface UseInViewOnceResult {
  /** Attach to the target element via `ref={ref}`. */
  readonly ref: React.RefObject<HTMLElement | null>;
  /** True once the element has entered the viewport (stays true once flipped). */
  readonly hasEntered: boolean;
}

/**
 * One-shot IntersectionObserver hook.
 *
 * Returns `{ ref, hasEntered }`. `hasEntered` flips to `true` the first time
 * the referenced element enters the viewport and stays true (does not reset).
 * Honors `prefers-reduced-motion` when `reducedMotionDefault` is true.
 */
export function useInViewOnce(options: UseInViewOnceOptions = {}): UseInViewOnceResult {
  const { threshold = 0.1, rootMargin = '0px', reducedMotionDefault = false } = options;

  const ref = useRef<HTMLElement | null>(null);
  const [hasEntered, setHasEntered] = useState(false);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    if (reducedMotionDefault && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mql.matches) {
        setHasEntered(true);
        return;
      }
    }

    if (typeof IntersectionObserver === 'undefined') {
      setHasEntered(true);
      return;
    }
  }, [reducedMotionDefault]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasEntered) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasEntered(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [hasEntered, threshold, rootMargin]);

  return { ref, hasEntered };
}
