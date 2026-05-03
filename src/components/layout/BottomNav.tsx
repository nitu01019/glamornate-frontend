'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Scissors, ShoppingBag, CalendarDays, User } from 'lucide-react';
import { useUpcomingBookings } from '@/hooks/useBookings';
import { useAuth } from '@/lib/auth-provider';
import { useCartStore } from '@/store/cart';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/services', label: 'Services', icon: Scissors },
  { href: '/cart', label: 'Cart', icon: ShoppingBag },
  { href: '/customer/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/account', label: 'Account', icon: User },
];

// Routes where bottom nav should be hidden
const hiddenRoutes = [
  '/auth',
  '/admin',
  '/spa/dashboard',
  '/spa/bookings',
  '/spa/services',
  '/spa/staff',
];

export default function BottomNav() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { data: upcomingBookings } = useUpcomingBookings();

  // Defer cart count to client-only to avoid SSR/client hydration mismatch
  // (Zustand persisted store reads from localStorage which doesn't exist on the server)
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);
  const storeCount = useCartStore((s) => s.getItemCount());
  const cartItemCount = hasMounted ? storeCount : 0;

  // Check if we should hide the bottom nav
  const shouldHide = hiddenRoutes.some((route) => pathname.startsWith(route));
  if (shouldHide) return null;

  // Defer auth-dependent booking count to client-only
  const bookingCount = hasMounted && isAuthenticated ? (upcomingBookings?.length || 0) : 0;

  // Check if a nav item is active
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav aria-label="Bottom navigation" className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-100 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-200 active:scale-90 ${
                active ? 'text-brand-maroon-500' : 'text-gray-400'
              }`}
            >
              {/* Active top bar indicator */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-maroon-500 rounded-full" />
              )}

              <div className="relative">
                <Icon
                  className={`w-[22px] h-[22px] transition-all duration-200 ${
                    active ? 'stroke-[2.5px]' : 'stroke-[1.5px]'
                  }`}
                  fill={active ? 'currentColor' : 'none'}
                  fillOpacity={active ? 0.15 : 0}
                />
                {/* Badge for Cart */}
                {item.href === '/cart' && cartItemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-brand-maroon-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-scale-in">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
                {/* Badge for Bookings */}
                {item.href === '/customer/bookings' && bookingCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-brand-maroon-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-scale-in">
                    {bookingCount > 9 ? '9+' : bookingCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-1 transition-all duration-200 ${
                  active ? 'font-semibold text-brand-maroon-500' : 'font-medium text-gray-400'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
