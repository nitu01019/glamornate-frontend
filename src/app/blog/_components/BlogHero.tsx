import Image from 'next/image';
import type { BlogPost } from '@/data/blog/types';
import { ReadingTimeBadge } from './ReadingTimeBadge';

interface BlogHeroProps {
  readonly post: BlogPost;
}

function formatPublishedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function BlogHero({ post }: BlogHeroProps): JSX.Element {
  return (
    <header className="bg-white">
      <div className="relative w-full aspect-[16/10] bg-gradient-to-br from-brand-maroon-100 to-brand-gold-100">
        <Image
          src={post.heroImage}
          alt={post.title}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
        />
      </div>
      <div className="px-4 py-5">
        <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-brand-maroon-50 text-brand-maroon-600 font-medium mb-2">
          {post.category}
        </span>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight mb-2">
          {post.title}
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-3">{post.excerpt}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <span className="font-medium text-gray-700">{post.author}</span>
          <span aria-hidden="true" className="text-gray-300">
            ·
          </span>
          <time dateTime={post.publishedAt}>{formatPublishedAt(post.publishedAt)}</time>
          <span aria-hidden="true" className="text-gray-300">
            ·
          </span>
          <ReadingTimeBadge minutes={post.readMinutes} />
        </div>
      </div>
    </header>
  );
}
