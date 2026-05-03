'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Inbox, Calendar, ShoppingBag, Heart, Users, FileText, Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export type EmptyStateVariant = 'default' | 'compact';

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: ReactNode;
}

export interface EmptyStateProps {
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Icon to display */
  icon?: ReactNode;
  /** Primary action */
  action?: EmptyStateAction;
  /** Secondary action */
  secondaryAction?: EmptyStateAction;
  /** Display variant */
  variant?: EmptyStateVariant;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  variant = 'default',
  className,
}: EmptyStateProps) {
  if (variant === 'compact') {
    return (
      <div
        className={cn('flex flex-col items-center justify-center py-8 px-4 text-center', className)}
      >
        {/* Icon */}
        {icon && (
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 text-slate-400 mb-3">
            {icon}
          </div>
        )}

        {/* Text */}
        <p className="text-sm font-medium text-slate-700 mb-1">{title}</p>
        {description && <p className="text-xs text-slate-500 max-w-[200px]">{description}</p>}

        {/* Action */}
        {action && (
          <div className="mt-3">
            {action.href ? (
              <Button asChild size="sm" variant="outline">
                <Link href={action.href}>
                  {action.icon}
                  {action.label}
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={action.onClick}>
                {action.icon}
                {action.label}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div
      className={cn('flex flex-col items-center justify-center py-16 px-8 text-center', className)}
    >
      {/* Decorative background */}
      <div className="relative mb-6">
        {/* Gradient glow */}
        <div className="absolute inset-0 w-24 h-24 bg-gradient-to-br from-brand-maroon-200 to-brand-gold-200 rounded-full blur-2xl opacity-50" />

        {/* Icon container */}
        <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-maroon-50 to-brand-gold-50 border border-brand-maroon-100/50">
          <div className="text-brand-maroon-400">{icon ?? <Inbox className="w-10 h-10" />}</div>
        </div>

        {/* Sparkle decoration */}
        <div className="absolute -top-1 -right-1">
          <Sparkles className="w-5 h-5 text-brand-gold-400" />
        </div>
      </div>

      {/* Text */}
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      {description && <p className="text-slate-500 max-w-sm mb-6 leading-relaxed">{description}</p>}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {action && (
            <>
              {action.href ? (
                <Button
                  asChild
                  className="bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 hover:from-brand-maroon-600 hover:to-brand-gold-600 text-white shadow-lg shadow-brand-maroon-200"
                >
                  <Link href={action.href}>
                    {action.icon ?? <Plus className="w-4 h-4 mr-2" />}
                    {action.label}
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={action.onClick}
                  className="bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 hover:from-brand-maroon-600 hover:to-brand-gold-600 text-white shadow-lg shadow-brand-maroon-200"
                >
                  {action.icon ?? <Plus className="w-4 h-4 mr-2" />}
                  {action.label}
                </Button>
              )}
            </>
          )}

          {secondaryAction && (
            <>
              {secondaryAction.href ? (
                <Button asChild variant="outline">
                  <Link href={secondaryAction.href}>
                    {secondaryAction.icon}
                    {secondaryAction.label}
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" onClick={secondaryAction.onClick}>
                  {secondaryAction.icon}
                  {secondaryAction.label}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Preset Empty States
// =============================================================================

interface PresetEmptyStateProps {
  action?: EmptyStateAction;
  className?: string;
}

export function NoBookings({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      title="No bookings yet"
      description="You haven't made any spa bookings yet. Treat yourself to some relaxation!"
      icon={<Calendar className="w-10 h-10" />}
      action={
        action ?? {
          label: 'Book Now',
          href: '/spas',
        }
      }
      className={className}
    />
  );
}

export function NoFavorites({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      title="No favorites yet"
      description="Start adding spas to your favorites to easily find them later."
      icon={<Heart className="w-10 h-10" />}
      action={
        action ?? {
          label: 'Explore Spas',
          href: '/spas',
        }
      }
      className={className}
    />
  );
}

export function NoServices({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      title="No services available"
      description="There are no services listed yet. Check back later for new offerings."
      icon={<Sparkles className="w-10 h-10" />}
      action={action}
      className={className}
    />
  );
}

export function NoUsers({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      title="No users found"
      description="There are no users matching your criteria."
      icon={<Users className="w-10 h-10" />}
      action={action}
      className={className}
    />
  );
}

export function NoOrders({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      title="No orders yet"
      description="You haven't placed any orders. Start shopping to see your order history here."
      icon={<ShoppingBag className="w-10 h-10" />}
      action={
        action ?? {
          label: 'Start Shopping',
          href: '/services',
        }
      }
      className={className}
    />
  );
}

export function NoContent({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      title="No content available"
      description="This section is empty. Content will appear here once added."
      icon={<FileText className="w-10 h-10" />}
      action={action}
      className={className}
    />
  );
}

export function NoData({
  title = 'No data available',
  description = "There's nothing to display right now.",
  action,
  className,
}: PresetEmptyStateProps & { title?: string; description?: string }) {
  return (
    <EmptyState
      title={title}
      description={description}
      icon={<Inbox className="w-10 h-10" />}
      action={action}
      className={className}
    />
  );
}
