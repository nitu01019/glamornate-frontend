'use client';

import Image from 'next/image';
import Link from 'next/link';

import { logHomeCategoryTileClick } from '@/lib/analytics/home-events';

interface CategoryTileWideProps {
  readonly slug: string;
  readonly name: string;
  readonly image: string;
  /**
   * Mark as `true` for the row-1 wide tile so next/image gets `priority`
   * for LCP. Only one wide tile per page should set this.
   */
  readonly priority?: boolean;
  /**
   * Zero-based position within the resolved 13-tile grid. Used for
   * telemetry so we can compare click-through by slot location.
   */
  readonly position?: number;
}

/**
 * Yes-Madam-style wide category tile (~2:1 rectangle).
 *
 * Image-only. No painted text, no badges, no curtain reveal. The
 * category name lives OUTSIDE the tile as a `<figcaption>` sibling so
 * automated assertions can confirm zero text descendants inside the
 * tile itself.
 *
 * Spans the full width of the grid on every breakpoint so the wide
 * tile keeps a consistent rhythm of one-across on phone, tablet, and
 * desktop.
 */
export default function CategoryTileWide({
  slug,
  name,
  image,
  priority = false,
  position = 0,
}: CategoryTileWideProps) {
  return (
    <figure className="flex flex-col">
      <Link
        href={`/services/category/${slug}`}
        data-testid="category-tile"
        data-wide="true"
        aria-label={`View ${name} category`}
        onClick={() => logHomeCategoryTileClick(slug, position, true)}
        className="group relative block w-full aspect-[2/1] rounded-tile overflow-hidden bg-gray-100 shadow-tile-md transition-transform duration-200 active:scale-[0.98] motion-safe:hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500 focus-visible:ring-offset-2 min-h-[44px] min-w-[44px]"
      >
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 800px"
          className="object-cover"
          priority={priority}
          fetchPriority={priority ? 'high' : undefined}
        />
      </Link>
      <figcaption className="mt-2 text-sm font-semibold text-gray-900 text-left leading-tight line-clamp-1">
        {name}
      </figcaption>
    </figure>
  );
}
