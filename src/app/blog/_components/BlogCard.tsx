import Image from 'next/image';
import Link from 'next/link';
import type { BlogPost } from '@/data/blog/types';
import { ReadingTimeBadge } from './ReadingTimeBadge';

interface BlogCardProps {
  readonly post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps): JSX.Element {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="flex gap-3 bg-white rounded-2xl shadow-sm p-3 active:scale-[0.99] transition-all"
      aria-label={`Read ${post.title}`}
    >
      <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-brand-maroon-50 to-brand-gold-50 flex-shrink-0">
        <Image src={post.heroImage} alt={post.title} fill sizes="96px" className="object-cover" />
      </div>
      <div className="flex flex-col justify-center min-w-0">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">{post.title}</h3>
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{post.excerpt}</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-maroon-50 text-brand-maroon-600 font-medium">
            {post.category}
          </span>
          <ReadingTimeBadge minutes={post.readMinutes} />
        </div>
      </div>
    </Link>
  );
}
