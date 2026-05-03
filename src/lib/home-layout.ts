/**
 * Pure layout utility for the Yes-Madam-style home category grid.
 *
 * Given the 13 Glamornate catalog categories, returns a deterministic
 * ordered list of slots where exactly two slots are rendered as WIDE
 * rectangles (the visual row-1 and row-3 anchors on a 3-col mobile grid)
 * and the remaining eleven slots are rendered as SQUARE tiles.
 *
 * This module is pure — no React, no side effects — so it is trivial to
 * unit-test and safe to call from both the server (RSC prefetch) and the
 * client (during render).
 */

import { catalogCategories } from '@/data/glamornate-catalog';

/**
 * Minimum shape required for a category to be laid out. Accepts any object
 * that exposes `slug`, `name`, and `image` strings — matches the public
 * surface of `ServiceCategory` without coupling this module to the full
 * catalog record.
 */
export interface CatalogCategory {
  readonly slug: string;
  readonly name: string;
  readonly image: string;
}

/** A slot kind drives visual geometry — wide = 2:1, square = 1:1. */
export type HomeCategoryKind = 'wide' | 'square';

/**
 * A single position in the home category grid. Consumers iterate over the
 * resolved layout in order; the `kind` controls which tile component renders.
 */
export interface HomeCategoryLayoutSlot {
  readonly kind: HomeCategoryKind;
  readonly category: CatalogCategory;
  /** True only for the LCP-critical first slot (the row-1 wide tile). */
  readonly priority: boolean;
  /** Zero-based position in the flat grid order. */
  readonly index: number;
}

/**
 * Flat-list positions that should be rendered as WIDE tiles.
 *
 * On a 3-col mobile grid a wide tile spans all three columns, so the
 * rhythm becomes:
 *   Row 1  → wide (index 0)
 *   Row 2  → square square square (indexes 1, 2, 3)
 *   Row 3  → square square (indexes 4, 5) + wide anchor (index 6)
 *   Row 4+ → squares continue
 *
 * The second wide anchor at index 6 matches the Yes-Madam cadence of
 * "one wide, five squares, one wide" before the grid resumes squares.
 */
export const HOME_GRID_WIDE_POSITIONS: readonly number[] = [0, 6] as const;

/** Canonical slug order, authored to put the strongest imagery up top. */
const HOME_GRID_CANONICAL_ORDER: readonly string[] = [
  'facials', // 0 — WIDE (row 1 anchor, LCP)
  'clean-ups', // 1
  'waxing', // 2
  'manicure-pedicure', // 3
  'threading', // 4
  'bleach', // 5
  'body-polishing-massage', // 6 — WIDE (row 3 anchor)
  'de-tan-pack', // 7
  'hair-root-touch-up', // 8
  'global-hair-coloring', // 9
  'hair-spa', // 10
  'hair-transformation', // 11
  'hair-treatments', // 12
];

/** Total number of tiles the home grid must render. */
export const HOME_GRID_TILE_COUNT = 13 as const;

function toCatalogCategory(record: {
  slug: string;
  name: string;
  image: string;
}): CatalogCategory {
  return { slug: record.slug, name: record.name, image: record.image };
}

/**
 * Build the deterministic 13-slot layout for the home category grid.
 *
 * Contract:
 * - Returns exactly {@link HOME_GRID_TILE_COUNT} slots.
 * - Slots at positions in {@link HOME_GRID_WIDE_POSITIONS} are `wide`;
 *   all other slots are `square`.
 * - Categories are emitted in the canonical order above. Any incoming
 *   categories are looked up by `slug`; gaps are filled from the bundled
 *   `catalogCategories` fallback so the visual count is never less than 13.
 * - Only the first slot (index 0) has `priority: true`.
 */
export function buildHomeCategoryLayout(
  categories: readonly CatalogCategory[],
): readonly HomeCategoryLayoutSlot[] {
  const incomingBySlug = new Map<string, CatalogCategory>();
  for (const item of categories) {
    incomingBySlug.set(item.slug, item);
  }

  const fallbackBySlug = new Map<string, CatalogCategory>();
  for (const item of catalogCategories) {
    fallbackBySlug.set(item.slug, toCatalogCategory(item));
  }

  const wideSet = new Set<number>(HOME_GRID_WIDE_POSITIONS);
  const usedSlugs = new Set<string>();

  const resolved: HomeCategoryLayoutSlot[] = [];

  for (let index = 0; index < HOME_GRID_TILE_COUNT; index += 1) {
    const canonicalSlug = HOME_GRID_CANONICAL_ORDER[index];
    const fromIncoming = incomingBySlug.get(canonicalSlug);
    const fromFallback = fallbackBySlug.get(canonicalSlug);

    let chosen: CatalogCategory | undefined =
      fromIncoming !== undefined ? fromIncoming : fromFallback;

    if (chosen === undefined) {
      // Canonical slug missing everywhere — borrow the next unused slug
      // from the incoming list, then from the fallback, to guarantee 13
      // visible tiles under all conditions.
      for (const [slug, item] of incomingBySlug) {
        if (!usedSlugs.has(slug)) {
          chosen = item;
          break;
        }
      }
      if (chosen === undefined) {
        for (const [slug, item] of fallbackBySlug) {
          if (!usedSlugs.has(slug)) {
            chosen = item;
            break;
          }
        }
      }
    }

    if (chosen === undefined) {
      // Should never happen: fallback has all 13. Guard defensively so the
      // grid never renders fewer than the contract demands.
      continue;
    }

    usedSlugs.add(chosen.slug);
    resolved.push({
      kind: wideSet.has(index) ? 'wide' : 'square',
      category: chosen,
      priority: index === 0,
      index,
    });
  }

  return resolved;
}
