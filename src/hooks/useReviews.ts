'use client';

/**
 * Review Hooks - React Query hooks for review data access
 * Provides data fetching and submission for spa reviews
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  firebaseClientWrapper, 
  QueryConstraintConfig 
} from '@/lib/firebase-client-wrapper';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-provider';
import { parseError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { spaQueryKeys } from './useSpas';
import type { Review, ReviewAspect } from '@/types';

const reviewsLogger = logger.child({ component: 'useReviews' });

// =============================================================================
// Types
// =============================================================================

export interface ReviewWithId extends Review {
  id: string;
}

export interface ReviewFilters {
  /** Filter by spa ID */
  spaId?: string;
  /** Filter by therapist ID */
  therapistId?: string;
  /** Minimum rating (1-5) */
  minRating?: number;
  /** Only verified reviews */
  verified?: boolean;
  /** Sort field */
  sortBy?: 'rating' | 'helpful' | 'createdAt';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Maximum results */
  limit?: number;
}

export interface SubmitReviewInput {
  bookingId: string;
  spaId: string;
  therapistId?: string;
  rating: number;
  aspects: ReviewAspect;
  comment: string;
  title?: string;
  photos?: string[];
  [key: string]: unknown;
}

// =============================================================================
// Query Keys
// =============================================================================

export const reviewQueryKeys = {
  all: ['reviews'] as const,
  lists: () => [...reviewQueryKeys.all, 'list'] as const,
  list: (filters?: ReviewFilters) => [...reviewQueryKeys.lists(), filters] as const,
  spa: (spaId: string) => [...reviewQueryKeys.all, 'spa', spaId] as const,
  therapist: (therapistId: string) => [...reviewQueryKeys.all, 'therapist', therapistId] as const,
  user: (userId: string) => [...reviewQueryKeys.all, 'user', userId] as const,
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Fetch reviews for a spa
 * 
 * @param spaId - The spa document ID
 * @param filters - Optional filters for rating, sorting
 * @returns Query result with review list
 * 
 * @example
 * ```tsx
 * const { data: reviews } = useReviews('spa-123');
 * ```
 */
export function useReviews(spaId: string | null | undefined, filters?: Omit<ReviewFilters, 'spaId'>) {
  const hooksLogger = reviewsLogger;

  return useQuery({
    queryKey: reviewQueryKeys.spa(spaId ?? ''),
    queryFn: async (): Promise<ReviewWithId[]> => {
      if (!spaId) return [];

      if (!isFirebaseConfigured()) {
        hooksLogger.debug('Firebase not configured, returning empty review list');
        return [];
      }

      try {
        const constraints: QueryConstraintConfig[] = [
          {
            type: 'where',
            field: 'spaId',
            operator: '==',
            value: spaId,
          },
        ];

        if (filters?.minRating) {
          constraints.push({
            type: 'where',
            field: 'rating',
            operator: '>=',
            value: filters.minRating,
          });
        }

        // Add ordering
        const sortField = filters?.sortBy === 'helpful' 
          ? 'helpfulCount' 
          : filters?.sortBy === 'rating'
          ? 'rating'
          : 'createdAt';
        
        constraints.push({
          type: 'orderBy',
          field: sortField,
          direction: filters?.sortDirection ?? 'desc',
        });

        if (filters?.limit) {
          constraints.push({
            type: 'limit',
            count: filters.limit,
          });
        } else {
          // Default limit
          constraints.push({
            type: 'limit',
            count: 50,
          });
        }

        const result = await firebaseClientWrapper.getDocuments<Review>('reviews', constraints);
        
        return result.documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        hooksLogger.error('Failed to fetch reviews', error, { spaId, filters });
        throw parseError(error);
      }
    },
    enabled: !!spaId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Submit a new review
 * Calls the submitReview callable function
 * 
 * @returns Mutation for submitting review
 * 
 * @example
 * ```tsx
 * const { mutate: submitReview } = useSubmitReview();
 * submitReview({ spaId: '...', rating: 5, comment: 'Great!' });
 * ```
 */
export function useSubmitReview() {
  const queryClient = useQueryClient();
  const { firebaseUser } = useAuth();
  const hooksLogger = reviewsLogger;

  return useMutation({
    mutationFn: async (data: SubmitReviewInput): Promise<{ reviewId: string }> => {
      hooksLogger.info('Submitting review', { 
        spaId: data.spaId, 
        bookingId: data.bookingId,
        rating: data.rating 
      });
      
      return firebaseClientWrapper.callFunction<SubmitReviewInput, { reviewId: string }>(
        'submitReview',
        data
      );
    },
    onSuccess: (_, variables) => {
      // Invalidate reviews for the spa
      queryClient.invalidateQueries({ 
        queryKey: reviewQueryKeys.spa(variables.spaId) 
      });
      
      // Invalidate spa details (rating may have changed)
      queryClient.invalidateQueries({ 
        queryKey: spaQueryKeys.detail(variables.spaId) 
      });
      
      // Invalidate user's reviews
      if (firebaseUser?.uid) {
        queryClient.invalidateQueries({ 
          queryKey: reviewQueryKeys.user(firebaseUser.uid) 
        });
      }
    },
    onError: (error) => {
      hooksLogger.error('Review submission failed', error);
    },
  });
}

/**
 * Mark a review as helpful
 * 
 * @returns Mutation for marking review helpful
 */
export function useMarkReviewHelpful() {
  const queryClient = useQueryClient();
  const hooksLogger = reviewsLogger;

  return useMutation({
    mutationFn: async (data: { reviewId: string; spaId: string }): Promise<void> => {
      hooksLogger.info('Marking review helpful', { reviewId: data.reviewId });
      
      await firebaseClientWrapper.callFunction('markReviewHelpful', {
        reviewId: data.reviewId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: reviewQueryKeys.spa(variables.spaId) 
      });
    },
    onError: (error) => {
      hooksLogger.error('Mark review helpful failed', error);
    },
  });
}

/**
 * Report a review
 * 
 * @returns Mutation for reporting review
 */
export function useReportReview() {
  const queryClient = useQueryClient();
  const hooksLogger = reviewsLogger;

  return useMutation({
    mutationFn: async (data: { 
      reviewId: string; 
      spaId: string;
      reason: string;
    }): Promise<void> => {
      hooksLogger.info('Reporting review', { reviewId: data.reviewId });
      
      await firebaseClientWrapper.callFunction('reportReview', {
        reviewId: data.reviewId,
        reason: data.reason,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: reviewQueryKeys.spa(variables.spaId) 
      });
    },
    onError: (error) => {
      hooksLogger.error('Report review failed', error);
    },
  });
}

/**
 * Fetch reviews by a therapist
 * 
 * @param therapistId - The therapist document ID
 * @returns Query result with therapist's reviews
 */
export function useTherapistReviews(therapistId: string | null | undefined) {
  const hooksLogger = reviewsLogger;

  return useQuery({
    queryKey: reviewQueryKeys.therapist(therapistId ?? ''),
    queryFn: async (): Promise<ReviewWithId[]> => {
      if (!therapistId) return [];

      if (!isFirebaseConfigured()) {
        return [];
      }

      try {
        const constraints: QueryConstraintConfig[] = [
          {
            type: 'where',
            field: 'therapistId',
            operator: '==',
            value: therapistId,
          },
          {
            type: 'orderBy',
            field: 'createdAt',
            direction: 'desc',
          },
          {
            type: 'limit',
            count: 30,
          },
        ];

        const result = await firebaseClientWrapper.getDocuments<Review>('reviews', constraints);
        
        return result.documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        hooksLogger.error('Failed to fetch therapist reviews', error, { therapistId });
        throw parseError(error);
      }
    },
    enabled: !!therapistId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch reviews by current user
 * 
 * @returns Query result with user's reviews
 */
export function useUserReviews() {
  const { firebaseUser } = useAuth();
  const hooksLogger = reviewsLogger;

  return useQuery({
    queryKey: reviewQueryKeys.user(firebaseUser?.uid ?? ''),
    queryFn: async (): Promise<ReviewWithId[]> => {
      if (!firebaseUser?.uid) return [];

      if (!isFirebaseConfigured()) {
        return [];
      }

      try {
        const constraints: QueryConstraintConfig[] = [
          {
            type: 'where',
            field: 'userId',
            operator: '==',
            value: firebaseUser.uid,
          },
          {
            type: 'orderBy',
            field: 'createdAt',
            direction: 'desc',
          },
        ];

        const result = await firebaseClientWrapper.getDocuments<Review>('reviews', constraints);
        
        return result.documents.map((doc) => ({
          id: doc.id,
          ...doc.data,
        }));
      } catch (error) {
        hooksLogger.error('Failed to fetch user reviews', error);
        throw parseError(error);
      }
    },
    enabled: !!firebaseUser?.uid,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get review statistics for a spa
 * 
 * @param spaId - The spa document ID
 * @returns Query result with review statistics
 */
export function useReviewStats(spaId: string | null | undefined) {
  const hooksLogger = reviewsLogger;

  return useQuery({
    queryKey: [...reviewQueryKeys.spa(spaId ?? ''), 'stats'] as const,
    queryFn: async (): Promise<{
      total: number;
      average: number;
      distribution: Record<number, number>;
    } | null> => {
      if (!spaId) return null;

      if (!isFirebaseConfigured()) {
        return null;
      }

      try {
        const constraints: QueryConstraintConfig[] = [
          {
            type: 'where',
            field: 'spaId',
            operator: '==',
            value: spaId,
          },
        ];

        const result = await firebaseClientWrapper.getDocuments<Review>('reviews', constraints);
        
        const reviews = result.documents;
        const total = reviews.length;
        
        if (total === 0) {
          return {
            total: 0,
            average: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          };
        }

        const sumRating = reviews.reduce((sum, doc) => sum + (doc.data.rating || 0), 0);
        const average = sumRating / total;

        const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviews.forEach((doc) => {
          const rating = Math.round(doc.data.rating || 0);
          if (rating >= 1 && rating <= 5) {
            distribution[rating]++;
          }
        });

        return {
          total,
          average: Math.round(average * 10) / 10,
          distribution,
        };
      } catch (error) {
        hooksLogger.error('Failed to fetch review stats', error, { spaId });
        throw parseError(error);
      }
    },
    enabled: !!spaId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
