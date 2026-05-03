'use client'

import { useState, useMemo } from 'react'
import {
  BookOpen,
  Droplets,
  Scissors,
  Leaf,
  Palette,
  Bath,
  Dumbbell,
  Sparkles,
  Clock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category =
  | 'All'
  | 'Skincare'
  | 'Hair Care'
  | 'Wellness'
  | 'Beauty Tips'
  | 'Self Care'

interface Article {
  id: string
  title: string
  excerpt: string
  category: Exclude<Category, 'All'>
  readTime: string
  date: string
  icon: LucideIcon
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const CATEGORIES: readonly Category[] = [
  'All',
  'Skincare',
  'Hair Care',
  'Wellness',
  'Beauty Tips',
  'Self Care',
] as const

const FEATURED_ARTICLE: Article = {
  id: 'featured-1',
  title: 'The Ultimate Guide to At-Home Spa Treatments',
  excerpt:
    'Transform your bathroom into a luxury spa with these expert-backed techniques...',
  category: 'Wellness',
  readTime: '5 min read',
  date: 'Mar 15, 2025',
  icon: Leaf,
}

const ARTICLES: readonly Article[] = [
  {
    id: 'article-1',
    title: '5 Morning Skincare Rituals That Actually Work',
    excerpt:
      'Dermatologists share the only 5 steps you need for glowing skin...',
    category: 'Skincare',
    readTime: '4 min read',
    date: 'Mar 12, 2025',
    icon: Droplets,
  },
  {
    id: 'article-2',
    title: 'Why Regular Massage Therapy Boosts Immunity',
    excerpt:
      'Research shows that regular massage does more than relax muscles...',
    category: 'Wellness',
    readTime: '6 min read',
    date: 'Mar 8, 2025',
    icon: Leaf,
  },
  {
    id: 'article-3',
    title: 'Hair Oiling Traditions: Ancient Wisdom, Modern Science',
    excerpt:
      "The science behind why your grandmother's hair oiling routine works...",
    category: 'Hair Care',
    readTime: '5 min read',
    date: 'Feb 28, 2025',
    icon: Scissors,
  },
  {
    id: 'article-4',
    title: 'Choosing the Right Facial for Your Skin Type',
    excerpt:
      "Not all facials are created equal. Here's how to pick the perfect one...",
    category: 'Beauty Tips',
    readTime: '3 min read',
    date: 'Feb 20, 2025',
    icon: Palette,
  },
  {
    id: 'article-5',
    title: 'The Art of Self-Care: More Than Just Bath Bombs',
    excerpt:
      'True self-care is about intentional choices that nurture your wellbeing...',
    category: 'Self Care',
    readTime: '7 min read',
    date: 'Feb 14, 2025',
    icon: Bath,
  },
  {
    id: 'article-6',
    title: 'Post-Workout Recovery: The Best Spa Treatments',
    excerpt:
      'From deep tissue massage to cryotherapy, the best recovery treatments...',
    category: 'Wellness',
    readTime: '4 min read',
    date: 'Feb 5, 2025',
    icon: Dumbbell,
  },
] as const

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function CategoryPill({
  category,
  isActive,
  onSelect,
}: {
  category: Category
  isActive: boolean
  onSelect: (cat: Category) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category)}
      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
        isActive
          ? 'bg-brand-maroon-500 text-white'
          : 'bg-white text-gray-600 border border-gray-200'
      }`}
    >
      {category}
    </button>
  )
}

function FeaturedCard({ article }: { article: Article }) {
  const Icon = article.icon

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden active:scale-[0.99] transition-all">
      {/* Image placeholder */}
      <div className="bg-gradient-to-br from-brand-maroon-100 to-brand-gold-100 h-48 rounded-t-2xl flex items-center justify-center">
        <Icon className="w-12 h-12 text-brand-maroon-400" />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-base font-semibold text-gray-900 mb-1.5">
          {article.title}
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed mb-3">
          {article.excerpt}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-maroon-50 text-brand-maroon-600 font-medium">
            {article.category}
          </span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {article.readTime}
          </span>
          <span className="text-xs text-gray-400">{article.date}</span>
        </div>
      </div>
    </div>
  )
}

function ArticleCard({ article }: { article: Article }) {
  const Icon = article.icon

  return (
    <div className="flex gap-3 bg-white rounded-2xl shadow-sm p-3 active:scale-[0.99] transition-all">
      {/* Image placeholder */}
      <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-brand-maroon-50 to-brand-gold-50 flex-shrink-0 flex items-center justify-center">
        <Icon className="w-7 h-7 text-brand-maroon-400" />
      </div>

      {/* Content */}
      <div className="flex flex-col justify-center min-w-0">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
          {article.title}
        </h3>
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">
          {article.excerpt}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-maroon-50 text-brand-maroon-600 font-medium">
            {article.category}
          </span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {article.readTime}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('All')

  const filteredArticles = useMemo(() => {
    if (activeCategory === 'All') return ARTICLES
    return ARTICLES.filter((a) => a.category === activeCategory)
  }, [activeCategory])

  const showFeatured =
    activeCategory === 'All' || FEATURED_ARTICLE.category === activeCategory

  return (
    <div className="min-h-screen bg-section-bg pb-24 animate-fade-in">
      {/* ---- Header ---- */}
      <div className="bg-white px-4 pt-14 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-brand-maroon-500" />
          <h1 className="text-2xl font-bold text-gray-900">
            The Glamornate Journal
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          Beauty tips, wellness trends, and self-care inspiration
        </p>
      </div>

      {/* ---- Category Filter ---- */}
      <div className="bg-white">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-4">
          {CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat}
              category={cat}
              isActive={activeCategory === cat}
              onSelect={setActiveCategory}
            />
          ))}
        </div>
      </div>

      {/* ---- Featured Article ---- */}
      {showFeatured && (
        <div className="px-4 mt-4">
          <FeaturedCard article={FEATURED_ARTICLE} />
        </div>
      )}

      {/* ---- Article List ---- */}
      <div className="px-4 mt-4 space-y-3">
        {filteredArticles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}

        {filteredArticles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-maroon-50 mb-4">
              <Sparkles className="w-7 h-7 text-brand-maroon-300" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              No articles yet
            </h3>
            <p className="text-sm text-gray-500 max-w-xs">
              We&apos;re working on content for this category. Check back soon.
            </p>
          </div>
        )}
      </div>

      {/* ---- Coming Soon Banner ---- */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            More articles coming soon
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            We&apos;re working on fresh content. Check back regularly for new
            posts.
          </p>
        </div>
      </div>
    </div>
  )
}
