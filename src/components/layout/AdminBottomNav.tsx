'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Users, BarChart3 } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/spas', label: 'Spas', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

export default function AdminBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin/dashboard') {
      return pathname === '/admin/dashboard' || pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-purple-100/50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-200 active:scale-95 ${
                active ? 'text-purple-600' : 'text-gray-400'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-6 h-6 transition-all duration-200 ${
                    active ? 'stroke-[2.5px]' : 'stroke-[1.5px]'
                  }`}
                  fill={active ? 'currentColor' : 'none'}
                  fillOpacity={active ? 0.15 : 0}
                />
              </div>
              <span
                className={`text-[10px] mt-1 font-medium transition-all duration-200 ${
                  active ? 'text-purple-600' : 'text-gray-400'
                }`}
              >
                {item.label}
              </span>
              {/* Active indicator dot */}
              {active && (
                <span className="absolute top-1 w-1 h-1 bg-purple-500 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
