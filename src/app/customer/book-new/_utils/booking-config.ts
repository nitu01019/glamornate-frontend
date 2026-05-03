/**
 * Booking-flow client-side constants.
 *
 * Phase 7 (Booking Flow Fix v3.1, 2026-05-02): asymmetric lead-time
 * guards. The client filters past slots at `BOOKING_LEAD_TIME_MIN`
 * minutes (60) so the user does not see "Confirm" on a 14:30 IST slot
 * at 14:25 IST. The server enforces a strictly *narrower* server-side
 * floor of 5 minutes (`SERVER_BOOKING_LEAD_TIME_MS` in
 * `backend/functions/src/utils/constants.ts`) so a low-clock-skew
 * client cannot weaponise the gap.
 *
 * The asymmetry is intentional and documented in
 * `docs/adr/0008-booking-lead-time-asymmetry.md`.
 */

/** Minutes before slot start. Client-side past-slot filter. */
export const BOOKING_LEAD_TIME_MIN = 60;
