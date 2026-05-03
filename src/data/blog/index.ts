import type { BlogPost } from './types';

import atHomeSpaDay from './posts/at-home-spa-day';
import bodyPolishingVsScrubbing from './posts/body-polishing-vs-scrubbing';
import bridalPrepTimeline from './posts/bridal-prep-timeline';
import hairCareBetweenSalonVisits from './posts/hair-care-between-salon-visits';
import hydragloFacialsExplained from './posts/hydraglo-facials-explained';
import koreanGlassSkinFacials from './posts/korean-glass-skin-facials';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
//
// The registry is built from defensive imports: each statically-imported post
// is probed for the minimum required shape (slug + title). Anything malformed
// is omitted with a warning so that a single bad post never breaks the build.
// ---------------------------------------------------------------------------

const CANDIDATE_POSTS: ReadonlyArray<BlogPost | null | undefined> = [
  atHomeSpaDay,
  bodyPolishingVsScrubbing,
  bridalPrepTimeline,
  hairCareBetweenSalonVisits,
  hydragloFacialsExplained,
  koreanGlassSkinFacials,
];

function isValidPost(post: BlogPost | null | undefined): post is BlogPost {
  if (!post) {
    return false;
  }
  if (typeof post.slug !== 'string' || post.slug.length === 0) {
    return false;
  }
  if (typeof post.title !== 'string' || post.title.length === 0) {
    return false;
  }
  return true;
}

function buildRegistry(): ReadonlyArray<BlogPost> {
  const valid: BlogPost[] = [];
  const seenSlugs = new Set<string>();

  CANDIDATE_POSTS.forEach((post, index) => {
    if (!isValidPost(post)) {
      // eslint-disable-next-line no-console -- registry integrity warning must reach the browser console at module-init time before logger.ts is wired up
      console.warn(`[blog/registry] Skipping invalid or missing post at index ${index}`);
      return;
    }
    if (seenSlugs.has(post.slug)) {
      // eslint-disable-next-line no-console -- registry integrity warning must reach the browser console at module-init time before logger.ts is wired up
      console.warn(`[blog/registry] Duplicate slug "${post.slug}" – keeping first occurrence`);
      return;
    }
    seenSlugs.add(post.slug);
    valid.push(post);
  });

  // Sort by publishedAt desc; fall back to title for stable ordering when
  // timestamps tie (all posts on the same day still get a deterministic order).
  return Object.freeze(
    valid.slice().sort((a, b) => {
      const byDate = b.publishedAt.localeCompare(a.publishedAt);
      if (byDate !== 0) return byDate;
      return a.title.localeCompare(b.title);
    }),
  );
}

const REGISTRY: ReadonlyArray<BlogPost> = buildRegistry();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getAllPosts(): ReadonlyArray<BlogPost> {
  return REGISTRY;
}

export function getPostBySlug(slug: string): BlogPost | null {
  if (typeof slug !== 'string' || slug.length === 0) {
    return null;
  }
  const match = REGISTRY.find((post) => post.slug === slug);
  return match ?? null;
}

export function getAllSlugs(): ReadonlyArray<string> {
  return Object.freeze(REGISTRY.map((post) => post.slug));
}

export function getRelatedPosts(slug: string, limit: number = 3): ReadonlyArray<BlogPost> {
  if (typeof slug !== 'string' || slug.length === 0) {
    return [];
  }
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 3;

  const source = getPostBySlug(slug);
  if (!source) {
    return [];
  }

  const byExplicit: BlogPost[] = [];
  source.relatedSlugs.forEach((relatedSlug) => {
    const related = getPostBySlug(relatedSlug);
    if (related && related.slug !== slug) {
      byExplicit.push(related);
    }
  });

  if (byExplicit.length >= safeLimit) {
    return Object.freeze(byExplicit.slice(0, safeLimit));
  }

  // Fill with same-category posts as a fallback, preserving sort order.
  const used = new Set<string>([slug, ...byExplicit.map((p) => p.slug)]);
  const fallback = REGISTRY.filter(
    (post) => post.category === source.category && !used.has(post.slug),
  );

  const merged = [...byExplicit, ...fallback];

  // Last-resort: top of the registry that isn't the source and hasn't been used.
  if (merged.length < safeLimit) {
    REGISTRY.forEach((post) => {
      if (merged.length >= safeLimit) return;
      if (used.has(post.slug)) return;
      if (merged.some((m) => m.slug === post.slug)) return;
      merged.push(post);
    });
  }

  return Object.freeze(merged.slice(0, safeLimit));
}
