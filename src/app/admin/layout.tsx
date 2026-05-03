'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import AdminHeader from '@/components/layout/AdminHeader';
import AdminBottomNav from '@/components/layout/AdminBottomNav';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* App-like header */}
        <AdminHeader />
        
        {/* Main content area with padding for header and bottom nav */}
        <main id="main-content" className="pt-14 pb-20 min-h-screen">
          {children}
        </main>
        
        {/* App-like bottom navigation */}
        <AdminBottomNav />
      </div>
    </ProtectedRoute>
  );
}
