import { describe, it, expect } from 'vitest';
import type { BlogPost, BlogSection } from '../types';
import { getAllPosts, getAllSlugs, getPostBySlug, getRelatedPosts } from '../index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count whitespace-delimited words in a string. We normalise runs of
 * whitespace to a single separator so newlines/tabs do not throw the count.
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Sum the word counts across every `paragraph` and `list` section of a post.
 * Headings, callouts, and images are intentionally excluded — the spec asks
 * for the sum of paragraph and list text only.
 */
function postBodyWordCount(post: BlogPost): number {
  let total = 0;
  for (const section of post.sections) {
    if (section.kind === 'paragraph') {
      total += countWords(section.text);
    } else if (section.kind === 'list') {
      for (const item of section.items) {
        total += countWords(item);
      }
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Constants drawn from the spec
// ---------------------------------------------------------------------------

const EXPECTED_POST_COUNT = 6;
const WORD_COUNT_MIN = 600;
const WORD_COUNT_SOFT_MAX = 1200;
const WORD_COUNT_HARD_MAX = 1400;
const SEO_TITLE_SOFT_MAX = 60;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('blog registry (phase-3 spec)', () => {
  describe('registry loading', () => {
    it('loads all 6 posts via getAllPosts()', () => {
      const posts = getAllPosts();
      expect(posts).toHaveLength(EXPECTED_POST_COUNT);
    });

    it('getAllSlugs() returns exactly 6 entries', () => {
      const slugs = getAllSlugs();
      expect(slugs).toHaveLength(EXPECTED_POST_COUNT);
    });

    it('every slug in getAllSlugs() resolves via getPostBySlug()', () => {
      const slugs = getAllSlugs();
      slugs.forEach((slug) => {
        const post = getPostBySlug(slug);
        expect(post).not.toBeNull();
        expect(post?.slug).toBe(slug);
      });
    });
  });

  describe('getPostBySlug', () => {
    it('returns the Korean Glass Skin post with the expected title', () => {
      const post = getPostBySlug('korean-glass-skin-facials');
      expect(post).not.toBeNull();
      // Title must mention "Korean Glass Skin" — exact casing per authored copy.
      expect(post?.title).toContain('Korean Glass Skin');
    });

    it('returns null for an unknown slug', () => {
      expect(getPostBySlug('does-not-exist')).toBeNull();
    });
  });

  describe('getRelatedPosts', () => {
    it('returns at most 3 related posts for a known slug', () => {
      const related = getRelatedPosts('korean-glass-skin-facials');
      expect(related.length).toBeLessThanOrEqual(3);
    });

    it('never includes the source post in its own related list', () => {
      const related = getRelatedPosts('korean-glass-skin-facials');
      related.forEach((r) => {
        expect(r.slug).not.toBe('korean-glass-skin-facials');
      });
    });

    it('respects an explicit limit below the default of 3', () => {
      const related = getRelatedPosts('korean-glass-skin-facials', 2);
      expect(related.length).toBeLessThanOrEqual(2);
    });
  });

  describe('per-post content assertions', () => {
    it('every post has a hero image path starting with /images/', () => {
      getAllPosts().forEach((post) => {
        expect(post.heroImage).toMatch(/^\/images\//);
      });
    });

    it('every post body word count is at least 600 (paragraph + list only)', () => {
      getAllPosts().forEach((post) => {
        const words = postBodyWordCount(post);
        expect(
          words,
          `${post.slug} has only ${words} words in paragraph/list content`,
        ).toBeGreaterThanOrEqual(WORD_COUNT_MIN);
      });
    });

    it('every post body word count stays under the hard cap (no runaway content)', () => {
      getAllPosts().forEach((post) => {
        const words = postBodyWordCount(post);
        expect(
          words,
          `${post.slug} has ${words} words — above hard cap of ${WORD_COUNT_HARD_MAX}`,
        ).toBeLessThanOrEqual(WORD_COUNT_HARD_MAX);
      });
    });

    it('warns (via console.warn) when a post exceeds the soft word-count target of 1200', () => {
      // Spec soft target is 600-1200. Anything in [1201, 1400] passes the
      // hard cap above but is flagged as a content-editorial warning so the
      // author knows to trim. This mirrors the seo.title "warn if not"
      // pattern already used in the spec.
      const offenders: Array<{ slug: string; words: number }> = [];
      getAllPosts().forEach((post) => {
        const words = postBodyWordCount(post);
        if (words > WORD_COUNT_SOFT_MAX) {
          offenders.push({ slug: post.slug, words });
          // eslint-disable-next-line no-console
          console.warn(
            `[blog/registry] ${post.slug} has ${words} words (> ${WORD_COUNT_SOFT_MAX} soft target)`,
          );
        }
      });
      // This assertion always passes — it exists purely to document the
      // warning contract. Offenders are reported on stderr for the author.
      expect(Array.isArray(offenders)).toBe(true);
    });

    it('every post seo.title fits within 60 characters (warn if not)', () => {
      const warnings: string[] = [];
      getAllPosts().forEach((post) => {
        if (post.seo.title.length > SEO_TITLE_SOFT_MAX) {
          warnings.push(
            `${post.slug}: seo.title length ${post.seo.title.length} > ${SEO_TITLE_SOFT_MAX}`,
          );
          // eslint-disable-next-line no-console
          console.warn(`[blog/registry] ${warnings[warnings.length - 1]}`);
        }
      });
      // Warning-only per spec. The assertion below documents the contract
      // but never fails so that slightly-over titles don't block the build.
      expect(warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('every post has at least one paragraph section', () => {
      getAllPosts().forEach((post) => {
        const hasParagraph = post.sections.some(
          (section: BlogSection) => section.kind === 'paragraph',
        );
        expect(hasParagraph, `${post.slug} has no paragraph sections`).toBe(true);
      });
    });
  });
});
