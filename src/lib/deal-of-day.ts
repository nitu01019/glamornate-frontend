import type { Promotion } from '@/lib/mock-data';

/**
 * Shape we expect on a Promotion that may carry an "active" flag and/or a
 * `validUntil` timestamp. Both are optional — if absent the promotion is
 * considered eligible.
 */
type PromotionWithStatus = Promotion & {
  active?: boolean;
  isActive?: boolean;
};

function isEligible(promo: PromotionWithStatus, nowMs: number): boolean {
  // If an explicit active flag is present and false, exclude.
  if (promo.active === false) return false;
  if (promo.isActive === false) return false;

  // If expired, exclude.
  if (promo.validUntil) {
    const until = new Date(promo.validUntil).getTime();
    if (Number.isFinite(until) && until < nowMs) return false;
  }

  return true;
}

/**
 * Select the "Deal of the Day" from available promotions.
 *
 * Uses a deterministic hash of the current date string so the selected
 * deal rotates daily without any manual intervention or server-side state.
 * Every user sees the same deal on the same calendar day.
 *
 * Inactive or expired promotions are filtered out before selection. When
 * no eligible promotion exists the function returns `null` and the caller
 * is responsible for rendering an explicit empty state.
 *
 * @param promotions - The full list of promotions (any status).
 * @param dateOverride - Optional ISO date string (YYYY-MM-DD) for testing.
 * @returns The selected promotion, or null when no eligible promotion exists.
 */
export function selectDealOfDay(
  promotions: ReadonlyArray<Promotion>,
  dateOverride?: string,
): Promotion | null {
  if (promotions.length === 0) return null;

  const nowMs = dateOverride ? new Date(`${dateOverride}T00:00:00Z`).getTime() : Date.now();

  const eligible = promotions.filter((p) => isEligible(p as PromotionWithStatus, nowMs));

  if (eligible.length === 0) return null;

  const dateStr = dateOverride ?? new Date().toISOString().slice(0, 10);

  // Simple string hash (djb2-style) seeded by the date.
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }

  const index = Math.abs(hash) % eligible.length;
  return eligible[index];
}
