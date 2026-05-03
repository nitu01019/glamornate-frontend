'use client';

/**
 * API Hooks - Core API client and React Query hooks for data access
 *
 * This module provides:
 * - Authenticated fetch wrapper for API calls
 * - API client with standardized error handling
 * - Admin-specific hooks (dashboard stats, user management, spa status)
 *
 * For entity-specific hooks, use the dedicated hook files:
 * - useSpas.ts for spa data
 * - useBookings.ts for booking data
 * - useServices.ts for service data
 * - useTherapists.ts for therapist data
 * - useReviews.ts for review data
 * - useNotifications.ts for notification data
 * - useAvailability.ts for availability data
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-provider';
import { apiClient } from '@/lib/api-client';
import type { ApiRequestOptions as ApiClientRequestOptions } from '@/lib/api-client';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';
import type { Spa, Booking, Review, Therapist, User } from '@/types';

// =============================================================================
// Re-exports — historical API preserved so existing consumers continue to work
// =============================================================================

/**
 * @deprecated Import `apiClient` directly from `@/lib/api-client`. This
 * re-export exists only to keep historical imports (`useApi`) compiling and
 * will be removed after all hooks have been migrated.
 */
export { apiClient };
export type { ApiResponse } from '@glamornate/contracts';
export type { ApiRequestOptions } from '@/lib/api-client';

/**
 * Hook to get an authenticated API client bound to the current Firebase user.
 * The underlying `apiClient` attaches the token automatically via the
 * provider registered in `auth-provider.tsx`; this hook just exposes a stable
 * reference and an `isAuthenticated` flag to consumers.
 */
export function useApiClient() {
  const { firebaseUser } = useAuth();

  return useMemo(
    () => ({
      client: apiClient,
      isAuthenticated: !!firebaseUser,
      get: <T,>(path: string, options?: ApiClientRequestOptions) => apiClient.get<T>(path, options),
      post: <T,>(path: string, body?: unknown, options?: ApiClientRequestOptions) =>
        apiClient.post<T>(path, body, options),
      put: <T,>(path: string, body?: unknown, options?: ApiClientRequestOptions) =>
        apiClient.put<T>(path, body, options),
      patch: <T,>(path: string, body?: unknown, options?: ApiClientRequestOptions) =>
        apiClient.patch<T>(path, body, options),
      delete: <T,>(path: string, options?: ApiClientRequestOptions) =>
        apiClient.delete<T>(path, options),
    }),
    [firebaseUser],
  );
}

// =============================================================================
// Firebase Firestore Helpers
// =============================================================================

function getFirebaseFirestore() {
  return getFirestoreDb();
}

// Extended types with document ID
export interface SpaDocument extends Spa {
  id: string;
}
export interface BookingDocument extends Booking {
  id: string;
}
export interface ReviewDocument extends Review {
  id: string;
}
export interface UserDocument extends User {
  id: string;
}

// ============================================================================
// SPA STATUS HOOKS
// ============================================================================

export function useUpdateSpaStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      spaId,
      status,
      reason,
    }: {
      spaId: string;
      status: 'active' | 'pending' | 'suspended' | 'verified' | 'rejected';
      reason?: string;
    }) => {
      if (!isFirebaseConfigured()) {
        throw new Error('Firebase is not configured');
      }
      const db = getFirebaseFirestore();
      const docRef = doc(db, 'spas', spaId);

      const updateData: Record<string, unknown> = {
        status,
        isActive: status === 'active' || status === 'verified',
        updatedAt: serverTimestamp(),
      };

      if (status === 'rejected' && reason) {
        updateData.rejectionReason = reason;
      }

      if (status === 'verified') {
        updateData.verification = {
          approvedAt: new Date().toISOString(),
        };
      }

      await updateDoc(docRef, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spas'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
    },
  });
}

// ============================================================================
// REVIEWS HOOKS
// ============================================================================

export function useReviews(spaId?: string, serviceId?: string) {
  return useQuery({
    queryKey: ['reviews', spaId, serviceId],
    queryFn: async (): Promise<ReviewDocument[]> => {
      if (!isFirebaseConfigured()) return [];
      const db = getFirebaseFirestore();
      const constraints: QueryConstraint[] = [];

      if (spaId) {
        constraints.push(where('spaId', '==', spaId));
      }
      if (serviceId) {
        constraints.push(where('serviceId', '==', serviceId));
      }

      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(limit(50));

      const q = query(collection(db, 'reviews'), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ReviewDocument[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ============================================================================
// USERS HOOKS (Admin only)
// ============================================================================

export function useUsers(filters?: { role?: string; status?: string; limit?: number }) {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: async (): Promise<UserDocument[]> => {
      if (!isFirebaseConfigured()) return [];
      const db = getFirebaseFirestore();
      const constraints: QueryConstraint[] = [];

      if (filters?.role) {
        constraints.push(where('role', '==', filters.role));
      }
      if (filters?.status) {
        constraints.push(where('isActive', '==', filters.status === 'active'));
      }
      if (filters?.limit) {
        constraints.push(limit(filters.limit));
      }

      constraints.push(orderBy('createdAt', 'desc'));

      const q = query(collection(db, 'users'), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as UserDocument[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ============================================================================
// DASHBOARD STATS HOOKS
// ============================================================================

export function useSpaDashboardStats(spaId: string) {
  return useQuery({
    queryKey: ['spa-dashboard-stats', spaId],
    queryFn: async () => {
      if (!isFirebaseConfigured()) return null;
      const db = getFirebaseFirestore();

      // Get bookings for this spa
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('spaId', '==', spaId),
        orderBy('createdAt', 'desc'),
        limit(100),
      );
      const bookingsSnap = await getDocs(bookingsQuery);
      const bookings = bookingsSnap.docs.map((d) => d.data()) as Booking[];

      // Get therapists for this spa
      const therapistsQuery = query(collection(db, 'therapists'), where('spaId', '==', spaId));
      const therapistsSnap = await getDocs(therapistsQuery);
      const therapists = therapistsSnap.docs.map((d) => d.data() as Therapist);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayBookings = bookings.filter((b) => {
        const bookingDate = new Date(b.slot?.date);
        return bookingDate >= today;
      });

      const totalRevenue = bookings
        .filter((b) => b.bookingStatus === 'completed')
        .reduce((sum, b) => sum + (b.pricing?.total || 0), 0);

      const monthlyRevenue = bookings
        .filter((b) => {
          const bookingDate = new Date(b.slot?.date);
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return b.bookingStatus === 'completed' && bookingDate >= monthAgo;
        })
        .reduce((sum, b) => sum + (b.pricing?.total || 0), 0);

      return {
        todayBookingsCount: todayBookings.length,
        totalRevenue,
        monthlyRevenue,
        activeStaff: therapists.filter((t) => t.status === 'online').length,
        totalStaff: therapists.length,
        recentBookings: bookings.slice(0, 5),
      };
    },
    enabled: !!spaId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useAdminDashboardStats() {
  return useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      if (!isFirebaseConfigured()) return null;
      const db = getFirebaseFirestore();

      // Get all spas
      const spasSnap = await getDocs(collection(db, 'spas'));
      const spas = spasSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as SpaDocument[];

      // Get all bookings
      const bookingsQuery = query(
        collection(db, 'bookings'),
        orderBy('createdAt', 'desc'),
        limit(200),
      );
      const bookingsSnap = await getDocs(bookingsQuery);
      const bookings = bookingsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as BookingDocument[];

      // Calculate stats
      const totalRevenue = bookings
        .filter((b) => b.bookingStatus === 'completed')
        .reduce((sum, b) => sum + (b.pricing?.total || 0), 0);

      const pendingSpas = spas.filter((s) => s.status === 'pending');

      return {
        totalSpas: spas.length,
        activeSpas: spas.filter((s) => s.status === 'active').length,
        totalBookings: bookings.length,
        totalRevenue,
        recentBookings: bookings.slice(0, 5),
        pendingSpas: pendingSpas.slice(0, 5),
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}
