import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { User as FirebaseUser } from 'firebase/auth';
import type { User } from '@/types';
import { attemptProfileWithRetry } from '../orphan-cleanup';

const fbUser = { uid: 'test-uid-123' } as FirebaseUser;

const profile: User = {
  uid: 'test-uid-123',
  email: 'test@example.com',
  displayName: 'Test User',
  // Cast through unknown: the test only cares about identity, not shape.
} as unknown as User;

function createLog() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
}

describe('attemptProfileWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns profile_found on attempt 1 when fetchUserProfile resolves the profile immediately', async () => {
    const fetchUserProfile = vi.fn().mockResolvedValue(profile);
    const log = createLog();

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const result = await attemptProfileWithRetry(fbUser, {
      fetchUserProfile,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      log: log as any,
    });

    expect(result).toEqual({ outcome: 'profile_found', attempts: 1, profile });
    expect(fetchUserProfile).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('absorbs Firestore-rules-propagation lag: null on attempt 1, profile on attempt 2', async () => {
    const fetchUserProfile = vi
      .fn<(fbUser: FirebaseUser) => Promise<User | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(profile);
    const log = createLog();

    const promise = attemptProfileWithRetry(fbUser, {
      fetchUserProfile,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      log: log as any,
    });

    // First await tick lets attempt 1 resolve and schedule the 250ms backoff.
    await vi.advanceTimersByTimeAsync(0);
    // Drain the 250ms backoff so attempt 2 can fire.
    await vi.advanceTimersByTimeAsync(250);

    const result = await promise;

    expect(result).toEqual({ outcome: 'profile_found', attempts: 2, profile });
    expect(fetchUserProfile).toHaveBeenCalledTimes(2);
    // One retry warning (between attempt 1 and 2) + one "found after retry" info.
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith(
      'Profile found after retry',
      expect.objectContaining({ uid: fbUser.uid, attempt: 2 }),
    );
  });

  it('returns profile_missing only after all retries exhaust (3 total attempts on defaults)', async () => {
    const fetchUserProfile = vi
      .fn<(fbUser: FirebaseUser) => Promise<User | null>>()
      .mockResolvedValue(null);
    const log = createLog();

    const promise = attemptProfileWithRetry(fbUser, {
      fetchUserProfile,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      log: log as any,
    });

    // Drain both 250ms backoffs (between attempts 1→2 and 2→3).
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(250);
    await vi.advanceTimersByTimeAsync(250);

    const result = await promise;

    expect(result).toEqual({ outcome: 'profile_missing', attempts: 3, profile: null });
    expect(fetchUserProfile).toHaveBeenCalledTimes(3);
    // Two retry warnings (after attempts 1 and 2) + one final "orphan confirmed".
    expect(log.warn).toHaveBeenCalledTimes(3);
    expect(log.warn).toHaveBeenLastCalledWith(
      'Profile missing after all retries — orphan confirmed',
      expect.objectContaining({ uid: fbUser.uid, attempts: 3 }),
    );
  });

  it('respects custom maxRetries and backoffMs', async () => {
    const fetchUserProfile = vi
      .fn<(fbUser: FirebaseUser) => Promise<User | null>>()
      .mockResolvedValue(null);
    const log = createLog();

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const promise = attemptProfileWithRetry(
      fbUser,
      {
        fetchUserProfile,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        log: log as any,
      },
      { maxRetries: 5, backoffMs: 100 },
    );

    // 6 total attempts → 5 backoffs of 100ms each.
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(100);
    }

    const result = await promise;

    expect(result.outcome).toBe('profile_missing');
    expect(result.attempts).toBe(6);
    expect(fetchUserProfile).toHaveBeenCalledTimes(6);

    // Every scheduled timeout used the custom backoff.
    const backoffTimes = setTimeoutSpy.mock.calls.map((call) => call[1]);
    expect(backoffTimes).toEqual([100, 100, 100, 100, 100]);
  });

  it('does not retry when fetchUserProfile returns a profile (zero setTimeout calls)', async () => {
    const fetchUserProfile = vi.fn().mockResolvedValue(profile);
    const log = createLog();

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    await attemptProfileWithRetry(
      fbUser,
      {
        fetchUserProfile,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        log: log as any,
      },
      { maxRetries: 10, backoffMs: 999 },
    );

    expect(fetchUserProfile).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  // γ4 follow-up (2026-05-12): listener wiring integration test.
  // auth-listener.ts:85 used to call `fetchUserProfile(fbUser)` once and
  // signOut on null. It now wraps the call in attemptProfileWithRetry.
  // These tests simulate the exact listener sequence and assert that the
  // first-call-null / second-call-success path no longer triggers signOut,
  // while the genuine-orphan path still does.
  describe('listener wiring (auth-listener.ts:85)', () => {
    it('absorbs rules-propagation lag in the listener path: null then profile → no signOut, user set', async () => {
      const fetchUserProfile = vi
        .fn<(fbUser: FirebaseUser) => Promise<User | null>>()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(profile);
      const log = createLog();
      const firebaseSignOut = vi.fn().mockResolvedValue(undefined);
      const setUser = vi.fn();

      // Reproduce the listener body's now-mechanical wiring (auth-listener.ts:85).
      const listenerStep = async () => {
        const orphanResult = await attemptProfileWithRetry(fbUser, {
          fetchUserProfile,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          log: log as any,
        });
        const profileFromRetry = orphanResult.profile;

        if (profileFromRetry === null) {
          await firebaseSignOut();
          setUser(null);
          return;
        }
        setUser(profileFromRetry);
      };

      const promise = listenerStep();

      // Drain attempt 1 → schedule backoff → drain backoff → attempt 2.
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(250);

      await promise;

      expect(fetchUserProfile).toHaveBeenCalledTimes(2);
      expect(firebaseSignOut).not.toHaveBeenCalled();
      expect(setUser).toHaveBeenCalledTimes(1);
      expect(setUser).toHaveBeenCalledWith(profile);
    });

    it('still signs out when listener path exhausts retries (genuine orphan)', async () => {
      const fetchUserProfile = vi
        .fn<(fbUser: FirebaseUser) => Promise<User | null>>()
        .mockResolvedValue(null);
      const log = createLog();
      const firebaseSignOut = vi.fn().mockResolvedValue(undefined);
      const setUser = vi.fn();

      const listenerStep = async () => {
        const orphanResult = await attemptProfileWithRetry(fbUser, {
          fetchUserProfile,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          log: log as any,
        });
        if (orphanResult.profile === null) {
          await firebaseSignOut();
          setUser(null);
          return;
        }
        setUser(orphanResult.profile);
      };

      const promise = listenerStep();

      // Drain all 3 attempts + 2 backoffs on defaults.
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(250);
      await vi.advanceTimersByTimeAsync(250);

      await promise;

      expect(fetchUserProfile).toHaveBeenCalledTimes(3);
      expect(firebaseSignOut).toHaveBeenCalledTimes(1);
      expect(setUser).toHaveBeenCalledWith(null);
    });
  });

  // foxtrot-5 stress (2026-05-12): exhaustion under simulated Firestore lag.
  // These tests confirm the retry counter is exact: declares orphan ONLY
  // after totalAttempts = maxRetries + 1 null returns, and does not invoke
  // fetchUserProfile a (totalAttempts+1)-th time.
  describe('exhaustion stress', () => {
    it('declares orphan after exactly 3 attempts on defaults (3 null returns) and never invokes a 4th', async () => {
      // Pre-load 3 nulls. A 4th call would mock-return undefined and trip
      // the assertion below — but more importantly, fetchUserProfile must
      // have been called exactly 3 times.
      const fourthCallSentinel = vi.fn();
      const fetchUserProfile = vi
        .fn<(fbUser: FirebaseUser) => Promise<User | null>>()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockImplementation(async () => {
          fourthCallSentinel();
          return profile;
        });
      const log = createLog();

      const promise = attemptProfileWithRetry(fbUser, {
        fetchUserProfile,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        log: log as any,
      });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(250);
      await vi.advanceTimersByTimeAsync(250);

      const result = await promise;

      expect(result).toEqual({ outcome: 'profile_missing', attempts: 3, profile: null });
      expect(fetchUserProfile).toHaveBeenCalledTimes(3);
      // The 4th-call branch (which would return a profile) must never fire.
      expect(fourthCallSentinel).not.toHaveBeenCalled();
    });

    it('with {maxRetries:5, backoffMs:50} and 6 null returns, exhausts at exactly 6 attempts', async () => {
      const seventhCallSentinel = vi.fn();
      const fetchUserProfile = vi
        .fn<(fbUser: FirebaseUser) => Promise<User | null>>()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockImplementation(async () => {
          seventhCallSentinel();
          return profile;
        });
      const log = createLog();

      const promise = attemptProfileWithRetry(
        fbUser,
        {
          fetchUserProfile,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          log: log as any,
        },
        { maxRetries: 5, backoffMs: 50 },
      );

      // 6 total attempts → 5 backoffs of 50ms each.
      await vi.advanceTimersByTimeAsync(0);
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(50);
      }

      const result = await promise;

      expect(result).toEqual({ outcome: 'profile_missing', attempts: 6, profile: null });
      expect(fetchUserProfile).toHaveBeenCalledTimes(6);
      expect(seventhCallSentinel).not.toHaveBeenCalled();
      // Exactly 5 retry warnings + 1 final orphan-confirmed warning = 6.
      expect(log.warn).toHaveBeenCalledTimes(6);
      expect(log.warn).toHaveBeenLastCalledWith(
        'Profile missing after all retries — orphan confirmed',
        expect.objectContaining({ uid: fbUser.uid, attempts: 6 }),
      );
    });
  });
});
