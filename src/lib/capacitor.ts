/**
 * Capacitor Platform Detection
 */

export function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as Record<string, unknown>).Capacitor;
}

export function isNative(): boolean {
  if (!isCapacitor()) return false;
  const cap = (window as unknown as Record<string, unknown>).Capacitor as Record<string, unknown>;
  return typeof cap.isNativePlatform === 'function'
    ? (cap.isNativePlatform as () => boolean)() === true
    : false;
}
