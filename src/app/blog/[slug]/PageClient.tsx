'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { BlogPost } from '@/data/blog/types';
import { BlogHero } from '../_components/BlogHero';
import { ArticleBody } from '../_components/ArticleBody';
import { RelatedPosts } from '../_components/RelatedPosts';

interface PageClientProps {
  readonly post: BlogPost;
  readonly related: readonly BlogPost[];
}

export function PageClient({ post, related }: PageClientProps): JSX.Element {
  return (
    <article className="min-h-screen bg-section-bg pb-24 animate-fade-in">
      <div className="bg-white px-4 pt-14 pb-2">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-brand-maroon-600 font-medium active:opacity-70 transition-opacity"
          aria-label="Back to Glamornate Journal"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Journal</span>
        </Link>
      </div>

      <BlogHero post={post} />

      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <ArticleBody sections={post.sections} />
        </div>
      </div>

      <div className="px-4 mt-4">
        <Link
          href={post.cta.href}
          className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white rounded-xl py-3 text-sm font-semibold active:opacity-90 transition-opacity"
          aria-label={post.cta.label}
        >
          {post.cta.label}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>

      <RelatedPosts posts={related} />

      <div className="px-4 mt-6">
        <Link
          href="/blog"
          className="flex items-center justify-center gap-2 w-full border border-brand-maroon-200 text-brand-maroon-600 rounded-xl py-3 text-sm font-semibold active:bg-brand-maroon-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Browse more articles
        </Link>
      </div>
    </article>
  );
}
