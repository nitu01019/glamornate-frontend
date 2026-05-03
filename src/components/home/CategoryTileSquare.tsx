'use client';

import Image from 'next/image';
import Link from 'next/link';

import { logHomeCategoryTileClick } from '@/lib/analytics/home-events';

interface CategoryTileSquareProps {
  readonly slug: string;
  readonly name: string;
  readonly image: string;
  /**
   * Zero-based position within the resolved 13-tile grid. Used for
   * telemetry so we can compare click-through by slot location.
   */
  readonly position?: number;
}

/**
 * Yes-Madam-style square category tile.
 *
 * The tile itself is image-only (no in-tile text, no badges, no overlay).
 * The category name is rendered as a `<figcaption>` sibling BELOW the
 * anchor so automated tests can assert the tile contains zero text.
 *
 * Elevation: `shadow-tile-md` at rest, `shadow-card-hover` on hover,
 * `active:scale-[0.98]` on press, 200 ms `transition-transform`.
 * The anchor itself honours WCAG AA 2.5.5 (44 × 44 tap target) via
 * `min-h-[44px]`.
 */
export default function CategoryTileSquare({
  slug,
  name,
  image,
  position = 0,
}: CategoryTileSquareProps) {
  return (
    <figure className="flex flex-col">
      <Link
        href={`/services/category/${slug}`}
        data-testid="category-tile"
        data-wide="false"
        aria-label={`View ${name} category`}
        onClick={() => logHomeCategoryTileClick(slug, position, false)}
        className="group relative block w-full aspect-square rounded-tile overflow-hidden bg-gray-100 shadow-tile-md transition-transform duration-200 active:scale-[0.98] motion-safe:hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500 focus-visible:ring-offset-2 min-h-[44px] min-w-[44px]"
      >
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 180px"
          className="object-cover"
        />
      </Link>
      <figcaption className="mt-2 text-[12px] font-medium text-gray-800 text-center leading-tight line-clamp-2 min-h-[2.2em] px-0.5">
        {name}
      </figcaption>
    </figure>
  );
}
