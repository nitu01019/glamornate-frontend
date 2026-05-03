import { describe, it, expect } from 'vitest';
import { getAllPosts, getAllSlugs, getPostBySlug, getRelatedPosts } from '../index';

describe('blog registry', () => {
  describe('getAllPosts', () => {
    it('returns a non-empty array of posts', () => {
      const posts = getAllPosts();
      expect(posts.length).toBeGreaterThan(0);
    });

    it('returns posts sorted by publishedAt desc then title asc', () => {
      const posts = getAllPosts();
      for (let i = 1; i < posts.length; i += 1) {
        const prev = posts[i - 1];
        const curr = posts[i];
        const byDate = curr.publishedAt.localeCompare(prev.publishedAt);
        expect(byDate).toBeLessThanOrEqual(0);
        if (byDate === 0) {
          expect(prev.title.localeCompare(curr.title)).toBeLessThanOrEqual(0);
        }
      }
    });

    it('contains no duplicate slugs', () => {
      const posts = getAllPosts();
      const slugs = posts.map((p) => p.slug);
      const unique = new Set(slugs);
      expect(unique.size).toBe(slugs.length);
    });

    it('every post has the minimum required fields', () => {
      const posts = getAllPosts();
      posts.forEach((post) => {
        expect(typeof post.slug).toBe('string');
        expect(post.slug.length).toBeGreaterThan(0);
        expect(typeof post.title).toBe('string');
        expect(post.title.length).toBeGreaterThan(0);
        expect(typeof post.excerpt).toBe('string');
        expect(typeof post.category).toBe('string');
        expect(typeof post.readMinutes).toBe('number');
        expect(post.readMinutes).toBeGreaterThan(0);
        expect(typeof post.heroImage).toBe('string');
        expect(typeof post.publishedAt).toBe('string');
        expect(Array.isArray(post.sections)).toBe(true);
        expect(post.sections.length).toBeGreaterThan(0);
        expect(typeof post.cta.label).toBe('string');
        expect(typeof post.cta.href).toBe('string');
        expect(Array.isArray(post.relatedSlugs)).toBe(true);
        expect(typeof post.seo.title).toBe('string');
        expect(typeof post.seo.description).toBe('string');
        expect(typeof post.seo.ogImage).toBe('string');
      });
    });
  });

  describe('getAllSlugs', () => {
    it('returns one slug per post in the same order as getAllPosts', () => {
      const posts = getAllPosts();
      const slugs = getAllSlugs();
      expect(slugs.length).toBe(posts.length);
      slugs.forEach((slug, i) => {
        expect(slug).toBe(posts[i].slug);
      });
    });

    it('slugs are kebab-case', () => {
      getAllSlugs().forEach((slug) => {
        expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      });
    });
  });

  describe('getPostBySlug', () => {
    it('returns the matching post when the slug exists', () => {
      const first = getAllPosts()[0];
      const found = getPostBySlug(first.slug);
      expect(found).not.toBeNull();
      expect(found?.slug).toBe(first.slug);
    });

    it('returns null for an unknown slug', () => {
      expect(getPostBySlug('totally-nonexistent-slug')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getPostBySlug('')).toBeNull();
    });

    it('returns null when passed a non-string at runtime', () => {
      // Simulate accidental misuse at call boundary (e.g. bad URL param).
      // Cast through unknown to preserve the type contract while testing
      // defensive runtime behavior.
      expect(getPostBySlug(undefined as unknown as string)).toBeNull();
      expect(getPostBySlug(null as unknown as string)).toBeNull();
    });
  });

  describe('getRelatedPosts', () => {
    it('returns an empty array when the slug is unknown', () => {
      expect(getRelatedPosts('unknown-slug')).toEqual([]);
    });

    it('returns an empty array for empty slug input', () => {
      expect(getRelatedPosts('')).toEqual([]);
    });

    it('returns no more than the requested limit', () => {
      const first = getAllPosts()[0];
      const related = getRelatedPosts(first.slug, 2);
      expect(related.length).toBeLessThanOrEqual(2);
    });

    it('never includes the source post in its own related list', () => {
      getAllPosts().forEach((post) => {
        const related = getRelatedPosts(post.slug, 5);
        related.forEach((r) => {
          expect(r.slug).not.toBe(post.slug);
        });
      });
    });

    it('defaults to 3 when no limit is provided', () => {
      const first = getAllPosts()[0];
      const related = getRelatedPosts(first.slug);
      expect(related.length).toBeLessThanOrEqual(3);
    });

    it('honors explicit relatedSlugs ordering when valid', () => {
      const all = getAllPosts();
      const source = all.find((p) => p.relatedSlugs.length >= 2);
      if (!source) {
        // Registry might not have any posts with related slugs; skip silently.
        return;
      }
      const related = getRelatedPosts(source.slug, 5);
      const firstExpected = source.relatedSlugs.find(
        (s) => getPostBySlug(s) !== null && s !== source.slug,
      );
      if (firstExpected) {
        expect(related[0]?.slug).toBe(firstExpected);
      }
    });

    it('treats non-positive or non-finite limits by falling back to 3', () => {
      const first = getAllPosts()[0];
      expect(getRelatedPosts(first.slug, 0).length).toBeLessThanOrEqual(3);
      expect(getRelatedPosts(first.slug, -1).length).toBeLessThanOrEqual(3);
      expect(getRelatedPosts(first.slug, Number.NaN).length).toBeLessThanOrEqual(3);
    });
  });
});
