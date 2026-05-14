import type { User as FirebaseUser } from 'firebase/auth';
import type { User } from '@/types';
import type { logger } from '@/lib/logger';

type Logger = ReturnType<typeof logger.child>;

export interface OrphanCleanupDeps {
  fetchUserProfile: (fbUser: FirebaseUser) => Promise<User | null>;
  log: Logger;
}

export interface OrphanCleanupResult {
  outcome: 'profile_found' | 'profile_missing';
  attempts: number;
  profile: User | null;
}

export interface OrphanCleanupOptions {
  maxRetries?: number;
  backoffMs?: number;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 250;

// γ4 deep fix (spec 2026-05-12-auth-9_5-plus §2.6 / §3.4):
// First-time sign-in races Firestore-rules-propagation lag (~200–500ms).
// A single null read from fetchUserProfile used to trigger firebaseSignOut,
// surfacing as a session_expired banner for legitimate new users. Absorb
// the lag by retrying maxRetries times with backoffMs between attempts;
// only declare 'profile_missing' (genuine orphan) once retries exhaust.
export async function attemptProfileWithRetry(
  fbUser: FirebaseUser,
  deps: OrphanCleanupDeps,
  opts: OrphanCleanupOptions = {},
): Promise<OrphanCleanupResult> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  const totalAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    const profile = await deps.fetchUserProfile(fbUser);

    if (profile !== null) {
      if (attempt > 1) {
        deps.log.info('Profile found after retry', {
          uid: fbUser.uid,
          attempt,
        });
      }
      return { outcome: 'profile_found', attempts: attempt, profile };
    }

    if (attempt <= maxRetries) {
      deps.log.warn('Profile not found — retrying after backoff', {
        uid: fbUser.uid,
        attempt,
        backoffMs,
      });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, backoffMs);
      });
    }
  }

  deps.log.warn('Profile missing after all retries — orphan confirmed', {
    uid: fbUser.uid,
    attempts: totalAttempts,
  });
  return { outcome: 'profile_missing', attempts: totalAttempts, profile: null };
}
