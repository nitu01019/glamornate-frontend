'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Settings, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';

// Page titles mapping
const pageTitles: Record<string, string> = {
  '/spa/dashboard': 'Dashboard',
  '/spa/bookings': 'Bookings',
  '/spa/services': 'Services',
  '/spa/staff': 'Staff',
};

export default function SpaHeader() {
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

  const isDashboard = pathname === '/spa/dashboard' || pathname === '/spa';
  const pageTitle = pageTitles[pathname] || 'Spa Portal';
  const spaName = user?.profile?.displayName || 'My Spa';

  const handleBack = () => {
    router.back();
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-amber-100/50'
          : 'bg-white/80 backdrop-blur-lg'
      }`}
    >
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        {/* Left: Back arrow or Spa branding */}
        <div className="flex items-center gap-3">
          {isDashboard ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-rose-500 rounded-xl flex items-center justify-center shadow-md">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-900 truncate max-w-[150px]">
                  {spaName}
                </span>
                <span className="text-[10px] text-amber-600 font-medium">
                  Spa Portal
                </span>
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
              <span className="text-base font-semibold text-gray-900">
                {pageTitle}
              </span>
            </>
          )}
        </div>

        {/* Right: Notifications + Settings */}
        <div className="flex items-center gap-1">
          {/* Notification Bell */}
          <Link
            href="/spa/notifications"
            className="relative p-2 rounded-full hover:bg-gray-100 transition-colors active:scale-95"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {/* Notification badge - you can make this dynamic */}
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
          </Link>

          {/* Settings */}
          <Link
            href="/spa/settings"
            className="p-2 rounded-full hover:bg-gray-100 transition-colors active:scale-95"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </Link>
        </div>
      </div>
    </header>
  );
}
