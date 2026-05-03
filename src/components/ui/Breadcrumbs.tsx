'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { useMemo } from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
  homeHref?: string;
  className?: string;
}

// Generate breadcrumbs automatically from pathname if items not provided
function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];
  
  let currentPath = '';
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    
    // Format the segment label (kebab-case to Title Case)
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // If it's the last segment, don't include href (current page)
    if (i === segments.length - 1) {
      breadcrumbs.push({ label });
    } else {
      breadcrumbs.push({ label, href: currentPath });
    }
  }
  
  return breadcrumbs;
}

export function Breadcrumbs({
  items,
  showHome = true,
  homeHref = '/',
  className = '',
}: BreadcrumbsProps) {
  const pathname = usePathname();
  
  // Use provided items or generate from pathname
  const breadcrumbItems = useMemo(() => {
    return items || generateBreadcrumbsFromPath(pathname);
  }, [items, pathname]);

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center ${className}`}>
      <ol className="flex items-center flex-wrap gap-1 text-sm">
        {/* Home Link */}
        {showHome && (
          <li className="flex items-center">
            <Link
              href={homeHref}
              className="text-gray-500 hover:text-brand-maroon-600 transition-colors flex items-center gap-1"
              aria-label="Home"
            >
              <Home className="w-4 h-4" />
              <span className="sr-only sm:not-sr-only">Home</span>
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400 mx-1.5 flex-shrink-0" />
          </li>
        )}

        {/* Breadcrumb Items */}
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          
          return (
            <li key={index} className="flex items-center">
              {item.href && !isLast ? (
                <>
                  <Link
                    href={item.href}
                    className="text-gray-500 hover:text-brand-maroon-600 transition-colors truncate max-w-[150px] sm:max-w-[200px]"
                    title={item.label}
                  >
                    {item.label}
                  </Link>
                  <ChevronRight className="w-4 h-4 text-gray-400 mx-1.5 flex-shrink-0" />
                </>
              ) : (
                <span 
                  className="font-medium text-gray-900 truncate max-w-[150px] sm:max-w-[200px]"
                  aria-current="page"
                  title={item.label}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Pre-built breadcrumb patterns for common pages
export function CustomerBreadcrumbs({ pageName }: { pageName: string }) {
  const items: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/customer/dashboard' },
    { label: pageName },
  ];
  
  return <Breadcrumbs items={items} showHome={false} />;
}

export function SpaBreadcrumbs({ pageName }: { pageName: string }) {
  const items: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/spa/dashboard' },
    { label: pageName },
  ];
  
  return <Breadcrumbs items={items} showHome={false} />;
}

export function AdminBreadcrumbs({ pageName }: { pageName: string }) {
  const items: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: pageName },
  ];
  
  return <Breadcrumbs items={items} showHome={false} />;
}

export function SpaDetailBreadcrumbs({ spaName }: { spaName: string }) {
  const items: BreadcrumbItem[] = [
    { label: 'Spas', href: '/spas' },
    { label: spaName },
  ];
  
  return <Breadcrumbs items={items} showHome={true} />;
}

export function ServiceDetailBreadcrumbs({ serviceName }: { serviceName: string }) {
  const items: BreadcrumbItem[] = [
    { label: 'Services', href: '/services' },
    { label: serviceName },
  ];
  
  return <Breadcrumbs items={items} showHome={true} />;
}

export default Breadcrumbs;
