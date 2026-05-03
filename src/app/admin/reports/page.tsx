'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getFirebaseClient } from '@/lib/firebase-client-wrapper';
import { useAuth } from '@/lib/auth-provider';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardSkeleton } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { logger } from '@/lib/logger';
import type { Spa, Booking } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Shield,
  Download,
  TrendingUp,
  Calendar,
  Users,
  Star,
  BarChart3,
  AlertCircle,
} from 'lucide-react';

type TimeRange = 'day' | 'week' | 'month' | 'year';

function AdminReportsContent() {
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const { signOut } = useAuth();

  // Initialize Firebase on client mount only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      getFirebaseClient().catch((err: unknown) =>
        logger.error('Firebase client init failed', err, { component: 'admin/reports' }),
      );
    }
  }, []);

  // Fetch stats from Firebase
  const {
    data: spas,
    isLoading: spasLoading,
    error: spasError,
    refetch: refetchSpas,
  } = useQuery<Spa[]>({
    queryKey: ['admin-reports-spas', timeRange],
    queryFn: async () => {
      const { spaService } = await getFirebaseClient();
      return await spaService.getSpas();
    },
    staleTime: 1000 * 60 * 2,
  });

  const {
    data: bookings,
    isLoading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useQuery<Booking[]>({
    queryKey: ['admin-reports-bookings', timeRange, spas],
    queryFn: async () => {
      if (!spas || spas.length === 0) return [];
      const { bookingService } = await getFirebaseClient();
      const allBookings = await Promise.all(
        spas.map((spa: Spa & { id?: string }) => bookingService.getSpaBookings(spa.id || '')),
      );
      return allBookings.flat();
    },
    enabled: !!spas,
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = spasLoading || bookingsLoading;
  const error = spasError || bookingsError;

  // Loading state
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <ErrorState
        title="Failed to Load Reports"
        message={
          error instanceof Error ? error.message : 'An error occurred while fetching report data'
        }
        showRetry
        onRetry={() => {
          refetchSpas();
          refetchBookings();
        }}
      />
    );
  }

  // Calculate stats from Firebase data
  const totalRevenue = bookings?.reduce((sum, b) => sum + (b.pricing?.total || 0), 0) || 0;
  const avgRating =
    spas && spas.length > 0 ? spas.reduce((sum, s) => sum + s.rating.overall, 0) / spas.length : 0;

  const topPerformers =
    spas
      ?.filter((s) => s.statistics?.revenue > 0)
      .sort((a, b) => b.statistics.revenue - a.statistics.revenue)
      .slice(0, 5)
      .map((s: Spa & { id?: string }) => ({
        id: s.id,
        name: s.name,
        revenue: s.statistics.revenue,
        bookings: s.statistics.totalBookings,
        rating: s.rating.overall,
      })) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-slate-700" />
              <div className="flex flex-col">
                <span className="text-lg font-semibold text-slate-800">Glamornate Admin</span>
                <span className="text-xs text-slate-500">Reports & Analytics</span>
              </div>
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/admin" className="text-slate-500 hover:text-slate-800">
              Dashboard
            </Link>
            <Link href="/admin/users" className="text-slate-500 hover:text-slate-800">
              Users
            </Link>
            <Link href="/admin/spas" className="text-slate-500 hover:text-slate-800">
              Partners
            </Link>
            <Link href="/admin/reports" className="text-slate-800 font-medium">
              Reports
            </Link>
          </nav>
          <Button variant="outline" className="border-slate-200" onClick={() => signOut()}>
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-slate-800">Reports & Analytics</h1>
            <p className="text-slate-500">Platform performance insights</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              {(['day', 'week', 'month', 'year'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    timeRange === range
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
            <Button variant="outline" className="border-slate-200">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-slate-100 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Spas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">{spas?.length || 0}</div>
              <div className="flex items-center text-sm mt-1 text-emerald-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                Active platform
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-100 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Total Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">{bookings?.length || 0}</div>
              <div className="flex items-center text-sm mt-1 text-emerald-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                All time
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-100 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">
                ₹{totalRevenue.toLocaleString()}
              </div>
              <div className="flex items-center text-sm mt-1 text-emerald-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                Total earnings
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-100 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <Star className="w-4 h-4" />
                Avg. Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">{avgRating.toFixed(1)}</div>
              <div className="flex items-center text-sm mt-1 text-amber-600">
                <Star className="w-3 h-3 fill-amber-500" />
                Platform average
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Charts */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-slate-100">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-slate-800">Revenue Trend</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400">Revenue chart visualization</p>
                    <p className="text-xs text-slate-500 mt-2">
                      Charts will be implemented with @/components/ui/charts
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">
                  Service Category Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {spas && spas.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {spas
                      .flatMap((s) => s.categories)
                      .reduce(
                        (acc, category) => {
                          const existing = acc.find((c) => c.category === category);
                          if (existing) {
                            existing.count += 1;
                          } else {
                            acc.push({ category, count: 1, color: getCategoryColor(category) });
                          }
                          return acc;
                        },
                        [] as { category: string; count: number; color: string }[],
                      )
                      .map((item) => {
                        const total = spas.reduce(
                          (sum: number, s: Spa) => sum + s.categories.length,
                          0,
                        );
                        const percentage = Math.round((item.count / total) * 100);
                        return (
                          <div key={item.category} className="p-4 bg-slate-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-slate-600 capitalize">
                                {item.category}
                              </span>
                              <span className="font-semibold text-slate-800">{percentage}%</span>
                            </div>
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${item.color} rounded-full`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-40 text-slate-400">
                    <AlertCircle className="w-8 h-8 mr-2" />
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <Card className="border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">Top Performing Partners</CardTitle>
              </CardHeader>
              <CardContent>
                {topPerformers.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No data yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topPerformers.map((spa) => (
                      <div key={spa.id} className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                            spa.id === topPerformers[0].id
                              ? 'bg-amber-100 text-amber-700'
                              : spa.id === topPerformers[1]?.id
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-orange-50 text-orange-600'
                          }`}
                        >
                          {topPerformers.indexOf(spa) + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 truncate">{spa.name}</div>
                          <div className="text-sm text-slate-500">
                            ₹{spa.revenue.toLocaleString()} • {spa.bookings} bookings
                          </div>
                        </div>
                        <div className="flex items-center text-amber-500">
                          <Star className="w-3 h-3 fill-amber-500" />
                          <span className="text-sm">{spa.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-rose-50">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">Generate Custom Report</CardTitle>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-gradient-to-r from-amber-600 to-rose-600">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Create Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    massage: 'from-emerald-500 to-emerald-600',
    facial: 'from-rose-500 to-rose-600',
    body: 'from-purple-500 to-purple-600',
    wellness: 'from-blue-500 to-blue-600',
    manicure: 'from-pink-500 to-pink-600',
    pedicure: 'from-amber-500 to-amber-600',
  };
  return colors[category] || 'from-gray-500 to-gray-600';
}

export default function AdminReportsPage() {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <AdminReportsContent />
    </ProtectedRoute>
  );
}
