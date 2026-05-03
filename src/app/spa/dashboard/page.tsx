'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  IndianRupee,
  Calendar,
  Users,
  TrendingUp,
  Plus,
  Star,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-provider';
import { useBookings, BookingWithId } from '@/hooks/useBookings';
import { useSpaTherapists } from '@/hooks/useTherapists';
import { useReviews, ReviewWithId } from '@/hooks/useReviews';
import Link from 'next/link';

// Format currency in Indian Rupees
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format time from date string
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Booking card component for upcoming bookings
function UpcomingBookingCard({ booking }: { booking: BookingWithId }) {
  const serviceNames = booking.services?.map((s) => s.name).join(', ') || 'Service';
  const totalDuration = booking.services?.reduce((sum, s) => sum + s.duration, 0) || 0;

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-rose-100 rounded-xl flex items-center justify-center shrink-0">
        <Clock className="w-6 h-6 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">
          {booking.customer?.name || 'Customer'}
        </p>
        <p className="text-sm text-gray-500 truncate">{serviceNames}</p>
        <p className="text-xs text-gray-400">{totalDuration} min</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium text-amber-600">{formatTime(booking.slot?.date)}</p>
        <p className="text-sm font-semibold text-gray-900">
          {formatCurrency(booking.pricing?.total || 0)}
        </p>
      </div>
    </div>
  );
}

// Review card component
function ReviewCard({ review }: { review: ReviewWithId }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 rounded-full shrink-0">
        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
        <span className="text-sm font-semibold text-amber-700">{review.rating}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 line-clamp-2">{review.comment}</p>
        <p className="text-xs text-gray-400 mt-1">
          {new Date(review.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

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
    amber: 'from-amber-500 to-orange-500 shadow-amber-500/30',
    rose: 'from-rose-500 to-pink-500 shadow-rose-500/30',
    emerald: 'from-emerald-500 to-teal-500 shadow-emerald-500/30',
    blue: 'from-blue-500 to-indigo-500 shadow-blue-500/30',
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
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
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

// Main dashboard content component
function SpaDashboardContent() {
  const { user } = useAuth();
  const spaId = user?.spaData?.spaId;

  // Fetch all bookings for this spa
  const {
    data: allBookings,
    isLoading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useBookings(spaId ? { spaId } : undefined);

  // Fetch therapists/staff for this spa
  const { data: therapists, isLoading: therapistsLoading } = useSpaTherapists(spaId);

  // Fetch recent reviews for this spa
  const { data: reviews, isLoading: reviewsLoading } = useReviews(spaId, { limit: 3 });

  // F6: defer `new Date()` to post-mount to avoid SSR/CSR hydration drift.
  const [todayString, setTodayString] = useState<string | null>(null);
  const [greeting, setGreeting] = useState<string | null>(null);
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setTodayString(today.toISOString().split('T')[0]);
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening');
  }, []);

  const todayBookings = todayString
    ? allBookings?.filter((booking) => {
        const bookingDate = new Date(booking.slot?.date).toISOString().split('T')[0];
        return bookingDate === todayString;
      }) || []
    : [];

  const upcomingBookings = todayString
    ? allBookings
        ?.filter((booking) => {
          const bookingDate = new Date(booking.slot?.date).toISOString().split('T')[0];
          return bookingDate >= todayString && booking.bookingStatus === 'confirmed';
        })
        .slice(0, 4) || []
    : [];

  const completedBookings = allBookings?.filter((b) => b.bookingStatus === 'completed') || [];
  const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.pricing?.total || 0), 0);

  const activeStaff = therapists?.filter((t) => t.status === 'online').length || 0;
  const totalStaff = therapists?.length || 0;

  const isLoading = bookingsLoading || therapistsLoading || reviewsLoading;

  // Check if we have a valid spa ID
  if (!spaId) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <Card className="border-0 shadow-lg rounded-2xl max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Spa Associated</h3>
            <p className="text-sm text-gray-500">
              Your account is not linked to any spa. Please contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (bookingsError) {
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
              onClick={() => refetchBookings()}
              className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Welcome Section */}
      <div className="mb-2">
        <h1 className="text-xl font-bold text-gray-900">
          {greeting ? `Good ${greeting}!` : 'Welcome!'}
        </h1>
        <p className="text-sm text-gray-500">Here&apos;s your spa overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          title="Today's Bookings"
          value={todayBookings.length.toString()}
          icon={Calendar}
          color="amber"
          subtitle={`${upcomingBookings.length} upcoming`}
        />
        <StatCard
          title="Revenue"
          value={formatCurrency(totalRevenue)}
          icon={IndianRupee}
          color="emerald"
          subtitle="Total earnings"
        />
        <StatCard
          title="Active Staff"
          value={`${activeStaff}/${totalStaff}`}
          icon={Users}
          color="blue"
          subtitle="Available now"
        />
        <StatCard
          title="Rating"
          value={
            reviews?.length
              ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
              : '0.0'
          }
          icon={Star}
          color="rose"
          subtitle={`${reviews?.length || 0} reviews`}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
        <div className="flex justify-around bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <QuickAction icon={Plus} label="New Booking" href="/spa/bookings" color="amber" />
          <QuickAction icon={Calendar} label="Schedule" href="/spa/bookings" color="rose" />
          <QuickAction icon={Users} label="Staff" href="/spa/staff" color="blue" />
          <QuickAction icon={TrendingUp} label="Services" href="/spa/services" color="emerald" />
        </div>
      </div>

      {/* Upcoming Bookings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Upcoming Bookings</h2>
          <Link
            href="/spa/bookings"
            className="text-xs font-medium text-amber-600 flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {upcomingBookings.length === 0 ? (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6 text-center">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No upcoming bookings</p>
              <p className="text-xs text-gray-400">New bookings will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingBookings.map((booking) => (
              <UpcomingBookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Reviews */}
      {reviews && reviews.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Recent Reviews</h2>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="space-y-3">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </div>
      )}

      {/* Staff Quick View */}
      {therapists && therapists.length > 0 && (
        <div className="pb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Staff Status</h2>
            <Link
              href="/spa/staff"
              className="text-xs font-medium text-amber-600 flex items-center gap-1"
            >
              Manage <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {therapists.slice(0, 5).map((therapist) => (
              <div key={therapist.id} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                    <span className="text-sm font-semibold text-blue-700">
                      {therapist.name
                        ?.split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </span>
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      therapist.status === 'online' ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}
                  />
                </div>
                <span className="text-xs text-gray-600 font-medium max-w-[60px] truncate">
                  {therapist.displayName || therapist.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Export wrapped with ProtectedRoute
export default function SpaDashboard() {
  return (
    <ProtectedRoute requiredRoles={['spa_owner', 'spa_staff']}>
      <SpaDashboardContent />
    </ProtectedRoute>
  );
}
