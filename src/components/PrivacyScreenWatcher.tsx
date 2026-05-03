'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { applyPrivacyScreen } from '@/lib/privacy-screen';

/**
 * Client-only watcher that toggles the native privacy-screen plugin
 * (FLAG_SECURE on Android) based on the current App Router pathname.
 *
 * Renders nothing. No-op on web. Safe if the plugin call fails.
 */
export function PrivacyScreenWatcher(): null {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) {
      return;
    }
    void applyPrivacyScreen(pathname);
  }, [pathname]);

  return null;
}

export default PrivacyScreenWatcher;
