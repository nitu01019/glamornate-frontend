import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.glamornate.app',
  appName: 'Glamornate',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#fdf6ec',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    // MOB-M5: Only the background color is set at config time.
    // Style is set at runtime in `src/lib/capacitor-init.ts` via
    // `StatusBar.setStyle({ style: Style.Dark })` to avoid drift
    // between the plugin's string config and the Style enum.
    StatusBar: {
      backgroundColor: '#ffffff',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    // Phase 4 / 4B: Geolocation plugin. The plugin is registered
    // automatically when `npx cap sync` runs, so no extra config keys are
    // strictly necessary. This empty block exists as a named anchor so
    // future options (e.g. high-accuracy defaults) have a home and so
    // readers of the config can see the plugin is deliberately enabled.
    Geolocation: {},
    // M2: Privacy-screen plugin. We disable the plugin's default
    // start-up enable so that <PrivacyScreenWatcher /> is the single
    // source of truth for which routes trigger FLAG_SECURE. The watcher
    // runs on every route change and toggles enable()/disable() based
    // on the SECURE_ROUTE_PREFIXES list in src/lib/privacy-screen.ts.
    PrivacyScreen: {
      enable: false,
    },
    // FirebaseAuthentication: native Google chooser bottom sheet.
    // skipNativeAuth=true keeps the Firebase web SDK as single source of
    // truth (everywhere else in the app uses getAuth().currentUser). The
    // native plugin only mints an idToken from Google's native SDK; we
    // exchange it via signInWithCredential() in src/lib/auth-provider.tsx.
    // This avoids the Capacitor WebView storage-partition bug that breaks
    // signInWithRedirect with "auth/missing-initial-state".
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
