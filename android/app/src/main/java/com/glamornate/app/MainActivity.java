package com.glamornate.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.appcheck.FirebaseAppCheck;
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory;
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory;

public class MainActivity extends BridgeActivity {
  private static final String APP_CHECK_PROVIDER_META = "com.glamornate.app.APP_CHECK_PROVIDER";
  private static final String PROVIDER_DEBUG = "debug";
  private static final String PROVIDER_PLAY_INTEGRITY = "playintegrity";
  private static final String LOG_TAG = "AppCheck";

  /**
   * SharedPreferences file-name template used by firebase-appcheck-debug 18.0.0
   * (StorageHelper). The %s slot is filled with FirebaseApp.getPersistenceKey().
   */
  private static final String DEBUG_PREFS_TEMPLATE =
      "com.google.firebase.appcheck.debug.store.%s";

  /**
   * Key inside the prefs file that holds the persisted UUID. Confirmed via
   * firebase-appcheck-debug 18.0.0 StorageHelper#DEBUG_SECRET_KEY.
   */
  private static final String DEBUG_SECRET_KEY =
      "com.google.firebase.appcheck.debug.DEBUG_SECRET";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Initialize Firebase before installing the App Check provider factory,
    // otherwise FirebaseAppCheck.getInstance() throws. google-services.json
    // (in android/app/) is read by FirebaseApp.initializeApp via the
    // google-services Gradle plugin — see android/app/build.gradle.
    FirebaseApp.initializeApp(this);

    // App Check provider selection is driven by the
    // `com.glamornate.app.APP_CHECK_PROVIDER` <meta-data> entry in
    // AndroidManifest.xml, populated by `manifestPlaceholders` per buildType:
    //   - release          → "playintegrity" (Play Store / production)
    //   - stagingRelease   → "debug"         (R8-minified, debug-signed sideload)
    //   - debug            → "debug"         (developer convenience)
    //
    // Fail-safe: if the meta-data is missing or unrecognized, default to
    // PlayIntegrity. Production behavior must never be silently weakened.
    String providerName = readAppCheckProviderName();
    Log.i(LOG_TAG, "selectedProvider=" + providerName);

    if (PROVIDER_DEBUG.equals(providerName)) {
      // -----------------------------------------------------------------
      // Unified Debug UUID strategy.
      //
      // The stagingRelease buildType injects NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN
      // from frontend/.env.local as BuildConfig.APP_CHECK_DEBUG_TOKEN (see
      // android/app/build.gradle). We pre-write that pinned UUID into the
      // SharedPreferences file the Debug App Check SDK reads from, so the
      // SDK's lazy retrieveStoredDebugSecret() returns our value instead
      // of generating a fresh one. Result: localhost web and the APK both
      // mint App Check tokens with the SAME UUID — operator registers it
      // once in Firebase Console.
      //
      // Why pre-write instead of getInstance(String token): firebase-
      // appcheck-debug 18.0.0 only exposes the no-arg getInstance() — the
      // String overload was removed/never present in this BoM. Pre-writing
      // SharedPreferences is the documented escape hatch.
      // -----------------------------------------------------------------
      String pinnedDebugToken = readPinnedDebugToken();
      if (pinnedDebugToken != null && !pinnedDebugToken.isEmpty()) {
        prePopulateDebugSecret(pinnedDebugToken);
      } else {
        Log.i(LOG_TAG, "No pinned UUID in BuildConfig — SDK will auto-generate per-device UUID on first token request.");
      }

      FirebaseAppCheck.getInstance().installAppCheckProviderFactory(
        DebugAppCheckProviderFactory.getInstance()
      );
    } else {
      FirebaseAppCheck.getInstance().installAppCheckProviderFactory(
        PlayIntegrityAppCheckProviderFactory.getInstance()
      );
    }
  }

  /**
   * Pre-populate the Debug App Check SDK's SharedPreferences with the pinned
   * UUID so that retrieveStoredDebugSecret() returns this value instead of
   * generating a new one. Uses .commit() (synchronous) to guarantee the write
   * is durable before installAppCheckProviderFactory triggers the SDK's
   * background read.
   *
   * No-op (with a logged warning) if the canonical persistence key is
   * unavailable for any reason.
   */
  private void prePopulateDebugSecret(String pinnedToken) {
    try {
      String persistenceKey = FirebaseApp.getInstance().getPersistenceKey();
      String prefsName = String.format(DEBUG_PREFS_TEMPLATE, persistenceKey);
      SharedPreferences prefs =
          getSharedPreferences(prefsName, Context.MODE_PRIVATE);

      String existing = prefs.getString(DEBUG_SECRET_KEY, null);
      if (pinnedToken.equals(existing)) {
        Log.i(LOG_TAG, "Pinned UUID already present in SharedPreferences — skipping write.");
        return;
      }

      boolean ok = prefs.edit().putString(DEBUG_SECRET_KEY, pinnedToken).commit();
      if (ok) {
        Log.i(LOG_TAG, "Pre-populated SharedPreferences with pinned UUID from BuildConfig (unified with web).");
      } else {
        Log.w(LOG_TAG, "SharedPreferences.commit() returned false — SDK may auto-generate a UUID instead.");
      }
    } catch (Throwable t) {
      Log.w(LOG_TAG, "Failed to pre-populate pinned debug UUID — SDK will fall back to auto-generation.", t);
    }
  }

  /**
   * Read BuildConfig.APP_CHECK_DEBUG_TOKEN if present. The field is declared
   * only on the stagingRelease buildType (see android/app/build.gradle), so
   * we resolve via reflection to keep this code compilable across all
   * buildTypes (debug / release / stagingRelease).
   */
  private String readPinnedDebugToken() {
    try {
      java.lang.reflect.Field field = BuildConfig.class.getDeclaredField("APP_CHECK_DEBUG_TOKEN");
      Object value = field.get(null);
      return value instanceof String ? (String) value : null;
    } catch (NoSuchFieldException ignored) {
      return null;
    } catch (IllegalAccessException ignored) {
      return null;
    }
  }

  /**
   * Read the `com.glamornate.app.APP_CHECK_PROVIDER` meta-data string from the
   * application manifest. Returns "playintegrity" on any failure path
   * (missing manifest entry, missing PackageManager record, null bundle) so the
   * fail-safe default is always production-correct.
   */
  private String readAppCheckProviderName() {
    try {
      ApplicationInfo info = getPackageManager().getApplicationInfo(
        getPackageName(),
        PackageManager.GET_META_DATA
      );
      if (info.metaData == null) {
        return PROVIDER_PLAY_INTEGRITY;
      }
      String value = info.metaData.getString(APP_CHECK_PROVIDER_META);
      if (value == null) {
        return PROVIDER_PLAY_INTEGRITY;
      }
      return value;
    } catch (PackageManager.NameNotFoundException e) {
      Log.w(LOG_TAG, "Failed to read APP_CHECK_PROVIDER meta-data; defaulting to playintegrity", e);
      return PROVIDER_PLAY_INTEGRITY;
    }
  }
}
