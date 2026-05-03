import Image from 'next/image';
import Link from 'next/link';
import type { BlogPost } from '@/data/blog/types';
import { ReadingTimeBadge } from './ReadingTimeBadge';

interface RelatedPostsProps {
  readonly posts: readonly BlogPost[];
}

interface RelatedCardProps {
  readonly post: BlogPost;
}

function RelatedCard({ post }: RelatedCardProps): JSX.Element {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="block bg-white rounded-2xl shadow-sm overflow-hidden active:scale-[0.99] transition-all"
      aria-label={`Read related article: ${post.title}`}
    >
      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-brand-maroon-50 to-brand-gold-50">
        <Image
          src={post.heroImage}
          alt={post.title}
          fill
          sizes="(max-width: 768px) 50vw, 240px"
          className="object-cover"
        />
      </div>
      <div className="p-3">
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-brand-maroon-50 text-brand-maroon-600 font-medium mb-1.5">
          {post.category}
        </span>
        <h4 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2 leading-snug">
          {post.title}
        </h4>
        <ReadingTimeBadge minutes={post.readMinutes} />
      </div>
    </Link>
  );
}

export function RelatedPosts({ posts }: RelatedPostsProps): JSX.Element | null {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="px-4 mt-6" aria-labelledby="related-posts-heading">
      <h2 id="related-posts-heading" className="text-sm font-bold text-gray-900 mb-3">
        Related Reading
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {posts.map((post) => (
          <RelatedCard key={post.slug} post={post} />
        ))}
      </div>
    </section>
  );
}
