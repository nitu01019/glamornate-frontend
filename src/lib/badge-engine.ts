/**
 * Badge Engine
 *
 * Computes dynamic badges for services based on configurable thresholds
 * instead of relying on hardcoded badge strings in mock data.
 */

import badgeConfig from './badge-config.json';
import type { HomeService } from './mock-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BadgeType =
  | 'most-booked'
  | 'bestseller'
  | 'top-rated'
  | 'trending'
  | 'new'
  | 'discount'
  | 'featured';

export interface ServiceBadge {
  type: BadgeType;
  label: string;
  priority: number;
  color: string;
}

// ---------------------------------------------------------------------------
// Color mapping (Tailwind class strings)
// ---------------------------------------------------------------------------

const BADGE_COLORS: Record<BadgeType, string> = {
  'most-booked': 'bg-brand-maroon-500 text-white',
  bestseller: 'bg-brand-gold-500 text-brand-maroon-900',
  'top-rated': 'bg-emerald-500 text-white',
  trending: 'bg-orange-500 text-white',
  new: 'bg-sky-500 text-white',
  discount: 'bg-green-600 text-white',
  featured: 'bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(isoDate: string): number {
  const created = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

function percentileThreshold(
  values: readonly number[],
  percentile: number,
): number {
  const sorted = [...values].sort((a, b) => b - a);
  const index = Math.max(0, Math.ceil(sorted.length * percentile) - 1);
  return sorted[index] ?? 0;
}

// ---------------------------------------------------------------------------
// Badge computation
// ---------------------------------------------------------------------------

/**
 * Compute ALL qualifying badges for a service, sorted by priority (ascending
 * means lower number = higher visual priority — i.e. featured at 1 is shown
 * first).
 */
export function computeBadges(
  service: Readonly<HomeService>,
  allServices: readonly HomeService[],
): ServiceBadge[] {
  const { thresholds, featuredServiceIds } = badgeConfig;
  const badges: ServiceBadge[] = [];

  // -- featured (priority 1) ------------------------------------------------
  if ((featuredServiceIds as readonly string[]).includes(service.id)) {
    badges.push({
      type: 'featured',
      label: 'Featured',
      priority: 1,
      color: BADGE_COLORS.featured,
    });
  }

  // -- discount (priority 2) ------------------------------------------------
  if (
    service.originalPrice !== undefined &&
    service.originalPrice > service.basePrice
  ) {
    const pct = Math.round(
      (1 - service.basePrice / service.originalPrice) * 100,
    );
    badges.push({
      type: 'discount',
      label: `${pct}% Off`,
      priority: 2,
      color: BADGE_COLORS.discount,
    });
  }

  // -- most-booked (priority 3) — top 20% by bookingCount -------------------
  const bookingCounts = allServices.map((s) => s.bookingCount);
  const mostBookedThreshold = percentileThreshold(
    bookingCounts,
    thresholds.mostBooked.percentile,
  );
  if (service.bookingCount >= mostBookedThreshold) {
    badges.push({
      type: 'most-booked',
      label: 'Most Booked',
      priority: 3,
      color: BADGE_COLORS['most-booked'],
    });
  }

  // -- bestseller (priority 4) — top 10% by revenue -------------------------
  const revenues = allServices.map((s) => s.bookingCount * s.basePrice);
  const serviceRevenue = service.bookingCount * service.basePrice;
  const bestsellerThreshold = percentileThreshold(
    revenues,
    thresholds.bestseller.percentile,
  );
  if (serviceRevenue >= bestsellerThreshold) {
    badges.push({
      type: 'bestseller',
      label: 'Bestseller',
      priority: 4,
      color: BADGE_COLORS.bestseller,
    });
  }

  // -- top-rated (priority 6) -----------------------------------------------
  if (
    service.rating >= thresholds.topRated.minRating &&
    service.reviewCount >= thresholds.topRated.minReviews
  ) {
    badges.push({
      type: 'top-rated',
      label: 'Top Rated',
      priority: 6,
      color: BADGE_COLORS['top-rated'],
    });
  }

  // -- new (priority 7) — created within maxAgeDays -------------------------
  if (daysSince(service.createdAt) <= thresholds.new.maxAgeDays) {
    badges.push({
      type: 'new',
      label: 'New',
      priority: 7,
      color: BADGE_COLORS.new,
    });
  }

  // Sort by ascending priority (lower number = higher importance)
  return [...badges].sort((a, b) => a.priority - b.priority);
}

/**
 * Return only the highest-priority (lowest priority number) badge, or null if
 * the service qualifies for none.
 */
export function getTopBadge(
  service: Readonly<HomeService>,
  allServices: readonly HomeService[],
): ServiceBadge | null {
  const badges = computeBadges(service, allServices);
  return badges[0] ?? null;
}
