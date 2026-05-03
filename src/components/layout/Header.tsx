'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-provider';
import { useIsScrolled } from '@/hooks/useScrollPosition';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import {
  Sparkles,
  Menu,
  X,
  ChevronDown,
  User,
  LayoutDashboard,
  Calendar,
  Settings,
  LogOut,
  Store,
  BarChart3,
  Users,
} from 'lucide-react';

interface HeaderProps {
  variant?: 'public' | 'customer' | 'spa' | 'admin';
  isTransparent?: boolean;
}

export default function Header({ variant = 'public', isTransparent = false }: HeaderProps) {
  const pathname = usePathname();
  const { user, isAuthenticated, signOut, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Scroll-past-threshold for sticky-header styling (extracted to useScrollPosition).
  const isScrolled = useIsScrolled(20);

  // Close user menu when clicking outside (extracted to useOnClickOutside).
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);
  useOnClickOutside(userMenuRef, closeUserMenu, userMenuOpen);

  // Close mobile menu on route change — genuine reactive side effect.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navItems = {
    public: [
      { href: '/spas', label: 'Spas' },
      { href: '/services', label: 'Services' },
      { href: '/about', label: 'About' },
    ],
    customer: [
      { href: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/customer/bookings', label: 'Bookings', icon: Calendar },
      { href: '/customer/history', label: 'History', icon: Calendar },
    ],
    spa: [
      { href: '/spa/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/spa/bookings', label: 'Bookings', icon: Calendar },
      { href: '/spa/services', label: 'Services', icon: Store },
      { href: '/spa/staff', label: 'Staff', icon: Users },
    ],
    admin: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/spas', label: 'Partners', icon: Store },
      { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
    ],
  };

  const currentNav = navItems[variant];

  // Get user dropdown menu items based on role
  const getUserMenuItems = () => {
    const baseItems = [
      { href: '/customer/profile', label: 'Profile', icon: User },
      { href: '/customer/bookings', label: 'My Bookings', icon: Calendar },
    ];

    if (user?.role === 'admin') {
      return [
        { href: '/admin/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
        ...baseItems,
      ];
    }
    if (user?.role === 'spa_owner' || user?.role === 'spa_staff') {
      return [
        { href: '/spa/dashboard', label: 'Spa Dashboard', icon: LayoutDashboard },
        ...baseItems,
      ];
    }
    return [
      { href: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ...baseItems,
    ];
  };

  // Determine header style based on scroll and transparency
  const headerClasses = isTransparent && !isScrolled
    ? 'bg-transparent border-transparent'
    : 'glass-header shadow-sm';

  const textClasses = isTransparent && !isScrolled
    ? 'text-white'
    : 'text-gray-900';

  const textMutedClasses = isTransparent && !isScrolled
    ? 'text-white/80 hover:text-white'
    : 'text-gray-600 hover:text-gray-900';

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    window.location.href = '/';
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerClasses}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative w-9 h-9 bg-gradient-to-br from-brand-gold-400 to-brand-maroon-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-maroon-500/20 group-hover:shadow-brand-maroon-500/40 transition-shadow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className={`text-xl font-serif font-semibold ${isTransparent && !isScrolled ? 'text-white' : 'gradient-text-premium'}`}>
              Glamornate
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {currentNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? isTransparent && !isScrolled
                      ? 'text-white'
                      : 'text-brand-maroon-600'
                    : textMutedClasses
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-4">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : isAuthenticated && user ? (
              /* Logged In - User Menu */
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                    isTransparent && !isScrolled
                      ? 'hover:bg-white/10'
                      : 'hover:bg-gray-100'
                  }`}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-maroon-400 to-brand-gold-400 flex items-center justify-center text-white text-sm font-medium shadow-md">
                    {user.profile?.displayName?.charAt(0) || 'U'}
                  </div>
                  <span className={`text-sm font-medium hidden lg:block ${textClasses}`}>
                    {user.profile?.displayName?.split(' ')[0] || 'User'}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${userMenuOpen ? 'rotate-180' : ''} ${textMutedClasses}`} />
                </button>

                {/* User Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-scale-in origin-top-right">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {user.profile?.displayName || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {user.profile?.email}
                      </p>
                      {user.role && user.role !== 'customer' && (
                        <span className="inline-flex items-center mt-2 px-2 py-0.5 text-xs font-medium rounded-full bg-brand-gold-100 text-brand-gold-700 capitalize">
                          {user.role.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      {getUserMenuItems().map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-maroon-50 hover:text-brand-maroon-600 transition-colors"
                        >
                          <item.icon className="w-4 h-4" />
                          {item.label}
                        </Link>
                      ))}
                    </div>

                    {/* Settings & Logout */}
                    <div className="border-t border-gray-100 pt-1">
                      <Link
                        href="/customer/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-maroon-50 hover:text-brand-maroon-600 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-maroon-50 hover:text-brand-maroon-600 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Not Logged In */
              <>
                <Link href="/auth/login">
                  <Button
                    variant="ghost"
                    className={textMutedClasses}
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button className="btn-gradient rounded-xl px-6">
                    Book Now
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className={`md:hidden p-2 rounded-lg transition-colors ${
              isTransparent && !isScrolled
                ? 'text-white hover:bg-white/10'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white z-50 transform transition-transform duration-300 ease-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Mobile Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <Link href="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
              <div className="w-8 h-8 bg-gradient-to-br from-brand-gold-400 to-brand-maroon-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-serif font-semibold gradient-text-premium">
                Glamornate
              </span>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile User Info */}
          {isAuthenticated && user && (
            <div className="p-4 bg-brand-maroon-50 border-b border-brand-maroon-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-maroon-400 to-brand-gold-400 flex items-center justify-center text-white text-lg font-medium shadow-md">
                  {user.profile?.displayName?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {user.profile?.displayName || 'User'}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {user.profile?.email}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {currentNav.map((item) => {
                const Icon = 'icon' in item ? item.icon : null;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      pathname === item.href
                        ? 'bg-brand-maroon-50 text-brand-maroon-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {Icon && <Icon className="w-5 h-5" />}
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Additional Links for Authenticated Users */}
            {isAuthenticated && user && (
              <div className="mt-6 pt-6 border-t border-gray-100 space-y-1">
                <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Account
                </p>
                {getUserMenuItems().map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      pathname === item.href
                        ? 'bg-brand-maroon-50 text-brand-maroon-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </nav>

          {/* Mobile Menu Footer */}
          <div className="p-4 border-t border-gray-100 space-y-3">
            {isAuthenticated ? (
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full border-brand-maroon-200 text-brand-maroon-600 hover:bg-brand-maroon-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            ) : (
              <>
                <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)} className="block">
                  <Button variant="outline" className="w-full border-gray-200">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/register" onClick={() => setMobileMenuOpen(false)} className="block">
                  <Button className="w-full btn-gradient">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
