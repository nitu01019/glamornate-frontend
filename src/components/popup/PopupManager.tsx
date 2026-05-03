'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { usePopupStore } from '@/store/popup';
import PromoPopup from '@/components/popup/PromoPopup';

export default function PopupManager() {
  const pathname = usePathname();
  const showPopup = usePopupStore((state) => state.showPopup);
  const dismissPopup = usePopupStore((state) => state.dismissPopup);
  const checkAndShowPopup = usePopupStore((state) => state.checkAndShowPopup);

  useEffect(() => {
    checkAndShowPopup();
  }, [checkAndShowPopup]);

  // Dismiss the promo popup on every route change so it can never follow the
  // user across navigations and silently block clicks on the next page.
  // Re-entry to `/` can re-trigger `checkAndShowPopup` which respects the
  // sessionStorage flag set by `dismissPopup`.
  useEffect(() => {
    if (showPopup) {
      dismissPopup();
    }
    // We intentionally only react to `pathname` changes here — including
    // `showPopup`/`dismissPopup` would cause the popup to dismiss itself the
    // instant it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally omitted: adding `showPopup`/`dismissPopup` would dismiss the popup immediately after it opens (self-cancelling loop)
  }, [pathname]);

  // Intercept the Android hardware back button while a promo popup is open
  // so that pressing back dismisses the popup instead of navigating away.
  useEffect(() => {
    if (!showPopup) return;
    const handler = (event: Event): void => {
      event.preventDefault();
      dismissPopup();
    };
    window.addEventListener('glamornate:back-button', handler);
    return () => window.removeEventListener('glamornate:back-button', handler);
  }, [showPopup, dismissPopup]);

  if (!showPopup) return null;

  return <PromoPopup onDismiss={dismissPopup} />;
}
