/** M-NOTIFY recovery stub (2026-04-25). Original lost in git clean. Replace with real impl when found. */
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface CategoryTileProps {
  title: string;
  href: string;
  imageSrc?: string;
  imageAlt?: string;
  className?: string;
}

/**
 * Link-based tile with optional image used in category grids.
 */
export default function CategoryTile({
  title,
  href,
  imageSrc,
  imageAlt,
  className,
}: CategoryTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        'relative flex flex-col items-center justify-end overflow-hidden rounded-2xl',
        'aspect-square bg-brand-maroon-50 text-center',
        'active:scale-[0.97] transition-transform',
        className,
      )}
    >
      {imageSrc && (
        <Image
          src={imageSrc}
          alt={imageAlt ?? title}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover"
        />
      )}
      <span
        className={cn(
          'relative z-10 w-full px-2 py-2',
          'text-xs font-semibold text-white',
          imageSrc ? 'bg-gradient-to-t from-black/60 to-transparent' : 'text-brand-maroon-700',
        )}
      >
        {title}
      </span>
    </Link>
  );
}
