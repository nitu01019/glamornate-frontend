'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-provider';
import { useUsers } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Search,
  Filter,
  MoreHorizontal,
  Phone,
  Mail,
  X,
  AlertCircle,
  Calendar,
  RefreshCw,
  Users as UsersIcon,
  UserCheck,
  UserX,
  Clock,
} from 'lucide-react';
import type { User } from '@/types';

// Extended User type that includes the Firestore document ID
interface UserWithId extends User {
  id: string;
}

type UserStatus = 'all' | 'active' | 'suspended' | 'pending';

function AdminUsersContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus>('all');
  const { signOut } = useAuth();

  // Fetch users from Firebase using the useUsers hook
  // Type cast since the hook adds the document id from Firestore
  const { data: rawUsers, isLoading, isError, error, refetch } = useUsers();
  const users = rawUsers as UserWithId[] | undefined;

  // Filter users based on search and status
  const filteredUsers =
    users?.filter((user) => {
      const matchesSearch =
        user.profile?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.profile?.phone?.includes(searchQuery);
      const matchesStatus =
        statusFilter === 'all' ||
        (user.isActive && user.emailVerified && statusFilter === 'active') ||
        (!user.isActive && statusFilter === 'suspended') ||
        (!user.emailVerified && statusFilter === 'pending');
      return matchesSearch && matchesStatus;
    }) || [];

  // Calculate statistics
  const totalUsers = users?.length || 0;
  const activeUsers = users?.filter((u) => u.isActive && u.emailVerified).length || 0;
  const pendingUsers = users?.filter((u) => !u.emailVerified).length || 0;
  const suspendedUsers = users?.filter((u) => !u.isActive).length || 0;

  const getStatus = (user: UserWithId): string => {
    if (!user.emailVerified) return 'pending';
    return user.isActive ? 'active' : 'suspended';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
        );
      case 'suspended':
        return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">Suspended</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  // Skeleton component for loading state
  const StatCardSkeleton = () => <div className="h-20 bg-slate-100 rounded-lg animate-pulse" />;

  const UserRowSkeleton = () => (
    <tr className="border-b border-slate-50">
      <td className="p-4">
        <div className="h-4 bg-slate-100 rounded w-32 mb-1 animate-pulse" />
        <div className="h-3 bg-slate-50 rounded w-40 animate-pulse" />
      </td>
      <td className="p-4">
        <div className="h-3 bg-slate-50 rounded w-32 animate-pulse" />
      </td>
      <td className="p-4">
        <div className="h-5 bg-slate-100 rounded w-16 animate-pulse" />
      </td>
      <td className="p-4">
        <div className="h-5 bg-slate-100 rounded w-16 animate-pulse" />
      </td>
      <td className="p-4">
        <div className="h-3 bg-slate-50 rounded w-20 animate-pulse" />
      </td>
      <td className="p-4">
        <div className="h-8 w-8 bg-slate-100 rounded animate-pulse" />
      </td>
    </tr>
  );

  const HeaderSkeleton = () => <div className="h-6 w-20 bg-slate-100 rounded animate-pulse" />;

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
                <span className="text-xs text-slate-500">User Management</span>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <HeaderSkeleton />
              <HeaderSkeleton />
              <HeaderSkeleton />
              <HeaderSkeleton />
            </nav>
            <div className="h-8 w-20 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="h-10 bg-slate-100 rounded w-24 mb-2 animate-pulse" />
            <div className="h-5 bg-slate-50 rounded w-48 animate-pulse" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>

          <Card className="border-slate-100">
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-slate-600">User</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-600">Contact</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-600">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-600">Role</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-600">Joined</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <UserRowSkeleton key={i} />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-slate-700" />
              <div className="flex flex-col">
                <span className="text-lg font-semibold text-slate-800">Glamornate Admin</span>
                <span className="text-xs text-slate-500">User Management</span>
              </div>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-rose-800 mb-2">Failed to Load Users</h2>
              <p className="text-rose-600 mb-4">
                {error?.message || 'An error occurred while fetching user data. Please try again.'}
              </p>
              <Button
                onClick={() => refetch()}
                variant="outline"
                className="border-rose-200 text-rose-700 hover:bg-rose-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
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
                <span className="text-xs text-slate-500">User Management</span>
              </div>
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/admin" className="text-slate-500 hover:text-slate-800 transition-colors">
              Dashboard
            </Link>
            <Link href="/admin/users" className="text-slate-800 font-medium">
              Users
            </Link>
            <Link
              href="/admin/spas"
              className="text-slate-500 hover:text-slate-800 transition-colors"
            >
              Partners
            </Link>
            <Link
              href="/admin/reports"
              className="text-slate-500 hover:text-slate-800 transition-colors"
            >
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-slate-800">Users</h1>
            <p className="text-slate-500">Manage customer accounts</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search users..."
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-slate-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <UsersIcon className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <div className="text-sm text-slate-500">Total Users</div>
                  <div className="text-2xl font-bold text-slate-800">{totalUsers}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm text-slate-500">Active</div>
                  <div className="text-2xl font-bold text-emerald-600">{activeUsers}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-sm text-slate-500">Pending</div>
                  <div className="text-2xl font-bold text-amber-600">{pendingUsers}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-rose-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 rounded-lg">
                  <UserX className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <div className="text-sm text-slate-500">Suspended</div>
                  <div className="text-2xl font-bold text-rose-600">{suspendedUsers}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['all', 'active', 'suspended', 'pending'] as const).map((status) => (
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
              {status === 'all' && ` (${totalUsers})`}
              {status === 'active' && ` (${activeUsers})`}
              {status === 'pending' && ` (${pendingUsers})`}
              {status === 'suspended' && ` (${suspendedUsers})`}
            </button>
          ))}
        </div>

        {/* Users Table */}
        <Card className="border-slate-100">
          <CardContent className="p-0">
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No users found</h3>
                <p className="text-slate-500 mb-4">
                  {totalUsers === 0
                    ? 'No users registered yet'
                    : 'No users match your search criteria'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">User</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">Contact</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">Role</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">Joined</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-amber-400 flex items-center justify-center text-white font-semibold">
                              {user.profile?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="font-medium text-slate-800">
                                {user.profile?.displayName || 'Unknown'}
                              </div>
                              <div className="text-sm text-slate-500">
                                {user.profile?.email || 'No email'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {user.profile?.phone ? (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Phone className="w-3 h-3" />
                              {user.profile.phone}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">No phone</span>
                          )}
                        </td>
                        <td className="p-4">{getStatusBadge(getStatus(user))}</td>
                        <td className="p-4">
                          <Badge className="bg-slate-100 text-slate-700 capitalize">
                            {user.role?.replace('_', ' ') || 'customer'}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-slate-500">{formatDate(user.createdAt)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        {pendingUsers > 0 && statusFilter !== 'pending' && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Pending Approvals</h2>
              <Link href="/admin/users" className="text-sm text-rose-600 hover:text-rose-700">
                View all pending
              </Link>
            </div>
            <div className="space-y-4">
              {filteredUsers
                .filter((u) => !u.emailVerified)
                .slice(0, 3)
                .map((user) => (
                  <Card
                    key={user.id}
                    className="border-amber-200 bg-gradient-to-r from-amber-50 to-white"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white font-semibold">
                            {user.profile?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">
                              {user.profile?.displayName || 'Unknown'}
                            </div>
                            <div className="text-sm text-slate-500">
                              {user.profile?.email || 'No email'}
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 mt-1">
                              <Calendar className="w-3 h-3" />
                              <span className="text-xs">
                                Registered {formatDate(user.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" className="border-slate-200">
                            <X className="w-4 h-4 mr-2 text-rose-500" />
                            Reject
                          </Button>
                          <Button className="bg-emerald-600 hover:bg-emerald-700">
                            <Mail className="w-4 h-4 mr-2" />
                            Send Verification
                          </Button>
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

export default function AdminUsersPage() {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <AdminUsersContent />
    </ProtectedRoute>
  );
}
