'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';

// Page titles mapping
const pageTitles: Record<string, string> = {
  '/admin/dashboard': 'Admin Panel',
  '/admin/spas': 'Manage Spas',
  '/admin/users': 'Manage Users',
  '/admin/reports': 'Reports',
};

export default function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isDashboard = pathname === '/admin/dashboard' || pathname === '/admin';
  const pageTitle = pageTitles[pathname] || 'Admin';
  const userInitial = user?.profile?.displayName?.charAt(0) || 'A';

  const handleBack = () => {
    router.back();
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-purple-100/50'
          : 'bg-white/80 backdrop-blur-lg'
      }`}
    >
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        {/* Left: Back arrow or Admin Panel title */}
        <div className="flex items-center gap-3">
          {isDashboard ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-900">Admin Panel</span>
                <span className="text-[10px] text-purple-600 font-medium">Glamornate</span>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={handleBack}
                className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors active:scale-95"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <span className="text-base font-semibold text-gray-900">{pageTitle}</span>
            </>
          )}
        </div>

        {/* Right: Notifications + User Avatar */}
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <Link
            href="/admin/notifications"
            className="relative p-2 rounded-full hover:bg-gray-100 transition-colors active:scale-95"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {/* Notification badge */}
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
          </Link>

          {/* User Avatar */}
          <Link
            href="/admin/profile"
            className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm active:scale-95 transition-transform"
          >
            {userInitial}
          </Link>
        </div>
      </div>
    </header>
  );
}
