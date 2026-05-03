'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import { useUnreadCount } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import AnimatedBrandName from '@/components/layout/AnimatedBrandName';
import { cn } from '@/lib/utils';

// Routes where app header should be hidden
const hiddenRoutes = [
  '/auth',
  '/admin',
  '/spa/dashboard',
  '/spa/bookings',
  '/spa/services',
  '/spa/staff',
];

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated: rawIsAuth, isLoading } = useAuth();
  const { count: rawUnreadCount } = useUnreadCount();
  const [isScrolled, setIsScrolled] = useState(false);
  const isHomePage = pathname === '/';

  // Defer client-only state to prevent SSR hydration mismatch
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  const unreadCount = hasMounted ? rawUnreadCount : 0;
  const isAuthenticated = hasMounted ? rawIsAuth : false;

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check if we should hide the header
  const shouldHide = hiddenRoutes.some((route) => pathname.startsWith(route));
  if (shouldHide) return null;

  const userInitial = user?.profile?.displayName?.charAt(0) || 'G';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-gray-100'
          : 'bg-white/80 backdrop-blur-lg'
      }`}
    >
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        {/* Left: Back button (non-home) + Brand lockup (no location chip) */}
        <div className="flex items-center gap-2">
          {!isHomePage && (
            <button
              type="button"
              onClick={() => router.back()}
              className={cn(
                'p-2 text-gray-600 hover:text-gray-900',
                'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-500',
                'transition-colors',
              )}
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <Link href="/" className="flex items-center gap-2" aria-label="Glamornate home">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-gold-400 to-brand-maroon-500 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <AnimatedBrandName />
          </Link>
        </div>

        {/* Right: Bell (always) + Avatar or Sign In (swap on auth state) */}
        <div className="flex items-center gap-3">
          {/* Notification Bell — always visible. Unauth users tap-through to login. */}
          <Link
            href={isAuthenticated ? '/customer/notifications' : '/auth/login'}
            className="relative p-2 -m-2"
            aria-label="Notifications"
            data-testid="app-header-bell"
          >
            <Bell className="w-5 h-5 text-gray-600 hover:text-brand-maroon-600 transition-colors" />
            {isAuthenticated && unreadCount > 0 && (
              <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 bg-brand-maroon-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          {isLoading ? (
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
          ) : isAuthenticated ? (
            <Link href="/customer/profile" className="flex items-center gap-2" aria-label="Account">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-maroon-400 to-brand-gold-400 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                {userInitial}
              </div>
            </Link>
          ) : (
            <Link href="/auth/login">
              <Button
                size="sm"
                className="bg-gradient-to-r from-brand-gold-500 to-brand-maroon-500 hover:from-brand-gold-600 hover:to-brand-maroon-600 text-white rounded-full px-4 text-sm font-medium shadow-md"
              >
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
