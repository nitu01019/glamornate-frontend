'use client';

/**
 * Staging-only App Check debug banner.
 *
 * Phase 8 (Booking Flow Fix v3.1, 2026-05-02): the staging APK uses
 * Firebase's debug-token App Check provider — every device generates a
 * stable UUID that has to be registered once in
 * `Firebase Console → App Check → Apps → Manage debug tokens`. The
 * legacy banner was deleted in commit c2d2779c; this restored version
 * surfaces the UUID with a one-tap copy + an opener for the deeplink so
 * QA can self-serve registration without trawling logcat.
 *
 * The banner renders ONLY when `NEXT_PUBLIC_APP_CHECK_DEBUG === 'true'`
 * AND `NEXT_PUBLIC_ENVIRONMENT === 'staging'`. Production builds tree-
 * shake the entire component out via the env-checked early return.
 */
import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

const FIREBASE_DEBUG_TOKEN_GLOBAL = 'FIREBASE_APPCHECK_DEBUG_TOKEN';
const CONSOLE_DEEPLINK =
  'https://console.firebase.google.com/project/glamornate-758c6/appcheck/apps';

export function AppCheckDebugBanner() {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_APP_CHECK_DEBUG !== 'true') return;
    if (process.env.NEXT_PUBLIC_ENVIRONMENT !== 'staging') return;

    // Either NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN (stable env-supplied) or
    // the SDK's auto-generated runtime UUID surfaces on `self`.
    const envToken = process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN?.trim();
    if (envToken && envToken.length > 0) {
      setToken(envToken);
      return;
    }
    type DebugTokenGlobal = Record<string, string | true | undefined>;
    const candidate = (self as unknown as DebugTokenGlobal)[FIREBASE_DEBUG_TOKEN_GLOBAL];
    if (typeof candidate === 'string') {
      setToken(candidate);
    } else {
      // The SDK may not have materialised the token yet on first paint.
      // Retry once after 2s.
      const id = setTimeout(() => {
        const c2 = (self as unknown as DebugTokenGlobal)[FIREBASE_DEBUG_TOKEN_GLOBAL];
        if (typeof c2 === 'string') setToken(c2);
      }, 2000);
      return () => clearTimeout(id);
    }
  }, []);

  if (!open) return null;
  if (process.env.NEXT_PUBLIC_APP_CHECK_DEBUG !== 'true') return null;
  if (process.env.NEXT_PUBLIC_ENVIRONMENT !== 'staging') return null;

  const onCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      logger.warn(
        'AppCheckDebugBanner copy failed',
        { component: 'AppCheckDebugBanner' },
        { err: String(err) },
      );
    }
  };

  return (
    <div
      role="region"
      aria-label="App Check debug token"
      className="fixed bottom-4 right-4 z-[9999] max-w-sm rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <strong className="text-sm">App Check (staging)</strong>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Dismiss"
          className="text-amber-900/60 hover:text-amber-900"
        >
          ×
        </button>
      </div>
      <p className="mt-2 leading-tight">
        Register this UUID in Firebase Console → App Check → Apps → Manage debug tokens.
      </p>
      <div className="mt-2 break-all rounded-lg bg-white/80 px-2 py-1 font-mono">
        {token ?? '(materialising…)'}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onCopy}
          disabled={!token}
          className="rounded-lg bg-amber-900 px-3 py-1.5 text-white disabled:opacity-50"
        >
          {copied ? 'Copied' : 'Copy UUID'}
        </button>
        <a
          href={CONSOLE_DEEPLINK}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-amber-900"
        >
          Open Firebase Console
        </a>
      </div>
    </div>
  );
}
