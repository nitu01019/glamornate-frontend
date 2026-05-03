import { useMemo } from 'react';
import { useDebounceValue } from './useDebounceValue';

/**
 * Known service / category keywords used for client-side autocomplete.
 *
 * In a production build this list would be fetched from the backend; keeping a
 * static seed list avoids an extra network round-trip for basic suggestions.
 */
const SUGGESTION_POOL: readonly string[] = [
  // Categories
  'Massage',
  'Facial',
  'Body Treatment',
  'Pedicure',
  'Manicure',
  'Wellness',
  // Popular services
  'Deep Tissue Massage',
  'Swedish Massage',
  'Thai Massage',
  'Hot Stone Massage',
  'Aromatherapy Massage',
  'Sports Massage',
  'Head Massage',
  'Foot Massage',
  'Hydrating Facial',
  'Anti-Aging Facial',
  'Gold Facial',
  'Cleanup Facial',
  'Brightening Facial',
  'Body Scrub',
  'Body Wrap',
  'Body Polish',
  'Gel Manicure',
  'French Manicure',
  'Spa Pedicure',
  'Classic Pedicure',
  'Nail Art',
  'Hair Spa',
  'Hair Treatment',
  'Keratin Treatment',
  'Waxing',
  'Threading',
  'Bleach',
  'Bridal Package',
  'Couple Spa',
  'Relaxation Package',
];

const MAX_SUGGESTIONS = 6;
const MIN_QUERY_LENGTH = 2;

interface AutocompleteSuggestionsResult {
  /** Filtered suggestion strings matching the current query. */
  suggestions: string[];
}

/**
 * Provides autocomplete suggestions for the search overlay.
 *
 * Performs a prefix + substring match against a static pool of known service
 * names and categories. The query is debounced internally (150 ms) so callers
 * do not need to debounce before passing the raw input value.
 */
export function useAutocompleteSuggestions(
  query: string,
): AutocompleteSuggestionsResult {
  const debouncedQuery = useDebounceValue(query.trim(), 150);

  const suggestions = useMemo<string[]>(() => {
    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      return [];
    }

    const lowerQuery = debouncedQuery.toLowerCase();

    // Score: prefix match first, then substring match.
    const scored = SUGGESTION_POOL.map((item) => {
      const lower = item.toLowerCase();
      if (lower.startsWith(lowerQuery)) return { item, score: 2 };
      if (lower.includes(lowerQuery)) return { item, score: 1 };
      return { item, score: 0 };
    })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.localeCompare(b.item));

    return scored.slice(0, MAX_SUGGESTIONS).map((entry) => entry.item);
  }, [debouncedQuery]);

  return { suggestions };
}
