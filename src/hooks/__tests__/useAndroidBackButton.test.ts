import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE importing the hook so the mocks are wired up.
// ---------------------------------------------------------------------------

const routerBack = vi.fn();
const routerPush = vi.fn();
const infoToast = vi.fn();
let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ back: routerBack, push: routerPush }),
}));

const isNativeMock: Mock<() => boolean> = vi.fn(() => true);
vi.mock('@/lib/capacitor', () => ({
  isNative: () => isNativeMock(),
}));

vi.mock('@/lib/providers', () => ({
  useToastActions: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: infoToast,
  }),
}));

// @capacitor/app mock. The hook imports it via dynamic `import()`, so we
// expose the same surface and capture the registered handler for each test.
type BackButtonHandler = (event: { canGoBack: boolean }) => Promise<void> | void;

interface CapturedListener {
  remove: Mock;
}

const addListenerMock = vi.fn();
const exitAppMock = vi.fn().mockResolvedValue(undefined);
let capturedHandler: BackButtonHandler | null = null;
let capturedListener: CapturedListener | null = null;

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string, handler: BackButtonHandler) => {
      if (event === 'backButton') capturedHandler = handler;
      capturedListener = { remove: vi.fn() };
      return Promise.resolve(capturedListener);
    },
    exitApp: () => exitAppMock(),
  },
}));

// Track addListener calls for the no-op assertion.
vi.mock('@capacitor/app', async () => {
  const add = (event: string, handler: BackButtonHandler): Promise<CapturedListener> => {
    addListenerMock(event);
    if (event === 'backButton') capturedHandler = handler;
    capturedListener = { remove: vi.fn() };
    return Promise.resolve(capturedListener);
  };
  return {
    App: {
      addListener: add,
      exitApp: () => exitAppMock(),
    },
  };
});

import { useAndroidBackButton } from '../useAndroidBackButton';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function flushAsync(): Promise<void> {
  // Let the dynamic import + addListener promise chain settle.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function pressBack(canGoBack = true): Promise<void> {
  if (!capturedHandler) throw new Error('back handler not registered');
  await act(async () => {
    await capturedHandler!({ canGoBack });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAndroidBackButton', () => {
  beforeEach(() => {
    routerBack.mockReset();
    routerPush.mockReset();
    infoToast.mockReset();
    addListenerMock.mockReset();
    exitAppMock.mockClear();
    capturedHandler = null;
    capturedListener = null;
    isNativeMock.mockReturnValue(true);
    mockPathname = '/';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers no listener when not on a native platform', async () => {
    isNativeMock.mockReturnValue(false);

    renderHook(() => useAndroidBackButton());
    await flushAsync();

    expect(addListenerMock).not.toHaveBeenCalled();
    expect(capturedHandler).toBeNull();
  });

  it('calls router.back() when not on the home route and history exists', async () => {
    mockPathname = '/services';

    renderHook(() => useAndroidBackButton());
    await flushAsync();

    await pressBack(true);

    expect(routerBack).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();
    expect(exitAppMock).not.toHaveBeenCalled();
  });

  it('shows the exit toast on the first back press at the home route', async () => {
    mockPathname = '/';

    renderHook(() => useAndroidBackButton());
    await flushAsync();

    await pressBack(true);

    expect(infoToast).toHaveBeenCalledWith('Press back again to exit');
    expect(exitAppMock).not.toHaveBeenCalled();
  });

  it('calls App.exitApp() on the second back press within the 2s window', async () => {
    mockPathname = '/';

    renderHook(() => useAndroidBackButton());
    await flushAsync();

    await pressBack(true);
    expect(infoToast).toHaveBeenCalledTimes(1);

    // Second press within 2s → exit.
    await pressBack(true);
    expect(exitAppMock).toHaveBeenCalledTimes(1);
  });

  it('re-arms (shows the toast again) if the 2s window expired before the second press', async () => {
    mockPathname = '/';

    renderHook(() => useAndroidBackButton());
    await flushAsync();

    await pressBack(true);
    expect(infoToast).toHaveBeenCalledTimes(1);

    // Expire the exit window.
    await act(async () => {
      vi.advanceTimersByTime(2001);
    });

    await pressBack(true);
    expect(infoToast).toHaveBeenCalledTimes(2);
    expect(exitAppMock).not.toHaveBeenCalled();
  });

  it('does nothing when an overlay preventDefault()s the glamornate:back-button event', async () => {
    mockPathname = '/';

    renderHook(() => useAndroidBackButton());
    await flushAsync();

    // Register a listener that intercepts the custom event.
    const intercept = (e: Event): void => {
      e.preventDefault();
    };
    window.addEventListener('glamornate:back-button', intercept);

    try {
      await pressBack(true);
    } finally {
      window.removeEventListener('glamornate:back-button', intercept);
    }

    expect(routerBack).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
    expect(infoToast).not.toHaveBeenCalled();
    expect(exitAppMock).not.toHaveBeenCalled();
  });
});
