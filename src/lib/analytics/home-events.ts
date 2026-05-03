/**
 * Home surface analytics — Phase 1 (industry overhaul)
 *
 * Typed event emitters for the Yes-Madam-caliber Home (hero + 13-tile grid).
 *
 * Design contract:
 *  - Event names are **snake_case** to stay compatible with Firebase
 *    Analytics (`logEvent(analytics, eventName, params)` where the event
 *    name must match `^[a-zA-Z][a-zA-Z0-9_]{0,39}$`). This keeps us drop-in
 *    ready for a future wire-up to `firebase/analytics`.
 *  - Every call is **SSR-safe** and **must never throw**. Analytics is a
 *    secondary concern; if the sink is broken, product code keeps working.
 *  - The sink is pluggable via {@link setHomeAnalyticsSink} so tests can
 *    capture events without patching globals. Production wraps the
 *    structured `logger` so the stream is observable in dev tools and
 *    forwarded to the remote logs endpoint for warn/error-level replays.
 *  - Each emitter takes strongly typed params and builds a flat
 *    params object — no nested structures — again for Firebase Analytics
 *    compatibility (nested values get dropped by `logEvent`).
 *
 * Hook-up to Firebase Analytics:
 *   TODO(analytics): wire `home_*` events into `firebase/analytics`
 *   `logEvent()` once the project exposes an initialised Analytics
 *   instance alongside Firestore. Until then, the logger-based sink
 *   surfaces events in dev tools and the remote log buffer.
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Event names (snake_case — Firebase Analytics convention)
// ---------------------------------------------------------------------------

export const HOME_EVENT_NAMES = {
  homeV2Shown: 'home_v2_shown',
  homeHeroView: 'home_hero_view',
  homeHeroSlideView: 'home_hero_slide_view',
  homeAddToCartChipClick: 'home_add_to_cart_chip_click',
  homeCategoryTileClick: 'home_category_tile_click',
} as const;

export type HomeEventName =
  (typeof HOME_EVENT_NAMES)[keyof typeof HOME_EVENT_NAMES];

// ---------------------------------------------------------------------------
// Event param shapes — flat, JSON-serialisable, Firebase-compatible
// ---------------------------------------------------------------------------

export interface HomeV2ShownParams {
  readonly flagSource: 'env' | 'remote-config' | 'override';
  readonly enabled: boolean;
}

export interface HomeHeroViewParams {
  readonly slideCount: number;
}

export interface HomeHeroSlideViewParams {
  readonly slideId: string;
}

export interface HomeAddToCartChipClickParams {
  /**
   * Product identifier that entered the cart. For the Phase 1 hero the
   * chip targets a single facial service per slide so this is the
   * service slug.
   */
  readonly productId: string;
}

export interface HomeCategoryTileClickParams {
  readonly slug: string;
  /** Zero-based position within the resolved 13-tile grid. */
  readonly position: number;
  /** `true` if this tile was rendered as the wide rectangle variant. */
  readonly isWide: boolean;
}

export type HomeEventParams =
  | HomeV2ShownParams
  | HomeHeroViewParams
  | HomeHeroSlideViewParams
  | HomeAddToCartChipClickParams
  | HomeCategoryTileClickParams;

// ---------------------------------------------------------------------------
// Sink abstraction
// ---------------------------------------------------------------------------

/**
 * A sink receives a fully-resolved event name and its (already-flattened)
 * params map. Implementations MUST NOT throw — consumers assume best-effort
 * delivery and never catch downstream.
 */
export type HomeAnalyticsSink = (
  event: HomeEventName,
  params: Readonly<Record<string, string | number | boolean>>,
) => void;

/**
 * Default sink — structured `logger.info` with the `home-analytics`
 * component tag. No-ops cleanly server-side because `logger` doesn't
 * touch `window` on the `info` path.
 */
const defaultSink: HomeAnalyticsSink = (event, params) => {
  try {
    logger.info(
      event,
      { component: 'home-analytics', action: event },
      { ...params },
    );
  } catch {
    // Analytics must never take down the UI. Swallow silently.
  }
};

let activeSink: HomeAnalyticsSink = defaultSink;

/**
 * Replace the active sink. Primarily for tests; prod should stick with
 * the default logger-backed sink until Firebase Analytics is wired.
 */
export function setHomeAnalyticsSink(sink: HomeAnalyticsSink): void {
  activeSink = sink;
}

/**
 * Restore the default sink. Call this in test teardown so events from
 * one test don't leak into the next.
 */
export function resetHomeAnalyticsSink(): void {
  activeSink = defaultSink;
}

/**
 * Internal helper — never throws. Short-circuits when the param bag is
 * malformed (non-plain object) to keep the sink contract simple.
 */
function emit(
  event: HomeEventName,
  params: Readonly<Record<string, string | number | boolean>>,
): void {
  try {
    activeSink(event, params);
  } catch {
    // Swallow. Analytics is fire-and-forget.
  }
}

// ---------------------------------------------------------------------------
// Public emitters
// ---------------------------------------------------------------------------

/**
 * Fired once per mount when the Home v2 surface renders (flag on).
 * Used to build the Phase 1 denominator for conversion dashboards.
 */
export function logHomeV2Shown(
  params: HomeV2ShownParams = { flagSource: 'env', enabled: true },
): void {
  emit(HOME_EVENT_NAMES.homeV2Shown, {
    flag_source: params.flagSource,
    enabled: params.enabled,
  });
}

/**
 * Fired once per mount when the hero carousel becomes visible. Pair with
 * `home_hero_slide_view` for per-slide funnel analysis.
 */
export function logHomeHeroView(params: HomeHeroViewParams): void {
  emit(HOME_EVENT_NAMES.homeHeroView, {
    slide_count: params.slideCount,
  });
}

/** Fired each time a new slide becomes the active slide. */
export function logHomeHeroSlideView(slideId: string): void {
  if (typeof slideId !== 'string' || slideId.length === 0) return;
  emit(HOME_EVENT_NAMES.homeHeroSlideView, {
    slide_id: slideId,
  });
}

/** Fired on the compact Add-to-Cart chip click in the hero. */
export function logHomeAddToCartChipClick(productId: string): void {
  if (typeof productId !== 'string' || productId.length === 0) return;
  emit(HOME_EVENT_NAMES.homeAddToCartChipClick, {
    product_id: productId,
  });
}

/** Fired on a category tile tap in the 13-tile grid. */
export function logHomeCategoryTileClick(
  slug: string,
  position: number,
  isWide: boolean,
): void {
  if (typeof slug !== 'string' || slug.length === 0) return;
  if (!Number.isFinite(position) || position < 0) return;
  emit(HOME_EVENT_NAMES.homeCategoryTileClick, {
    slug,
    position: Math.trunc(position),
    is_wide: Boolean(isWide),
    tile_kind: isWide ? 'wide' : 'square',
  });
}
