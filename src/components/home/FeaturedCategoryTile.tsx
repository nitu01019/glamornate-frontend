'use client';

import Image from 'next/image';
import Link from 'next/link';

import CurtainRevealBadge from './CurtainRevealBadge';

interface FeaturedCategoryTileProps {
  readonly slug: string;
  readonly name: string;
  readonly image: string;
  readonly animatedLabels?: readonly string[];
}

/**
 * Featured category tile — spans 2 columns in the 4-col grid.
 * Larger surface area with peach background and `rounded-tile` radius.
 * Shows an animated rotating label row at the bottom when `animatedLabels`
 * is provided (e.g., "Most Booked" → "Loved by 5,000+" → "Top Rated").
 *
 * Emits `data-testid="category-card"` for backward-compatibility with the
 * existing home-page test contract.
 *
 * @deprecated Use CategoryTileWide behind NEXT_PUBLIC_HOME_V2_GRID. Will be
 * removed after flag flip.
 */
export default function FeaturedCategoryTile({
  slug,
  name,
  image,
  animatedLabels,
}: FeaturedCategoryTileProps) {
  const hasAnimatedLabels = animatedLabels !== undefined && animatedLabels.length > 0;

  return (
    <Link
      href={`/services/category/${slug}`}
      data-testid="category-card"
      aria-label={`View ${name} category`}
      className="relative flex flex-col overflow-hidden bg-brand-pink-50 rounded-tile shadow-tile-md touch-target active:scale-[0.98] transition-transform"
    >
      {/* Image fills the tile */}
      <div className="relative w-full aspect-[2/1] bg-gray-100">
        <Image
          src={image}
          alt={name}
          fill
          sizes="(max-width: 768px) 60vw, 400px"
          className="object-cover"
        />
      </div>

      {/* Label row at bottom: category name + animated label (optional) */}
      <div className="flex flex-col gap-0.5 px-3 py-2">
        <span className="text-sm font-semibold text-gray-900 leading-tight line-clamp-1">
          {name}
        </span>
        {hasAnimatedLabels ? (
          <span data-testid="featured-animated-label" className="leading-tight">
            <CurtainRevealBadge label="Most Booked" />
          </span>
        ) : null}
      </div>
    </Link>
  );
}
