import { useMemo } from 'react';

export interface UseEmailTypoSuggestionResult {
  suggestion: string | null;
}

const TYPO_MAP: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'yahooo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'yhaoo.com': 'yahoo.com',
};

const TOP_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'protonmail.com',
  'live.com',
  'aol.com',
  'mail.com',
  'gmx.com',
];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const prev: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  const curr: number[] = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev.splice(0, n + 1, ...curr);
  }
  return prev[n];
}

export function useEmailTypoSuggestion(email: string): UseEmailTypoSuggestionResult {
  return useMemo(() => {
    const atIdx = email.lastIndexOf('@');
    if (atIdx < 0) return { suggestion: null };

    const localPart = email.slice(0, atIdx);
    const domain = email.slice(atIdx + 1).toLowerCase();

    if (!domain) return { suggestion: null };

    if (TOP_DOMAINS.includes(domain)) return { suggestion: null };

    const typoFixed = TYPO_MAP[domain];
    if (typoFixed) {
      return { suggestion: `Did you mean ${localPart}@${typoFixed}?` };
    }

    for (const candidate of TOP_DOMAINS) {
      if (levenshtein(domain, candidate) === 1) {
        return { suggestion: `Did you mean ${localPart}@${candidate}?` };
      }
    }

    return { suggestion: null };
  }, [email]);
}
