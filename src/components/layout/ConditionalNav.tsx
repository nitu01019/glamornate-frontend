'use client';

import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';
import HomeLocationRow from '@/components/home/HomeLocationRow';

/**
 * Conditionally renders the customer-facing chrome on every customer route.
 *
 * Customer routes get `AppHeader` (sparkle-logo + animated wordmark + bell +
 * Sign-In / avatar). The HOME route `/` additionally gets `HomeLocationRow`
 * (address strip) pinned directly under the header. Other customer routes
 * (services, cart, bookings, account, etc.) show only the header — the
 * address strip is a home-screen-only affordance.
 *
 * Portal routes (`/spa/*`, `/admin/*`) and the auth flow (`/auth/*`) provide
 * their own chrome, so this wrapper hides the global nav for those paths.
 */
export default function ConditionalNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const hideGlobalNav =
    pathname?.startsWith('/admin') || pathname?.startsWith('/spa') || pathname?.startsWith('/auth');
  const isHome = pathname === '/';

  // AppHeader is fixed (56px). HomeLocationRow is fixed (56px) only on /.
  // Reserve pt-28 (112px) on home; pt-14 (56px) on every other customer route.
  const mainSpacing = hideGlobalNav ? '' : isHome ? 'pt-28 pb-20' : 'pt-14 pb-20';

  return (
    <>
      {!hideGlobalNav && <AppHeader />}
      {!hideGlobalNav && isHome && <HomeLocationRow />}
      <main id="main-content" className={mainSpacing}>
        {children}
      </main>
      {!hideGlobalNav && <BottomNav />}
    </>
  );
}
