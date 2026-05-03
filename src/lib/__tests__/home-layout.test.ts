import { describe, expect, it } from 'vitest';

import {
  HOME_GRID_TILE_COUNT,
  HOME_GRID_WIDE_POSITIONS,
  buildHomeCategoryLayout,
  type CatalogCategory,
} from '@/lib/home-layout';
import { catalogCategories } from '@/data/glamornate-catalog';

const CANONICAL_SLUGS: readonly string[] = [
  'facials',
  'clean-ups',
  'waxing',
  'manicure-pedicure',
  'threading',
  'bleach',
  'body-polishing-massage',
  'de-tan-pack',
  'hair-root-touch-up',
  'global-hair-coloring',
  'hair-spa',
  'hair-transformation',
  'hair-treatments',
];

function catalogFor(slug: string): CatalogCategory {
  const record = catalogCategories.find((c) => c.slug === slug);
  if (!record) {
    throw new Error(`catalog missing slug ${slug}`);
  }
  return { slug: record.slug, name: record.name, image: record.image };
}

const CANONICAL_ITEMS: readonly CatalogCategory[] = CANONICAL_SLUGS.map(catalogFor);

describe('HOME_GRID_WIDE_POSITIONS', () => {
  it('contains exactly two positions: row-1 and row-3 anchors', () => {
    expect([...HOME_GRID_WIDE_POSITIONS]).toEqual([0, 6]);
  });
});

describe('buildHomeCategoryLayout', () => {
  it('returns exactly 13 slots for the canonical 13-item input', () => {
    const slots = buildHomeCategoryLayout(CANONICAL_ITEMS);
    expect(slots).toHaveLength(HOME_GRID_TILE_COUNT);
  });

  it('marks positions 0 and 6 as wide and the other eleven as square', () => {
    const slots = buildHomeCategoryLayout(CANONICAL_ITEMS);
    const wideIndexes = slots
      .filter((s) => s.kind === 'wide')
      .map((s) => s.index);
    expect(wideIndexes).toEqual([0, 6]);
    expect(slots.filter((s) => s.kind === 'square')).toHaveLength(11);
  });

  it('assigns priority: true only to the first slot', () => {
    const slots = buildHomeCategoryLayout(CANONICAL_ITEMS);
    expect(slots[0].priority).toBe(true);
    for (let i = 1; i < slots.length; i += 1) {
      expect(slots[i].priority).toBe(false);
    }
  });

  it('resolves a deterministic slug order regardless of input order', () => {
    const shuffled = [...CANONICAL_ITEMS].sort(() => -1);
    const slotsFromShuffled = buildHomeCategoryLayout(shuffled);
    const slotsFromCanonical = buildHomeCategoryLayout(CANONICAL_ITEMS);

    expect(slotsFromShuffled.map((s) => s.category.slug)).toEqual(
      slotsFromCanonical.map((s) => s.category.slug),
    );
  });

  it('pads from the bundled catalog when fewer than 13 items are supplied', () => {
    const sparse = CANONICAL_ITEMS.slice(0, 4);
    const slots = buildHomeCategoryLayout(sparse);

    expect(slots).toHaveLength(HOME_GRID_TILE_COUNT);
    expect(slots.filter((s) => s.kind === 'wide')).toHaveLength(2);
    // Every canonical slug resolves via the fallback.
    expect(new Set(slots.map((s) => s.category.slug)).size).toBe(
      HOME_GRID_TILE_COUNT,
    );
  });

  it('falls back to the full catalog when given an empty list', () => {
    const slots = buildHomeCategoryLayout([]);
    expect(slots).toHaveLength(HOME_GRID_TILE_COUNT);
    expect(slots.filter((s) => s.kind === 'wide')).toHaveLength(2);
  });

  it('produces a stable snapshot for the canonical input', () => {
    const snapshot = buildHomeCategoryLayout(CANONICAL_ITEMS).map((s) => ({
      index: s.index,
      kind: s.kind,
      priority: s.priority,
      slug: s.category.slug,
    }));

    expect(snapshot).toMatchInlineSnapshot(`
      [
        {
          "index": 0,
          "kind": "wide",
          "priority": true,
          "slug": "facials",
        },
        {
          "index": 1,
          "kind": "square",
          "priority": false,
          "slug": "clean-ups",
        },
        {
          "index": 2,
          "kind": "square",
          "priority": false,
          "slug": "waxing",
        },
        {
          "index": 3,
          "kind": "square",
          "priority": false,
          "slug": "manicure-pedicure",
        },
        {
          "index": 4,
          "kind": "square",
          "priority": false,
          "slug": "threading",
        },
        {
          "index": 5,
          "kind": "square",
          "priority": false,
          "slug": "bleach",
        },
        {
          "index": 6,
          "kind": "wide",
          "priority": false,
          "slug": "body-polishing-massage",
        },
        {
          "index": 7,
          "kind": "square",
          "priority": false,
          "slug": "de-tan-pack",
        },
        {
          "index": 8,
          "kind": "square",
          "priority": false,
          "slug": "hair-root-touch-up",
        },
        {
          "index": 9,
          "kind": "square",
          "priority": false,
          "slug": "global-hair-coloring",
        },
        {
          "index": 10,
          "kind": "square",
          "priority": false,
          "slug": "hair-spa",
        },
        {
          "index": 11,
          "kind": "square",
          "priority": false,
          "slug": "hair-transformation",
        },
        {
          "index": 12,
          "kind": "square",
          "priority": false,
          "slug": "hair-treatments",
        },
      ]
    `);
  });
});
