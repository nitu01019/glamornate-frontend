'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { APIProviderRoot } from '@/components/maps/APIProviderRoot';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requiredRoles={['customer']}>
      {/* APIProviderRoot mounts the Google Maps JS SDK once for every
          customer route (book-new, addresses, dashboard, ...). Graceful
          no-op when the public Maps-JS key is missing. Plan §6 Step 7. */}
      <APIProviderRoot>
        {/* Minimal wrapper - global AppHeader and BottomNav from root layout handle navigation */}
        <div className="min-h-screen bg-white">
          {children}
        </div>
      </APIProviderRoot>
    </ProtectedRoute>
  );
}
