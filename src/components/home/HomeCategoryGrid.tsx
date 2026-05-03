'use client';

import { useEffect, useMemo } from 'react';

import { useCategories } from '@/hooks/useHomeData';
import { catalogCategories } from '@/data/glamornate-catalog';
import {
  buildHomeCategoryLayout,
  type CatalogCategory,
} from '@/lib/home-layout';
import { logHomeV2Shown } from '@/lib/analytics/home-events';

import CategoryTileSquare from './CategoryTileSquare';
import CategoryTileWide from './CategoryTileWide';
import { HomeCategoryGridSkeleton } from './HomeSkeletons';

interface HomeCategoryGridProps {
  readonly heading?: string;
}

/**
 * Yes-Madam-style 13-tile category grid.
 *
 * Layout rhythm (always 13 tiles total):
 *   - 2 wide tiles (one on row 1, one on row 3) that span the full width.
 *   - 11 square tiles arranged 3-col on phone, 4-col on tablet-sm,
 *     5-col on desktop.
 *
 * The grid is image-only: each tile renders only an image anchored by a
 * `<Link>`, while the category name is rendered as a `<figcaption>`
 * sibling BELOW the tile. There are no NEW / Most Booked / animated
 * badges, and no text descendants of any `data-testid="category-tile"`
 * element.
 *
 * Data flows from `useCategories` with graceful fallback to the bundled
 * `catalogCategories`. Loading shows {@link HomeCategoryGridSkeleton};
 * error falls back to the static catalog so the layout remains 13 tiles.
 */
export default function HomeCategoryGrid({
  heading = 'Explore Our Categories',
}: HomeCategoryGridProps) {
  const { data, isLoading, isError } = useCategories();

  const slots = useMemo(() => {
    const source = isError || !data ? catalogCategories : data;
    const normalized: CatalogCategory[] = (source ?? []).map((c) => ({
      slug: c.slug,
      name: c.name,
      image: c.image,
    }));
    return buildHomeCategoryLayout(normalized);
  }, [data, isError]);

  // Fire home_v2_shown once the grid has data to render. This is our Phase 1
  // "surface reached" denominator for tile-click conversion.
  useEffect(() => {
    if (isLoading) return;
    logHomeV2Shown({ flagSource: 'env', enabled: true });
  }, [isLoading]);

  if (isLoading) {
    return <HomeCategoryGridSkeleton />;
  }

  return (
    <section
      className="bg-white px-4 pt-4 pb-6"
      data-testid="home-category-grid"
    >
      <h2 className="text-lg font-bold text-gray-900 mb-4">{heading}</h2>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 gap-y-5">
        {slots.map((slot, index) => {
          if (slot.kind === 'wide') {
            return (
              <div
                key={slot.category.slug}
                className="col-span-3 sm:col-span-4 lg:col-span-5"
              >
                <CategoryTileWide
                  slug={slot.category.slug}
                  name={slot.category.name}
                  image={slot.category.image}
                  priority={slot.priority}
                  position={index}
                />
              </div>
            );
          }

          return (
            <div key={slot.category.slug} className="col-span-1">
              <CategoryTileSquare
                slug={slot.category.slug}
                name={slot.category.name}
                image={slot.category.image}
                position={index}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
