'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Calendar,
  IndianRupee,
  Users,
  Clock,
  CheckCircle,
  ChevronRight,
  Loader2,
  X,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAdminDashboardStats, useUpdateSpaStatus } from '@/hooks/useApi';
import { useSpas } from '@/hooks/useSpas';
import type { BookingWithId, SpaWithId } from '@/types';
import { logger } from '@/lib/logger';

// Stat Card with app-like design
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  const colorClasses: Record<string, string> = {
    purple: 'from-purple-500 to-indigo-500 shadow-purple-500/30',
    green: 'from-emerald-500 to-teal-500 shadow-emerald-500/30',
    blue: 'from-blue-500 to-cyan-500 shadow-blue-500/30',
    amber: 'from-amber-500 to-orange-500 shadow-amber-500/30',
  };

  return (
    <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg flex items-center justify-center`}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick Action Button
function QuickAction({
  icon: Icon,
  label,
  href,
  color,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-700',
    green: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
  };

  return (
    <Link href={href} className="flex flex-col items-center gap-2">
      <div
        className={`w-14 h-14 rounded-2xl ${colorClasses[color]} flex items-center justify-center active:scale-95 transition-transform`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-xs font-medium text-gray-600">{label}</span>
    </Link>
  );
}

// Loading skeleton
function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-6 animate-pulse">
      <div className="h-6 w-40 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl" />
        ))}
      </div>
      <div className="h-40 bg-gray-100 rounded-2xl" />
    </div>
  );
}

function AdminDashboardContent() {
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch admin dashboard stats
  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useAdminDashboardStats();

  // Fetch pending spas for approval section
  const { data: pendingSpasData } = useSpas({ status: 'pending', limit: 10 });

  // Mutation for updating spa status
  const updateSpaStatus = useUpdateSpaStatus();

  const handleApproveSpa = async (spaId: string) => {
    setActionInProgress(spaId);
    try {
      await updateSpaStatus.mutateAsync({ spaId, status: 'active' });
    } catch (error: unknown) {
      logger.error('Failed to approve spa', error, { component: 'admin-dashboard' });
      setActionError('Failed to approve spa. Please try again.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRejectSpa = async (spaId: string) => {
    setActionInProgress(spaId);
    try {
      await updateSpaStatus.mutateAsync({
        spaId,
        status: 'rejected',
        reason: 'Did not meet approval criteria',
      });
    } catch (error: unknown) {
      logger.error('Failed to reject spa', error, { component: 'admin-dashboard' });
      setActionError('Failed to reject spa. Please try again.');
    } finally {
      setActionInProgress(null);
    }
  };

  // Loading state
  if (statsLoading) {
    return <DashboardSkeleton />;
  }

  // Error state
  if (statsError) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <Card className="border-0 shadow-lg rounded-2xl max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-rose-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load</h3>
            <p className="text-sm text-gray-500 mb-4">Unable to load dashboard data.</p>
            <Button
              onClick={() => refetchStats()}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-full"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extract data with defaults
  const totalSpas = statsData?.totalSpas || 0;
  const activeSpas = statsData?.activeSpas || 0;
  const totalBookings = statsData?.totalBookings || 0;
  const totalRevenue = statsData?.totalRevenue || 0;
  const recentBookings = statsData?.recentBookings || [];
  const pendingSpasList = pendingSpasData || [];

  const formattedRecentBookings = recentBookings.slice(0, 5).map((b: BookingWithId) => ({
    id: b.id,
    customer: b.customer?.name || 'Unknown',
    spa: b.spaId || 'Unknown',
    amount: `₹${b.pricing?.total || 0}`,
    status: b.bookingStatus,
    time: b.createdAt
      ? new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '',
  }));

  const formattedPendingSpas = pendingSpasList.slice(0, 3).map((s: SpaWithId) => ({
    id: s.id,
    name: s.name,
    location: s.location ? `${s.location.city}, ${s.location.state}` : 'Unknown',
    submitted: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '',
  }));

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      confirmed: 'bg-emerald-100 text-emerald-700',
      pending: 'bg-amber-100 text-amber-700',
      cancelled: 'bg-gray-100 text-gray-600',
      completed: 'bg-blue-100 text-blue-700',
      no_show: 'bg-rose-100 text-rose-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  }

  return (
    <div className="p-4 space-y-6">
      {actionError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm text-rose-700">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-500 hover:text-rose-700 ml-2 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Welcome Section */}
      <div className="mb-2">
        <h1 className="text-xl font-bold text-gray-900">Welcome, Admin</h1>
        <p className="text-sm text-gray-500">Platform overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          title="Total Spas"
          value={totalSpas.toString()}
          icon={Building2}
          color="purple"
          subtitle={`${pendingSpasList.length} pending`}
        />
        <StatCard
          title="Active Spas"
          value={activeSpas.toString()}
          icon={CheckCircle}
          color="green"
          subtitle="Operating now"
        />
        <StatCard
          title="Bookings"
          value={totalBookings.toString()}
          icon={Calendar}
          color="blue"
          subtitle="All time"
        />
        <StatCard
          title="Revenue"
          value={`₹${totalRevenue.toLocaleString()}`}
          icon={IndianRupee}
          color="amber"
          subtitle="Total platform"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
        <div className="flex justify-around bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <QuickAction icon={Building2} label="Spas" href="/admin/spas" color="purple" />
          <QuickAction icon={Users} label="Users" href="/admin/users" color="blue" />
          <QuickAction icon={TrendingUp} label="Reports" href="/admin/reports" color="green" />
          <QuickAction icon={Calendar} label="Bookings" href="/admin/bookings" color="amber" />
        </div>
      </div>

      {/* Pending Approvals */}
      {formattedPendingSpas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Pending Approvals</h2>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
              {formattedPendingSpas.length}
            </span>
          </div>
          <div className="space-y-3">
            {formattedPendingSpas.map((spa) => (
              <Card key={spa.id} className="border-0 shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{spa.name}</p>
                      <p className="text-sm text-gray-500">{spa.location}</p>
                      <p className="text-xs text-gray-400 mt-1">Submitted: {spa.submitted}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-9"
                      onClick={() => handleApproveSpa(spa.id)}
                      disabled={actionInProgress === spa.id}
                    >
                      {actionInProgress === spa.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl h-9"
                      onClick={() => handleRejectSpa(spa.id)}
                      disabled={actionInProgress === spa.id}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent Bookings */}
      <div className="pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Recent Bookings</h2>
          <Link
            href="/admin/bookings"
            className="text-xs font-medium text-purple-600 flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {formattedRecentBookings.length === 0 ? (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6 text-center">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No bookings yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {formattedRecentBookings.map((booking) => (
              <Card key={booking.id} className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{booking.customer}</p>
                      <p className="text-xs text-gray-500">{booking.spa}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-gray-900">{booking.amount}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(booking.status)}`}
                      >
                        {booking.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}
