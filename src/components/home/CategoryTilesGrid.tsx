'use client';

import { useCategories } from '@/hooks/useHomeData';
import { catalogCategories } from '@/data/glamornate-catalog';

import FeaturedCategoryTile from './FeaturedCategoryTile';
import SecondaryCategoryTile from './SecondaryCategoryTile';
import { CategoriesGridSkeleton } from './HomeSkeletons';

interface CategoryItem {
  readonly slug: string;
  readonly name: string;
  readonly image: string;
}

type CategoryBadge = 'New' | 'Most Booked';

interface CategoryLayoutPlan {
  readonly featured: readonly string[];
  readonly secondary: readonly (readonly string[])[];
  readonly badges: Readonly<Record<string, CategoryBadge>>;
}

interface ResolvedLayout {
  readonly featured: readonly CategoryItem[];
  readonly secondaryRows: readonly (readonly CategoryItem[])[];
  readonly badgeMap: Readonly<Record<string, CategoryBadge>>;
}

const HYDRAGLO_ANIMATED_LABELS: readonly string[] = ['Most Booked', 'Loved by 5,000+', 'Top Rated'];

/**
 * Canonical layout for the 13 Glamornate service categories.
 * Layout: 3 featured + 4 + 4 + 2 (total 13).
 *
 * Source of truth: `docs/plans/investigations/round3/p1-a1-category-inventory.md`.
 *
 * Badge key is the live catalog slug `facials` (no dedicated `hydraglo-facials`
 * slug exists); the helper `isHydraGloFacialSlug` already matches `facials`.
 */
const categoryLayoutPlan: CategoryLayoutPlan = {
  featured: ['facials', 'clean-ups', 'waxing'],
  secondary: [
    ['manicure-pedicure', 'bleach', 'de-tan-pack', 'threading'],
    ['body-polishing-massage', 'hair-root-touch-up', 'global-hair-coloring', 'hair-spa'],
    ['hair-transformation', 'hair-treatments'],
  ],
  badges: {
    facials: 'Most Booked',
    'body-polishing-massage': 'New',
  },
};

/**
 * Returns true when the category slug looks like the HydraGlo / Facials
 * tile that should display the animated rotating label.
 *
 * Matches defensively so copy/slug tweaks in the catalog do not silently
 * drop the treatment.
 */
function isHydraGloFacialSlug(slug: string): boolean {
  const normalized = slug.toLowerCase();
  return (
    normalized === 'hydraglo-facials' ||
    normalized === 'hydraglo' ||
    normalized === 'facials' ||
    normalized.includes('hydraglo')
  );
}

/**
 * Resolves the `categoryLayoutPlan` (a slug-based plan) against the concrete
 * list of `items` coming from the hook or the catalog fallback.
 *
 * Missing slugs are skipped gracefully. If nothing in the plan resolves to a
 * real featured item, we fall back to `items.slice(0, 3)` for the featured
 * row and chunk the remainder into rows of 4.
 */
export function applyLayoutPlan(
  items: readonly CategoryItem[],
  plan: CategoryLayoutPlan,
): ResolvedLayout {
  const bySlug = new Map<string, CategoryItem>();
  for (const item of items) {
    bySlug.set(item.slug, item);
  }

  const pickMany = (slugs: readonly string[]): CategoryItem[] => {
    const picked: CategoryItem[] = [];
    for (const slug of slugs) {
      const item = bySlug.get(slug);
      if (item !== undefined) {
        picked.push(item);
      }
    }
    return picked;
  };

  const featuredFromPlan = pickMany(plan.featured);
  const secondaryRowsFromPlan = plan.secondary
    .map((row) => pickMany(row))
    .filter((row) => row.length > 0);

  // Plan resolved at least one featured item → trust the plan.
  if (featuredFromPlan.length > 0) {
    return {
      featured: featuredFromPlan,
      secondaryRows: secondaryRowsFromPlan,
      badgeMap: plan.badges,
    };
  }

  // Fallback path: chunk `items` into a 3-then-rows-of-4 layout.
  const featuredFallback = items.slice(0, 3);
  const rest = items.slice(3);
  const fallbackRows: CategoryItem[][] = [];
  for (let i = 0; i < rest.length; i += 4) {
    fallbackRows.push(rest.slice(i, i + 4));
  }

  return {
    featured: featuredFallback,
    secondaryRows: fallbackRows,
    badgeMap: plan.badges,
  };
}

/**
 * Orchestrates Featured + Secondary tile rows for all 13 Glamornate
 * service categories.
 *
 * Layout:
 * - Featured row: 3 categories (col-spans 2 + 1 + 1).
 * - Secondary rows: as many rows as the plan specifies (typically 4 + 4 + 2).
 *
 * The plan is slug-driven so future catalog re-orderings do not disturb
 * the visual layout. If no slug matches (e.g., remote data is wildly
 * different from the catalog), the renderer degrades gracefully.
 *
 * @deprecated Use HomeCategoryGrid behind NEXT_PUBLIC_HOME_V2_GRID. Will be
 * removed after flag flip.
 */
export default function CategoryTilesGrid() {
  const { data: categories, isLoading, isError } = useCategories();

  if (isLoading) {
    return <CategoriesGridSkeleton />;
  }

  const showFallback = isError || !categories;
  const source = showFallback ? catalogCategories : categories;

  const items: readonly CategoryItem[] = (source ?? []).map((c) => ({
    slug: c.slug,
    name: c.name,
    image: c.image,
  }));

  const { featured, secondaryRows, badgeMap } = applyLayoutPlan(items, categoryLayoutPlan);

  const hasFeatured = featured.length > 0;
  const hasSecondary = secondaryRows.some((row) => row.length > 0);

  if (!hasFeatured && !hasSecondary) {
    return null;
  }

  return (
    <section className="bg-white px-4 pt-4 pb-6" data-testid="category-tiles-grid">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Explore Our Categories</h2>

      {hasFeatured ? (
        <div className="grid grid-cols-4 gap-2 mb-2">
          {featured.map((category, index) => {
            const isHero = index === 0;
            const isMostBookedByPlan = badgeMap[category.slug] === 'Most Booked';
            const animatedLabels =
              isMostBookedByPlan || isHydraGloFacialSlug(category.slug)
                ? HYDRAGLO_ANIMATED_LABELS
                : undefined;

            if (isHero) {
              return (
                <div key={category.slug} className="col-span-2">
                  <FeaturedCategoryTile
                    slug={category.slug}
                    name={category.name}
                    image={category.image}
                    animatedLabels={animatedLabels}
                  />
                </div>
              );
            }

            return (
              <div key={category.slug} className="col-span-1">
                <SecondaryCategoryTile
                  slug={category.slug}
                  name={category.name}
                  image={category.image}
                  badge={badgeMap[category.slug] ?? undefined}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {secondaryRows.map((row, rowIndex) => {
        if (row.length === 0) {
          return null;
        }

        return (
          <div key={`secondary-row-${rowIndex}`} className="grid grid-cols-4 gap-2 mb-2">
            {row.map((category) => (
              <div key={category.slug} className="col-span-1">
                <SecondaryCategoryTile
                  slug={category.slug}
                  name={category.name}
                  image={category.image}
                  badge={badgeMap[category.slug] ?? undefined}
                />
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
