import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  HOME_EVENT_NAMES,
  logHomeAddToCartChipClick,
  logHomeCategoryTileClick,
  logHomeHeroSlideView,
  logHomeHeroView,
  logHomeV2Shown,
  resetHomeAnalyticsSink,
  setHomeAnalyticsSink,
  type HomeEventName,
} from '../home-events';

// Mock the structured logger so the default sink path is inspectable without
// actually writing to console or the remote buffer.
const loggerInfo = vi.fn();
vi.mock('@/lib/logger', () => ({
  logger: {
    info: (
      message: string,
      context?: unknown,
      metadata?: unknown,
    ) => loggerInfo(message, context, metadata),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

interface CapturedEvent {
  readonly event: HomeEventName;
  readonly params: Readonly<Record<string, string | number | boolean>>;
}

describe('home-events analytics emitter', () => {
  let captured: CapturedEvent[];

  beforeEach(() => {
    captured = [];
    setHomeAnalyticsSink((event, params) => {
      captured.push({ event, params });
    });
    loggerInfo.mockClear();
  });

  afterEach(() => {
    resetHomeAnalyticsSink();
  });

  it('uses snake_case event names for Firebase Analytics compatibility', () => {
    const snakeCase = /^[a-z][a-z0-9_]*$/;
    for (const name of Object.values(HOME_EVENT_NAMES)) {
      expect(name).toMatch(snakeCase);
    }
  });

  it('logHomeV2Shown emits home_v2_shown with the flag source + enabled bit', () => {
    logHomeV2Shown({ flagSource: 'env', enabled: true });
    expect(captured).toHaveLength(1);
    expect(captured[0].event).toBe(HOME_EVENT_NAMES.homeV2Shown);
    expect(captured[0].params).toEqual({
      flag_source: 'env',
      enabled: true,
    });
  });

  it('logHomeV2Shown defaults to env/enabled=true when called with no args', () => {
    logHomeV2Shown();
    expect(captured).toHaveLength(1);
    expect(captured[0].params).toEqual({
      flag_source: 'env',
      enabled: true,
    });
  });

  it('logHomeHeroView emits home_hero_view with slide_count', () => {
    logHomeHeroView({ slideCount: 6 });
    expect(captured).toHaveLength(1);
    expect(captured[0].event).toBe(HOME_EVENT_NAMES.homeHeroView);
    expect(captured[0].params).toEqual({ slide_count: 6 });
  });

  it('logHomeHeroSlideView emits home_hero_slide_view with the slide id', () => {
    logHomeHeroSlideView('hero-slide-2');
    expect(captured).toHaveLength(1);
    expect(captured[0].event).toBe(HOME_EVENT_NAMES.homeHeroSlideView);
    expect(captured[0].params).toEqual({ slide_id: 'hero-slide-2' });
  });

  it('logHomeHeroSlideView ignores empty slide ids', () => {
    logHomeHeroSlideView('');
    expect(captured).toHaveLength(0);
  });

  it('logHomeAddToCartChipClick emits home_add_to_cart_chip_click with the product id', () => {
    logHomeAddToCartChipClick('astaberry-wine-facial');
    expect(captured).toHaveLength(1);
    expect(captured[0].event).toBe(
      HOME_EVENT_NAMES.homeAddToCartChipClick,
    );
    expect(captured[0].params).toEqual({
      product_id: 'astaberry-wine-facial',
    });
  });

  it('logHomeAddToCartChipClick ignores empty product ids', () => {
    logHomeAddToCartChipClick('');
    expect(captured).toHaveLength(0);
  });

  it('logHomeCategoryTileClick emits a flat payload with slug + position + is_wide', () => {
    logHomeCategoryTileClick('facials', 0, true);
    expect(captured).toHaveLength(1);
    const entry = captured[0];
    expect(entry.event).toBe(HOME_EVENT_NAMES.homeCategoryTileClick);
    expect(entry.params).toEqual({
      slug: 'facials',
      position: 0,
      is_wide: true,
      tile_kind: 'wide',
    });
  });

  it('logHomeCategoryTileClick marks non-wide tiles as square', () => {
    logHomeCategoryTileClick('clean-ups', 1, false);
    expect(captured).toHaveLength(1);
    expect(captured[0].params).toEqual({
      slug: 'clean-ups',
      position: 1,
      is_wide: false,
      tile_kind: 'square',
    });
  });

  it('logHomeCategoryTileClick rejects empty slugs and negative positions', () => {
    logHomeCategoryTileClick('', 0, false);
    logHomeCategoryTileClick('valid-slug', -1, false);
    logHomeCategoryTileClick('valid-slug', Number.NaN, false);
    expect(captured).toHaveLength(0);
  });

  it('logHomeCategoryTileClick truncates fractional positions to integers', () => {
    logHomeCategoryTileClick('waxing', 2.7, false);
    expect(captured[0].params.position).toBe(2);
  });

  it('sink failures are swallowed so analytics never takes down the UI', () => {
    setHomeAnalyticsSink(() => {
      throw new Error('remote sink exploded');
    });

    expect(() => logHomeHeroSlideView('hero-slide-0')).not.toThrow();
  });

  it('resetHomeAnalyticsSink restores the default logger-backed sink', () => {
    resetHomeAnalyticsSink();
    logHomeHeroView({ slideCount: 3 });

    expect(loggerInfo).toHaveBeenCalledTimes(1);
    const [message, context, metadata] = loggerInfo.mock.calls[0];
    expect(message).toBe(HOME_EVENT_NAMES.homeHeroView);
    expect(context).toEqual({
      component: 'home-analytics',
      action: HOME_EVENT_NAMES.homeHeroView,
    });
    expect(metadata).toEqual({ slide_count: 3 });
  });

  it('default sink is SSR-safe (does not reference window)', () => {
    resetHomeAnalyticsSink();
    const originalWindow = globalThis.window;
    // Simulate SSR by stripping window.
    // @ts-expect-error — deliberate teardown
    delete globalThis.window;
    try {
      expect(() => logHomeV2Shown()).not.toThrow();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
