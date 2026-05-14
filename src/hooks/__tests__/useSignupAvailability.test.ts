/**
 * Tests for useSignupAvailability and useEmailTypoSuggestion hooks.
 *
 * Strategy:
 *   - Mock `@/lib/firebase-client-wrapper` to control `callFunction`.
 *   - Mock `@/lib/app-check` to control `getAppCheckToken` (returns token
 *     by default; can be made to return null to simulate App Check failure).
 *   - Mock `@/lib/logger` to keep test output clean.
 *   - Mock `./useDebounceValue` to return the value immediately (no 300 ms
 *     timer for every test that doesn't care about debounce).
 *   - Use `vi.useFakeTimers()` only inside the tests that exercise timer logic
 *     (App Check retry, triggerCheck flag reset).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Module mocks — declared before any hook import so Vitest hoists them.
// ---------------------------------------------------------------------------

// --- useDebounceValue: return input value immediately (no real timer needed) ---
vi.mock('../useDebounceValue', () => ({
  useDebounceValue: (value: string) => value,
}));

// --- logger: no-op to suppress noise ---
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// --- App Check: default returns a token string ---
const getAppCheckTokenMock = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/app-check', () => ({
  getAppCheckToken: () => getAppCheckTokenMock(),
  initAppCheck: vi.fn(),
  __resetAppCheckForTests: vi.fn(),
}));

// --- Firebase client wrapper: callFunction spy ---
const callFunctionMock = vi.fn<(name: string, payload: unknown) => Promise<unknown>>();
vi.mock('@/lib/firebase-client-wrapper', () => ({
  firebaseClientWrapper: {
    callFunction: (...args: Parameters<typeof callFunctionMock>) => callFunctionMock(...args),
    getDocuments: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    subscribeToQuery: vi.fn(() => vi.fn()),
  },
}));

// ---------------------------------------------------------------------------
// Hook imports (after mocks)
// ---------------------------------------------------------------------------

import { useSignupAvailability } from '../useSignupAvailability';
import { useEmailTypoSuggestion } from '../useEmailTypoSuggestion';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const VALID_EMAIL = 'test@example.com';

beforeEach(() => {
  // Default: App Check returns a valid token.
  getAppCheckTokenMock.mockResolvedValue('mock-app-check-token');
  // Default: backend says email is available.
  callFunctionMock.mockResolvedValue({ email: { available: true, taken: false } });
});

afterEach(() => {
  vi.clearAllMocks();
  // Ensure we always restore real timers even if a test forgets.
  vi.useRealTimers();
});

// ===========================================================================
// useSignupAvailability
// ===========================================================================

describe('useSignupAvailability', () => {
  // -------------------------------------------------------------------------
  // Test 1: Network error → status becomes 'idle' (not 'error')
  // -------------------------------------------------------------------------

  it('settles to idle (not error) when callFunction throws a network error', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });

    callFunctionMock.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() =>
      useSignupAvailability('email', VALID_EMAIL, { trigger: 'both' }),
    );

    // Drain microtasks for the first attempt (App Check + callFunction rejection).
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Advance past the 1-second RETRY_DELAY_MS so the scheduled retry fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    // After both the initial attempt and the one-shot retry fail, status must
    // be 'idle' — the hook never surfaces 'error'.
    expect(result.current.status).toBe('idle');
    expect(result.current.status).not.toBe('error');

    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Test 2: App Check returning null → silently idle (no callFunction call)
  // -------------------------------------------------------------------------

  it('does not call the backend and stays idle when App Check returns null', async () => {
    // When getAppCheckToken resolves to null the hook skips the backend call
    // and immediately sets status to 'idle'.  This simulates App Check not yet
    // initialized or a token acquisition timeout on the 2-second race.
    getAppCheckTokenMock.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useSignupAvailability('email', VALID_EMAIL, { trigger: 'both' }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // When App Check is null the hook sets idle directly — no callFunction call.
    expect(callFunctionMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.status).not.toBe('error');
  });

  it('calls callFunction twice (initial + retry) when App Check succeeds but callable throws', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });

    callFunctionMock.mockRejectedValue(new Error('server error'));

    const { result } = renderHook(() =>
      useSignupAvailability('email', VALID_EMAIL, { trigger: 'both' }),
    );

    // Drain microtasks for the first attempt.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Advance past the 1-second retry delay so the retry setTimeout fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    // callFunction should have been called exactly twice.
    expect(callFunctionMock).toHaveBeenCalledTimes(2);

    // Status after two failures must be idle, never error.
    expect(result.current.status).toBe('idle');
    expect(result.current.status).not.toBe('error');

    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Test 3: triggerCheck() fires immediately (onBlur mode, no auto-fire)
  // -------------------------------------------------------------------------

  it('triggerCheck() invokes callFunction when trigger is onBlur (no debounce auto-fire)', async () => {
    // With trigger: 'onBlur', the debounced effect does NOT auto-fire.
    // Only triggerCheck() should cause an invocation.
    const { result } = renderHook(() =>
      useSignupAvailability('email', VALID_EMAIL, { trigger: 'onBlur' }),
    );

    // Give the hook a moment to mount — no auto-check should run.
    await act(async () => {
      await Promise.resolve();
    });

    expect(callFunctionMock).not.toHaveBeenCalled();

    // Now call triggerCheck — it should fire synchronously (or within microtasks).
    act(() => {
      result.current.triggerCheck();
    });

    // Flush the async chain kicked off by triggerCheck.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(callFunctionMock).toHaveBeenCalledTimes(1);
    expect(callFunctionMock).toHaveBeenCalledWith('checkSignupAvailability', {
      email: VALID_EMAIL,
    });
  });

  // -------------------------------------------------------------------------
  // Test 4a: backend returns available → status is 'available'
  // -------------------------------------------------------------------------

  it('sets status to available when backend reports available:true / taken:false', async () => {
    callFunctionMock.mockResolvedValue({ email: { available: true, taken: false } });

    const { result } = renderHook(() =>
      useSignupAvailability('email', VALID_EMAIL, { trigger: 'both' }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('available');
    });

    expect(result.current.lastCheckedEmail).toBe(VALID_EMAIL);
  });

  // -------------------------------------------------------------------------
  // Test 4b: backend returns taken → status is 'taken'
  // -------------------------------------------------------------------------

  it('sets status to taken when backend reports available:false / taken:true', async () => {
    callFunctionMock.mockResolvedValue({ email: { available: false, taken: true } });

    const { result } = renderHook(() =>
      useSignupAvailability('email', 'taken@example.com', { trigger: 'both' }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('taken');
    });

    expect(result.current.lastCheckedEmail).toBe('taken@example.com');
  });

  // -------------------------------------------------------------------------
  // Additional: empty value stays idle (pre-validation short-circuit)
  // -------------------------------------------------------------------------

  it('stays idle when the email value is empty', async () => {
    const { result } = renderHook(() => useSignupAvailability('email', '', { trigger: 'both' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(callFunctionMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  // -------------------------------------------------------------------------
  // Additional: invalid email stays idle (pre-validation short-circuit)
  // -------------------------------------------------------------------------

  it('stays idle when the email value is invalid (no @)', async () => {
    const { result } = renderHook(() =>
      useSignupAvailability('email', 'notanemail', { trigger: 'both' }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(callFunctionMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  // -------------------------------------------------------------------------
  // Additional: backend returns null slot (rate_limited) → idle
  // -------------------------------------------------------------------------

  it('stays idle when backend returns null email slot (rate_limited sentinel)', async () => {
    callFunctionMock.mockResolvedValue({ email: null, phone: null });

    const { result } = renderHook(() =>
      useSignupAvailability('email', VALID_EMAIL, { trigger: 'both' }),
    );

    await waitFor(() => {
      // Status should settle to idle — not 'available', not 'taken'.
      expect(['idle', 'checking']).toContain(result.current.status);
    });

    // Wait a bit longer for the check to complete.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe('idle');
  });

  // -------------------------------------------------------------------------
  // A-5-01 regression: retry uses the LATEST value, not the stale captured one.
  // Pre-fix: retry probed the original `raw` argument captured by the closure,
  // ignoring subsequent keystrokes; the token bump on retry neutralised the
  // stale-response guard so a stale result could land.
  // Post-fix: retry reads valueRef.current and aborts if input changed.
  // -------------------------------------------------------------------------

  it('A-5-01: retry probes the latest value (not the stale captured one)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });

    callFunctionMock
      .mockRejectedValueOnce(new Error('transient network'))
      .mockResolvedValueOnce({ email: { available: true, taken: false } });

    const { rerender } = renderHook(
      ({ email }: { email: string }) => useSignupAvailability('email', email, { trigger: 'both' }),
      { initialProps: { email: 'first@example.com' } },
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // User types a different value before the retry fires.
    rerender({ email: 'second@example.com' });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    // The retry must NOT have probed the stale value a second time. Either it
    // aborts (snapshot mismatch) or it probes the latest value.
    const retryCalls = callFunctionMock.mock.calls.slice(1);
    for (const [, payload] of retryCalls) {
      const email = (payload as { email?: string }).email;
      expect(email).not.toBe('first@example.com');
    }

    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // A-5-05: stale-response suppression — only the latest probe's result wins.
  // -------------------------------------------------------------------------

  it('A-5-05: stale-response suppression — only the latest probe commits', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    let resolveSecond: ((value: unknown) => void) | undefined;

    callFunctionMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    callFunctionMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      ({ email }: { email: string }) => useSignupAvailability('email', email, { trigger: 'both' }),
      { initialProps: { email: 'first@example.com' } },
    );

    // Drain the initial mount → first call started.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Second keystroke kicks off the second probe.
    rerender({ email: 'second@example.com' });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Resolve the SECOND (latest) probe first — that result must commit.
    await act(async () => {
      resolveSecond?.({ email: { available: false, taken: true } });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe('taken');
    expect(result.current.lastCheckedEmail).toBe('second@example.com');

    // Resolve the STALE first probe with a contradictory result. The stale
    // token guard must suppress it — status stays 'taken'.
    await act(async () => {
      resolveFirst?.({ email: { available: true, taken: false } });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe('taken');
    expect(result.current.lastCheckedEmail).toBe('second@example.com');
  });

  // -------------------------------------------------------------------------
  // A-5-05: triggerCheck immediate flag suppresses next debounced run.
  // -------------------------------------------------------------------------

  it('A-5-05: triggerCheck immediate flag suppresses next debounced run', async () => {
    const { result, rerender } = renderHook(
      ({ email }: { email: string }) => useSignupAvailability('email', email, { trigger: 'both' }),
      { initialProps: { email: VALID_EMAIL } },
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const initialCallCount = callFunctionMock.mock.calls.length;

    act(() => {
      result.current.triggerCheck();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const afterTriggerCount = callFunctionMock.mock.calls.length;
    expect(afterTriggerCount).toBe(initialCallCount + 1);

    // Re-render with the same value — the debounced effect would re-fire,
    // but the immediate flag must suppress it.
    rerender({ email: VALID_EMAIL });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(callFunctionMock.mock.calls.length).toBe(afterTriggerCount);
  });

  // -------------------------------------------------------------------------
  // A-5-05: trigger:'onChange' mode auto-fires on debounced changes.
  // -------------------------------------------------------------------------

  it("A-5-05: trigger:'onChange' fires callFunction on debounced changes", async () => {
    const { result } = renderHook(() =>
      useSignupAvailability('email', VALID_EMAIL, { trigger: 'onChange' }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('available');
    });

    expect(callFunctionMock).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // A-5-05: phone field path — PHONE_RE pre-validation + payload shape.
  // -------------------------------------------------------------------------

  it('A-5-05: phone field — valid E.164 taken sets status taken', async () => {
    callFunctionMock.mockResolvedValue({ phone: { available: false, taken: true } });

    const { result } = renderHook(() =>
      useSignupAvailability('phone', '+919999912345', { trigger: 'both' }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('taken');
    });

    expect(callFunctionMock).toHaveBeenCalledWith('checkSignupAvailability', {
      phone: '+919999912345',
    });
  });

  it('A-5-05: phone field — valid E.164 available sets status available', async () => {
    callFunctionMock.mockResolvedValue({ phone: { available: true, taken: false } });

    const { result } = renderHook(() =>
      useSignupAvailability('phone', '+919999912345', { trigger: 'both' }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('available');
    });
  });

  it('A-5-05: phone field — invalid value stays idle (no callFunction)', async () => {
    const { result } = renderHook(() =>
      useSignupAvailability('phone', 'not-a-phone', { trigger: 'both' }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(callFunctionMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  // -------------------------------------------------------------------------
  // A-5-05: lastCheckedEmail transform — trimmed; payload lowercased.
  // -------------------------------------------------------------------------

  it('A-5-05: lastCheckedEmail equals trimmed value; payload is lowercased', async () => {
    callFunctionMock.mockResolvedValue({ email: { available: true, taken: false } });

    const { result } = renderHook(() =>
      useSignupAvailability('email', '  Test@Example.com  ', { trigger: 'both' }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('available');
    });

    // The hook trims the value before storing — casing is preserved here.
    expect(result.current.lastCheckedEmail).toBe('Test@Example.com');

    // Verify the network payload IS lowercased — the transform contract.
    expect(callFunctionMock).toHaveBeenCalledWith('checkSignupAvailability', {
      email: 'test@example.com',
    });
  });

  // -------------------------------------------------------------------------
  // Additional: hook returns stable shape ({ status, lastCheckedEmail, triggerCheck })
  // -------------------------------------------------------------------------

  it('returns the required shape keys from the start', () => {
    // With an empty value the hook never fires, so we can safely assert idle.
    const { result } = renderHook(() => useSignupAvailability('email', ''));

    expect(result.current).toHaveProperty('status');
    expect(result.current).toHaveProperty('lastCheckedEmail');
    expect(result.current).toHaveProperty('triggerCheck');
    expect(typeof result.current.triggerCheck).toBe('function');
    // Empty value pre-validation short-circuits: status stays idle.
    expect(result.current.status).toBe('idle');
    expect(result.current.lastCheckedEmail).toBe('');
  });
});

// ===========================================================================
// useEmailTypoSuggestion
// ===========================================================================

describe('useEmailTypoSuggestion', () => {
  // -------------------------------------------------------------------------
  // Test 5: Known TYPO_MAP match → suggestion with corrected domain
  // -------------------------------------------------------------------------

  it('returns "Did you mean nitish@gmail.com?" for nitish@gmial.com', () => {
    const { result } = renderHook(() => useEmailTypoSuggestion('nitish@gmial.com'));

    expect(result.current.suggestion).toBe('Did you mean nitish@gmail.com?');
  });

  // -------------------------------------------------------------------------
  // Test 6: Exact valid domain → null
  // -------------------------------------------------------------------------

  it('returns null for valid@gmail.com (exact TOP_DOMAINS match)', () => {
    const { result } = renderHook(() => useEmailTypoSuggestion('valid@gmail.com'));

    expect(result.current.suggestion).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 7: Levenshtein-1 match → suggestion (yhaoo.com → yahoo.com)
  // -------------------------------------------------------------------------

  it('returns suggestion for user@yhaoo.com (Levenshtein-1 from yahoo.com)', () => {
    const { result } = renderHook(() => useEmailTypoSuggestion('user@yhaoo.com'));

    // yhaoo.com is in TYPO_MAP → direct suggestion
    expect(result.current.suggestion).not.toBeNull();
    expect(result.current.suggestion).toContain('yahoo.com');
  });

  // -------------------------------------------------------------------------
  // Test 8: No false positives for unusual but valid domains
  // -------------------------------------------------------------------------

  it('returns null for user@somecompany.io (distance > 1 from all TOP_DOMAINS)', () => {
    const { result } = renderHook(() => useEmailTypoSuggestion('user@somecompany.io'));

    expect(result.current.suggestion).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Additional edge cases
  // -------------------------------------------------------------------------

  it('returns null when there is no @ in the email', () => {
    const { result } = renderHook(() => useEmailTypoSuggestion('notanemail'));

    expect(result.current.suggestion).toBeNull();
  });

  it('returns null for empty string', () => {
    const { result } = renderHook(() => useEmailTypoSuggestion(''));

    expect(result.current.suggestion).toBeNull();
  });

  it('returns null for user@yahoo.com (exact TOP_DOMAIN)', () => {
    const { result } = renderHook(() => useEmailTypoSuggestion('user@yahoo.com'));

    expect(result.current.suggestion).toBeNull();
  });

  it('returns null for user@hotmail.com (exact TOP_DOMAIN)', () => {
    const { result } = renderHook(() => useEmailTypoSuggestion('user@hotmail.com'));

    expect(result.current.suggestion).toBeNull();
  });

  it('returns suggestion for user@gmai.com (TYPO_MAP: gmai.com → gmail.com)', () => {
    const { result } = renderHook(() => useEmailTypoSuggestion('user@gmai.com'));

    expect(result.current.suggestion).toBe('Did you mean user@gmail.com?');
  });

  it('returns suggestion for user@hotmial.com (TYPO_MAP: hotmial.com → hotmail.com)', () => {
    const { result } = renderHook(() => useEmailTypoSuggestion('user@hotmial.com'));

    expect(result.current.suggestion).toBe('Did you mean user@hotmail.com?');
  });

  it('returns suggestion for user@outlok.com (TYPO_MAP: outlok.com → outlook.com)', () => {
    const { result } = renderHook(() => useEmailTypoSuggestion('user@outlok.com'));

    expect(result.current.suggestion).toBe('Did you mean user@outlook.com?');
  });

  it('preserves localPart case in suggestion', () => {
    const { result } = renderHook(() => useEmailTypoSuggestion('MyName@gmial.com'));

    expect(result.current.suggestion).toBe('Did you mean MyName@gmail.com?');
  });

  it('reacts to email changes (memo invalidates when email changes)', () => {
    const { result, rerender } = renderHook(
      ({ email }: { email: string }) => useEmailTypoSuggestion(email),
      { initialProps: { email: 'user@gmail.com' } },
    );

    expect(result.current.suggestion).toBeNull();

    rerender({ email: 'user@gmial.com' });

    expect(result.current.suggestion).toBe('Did you mean user@gmail.com?');

    rerender({ email: 'user@gmail.com' });

    expect(result.current.suggestion).toBeNull();
  });
});
