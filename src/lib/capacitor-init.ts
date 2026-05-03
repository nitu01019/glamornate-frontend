import { isNative } from './capacitor';
import { initSentryCapacitor } from './sentry-capacitor';

export async function initializeCapacitorPlugins(): Promise<void> {
  if (!isNative()) return;

  // Initialize Sentry for the native Capacitor runtime before any other plugin
  // work so that early plugin failures are still captured. No-op when
  // NEXT_PUBLIC_SENTRY_DSN is empty.
  initSentryCapacitor();

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    const { StatusBar, Style } = await import('@capacitor/status-bar');

    await SplashScreen.hide();
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#ffffff' });
  } catch {
    // Plugins not available — running in web mode
  }
}
