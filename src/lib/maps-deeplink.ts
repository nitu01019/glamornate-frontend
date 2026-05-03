/**
 * Build a Google Maps directions URL from coords.
 * Cross-platform — opens in Maps app on Android, Maps PWA on iOS, web Maps in browser.
 */

export interface DirectionsLocation {
  lat: number;
  lng: number;
  address?: string;
}

export function buildDirectionsUrl(loc: DirectionsLocation): string {
  const base = `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
  return loc.address
    ? `${base}&destination=${encodeURIComponent(loc.address)}`
    : base;
}

/**
 * Open the directions URL in a new context.
 *
 * Capacitor's WebViewClient intercepts `_blank` https links and forwards them
 * to `Intent.ACTION_VIEW`, which launches the Google Maps app on Android and
 * Safari/Maps on iOS. On web we open a new tab.
 */
export function openDirections(loc: DirectionsLocation): void {
  if (typeof window === 'undefined') return;
  window.open(buildDirectionsUrl(loc), '_blank', 'noopener,noreferrer');
}
