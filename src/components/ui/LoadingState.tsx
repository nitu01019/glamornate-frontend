'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

// =============================================================================
// Spinner Component
// =============================================================================

interface SpinnerProps {
  /** Spinner size */
  size?: SpinnerSize;
  /** Additional CSS classes */
  className?: string;
  /** Custom color class */
  color?: string;
}

const spinnerSizes: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export function Spinner({ size = 'md', className, color = 'text-brand-maroon-500' }: SpinnerProps) {
  return <Loader2 className={cn('animate-spin', spinnerSizes[size], color, className)} />;
}

// =============================================================================
// Page Loader Component
// =============================================================================

interface PageLoaderProps {
  /** Optional loading message */
  message?: string;
  /** Additional CSS classes */
  className?: string;
}

export function PageLoader({ message, className }: PageLoaderProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center min-h-[60vh] p-8', className)}>
      <div className="relative">
        {/* Gradient glow effect */}
        <div className="absolute inset-0 blur-xl bg-gradient-to-r from-brand-maroon-300 to-brand-gold-300 opacity-30 animate-pulse" />

        {/* Spinner */}
        <div className="relative">
          <Spinner size="xl" />
        </div>
      </div>

      {message && <p className="mt-6 text-sm text-slate-500 animate-pulse">{message}</p>}
    </div>
  );
}

// =============================================================================
// Skeleton Base Component
// =============================================================================

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%]',
        className,
      )}
    />
  );
}

// =============================================================================
// Card Skeleton
// =============================================================================

interface CardSkeletonProps {
  /** Show image placeholder */
  showImage?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function CardSkeleton({ showImage = true, className }: CardSkeletonProps) {
  return (
    <div className={cn('rounded-xl bg-white border border-slate-100 overflow-hidden', className)}>
      {/* Image placeholder */}
      {showImage && <Skeleton className="w-full h-48" />}

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <Skeleton className="h-5 w-3/4" />

        {/* Description */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// List Skeleton
// =============================================================================

interface ListSkeletonProps {
  /** Number of items to show */
  count?: number;
  /** Show avatar placeholder */
  showAvatar?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ListSkeleton({ count = 5, showAvatar = true, className }: ListSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 rounded-lg bg-white border border-slate-100"
        >
          {/* Avatar */}
          {showAvatar && <Skeleton className="w-10 h-10 rounded-full shrink-0" />}

          {/* Content */}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>

          {/* Action */}
          <Skeleton className="h-8 w-16 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Table Skeleton
// =============================================================================

interface TableSkeletonProps {
  /** Number of rows */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Additional CSS classes */
  className?: string;
}

export function TableSkeleton({ rows = 5, columns = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn('w-full rounded-lg border border-slate-200 overflow-hidden', className)}>
      {/* Header */}
      <div
        className="bg-slate-50 border-b border-slate-200 px-4 py-3 grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4" />
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="px-4 py-4 grid gap-4"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton key={colIdx} className={cn('h-4', colIdx === 0 ? 'w-full' : 'w-3/4')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Dashboard Skeleton
// =============================================================================

interface DashboardSkeletonProps {
  /** Additional CSS classes */
  className?: string;
}

export function DashboardSkeleton({ className }: DashboardSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="w-10 h-10 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white border border-slate-100 p-6">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="rounded-xl bg-white border border-slate-100 p-6">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl bg-white border border-slate-100 p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <ListSkeleton count={4} showAvatar />
      </div>
    </div>
  );
}

// =============================================================================
// Profile Skeleton
// =============================================================================

interface ProfileSkeletonProps {
  /** Additional CSS classes */
  className?: string;
}

export function ProfileSkeleton({ className }: ProfileSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Profile header */}
      <div className="rounded-xl bg-white border border-slate-100 p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar */}
          <Skeleton className="w-24 h-24 rounded-full shrink-0" />

          {/* Info */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <Skeleton className="h-7 w-48 mx-auto sm:mx-0" />
            <Skeleton className="h-4 w-32 mx-auto sm:mx-0" />
            <Skeleton className="h-4 w-64 mx-auto sm:mx-0" />
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Profile content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="rounded-xl bg-white border border-slate-100 p-6 space-y-4">
          <Skeleton className="h-5 w-32 mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-white border border-slate-100 p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Inline Loader
// =============================================================================

interface InlineLoaderProps {
  /** Text to display */
  text?: string;
  /** Additional CSS classes */
  className?: string;
}

export function InlineLoader({ text = 'Loading...', className }: InlineLoaderProps) {
  return (
    <div className={cn('flex items-center gap-2 text-sm text-slate-500', className)}>
      <Spinner size="sm" color="text-slate-400" />
      <span>{text}</span>
    </div>
  );
}

// =============================================================================
// Content Loader (for content areas)
// =============================================================================

interface ContentLoaderProps {
  /** Number of lines */
  lines?: number;
  /** Additional CSS classes */
  className?: string;
}

export function ContentLoader({ lines = 3, className }: ContentLoaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

// =============================================================================
// Form Skeleton
// =============================================================================

interface FormSkeletonProps {
  /** Number of fields */
  fields?: number;
  /** Additional CSS classes */
  className?: string;
}

export function FormSkeleton({ fields = 4, className }: FormSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}

// =============================================================================
// Grid Skeleton (for card grids)
// =============================================================================

interface GridSkeletonProps {
  /** Number of cards */
  count?: number;
  /** Grid columns (responsive) */
  columns?: 2 | 3 | 4;
  /** Show images in cards */
  showImages?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function GridSkeleton({
  count = 6,
  columns = 3,
  showImages = true,
  className,
}: GridSkeletonProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-6', gridCols[columns], className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} showImage={showImages} />
      ))}
    </div>
  );
}
