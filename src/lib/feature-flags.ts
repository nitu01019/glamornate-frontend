// Feature flags. Each flag is a hard-coded boolean; flip in source to toggle.
// No env-var driven flags here on purpose — keeps mobile static-export deterministic.

/**
 * Phone OTP sign-in. Deprecated 2026-04-26 per NEEDS_WORK plan §1.2.
 * Path forward: Firebase Auth built-in flows (Google + email).
 * To re-enable: flip to true and reinstate the form's importers.
 */
export const phoneOtpEnabled = false;
