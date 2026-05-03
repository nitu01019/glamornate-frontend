#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Glamornate Android post-install cold-start smoke harness.
#
# What this does:
#   Drives a fresh cold-start of `com.glamornate.app` on a single connected
#   adb device, captures threadtime logcat to /tmp, then runs five grep-based
#   pass/fail probes that catch the most common APK regressions surfaced by
#   the 2026-04-29 industry-overhaul build:
#
#     Row 1  AppCheck provider — manifest meta-data must select `debug`,
#            never `playintegrity`, on the stagingRelease buildType.
#     Row 2  Debug-secret UUID — Firebase JS SDK prints a one-time UUID on
#            the very first cold-start of a freshly-installed debug-provider
#            APK. The operator must paste this into Firebase Console →
#            App Check → Apps → com.glamornate.app → Manage debug tokens.
#     Row 3  App Check token mint — once Row 2's UUID is registered and
#            propagated (~60 s), subsequent cold-starts must mint a token.
#            On the FIRST run after a `pm clear`, Row 3 will legitimately
#            fail because the operator has not yet registered the UUID
#            from Row 2 — this script emits a yellow WARN for Row 3 alone
#            and does NOT fail the overall run on that one row.
#     Row 4  No "Network request failed" toast on cold start (sentinel
#            string the booking flow surfaces when an App Check or region
#            misconfiguration causes callable Functions to reject).
#     Row 5  Capacitor plugins survived R8 — at least one of
#            GeolocationPlugin / FirebaseAuthenticationPlugin must show
#            up in logcat, proving proguard-rules.pro keeps held.
#
# Operator workflow:
#   1. Install the staging APK once:
#        adb install -r android/app/build/outputs/apk/stagingRelease/app-stagingRelease.apk
#   2. Run THIS script. Row 2 prints the debug-secret UUID.
#   3. Copy the UUID into Firebase Console (named e.g.
#      `staging-2026-04-29-<deviceId>`). Wait ~60 s for propagation.
#   4. Re-run THIS script. Row 3 should PASS.
#
# Rows 6 + are human-gesture flows (Google Sign-in, sign-up, GPS prompt,
# slot availability, booking creation). Those cannot be fully automated
# from adb without instrumenting the UI — see
# `docs/runbooks/apk-smoke-checklist.md` for the manual checklist.
#
# Idempotence: this script clears the prior logcat buffer (`adb logcat -c`)
# and `pm clear`s the app before each run, so re-running yields a clean
# capture without leftover state.
#
# Exit codes:
#   0  All required rows (1, 2, 4, 5) PASS. Row 3 may WARN on first run.
#   1  Any of rows 1, 2, 4, 5 FAIL, OR no usable adb device is present.
#
# References:
#   - Plan: ~/.claude/plans/apk-regression-2026-04-29.md
#   - Runbook: frontend/docs/runbooks/apk-smoke-checklist.md
#   - Memory: apk_booking_appcheck_region_2026_04_29
# -----------------------------------------------------------------------------

set -u
# NOTE: deliberately NOT using `set -e` — we want each grep probe to run
# independently and aggregate failures into a summary, instead of bailing
# on the first non-zero exit.

PACKAGE="com.glamornate.app"
SLEEP_SECS=12
LOGFILE="/tmp/glamornate-smoke-$(date +%s).log"

# ANSI colors — guarded so non-tty redirection stays clean.
if [ -t 1 ]; then
  C_RED=$'\033[0;31m'
  C_GREEN=$'\033[0;32m'
  C_YELLOW=$'\033[0;33m'
  C_BOLD=$'\033[1m'
  C_RESET=$'\033[0m'
else
  C_RED=""
  C_GREEN=""
  C_YELLOW=""
  C_BOLD=""
  C_RESET=""
fi

# ---------------------------------------------------------------------------
# Step 1 — verify exactly one usable device is connected.
# ---------------------------------------------------------------------------
if ! command -v adb >/dev/null 2>&1; then
  printf "%sFAIL%s adb is not on PATH. Install Android platform-tools first.\n" "$C_RED" "$C_RESET" >&2
  exit 1
fi

# `adb devices` output:
#   List of devices attached
#   <serial>\tdevice          <-- usable
#   <serial>\tunauthorized    <-- not usable (must accept RSA prompt on phone)
#   <serial>\toffline         <-- not usable
device_count=$(adb devices | awk 'NR>1 && $2=="device" {c++} END{print c+0}')
if [ "$device_count" -lt 1 ]; then
  printf "%sFAIL%s No connected adb device in 'device' state.\n" "$C_RED" "$C_RESET" >&2
  printf "        Connect a phone over USB, enable USB debugging, accept the RSA prompt,\n" >&2
  printf "        then re-run. Current adb devices output:\n" >&2
  adb devices >&2
  exit 1
fi
if [ "$device_count" -gt 1 ]; then
  printf "%sWARN%s Multiple devices connected. adb will pick the default — set\n" "$C_YELLOW" "$C_RESET" >&2
  printf "        ANDROID_SERIAL=<serial> if you need to target a specific device.\n" >&2
fi

printf "%s==>%s Glamornate APK cold-start smoke\n" "$C_BOLD" "$C_RESET"
printf "    package : %s\n" "$PACKAGE"
printf "    logfile : %s\n" "$LOGFILE"
printf "    cold-start sleep : %ds\n" "$SLEEP_SECS"
printf "\n"

# ---------------------------------------------------------------------------
# Step 2 — wipe app data so the next launch is a true cold-start with no
# stale debug-token UUID cached in shared prefs.
# ---------------------------------------------------------------------------
printf "%s-->%s Clearing %s app data ...\n" "$C_BOLD" "$C_RESET" "$PACKAGE"
if ! adb shell pm clear "$PACKAGE" >/dev/null; then
  printf "%sFAIL%s pm clear %s — is the APK installed? Run\n" "$C_RED" "$C_RESET" "$PACKAGE" >&2
  printf "        adb install -r android/app/build/outputs/apk/stagingRelease/app-stagingRelease.apk\n" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 3 — clear logcat ring buffer + start a background threadtime capture.
# ---------------------------------------------------------------------------
printf "%s-->%s Clearing logcat buffer + starting capture ...\n" "$C_BOLD" "$C_RESET"
adb logcat -c
# Truncate any stale file at the same path.
: > "$LOGFILE"
adb logcat -v threadtime > "$LOGFILE" &
LOGCAT_PID=$!
# Give logcat a moment to attach before we cold-start the app.
sleep 1

# ---------------------------------------------------------------------------
# Step 4 — cold-start the app via monkey (LAUNCHER intent).
# ---------------------------------------------------------------------------
printf "%s-->%s Cold-starting %s ...\n" "$C_BOLD" "$C_RESET" "$PACKAGE"
if ! adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; then
  kill "$LOGCAT_PID" 2>/dev/null || true
  printf "%sFAIL%s monkey could not start %s. Is the APK installed?\n" "$C_RED" "$C_RESET" "$PACKAGE" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 5 — wait for app initialisation, then stop logcat.
# ---------------------------------------------------------------------------
printf "%s-->%s Sleeping %ds while app initialises ...\n" "$C_BOLD" "$C_RESET" "$SLEEP_SECS"
sleep "$SLEEP_SECS"

printf "%s-->%s Stopping logcat capture ...\n" "$C_BOLD" "$C_RESET"
kill "$LOGCAT_PID" 2>/dev/null || true
# Best-effort wait so the file is fully flushed before we grep it.
wait "$LOGCAT_PID" 2>/dev/null || true

if [ ! -s "$LOGFILE" ]; then
  printf "%sFAIL%s Logcat capture is empty: %s\n" "$C_RED" "$C_RESET" "$LOGFILE" >&2
  printf "        Possible causes: device disconnected mid-run, or adb permission denied.\n" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 6 — run the five grep probes.
# Each probe sets row_<n>_status (PASS|FAIL|WARN) and row_<n>_evidence.
# ---------------------------------------------------------------------------
row_1_status="FAIL"; row_1_evidence="no match"
row_2_status="FAIL"; row_2_evidence="no match"
row_3_status="FAIL"; row_3_evidence="no match"
row_4_status="FAIL"; row_4_evidence=""
row_5_status="FAIL"; row_5_evidence="no match"

# --- Row 1: AppCheck provider must be debug, never playintegrity. ---
# We accept either of these signals as PASS:
#   - "selectedProvider=debug"            (TEAM A's MainActivity log)
#   - "app-check.expectedNativeProvider"  (matching breadcrumb)
# We hard-fail if "selectedProvider=playintegrity" is anywhere in the log.
if grep -E "selectedProvider=playintegrity" "$LOGFILE" >/dev/null 2>&1; then
  row_1_status="FAIL"
  row_1_evidence=$(grep -E "selectedProvider=playintegrity" "$LOGFILE" | head -1)
elif row_1_match=$(grep -E "selectedProvider=debug|app-check.expectedNativeProvider" "$LOGFILE" | head -1); then
  if [ -n "$row_1_match" ]; then
    row_1_status="PASS"
    row_1_evidence="$row_1_match"
  fi
fi

# --- Row 2: Debug-secret UUID printed by Firebase JS SDK on first cold-start. ---
# The Firebase JS SDK prints something like:
#   "Enter this debug secret into the allow list in the Firebase Console..."
#   followed by a UUID line.
if row_2_match=$(grep -i "Enter this debug secret" "$LOGFILE" | head -1); then
  if [ -n "$row_2_match" ]; then
    row_2_status="PASS"
    row_2_evidence="$row_2_match"
  fi
fi

# --- Row 3: App Check token mint. ---
# If we see an explicit failure ("App Check token missing" or HTTP 403 against
# App Check) we hard-fail. Otherwise we look for any non-error token line.
if grep -E "App Check token missing|app-check.*403" "$LOGFILE" >/dev/null 2>&1; then
  row_3_status="FAIL"
  row_3_evidence=$(grep -E "App Check token missing|app-check.*403" "$LOGFILE" | head -1)
elif row_3_match=$(grep -E "App Check token (granted|received|fetched)" "$LOGFILE" | head -1); then
  if [ -n "$row_3_match" ]; then
    row_3_status="PASS"
    row_3_evidence="$row_3_match"
  fi
elif row_3_match=$(grep -i "appcheck.*token" "$LOGFILE" | grep -vi "error\|missing\|403" | head -1); then
  if [ -n "$row_3_match" ]; then
    row_3_status="PASS"
    row_3_evidence="$row_3_match"
  fi
fi

# Row 3 is allowed to WARN on the FIRST cold-start before the operator
# registers the Row 2 UUID. We downgrade FAIL -> WARN only if Row 2 PASSed
# (meaning this IS the first run that printed the UUID) AND Row 3 didn't
# explicitly fail with a 403 / missing-token error.
if [ "$row_3_status" = "FAIL" ] && [ "$row_2_status" = "PASS" ]; then
  if ! grep -E "App Check token missing|app-check.*403" "$LOGFILE" >/dev/null 2>&1; then
    row_3_status="WARN"
    row_3_evidence="first cold-start — register Row 2 UUID then re-run"
  fi
fi

# --- Row 4: count of "Network request failed" toasts. Must be zero. ---
nrf_count=$(grep -c "Network request failed" "$LOGFILE" || true)
if [ "$nrf_count" = "0" ]; then
  row_4_status="PASS"
  row_4_evidence="0 hits"
else
  row_4_status="FAIL"
  row_4_evidence="$nrf_count hit(s) — first: $(grep "Network request failed" "$LOGFILE" | head -1)"
fi

# --- Row 5: Capacitor plugins must show up — proves R8 didn't strip them. ---
if row_5_match=$(grep -E "GeolocationPlugin|FirebaseAuthenticationPlugin" "$LOGFILE" | head -1); then
  if [ -n "$row_5_match" ]; then
    row_5_status="PASS"
    row_5_evidence="$row_5_match"
  fi
fi

# ---------------------------------------------------------------------------
# Step 7 — print summary table.
# ---------------------------------------------------------------------------
printf "\n"
printf "%s==>%s Smoke summary\n" "$C_BOLD" "$C_RESET"
printf "%s%-5s %-6s %s%s\n" "$C_BOLD" "Row" "Status" "Evidence" "$C_RESET"
print_row() {
  local n="$1" status="$2" ev="$3" color
  case "$status" in
    PASS) color="$C_GREEN" ;;
    WARN) color="$C_YELLOW" ;;
    FAIL) color="$C_RED" ;;
    *)    color="" ;;
  esac
  # Truncate evidence to ~120 chars to keep table readable.
  local ev_short
  if [ "${#ev}" -gt 120 ]; then
    ev_short="${ev:0:117}..."
  else
    ev_short="$ev"
  fi
  printf "%-5s %s%-6s%s %s\n" "$n" "$color" "$status" "$C_RESET" "$ev_short"
}
print_row "1" "$row_1_status" "$row_1_evidence"
print_row "2" "$row_2_status" "$row_2_evidence"
print_row "3" "$row_3_status" "$row_3_evidence"
print_row "4" "$row_4_status" "$row_4_evidence"
print_row "5" "$row_5_status" "$row_5_evidence"
printf "\n"
printf "Logfile retained at: %s\n" "$LOGFILE"
printf "  inspect with: less '%s'\n" "$LOGFILE"
printf "  or filter:    grep -E 'AppCheck|appcheck|FirebaseApp' '%s'\n" "$LOGFILE"

# ---------------------------------------------------------------------------
# Step 8 — exit code. Required PASS rows: 1, 2, 4, 5. Row 3 may WARN.
# ---------------------------------------------------------------------------
required_failed=0
for required in "$row_1_status" "$row_2_status" "$row_4_status" "$row_5_status"; do
  if [ "$required" != "PASS" ]; then
    required_failed=1
  fi
done
if [ "$row_3_status" = "FAIL" ]; then
  required_failed=1
fi

if [ "$required_failed" -eq 0 ]; then
  printf "\n%sOK%s smoke passed.\n" "$C_GREEN" "$C_RESET"
  if [ "$row_3_status" = "WARN" ]; then
    printf "%sNOTE%s Row 3 emitted a WARN — register the Row 2 UUID in Firebase\n" "$C_YELLOW" "$C_RESET"
    printf "        Console (App Check -> Apps -> %s -> Manage debug tokens),\n" "$PACKAGE"
    printf "        wait ~60s, then re-run this script. Row 3 should PASS on the\n"
    printf "        second run.\n"
  fi
  exit 0
fi

printf "\n%sFAIL%s smoke failed — see rows above. Triage table:\n" "$C_RED" "$C_RESET"
printf "  docs/runbooks/apk-smoke-checklist.md (Section 4)\n"
exit 1
