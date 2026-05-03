'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import SpaHeader from '@/components/layout/SpaHeader';
import SpaBottomNav from '@/components/layout/SpaBottomNav';

export default function SpaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requiredRoles={['spa_owner', 'spa_staff']}>
      <div className="min-h-screen bg-gradient-to-b from-amber-50/30 to-white">
        {/* App-like header */}
        <SpaHeader />
        
        {/* Main content area with padding for header and bottom nav */}
        <main id="main-content" className="pt-14 pb-20 min-h-screen">
          {children}
        </main>
        
        {/* App-like bottom navigation */}
        <SpaBottomNav />
      </div>
    </ProtectedRoute>
  );
}
