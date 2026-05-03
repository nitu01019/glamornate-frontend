'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSpas } from '@/hooks/useSpas';
import { useAuth } from '@/lib/auth-provider';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import type { Spa } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GridSkeleton } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Shield,
  Search,
  Filter,
  MapPin,
  Star,
  TrendingUp,
  Eye,
  MoreHorizontal,
  AlertCircle,
  Calendar,
} from 'lucide-react';

type SpaStatus = 'all' | 'active' | 'pending' | 'suspended';

function AdminSpasContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SpaStatus>('all');
  const { signOut } = useAuth();

  // Fetch spas using the proper hook
  const { data: spas, isLoading, error, refetch } = useSpas();

  const filteredSpas =
    spas?.filter((spa) => {
      const matchesSearch =
        spa.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        spa.location?.city?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || spa.status === statusFilter;
      return matchesSearch && matchesStatus;
    }) || [];

  const getStatusBadge = (status: Spa['status']) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
        );
      case 'verified':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Verified</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>;
      case 'suspended':
        return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">Suspended</Badge>;
      case 'rejected':
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Rejected</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Unknown</Badge>;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-slate-700" />
              <div className="flex flex-col">
                <span className="text-lg font-semibold text-slate-800">Glamornate Admin</span>
                <span className="text-xs text-slate-500">Partner Management</span>
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-slate-800">Partner Spas</h1>
            <p className="text-slate-500">Manage spa and salon partners</p>
          </div>
          <GridSkeleton count={6} columns={3} />
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-slate-700" />
              <div className="flex flex-col">
                <span className="text-lg font-semibold text-slate-800">Glamornate Admin</span>
                <span className="text-xs text-slate-500">Partner Management</span>
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 flex items-center justify-center">
          <ErrorState
            title="Failed to Load Spas"
            message="Unable to load spa data. Please try again."
            showRetry
            onRetry={() => refetch()}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-slate-700" />
              <div className="flex flex-col">
                <span className="text-lg font-semibold text-slate-800">Glamornate Admin</span>
                <span className="text-xs text-slate-500">Partner Management</span>
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
            <Link href="/admin/spas" className="text-slate-800 font-medium">
              Partners
            </Link>
            <Link href="/admin/reports" className="text-slate-500 hover:text-slate-800">
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
            <h1 className="text-3xl font-semibold text-slate-800">Partner Spas</h1>
            <p className="text-slate-500">Manage spa and salon partners</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search spas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button variant="outline" className="border-slate-200">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="border-slate-100">
            <CardContent className="p-4">
              <div className="text-sm text-slate-500 mb-1">Total Partners</div>
              <div className="text-2xl font-bold text-slate-800">{spas?.length || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-emerald-100">
            <CardContent className="p-4">
              <div className="text-sm text-slate-500 mb-1">Active</div>
              <div className="text-2xl font-bold text-emerald-600">
                {spas?.filter((s) => s.status === 'active' || s.status === 'verified').length || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-100">
            <CardContent className="p-4">
              <div className="text-sm text-slate-500 mb-1">Pending</div>
              <div className="text-2xl font-bold text-amber-600">
                {spas?.filter((s) => s.status === 'pending').length || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="border-rose-100">
            <CardContent className="p-4">
              <div className="text-sm text-slate-500 mb-1">Suspended</div>
              <div className="text-2xl font-bold text-rose-600">
                {spas?.filter((s) => s.status === 'suspended').length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {(['all', 'active', 'pending', 'suspended'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === status
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Spas Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSpas.length === 0 ? (
            <Card className="col-span-full border-slate-100 border-dashed">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No spas found</h3>
                <p className="text-slate-500">
                  {spas?.length === 0
                    ? 'No spa partners registered yet'
                    : 'No spas match your filters'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredSpas.map((spa) => (
              <Card key={spa.id} className="border-slate-100 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-800">{spa.name}</h3>
                        {spa.status === 'verified' && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                            Verified
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-slate-500 mb-1">
                        <MapPin className="w-3 h-3" />
                        {spa.location.city}, {spa.location.state}
                      </div>
                      {spa.rating.overall > 0 && (
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          {spa.rating.overall} ({spa.rating.count} reviews)
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="text-slate-400">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    {getStatusBadge(spa.status)}
                    <Badge
                      className={
                        spa.tier === 'premium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }
                    >
                      {spa.tier}
                    </Badge>
                  </div>

                  {(spa.status === 'active' || spa.status === 'verified') && (
                    <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-slate-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-lg font-bold text-slate-800">
                          {spa.statistics.totalBookings}
                        </div>
                        <div className="text-xs text-slate-500">Bookings</div>
                      </div>
                      <div className="text-center border-x border-slate-200">
                        <div className="text-lg font-bold text-emerald-600">
                          ₹{spa.statistics.revenue.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500">Revenue</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-600 flex items-center justify-center">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div className="text-xs text-slate-500">Active</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Joined {new Date(spa.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/admin/spas/${spa.id}`}>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Pending Approvals */}
        {filteredSpas.some((s) => s.status === 'pending') && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Pending Applications</h2>
            <div className="space-y-4">
              {filteredSpas
                .filter((s) => s.status === 'pending')
                .map((spa) => (
                  <Card
                    key={spa.id}
                    className="border-amber-200 bg-gradient-to-r from-amber-50 to-white"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-slate-800 mb-1">{spa.name}</div>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <MapPin className="w-3 h-3" />
                            {spa.location.city}, {spa.location.state}
                          </div>
                          <div className="text-sm text-slate-400 mt-2">
                            Applied on {new Date(spa.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/admin/spas/${spa.id}`}>
                            <Button variant="outline">Review</Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminSpasPage() {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <AdminSpasContent />
    </ProtectedRoute>
  );
}
