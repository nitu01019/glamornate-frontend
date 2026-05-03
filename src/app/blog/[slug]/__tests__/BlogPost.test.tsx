import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { BlogPost, BlogSection } from '@/data/blog/types';

// ---------------------------------------------------------------------------
// Mocks — stub next/image and next/link so jsdom renders plain DOM nodes.
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

const loadPageClient = async () => (await import('../PageClient')).PageClient;
const loadArticleBody = async () => (await import('../../_components/ArticleBody')).ArticleBody;

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makePost(overrides: Partial<BlogPost>): BlogPost {
  return {
    slug: overrides.slug ?? 'test-slug',
    title: overrides.title ?? 'Test Post Title',
    excerpt: overrides.excerpt ?? 'Test excerpt',
    category: overrides.category ?? 'Skincare',
    readMinutes: overrides.readMinutes ?? 7,
    heroImage: overrides.heroImage ?? '/images/sample.webp',
    publishedAt: overrides.publishedAt ?? '2026-04-17',
    author: overrides.author ?? 'Jane Reviewer',
    sections: overrides.sections ?? [{ kind: 'paragraph', text: 'Hello body paragraph.' }],
    cta: overrides.cta ?? { label: 'Book a service', href: '/services' },
    relatedSlugs: overrides.relatedSlugs ?? [],
    seo: overrides.seo ?? {
      title: overrides.title ?? 'Test Post Title',
      description: overrides.excerpt ?? 'Test excerpt',
      ogImage: '/images/sample.webp',
    },
  };
}

const relatedOne = makePost({
  slug: 'related-one',
  title: 'Related Article One',
});
const relatedTwo = makePost({
  slug: 'related-two',
  title: 'Related Article Two',
});

// ---------------------------------------------------------------------------
// Tests — PageClient
// ---------------------------------------------------------------------------

describe('BlogPost page (PageClient)', () => {
  it('renders the title, byline author, and reading-time badge', async () => {
    const PageClient = await loadPageClient();
    const post = makePost({
      slug: 'glow-guide',
      title: 'The Ultimate Glow Guide',
      author: 'Ritu Kapoor',
      readMinutes: 8,
    });

    render(<PageClient post={post} related={[]} />);

    // Title renders in the hero as an h1.
    expect(
      screen.getByRole('heading', { level: 1, name: /the ultimate glow guide/i }),
    ).toBeInTheDocument();

    // Byline author appears in the hero.
    expect(screen.getByText('Ritu Kapoor')).toBeInTheDocument();

    // Reading-time badge exposes an accessible label like "8 minute read".
    expect(screen.getByLabelText(/8 minute read/i)).toBeInTheDocument();
    expect(screen.getByText(/8 min read/i)).toBeInTheDocument();
  });

  it('renders the CTA link to the post-specific service href', async () => {
    const PageClient = await loadPageClient();
    const post = makePost({
      cta: { label: 'Book a Korean Glass Skin Facial', href: '/services/category/facials' },
    });

    render(<PageClient post={post} related={[]} />);

    const cta = screen.getByRole('link', {
      name: /book a korean glass skin facial/i,
    });
    expect(cta).toHaveAttribute('href', '/services/category/facials');
  });

  it('renders a Related Reading grid with <a> links to /blog/<related-slug>', async () => {
    const PageClient = await loadPageClient();
    const post = makePost({
      slug: 'source-post',
      title: 'Source Post',
      relatedSlugs: ['related-one', 'related-two'],
    });

    render(<PageClient post={post} related={[relatedOne, relatedTwo]} />);

    const section = screen.getByRole('region', { name: /related reading/i });
    expect(section).toBeInTheDocument();

    const links = within(section).getAllByRole('link');
    expect(links.length).toBe(2);
    expect(links[0]).toHaveAttribute('href', '/blog/related-one');
    expect(links[1]).toHaveAttribute('href', '/blog/related-two');
  });

  it('omits the Related Reading section when no related posts are provided', async () => {
    const PageClient = await loadPageClient();
    const post = makePost({ slug: 'no-related', title: 'Solo Post' });

    render(<PageClient post={post} related={[]} />);

    expect(screen.queryByRole('region', { name: /related reading/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — ArticleBody variant rendering
// ---------------------------------------------------------------------------

describe('ArticleBody — renders each BlogSection.kind variant', () => {
  const allFiveVariants: readonly BlogSection[] = [
    { kind: 'heading', level: 2, text: 'Top-Level Heading' },
    { kind: 'heading', level: 3, text: 'Sub Heading' },
    { kind: 'paragraph', text: 'A sample paragraph body.' },
    {
      kind: 'list',
      ordered: true,
      items: ['First ordered step', 'Second ordered step'],
    },
    {
      kind: 'list',
      items: ['Unordered first', 'Unordered second'],
    },
    {
      kind: 'callout',
      title: 'A quick callout',
      body: 'Callout body copy goes here.',
    },
    {
      kind: 'image',
      src: '/images/sample-inline.webp',
      alt: 'Inline illustration',
    },
  ];

  it('renders an h2 for a level-2 heading', async () => {
    const ArticleBody = await loadArticleBody();
    render(<ArticleBody sections={allFiveVariants} />);

    expect(
      screen.getByRole('heading', { level: 2, name: /top-level heading/i }),
    ).toBeInTheDocument();
  });

  it('renders an h3 for a level-3 heading', async () => {
    const ArticleBody = await loadArticleBody();
    render(<ArticleBody sections={allFiveVariants} />);

    expect(screen.getByRole('heading', { level: 3, name: /sub heading/i })).toBeInTheDocument();
  });

  it('renders paragraph text', async () => {
    const ArticleBody = await loadArticleBody();
    render(<ArticleBody sections={allFiveVariants} />);

    expect(screen.getByText(/a sample paragraph body\./i)).toBeInTheDocument();
  });

  it('renders ordered lists as <ol> with all items', async () => {
    const ArticleBody = await loadArticleBody();
    const { container } = render(<ArticleBody sections={allFiveVariants} />);

    const ol = container.querySelector('ol');
    expect(ol).not.toBeNull();
    expect(within(ol as HTMLElement).getByText('First ordered step')).toBeInTheDocument();
    expect(within(ol as HTMLElement).getByText('Second ordered step')).toBeInTheDocument();
  });

  it('renders unordered lists as <ul> with all items', async () => {
    const ArticleBody = await loadArticleBody();
    const { container } = render(<ArticleBody sections={allFiveVariants} />);

    const ul = container.querySelector('ul');
    expect(ul).not.toBeNull();
    expect(within(ul as HTMLElement).getByText('Unordered first')).toBeInTheDocument();
    expect(within(ul as HTMLElement).getByText('Unordered second')).toBeInTheDocument();
  });

  it('renders callouts with role="note", title, and body', async () => {
    const ArticleBody = await loadArticleBody();
    render(<ArticleBody sections={allFiveVariants} />);

    const note = screen.getByRole('note');
    expect(note).toBeInTheDocument();
    expect(within(note).getByText(/a quick callout/i)).toBeInTheDocument();
    expect(within(note).getByText(/callout body copy goes here\./i)).toBeInTheDocument();
  });

  it('renders image sections with alt text and a figcaption', async () => {
    const ArticleBody = await loadArticleBody();
    render(<ArticleBody sections={allFiveVariants} />);

    const img = screen.getByAltText('Inline illustration');
    expect(img).toBeInTheDocument();
    // figcaption echoes the alt text when non-empty.
    expect(screen.getByText(/inline illustration/i)).toBeInTheDocument();
  });

  it('renders nothing for an empty sections array', async () => {
    const ArticleBody = await loadArticleBody();
    const { container } = render(<ArticleBody sections={[]} />);

    // The wrapper div still exists but has no child section markup.
    expect(container.querySelector('.prose-article')?.children.length ?? 0).toBe(0);
  });
});
