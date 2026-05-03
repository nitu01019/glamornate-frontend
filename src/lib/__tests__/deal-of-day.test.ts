import { describe, it, expect } from 'vitest';
import { selectDealOfDay } from '../deal-of-day';
import type { Promotion } from '@/lib/mock-data';

function makePromo(overrides: Partial<Promotion>): Promotion {
  return {
    id: overrides.id ?? 'p1',
    title: overrides.title ?? 'Title',
    subtitle: overrides.subtitle ?? 'Sub',
    description: overrides.description ?? 'Desc',
    image: overrides.image ?? '/img.webp',
    ctaText: overrides.ctaText ?? 'Book Now',
    ctaLink: overrides.ctaLink ?? '/offers',
    bgColor: overrides.bgColor ?? '#fff',
    ordering: overrides.ordering ?? 0,
    isActive: overrides.isActive ?? true,
    ...overrides,
  };
}

describe('selectDealOfDay', () => {
  it('returns null for an empty list', () => {
    expect(selectDealOfDay([])).toBeNull();
  });

  it('returns null when all promotions are inactive', () => {
    const promos: Promotion[] = [
      makePromo({ id: 'a', isActive: false }),
      makePromo({ id: 'b', isActive: false }),
    ];
    expect(selectDealOfDay(promos)).toBeNull();
  });

  it('returns null when all promotions are expired', () => {
    const promos: Promotion[] = [
      makePromo({ id: 'a', validUntil: '2000-01-01T00:00:00Z' }),
      makePromo({ id: 'b', validUntil: '2000-06-01T00:00:00Z' }),
    ];
    // dateOverride anchors "now" to 2026-04-17 which is after 2000.
    expect(selectDealOfDay(promos, '2026-04-17')).toBeNull();
  });

  it('selects an active, non-expired promotion deterministically by date', () => {
    const promos: Promotion[] = [
      makePromo({ id: 'a', isActive: true }),
      makePromo({ id: 'b', isActive: true }),
      makePromo({ id: 'c', isActive: true }),
    ];
    const first = selectDealOfDay(promos, '2026-04-17');
    const second = selectDealOfDay(promos, '2026-04-17');
    expect(first).not.toBeNull();
    expect(first?.id).toBe(second?.id);
  });

  it('rotates selection across different dates', () => {
    const promos: Promotion[] = Array.from({ length: 8 }, (_, i) =>
      makePromo({ id: `p${i}`, isActive: true }),
    );
    const pickedIds = new Set<string>();
    for (let d = 1; d <= 14; d++) {
      const dateStr = `2026-04-${String(d).padStart(2, '0')}`;
      const deal = selectDealOfDay(promos, dateStr);
      if (deal) pickedIds.add(deal.id);
    }
    // Over two weeks with 8 promos we should visit more than one unique id.
    expect(pickedIds.size).toBeGreaterThan(1);
  });

  it('skips inactive/expired entries and picks from the remainder', () => {
    const promos: Promotion[] = [
      makePromo({ id: 'expired', validUntil: '2000-01-01T00:00:00Z' }),
      makePromo({ id: 'inactive', isActive: false }),
      makePromo({ id: 'live', isActive: true }),
    ];
    const deal = selectDealOfDay(promos, '2026-04-17');
    expect(deal?.id).toBe('live');
  });
});
