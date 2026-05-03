'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-provider';
import {
  Sparkles,
  LayoutDashboard,
  Calendar,
  Clock,
  Heart,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Store,
  Users,
  BarChart3,
  Briefcase,
  FileText,
  HelpCircle,
  Menu,
  X,
} from 'lucide-react';

interface SidebarProps {
  variant: 'customer' | 'spa' | 'admin';
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

export default function Sidebar({ variant }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Navigation items based on variant
  const navigationSections: Record<string, NavSection[]> = {
    customer: [
      {
        items: [
          { href: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/customer/book-new', label: 'Book Now', icon: Calendar },
          { href: '/customer/bookings', label: 'My Bookings', icon: Clock, badge: 2 },
          { href: '/customer/history', label: 'History', icon: FileText },
        ],
      },
      {
        title: 'Account',
        items: [
          { href: '/customer/favorites', label: 'Favorites', icon: Heart },
          { href: '/customer/profile', label: 'Profile', icon: User },
        ],
      },
    ],
    spa: [
      {
        items: [
          { href: '/spa/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/spa/bookings', label: 'Bookings', icon: Calendar, badge: 5 },
        ],
      },
      {
        title: 'Management',
        items: [
          { href: '/spa/services', label: 'Services', icon: Briefcase },
          { href: '/spa/staff', label: 'Staff', icon: Users },
        ],
      },
    ],
    admin: [
      {
        items: [
          { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/admin/users', label: 'Users', icon: Users, badge: 12 },
          { href: '/admin/spas', label: 'Spas', icon: Store },
        ],
      },
      {
        title: 'Reports',
        items: [{ href: '/admin/reports', label: 'Analytics', icon: BarChart3 }],
      },
    ],
  };

  const sections = navigationSections[variant] || navigationSections.customer;

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  // Get role badge
  const getRoleBadge = () => {
    switch (user?.role) {
      case 'admin':
        return { label: 'Admin', color: 'bg-purple-100 text-purple-700' };
      case 'spa_owner':
        return { label: 'Spa Owner', color: 'bg-amber-100 text-amber-700' };
      case 'spa_staff':
        return { label: 'Staff', color: 'bg-blue-100 text-blue-700' };
      default:
        return { label: 'Customer', color: 'bg-rose-100 text-rose-700' };
    }
  };

  const roleBadge = getRoleBadge();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={`flex items-center gap-3 px-4 py-5 border-b border-gray-100 ${isCollapsed ? 'justify-center' : ''}`}
      >
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-serif font-semibold gradient-text-premium">
              Glamornate
            </span>
          )}
        </Link>
      </div>

      {/* User Info */}
      <div
        className={`px-4 py-4 border-b border-gray-100 ${isCollapsed ? 'flex justify-center' : ''}`}
      >
        {isCollapsed ? (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-amber-400 flex items-center justify-center text-white font-medium shadow-md">
            {user?.profile?.displayName?.charAt(0) || 'U'}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-400 to-amber-400 flex items-center justify-center text-white font-medium shadow-md shrink-0">
              {user?.profile?.displayName?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">
                {user?.profile?.displayName || 'User'}
              </p>
              <span
                className={`inline-flex items-center mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${roleBadge.color}`}
              >
                {roleBadge.label}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className={sectionIndex > 0 ? 'mt-6' : ''}>
            {section.title && !isCollapsed && (
              <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-rose-50 text-rose-600 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <item.icon
                      className={`w-5 h-5 shrink-0 ${
                        isActive ? 'text-rose-500' : 'text-gray-400 group-hover:text-gray-600'
                      }`}
                    />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              isActive ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="border-t border-gray-100 p-3 space-y-1">
        <Link
          href="/help"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Help & Support' : undefined}
        >
          <HelpCircle className="w-5 h-5 text-gray-400" />
          {!isCollapsed && <span>Help & Support</span>}
        </Link>
        <button
          onClick={handleSignOut}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-rose-50 hover:text-rose-600 transition-all ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="w-5 h-5 text-gray-400" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse Toggle - Desktop only */}
      <div className="hidden lg:block border-t border-gray-100 p-3">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-40 lg:hidden p-2 rounded-lg bg-white shadow-md border border-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        aria-label="Open sidebar"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white z-50 transform transition-transform duration-300 ease-out lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 h-screen bg-white border-r border-gray-100 transition-all duration-300 z-30 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Spacer for main content */}
      <div
        className={`hidden lg:block shrink-0 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}
      />
    </>
  );
}
