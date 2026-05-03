'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { installDeepLinks } from '@/lib/deep-links';

/**
 * Phase 3 / M1: Mounts the Capacitor `appUrlOpen` listener once the
 * App Router `useRouter` hook is available in the client tree.
 *
 * Renders nothing. No-op on web (the underlying installer guards on
 * `Capacitor.isNativePlatform()`). Mirror of `PrivacyScreenWatcher`.
 */
export function DeepLinksInstaller(): null {
  const router = useRouter();

  useEffect(() => {
    installDeepLinks(router);
  }, [router]);

  return null;
}

export default DeepLinksInstaller;
