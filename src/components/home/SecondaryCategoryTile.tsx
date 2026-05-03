'use client';

import Image from 'next/image';
import Link from 'next/link';

type SecondaryBadge = 'New' | 'Most Booked';

interface SecondaryCategoryTileProps {
  readonly slug: string;
  readonly name: string;
  readonly image: string;
  readonly badge?: SecondaryBadge;
}

const BADGE_STYLES: Readonly<Record<SecondaryBadge, string>> = {
  New: 'bg-sky-500 text-white',
  'Most Booked': 'bg-brand-maroon-500 text-white',
};

/**
 * Secondary category tile — occupies a single column in the 4-col grid.
 * Cream background with `rounded-tile` radius and smaller tile shadow.
 * Optionally renders a small absolutely-positioned badge (top-left) for
 * "New" or "Most Booked" callouts.
 *
 * Emits `data-testid="category-card"` for backward-compatibility with the
 * existing home-page test contract.
 *
 * @deprecated Use CategoryTileSquare behind NEXT_PUBLIC_HOME_V2_GRID. Will
 * be removed after flag flip.
 */
export default function SecondaryCategoryTile({
  slug,
  name,
  image,
  badge,
}: SecondaryCategoryTileProps) {
  return (
    <Link
      href={`/services/category/${slug}`}
      data-testid="category-card"
      aria-label={`View ${name} category`}
      className="relative flex flex-col overflow-hidden bg-brand-pink-100 rounded-tile shadow-tile-sm touch-target active:scale-[0.98] transition-transform"
    >
      {badge !== undefined ? (
        <span
          data-testid="secondary-tile-badge"
          className={`absolute top-1.5 left-1.5 z-10 text-[9px] font-semibold px-1.5 py-0.5 rounded-md leading-none ${BADGE_STYLES[badge]}`}
        >
          {badge}
        </span>
      ) : null}

      {/* Image at top */}
      <div className="relative w-full aspect-square bg-gray-100">
        <Image
          src={image}
          alt={name}
          fill
          sizes="(max-width: 768px) 25vw, 200px"
          className="object-cover"
        />
      </div>

      {/* Label below */}
      <div className="px-2 py-1.5">
        <span className="block text-[11px] font-medium text-gray-800 text-center leading-tight line-clamp-2">
          {name}
        </span>
      </div>
    </Link>
  );
}
