import Image from 'next/image';
import Link from 'next/link';
import type { BlogPost } from '@/data/blog/types';
import { ReadingTimeBadge } from './ReadingTimeBadge';

interface FeaturedBlogCardProps {
  readonly post: BlogPost;
}

function formatPublishedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function FeaturedBlogCard({ post }: FeaturedBlogCardProps): JSX.Element {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="block bg-white rounded-2xl shadow-sm overflow-hidden active:scale-[0.99] transition-all"
      aria-label={`Read featured article: ${post.title}`}
    >
      <div className="relative w-full aspect-[16/10] bg-gradient-to-br from-brand-maroon-100 to-brand-gold-100">
        <Image
          src={post.heroImage}
          alt={post.title}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
          priority
        />
        <span className="absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded-full bg-white/90 text-brand-maroon-700 font-semibold backdrop-blur-sm">
          Featured
        </span>
      </div>
      <div className="p-4">
        <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-brand-maroon-50 text-brand-maroon-600 font-medium mb-2">
          {post.category}
        </span>
        <h3 className="text-base font-semibold text-gray-900 mb-1.5 leading-snug">{post.title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed mb-3 line-clamp-2">{post.excerpt}</p>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <ReadingTimeBadge minutes={post.readMinutes} />
          <span aria-hidden="true">·</span>
          <time dateTime={post.publishedAt}>{formatPublishedAt(post.publishedAt)}</time>
        </div>
      </div>
    </Link>
  );
}
