'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks the user's `prefers-reduced-motion` setting. Returns `true` when the
 * user has requested reduced motion (e.g. via OS accessibility settings).
 *
 * Listens for media-query changes so a mid-session preference flip propagates.
 * SSR-safe: returns `false` on the server, hydrates client-side.
 *
 * Compatibility: prefers `addEventListener` (Chrome/Firefox/Safari 14+) and
 * falls back to the deprecated `addListener` for Safari < 14.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  return reduced;
}
