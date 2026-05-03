import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock fns — must use vi.hoisted so they are available inside vi.mock
// factory callbacks which are hoisted to the top of the file.
// ---------------------------------------------------------------------------

const {
  mockInitializeAppCheck,
  mockGetToken,
  mockCapacitorGetToken,
  MockReCaptchaV3Provider,
  MockCustomProvider,
} = vi.hoisted(() => {
  const MockReCaptchaV3Provider = vi.fn().mockImplementation(function (this: unknown, key: string) {
    return { type: 'recaptcha', key };
  });
  const MockCustomProvider = vi.fn().mockImplementation(function (
    this: unknown,
    opts: { getToken: () => unknown },
  ) {
    return { type: 'custom', _getToken: opts.getToken };
  });
  return {
    mockInitializeAppCheck: vi.fn(),
    mockGetToken: vi.fn(),
    mockCapacitorGetToken: vi.fn(),
    MockReCaptchaV3Provider,
    MockCustomProvider,
  };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

vi.mock('@capacitor-firebase/app-check', () => ({
  FirebaseAppCheck: { getToken: mockCapacitorGetToken },
}));

vi.mock('firebase/app', () => ({
  getApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: mockInitializeAppCheck,
  getToken: mockGetToken,
  ReCaptchaV3Provider: MockReCaptchaV3Provider,
  CustomProvider: MockCustomProvider,
}));

vi.mock('../logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

vi.mock('../capacitor', () => ({
  isNative: vi.fn(() => false),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { Capacitor } from '@capacitor/core';
import { initializeAppCheck } from 'firebase/app-check';
import { isNative } from '../capacitor';
import {
  initAppCheck,
  getAppCheckToken,
  AppCheckTokenError,
  __resetAppCheckForTests,
} from '../app-check';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setNative(value: boolean) {
  vi.mocked(isNative).mockReturnValue(value);
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(value);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initAppCheck', () => {
  beforeEach(() => {
    __resetAppCheckForTests();
    mockInitializeAppCheck.mockReturnValue({ app: 'fake-app-check' });
    mockGetToken.mockResolvedValue({ token: 'test-token' });
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = 'test-site-key';
    setNative(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  });

  // -------------------------------------------------------------------------
  // 1. Web platform
  // -------------------------------------------------------------------------
  it('web platform: calls initializeAppCheck with ReCaptchaV3Provider', () => {
    const result = initAppCheck();

    expect(mockInitializeAppCheck).toHaveBeenCalledOnce();
    expect(MockReCaptchaV3Provider).toHaveBeenCalledOnce();
    const [, config] = vi.mocked(initializeAppCheck).mock.calls[0];
    expect(config.isTokenAutoRefreshEnabled).toBe(true);
    expect(result).not.toBeNull();
  });

  it('web platform: uses the provided site key', () => {
    initAppCheck();
    expect(MockReCaptchaV3Provider).toHaveBeenCalledWith('test-site-key');
  });

  it('web platform: returns null and skips init when site key is missing', () => {
    delete process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    const result = initAppCheck();
    expect(mockInitializeAppCheck).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 2. Native platform — success
  // -------------------------------------------------------------------------
  it('native platform: calls initializeAppCheck with CustomProvider on success', async () => {
    setNative(true);
    mockCapacitorGetToken.mockResolvedValue({
      token: 'native-token',
      expireTimeMillis: Date.now() + 3600_000,
    });

    const result = initAppCheck();
    expect(result).not.toBeNull();
    expect(mockInitializeAppCheck).toHaveBeenCalledOnce();
    expect(MockCustomProvider).toHaveBeenCalledOnce();
  });

  it("native platform: CustomProvider's getToken bridges to FirebaseAppCheck.getToken", async () => {
    setNative(true);
    const expireMs = Date.now() + 3600_000;
    mockCapacitorGetToken.mockResolvedValue({
      token: 'native-token',
      expireTimeMillis: expireMs,
    });

    initAppCheck();

    // Extract and invoke the custom provider's getToken
    const customProviderOpts = MockCustomProvider.mock.calls[0][0];
    const bridgedResult = await customProviderOpts.getToken();

    expect(bridgedResult).toEqual({ token: 'native-token', expireTimeMillis: expireMs });
    expect(mockCapacitorGetToken).toHaveBeenCalledWith({});
  });

  it('native platform: getToken falls back expireTimeMillis when native omits it', async () => {
    setNative(true);
    mockCapacitorGetToken.mockResolvedValue({
      token: 'native-token',
      // no expireTimeMillis
    });

    initAppCheck();

    const customProviderOpts = MockCustomProvider.mock.calls[0][0];
    const before = Date.now();
    const bridgedResult = await customProviderOpts.getToken();
    const after = Date.now();

    // Fallback should be ~1 hour from now
    expect(bridgedResult.expireTimeMillis).toBeGreaterThanOrEqual(before + 3599_000);
    expect(bridgedResult.expireTimeMillis).toBeLessThanOrEqual(after + 3601_000);
  });

  // -------------------------------------------------------------------------
  // 3. Native, transient network error — retry once, then succeed
  // -------------------------------------------------------------------------
  it('native platform: retries once on transient network error then succeeds', async () => {
    setNative(true);
    mockCapacitorGetToken
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce({ token: 'retry-token', expireTimeMillis: Date.now() + 3600_000 });

    initAppCheck();

    const customProviderOpts = MockCustomProvider.mock.calls[0][0];
    const result = await customProviderOpts.getToken();

    expect(mockCapacitorGetToken).toHaveBeenCalledTimes(2);
    expect(result.token).toBe('retry-token');
  });

  // -------------------------------------------------------------------------
  // 4. Native, unsupported device — fail fast with AppCheckTokenError
  // -------------------------------------------------------------------------
  it('native platform: throws AppCheckTokenError(unsupported_device) on unsupported device', async () => {
    setNative(true);
    mockCapacitorGetToken.mockRejectedValue(
      new Error('Play Integrity API unsupported on this device'),
    );

    initAppCheck();

    const customProviderOpts = MockCustomProvider.mock.calls[0][0];
    await expect(customProviderOpts.getToken()).rejects.toMatchObject({
      name: 'AppCheckTokenError',
      kind: 'unsupported_device',
    });

    // Must NOT retry on unsupported device
    expect(mockCapacitorGetToken).toHaveBeenCalledTimes(1);
  });

  it('native platform: throws AppCheckTokenError(native_provider_failed) on non-retryable error', async () => {
    setNative(true);
    mockCapacitorGetToken.mockRejectedValue(
      new Error('App Check not enabled in Firebase Console'),
    );

    initAppCheck();

    const customProviderOpts = MockCustomProvider.mock.calls[0][0];
    await expect(customProviderOpts.getToken()).rejects.toBeInstanceOf(AppCheckTokenError);
    expect(mockCapacitorGetToken).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 5. Idempotency — second call returns same instance, no double init
  // -------------------------------------------------------------------------
  it('is idempotent: calling initAppCheck twice returns the same instance', () => {
    const first = initAppCheck();
    const second = initAppCheck();

    expect(mockInitializeAppCheck).toHaveBeenCalledOnce();
    expect(first).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// getAppCheckToken
// ---------------------------------------------------------------------------

describe('getAppCheckToken', () => {
  beforeEach(() => {
    __resetAppCheckForTests();
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = 'test-site-key';
    setNative(false);
    mockInitializeAppCheck.mockReturnValue({ app: 'fake-app-check' });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  });

  it('returns null when App Check is not initialized', async () => {
    const token = await getAppCheckToken();
    expect(token).toBeNull();
  });

  it('returns token string after successful init', async () => {
    initAppCheck();
    mockGetToken.mockResolvedValue({ token: 'abc123' });

    const token = await getAppCheckToken();
    expect(token).toBe('abc123');
  });

  it('returns null and does not throw when getToken fails', async () => {
    initAppCheck();
    mockGetToken.mockRejectedValue(new Error('SDK error'));

    const token = await getAppCheckToken();
    expect(token).toBeNull();
  });
});
