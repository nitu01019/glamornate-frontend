'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `true` only after the component has mounted on the client.
 *
 * Use in place of `suppressHydrationWarning` when a render value differs
 * between server and client (e.g. `new Date().getFullYear()`, locale-
 * dependent formatting, feature-flag gates derived from `window`).
 *
 * Pattern:
 * ```tsx
 * const mounted = useHasMounted();
 * if (!mounted) return <Placeholder />; // server-safe fallback
 * return <ClientOnlyContent />;
 * ```
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
