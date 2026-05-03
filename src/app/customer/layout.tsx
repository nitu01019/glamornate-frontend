'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requiredRoles={['customer']}>
      {/* Minimal wrapper - global AppHeader and BottomNav from root layout handle navigation */}
      <div className="min-h-screen bg-white">
        {children}
      </div>
    </ProtectedRoute>
  );
}
