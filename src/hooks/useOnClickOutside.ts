'use client';

import { useEffect, type RefObject } from 'react';

type AnyEvent = MouseEvent | TouchEvent;

/**
 * Fires `handler` when a pointer (mouse or touch) event occurs outside the
 * element referenced by `ref`.
 *
 * Typical usage is closing a dropdown / popover when the user clicks off of
 * it. The effect subscribes to `mousedown` + `touchstart` (covering mobile
 * tap-away) and unregisters on unmount.
 *
 * If `enabled` is `false` the listener is not attached — useful for avoiding
 * extra work when the menu is already closed.
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useOnClickOutside(ref, () => setOpen(false), open);
 * ```
 */
export function useOnClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null>,
  handler: (event: AnyEvent) => void,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    const listener = (event: AnyEvent): void => {
      const el = ref.current;
      // Do nothing if clicking ref's element or descendent elements.
      if (!el || el.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler, enabled]);
}
