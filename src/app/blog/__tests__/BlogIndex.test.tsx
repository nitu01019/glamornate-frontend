import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { BlogPost } from '@/data/blog/types';

// ---------------------------------------------------------------------------
// Mocks — stub next/image and next/link so jsdom renders a plain DOM tree.
// ---------------------------------------------------------------------------

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { priority, fill, sizes, ...rest } = props as Record<string, unknown>;
    void priority;
    void fill;
    void sizes;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

// Delay importing BlogIndexClient until after mocks are registered.
const loadBlogIndexClient = async () =>
  (await import('../_components/BlogIndexClient')).BlogIndexClient;

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

function makePost(overrides: Partial<BlogPost>): BlogPost {
  return {
    slug: overrides.slug ?? 'default-slug',
    title: overrides.title ?? 'Default Title',
    excerpt: overrides.excerpt ?? 'Default excerpt',
    category: overrides.category ?? 'Skincare',
    readMinutes: overrides.readMinutes ?? 5,
    heroImage: overrides.heroImage ?? '/images/sample.webp',
    publishedAt: overrides.publishedAt ?? '2026-04-17',
    author: overrides.author ?? 'Test Author',
    sections: overrides.sections ?? [{ kind: 'paragraph', text: 'body' }],
    cta: overrides.cta ?? { label: 'Book', href: '/services' },
    relatedSlugs: overrides.relatedSlugs ?? [],
    seo: overrides.seo ?? {
      title: overrides.title ?? 'Default Title',
      description: overrides.excerpt ?? 'Default excerpt',
      ogImage: '/images/sample.webp',
    },
  };
}

const sixPosts: readonly BlogPost[] = [
  makePost({ slug: 'p1', title: 'Skincare Post One', category: 'Skincare' }),
  makePost({ slug: 'p2', title: 'Skincare Post Two', category: 'Skincare' }),
  makePost({ slug: 'p3', title: 'Hair Post', category: 'Hair Care' }),
  makePost({ slug: 'p4', title: 'Wellness Post', category: 'Wellness' }),
  makePost({ slug: 'p5', title: 'Self Care Post', category: 'Self Care' }),
  makePost({ slug: 'p6', title: 'Beauty Tips Post', category: 'Beauty Tips' }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BlogIndexClient (Journal index)', () => {
  beforeEach(() => {
    // nothing persistent to reset yet
  });

  it('renders all 6 post titles when no filter is applied', async () => {
    const BlogIndexClient = await loadBlogIndexClient();
    render(<BlogIndexClient posts={sixPosts} />);

    sixPosts.forEach((post) => {
      // Each title should appear at least once (either in featured card or list card).
      const matches = screen.getAllByText(post.title);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders an "All" category chip plus one chip per distinct category', async () => {
    const BlogIndexClient = await loadBlogIndexClient();
    render(<BlogIndexClient posts={sixPosts} />);

    const tablist = screen.getByRole('tablist', {
      name: /filter journal posts by category/i,
    });
    const chips = within(tablist).getAllByRole('button');
    // All + 5 unique categories (Skincare, Hair Care, Wellness, Self Care, Beauty Tips).
    expect(chips.length).toBe(6);
    expect(within(tablist).getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(within(tablist).getByRole('button', { name: 'Skincare' })).toBeInTheDocument();
  });

  it('clicking a category chip (e.g., "Skincare") reduces the grid to posts with that category', async () => {
    const BlogIndexClient = await loadBlogIndexClient();
    render(<BlogIndexClient posts={sixPosts} />);

    const skincareChip = screen.getByRole('button', { name: 'Skincare' });
    fireEvent.click(skincareChip);

    // Both Skincare titles are still visible.
    expect(screen.getByText('Skincare Post One')).toBeInTheDocument();
    expect(screen.getByText('Skincare Post Two')).toBeInTheDocument();

    // Non-matching titles are filtered out.
    expect(screen.queryByText('Hair Post')).not.toBeInTheDocument();
    expect(screen.queryByText('Wellness Post')).not.toBeInTheDocument();
    expect(screen.queryByText('Self Care Post')).not.toBeInTheDocument();
    expect(screen.queryByText('Beauty Tips Post')).not.toBeInTheDocument();
  });

  it('clicking "All" restores the full grid after a category filter', async () => {
    const BlogIndexClient = await loadBlogIndexClient();
    render(<BlogIndexClient posts={sixPosts} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skincare' }));
    // Confirm filter is active.
    expect(screen.queryByText('Hair Post')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    // Every title is back.
    sixPosts.forEach((post) => {
      expect(screen.getAllByText(post.title).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders a graceful empty state when no posts match the active category', async () => {
    const BlogIndexClient = await loadBlogIndexClient();
    // Only one post, in "Skincare". If user-land ever ends up with a stale
    // activeCategory that yields zero results, the empty state kicks in.
    // We simulate this by providing a posts list with a single category,
    // switching to a different chip would be impossible (chip not rendered),
    // so we instead verify the empty-state markup is wired by rendering zero
    // posts overall.
    render(<BlogIndexClient posts={[]} />);

    expect(screen.getByText(/no articles yet/i)).toBeInTheDocument();
    expect(screen.getByText(/check back soon/i)).toBeInTheDocument();
  });

  it('clicking a chip whose category has only one post renders just that post', async () => {
    const BlogIndexClient = await loadBlogIndexClient();
    render(<BlogIndexClient posts={sixPosts} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hair Care' }));

    expect(screen.getByText('Hair Post')).toBeInTheDocument();
    expect(screen.queryByText('Skincare Post One')).not.toBeInTheDocument();
    expect(screen.queryByText('Wellness Post')).not.toBeInTheDocument();
  });
});
