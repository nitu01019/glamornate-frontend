'use client';

import { usePathname } from 'next/navigation';
import FloatingCartButton from '@/components/cart/FloatingCartButton';
import NetworkStatus from '@/components/ui/NetworkStatus';
import dynamic from 'next/dynamic';
// Phase 6: CartDrawer is now globally mounted so any page can open the cart
// sheet via `useCartStore.getState().openCart()` without a route change.
// Dynamic import keeps it out of the initial bundle (drawer is rare on first
// paint) and disables SSR because it depends on a localStorage-backed store.
const CartDrawer = dynamic(() => import('@/components/cart/CartDrawer'), { ssr: false });
const ChatBubble = dynamic(() => import('@/components/chat/ChatBubble'), { ssr: false });
const ChatWindow = dynamic(() => import('@/components/chat/ChatWindow'), { ssr: false });
import PopupManager from '@/components/popup/PopupManager';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';

/**
 * Global floating widgets rendered inside Providers.
 * - FloatingCartButton: visible when cart has items
 * - CartDrawer: bottom-sheet cart, visible when `useCartStore.isOpen` is true
 * - ChatBubble: always visible (bottom-left)
 * - ChatWindow: visible when chat isOpen state is true
 *
 * Also mounts the Android hardware back-button handler. The hook is a no-op
 * on web and only attaches a Capacitor listener when running as a native app.
 *
 * Hidden on auth pages where these widgets are not relevant.
 */
export default function GlobalWidgets() {
  const pathname = usePathname();
  useAndroidBackButton();

  if (pathname?.startsWith('/auth')) {
    return null;
  }

  return (
    <>
      <NetworkStatus />
      <FloatingCartButton />
      <CartDrawer />
      <ChatBubble />
      <ChatWindow />
      <PopupManager />
    </>
  );
}
