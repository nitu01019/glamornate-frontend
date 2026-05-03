'use client';

import { useEffect } from 'react';

/**
 * Prevents pinch-to-zoom and double-tap-zoom on all pages.
 * iOS Safari ignores the viewport meta user-scalable=no since iOS 10,
 * so JavaScript event listeners are the only reliable approach.
 */
export default function ZoomLock() {
  useEffect(() => {
    // Block pinch-to-zoom (iOS gesture events)
    const blockGesture = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', blockGesture, { passive: false });
    document.addEventListener('gesturechange', blockGesture, { passive: false });
    document.addEventListener('gestureend', blockGesture, { passive: false });

    // Block pinch-to-zoom (multi-touch on touchmove)
    const blockMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', blockMultiTouch, { passive: false });

    // Block double-tap-to-zoom
    let lastTouchEnd = 0;
    const blockDoubleTap = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };
    document.addEventListener('touchend', blockDoubleTap, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', blockGesture);
      document.removeEventListener('gesturechange', blockGesture);
      document.removeEventListener('gestureend', blockGesture);
      document.removeEventListener('touchmove', blockMultiTouch);
      document.removeEventListener('touchend', blockDoubleTap);
    };
  }, []);

  return null;
}
