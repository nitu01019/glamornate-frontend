'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import type { BlogPost } from '@/data/blog/types';
import { BlogCard } from './BlogCard';
import { FeaturedBlogCard } from './FeaturedBlogCard';

interface BlogIndexClientProps {
  readonly posts: readonly BlogPost[];
}

const ALL_CATEGORY = 'All' as const;
type CategoryOption = typeof ALL_CATEGORY | string;

function deriveCategories(posts: readonly BlogPost[]): readonly CategoryOption[] {
  const unique = new Set<string>();
  posts.forEach((post) => unique.add(post.category));
  return [ALL_CATEGORY, ...Array.from(unique).sort()];
}

interface CategoryPillProps {
  readonly category: CategoryOption;
  readonly isActive: boolean;
  readonly onSelect: (category: CategoryOption) => void;
}

function CategoryPill({ category, isActive, onSelect }: CategoryPillProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(category)}
      aria-pressed={isActive}
      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
        isActive
          ? 'bg-brand-maroon-500 text-white'
          : 'bg-white text-gray-600 border border-gray-200'
      }`}
    >
      {category}
    </button>
  );
}

export function BlogIndexClient({ posts }: BlogIndexClientProps): JSX.Element {
  const [activeCategory, setActiveCategory] = useState<CategoryOption>(ALL_CATEGORY);

  const categories = useMemo(() => deriveCategories(posts), [posts]);

  const visiblePosts = useMemo(() => {
    if (activeCategory === ALL_CATEGORY) {
      return posts;
    }
    return posts.filter((post) => post.category === activeCategory);
  }, [posts, activeCategory]);

  const featuredPost = visiblePosts[0] ?? null;
  const restPosts = featuredPost ? visiblePosts.slice(1) : [];

  return (
    <div className="min-h-screen bg-section-bg pb-24 animate-fade-in">
      <div className="bg-white px-4 pt-14 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-brand-maroon-500" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900">The Glamornate Journal</h1>
        </div>
        <p className="text-sm text-gray-500">
          Beauty tips, wellness trends, and self-care inspiration
        </p>
      </div>

      <div className="bg-white">
        <div
          className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-4"
          role="tablist"
          aria-label="Filter journal posts by category"
        >
          {categories.map((cat) => (
            <CategoryPill
              key={cat}
              category={cat}
              isActive={activeCategory === cat}
              onSelect={setActiveCategory}
            />
          ))}
        </div>
      </div>

      {featuredPost && (
        <div className="px-4 mt-4">
          <FeaturedBlogCard post={featuredPost} />
        </div>
      )}

      <div className="px-4 mt-4 space-y-3">
        {restPosts.map((post) => (
          <BlogCard key={post.slug} post={post} />
        ))}

        {visiblePosts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-maroon-50 mb-4">
              <Sparkles className="w-7 h-7 text-brand-maroon-300" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">No articles yet</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              We&apos;re working on content for this category. Check back soon.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
