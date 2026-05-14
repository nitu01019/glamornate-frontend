/**
 * Booking-flow copy constants.
 *
 * Phase 4.5 (Booking Flow Fix v3.1, 2026-05-02): single source of truth
 * for every user-facing string in the booking surface. Centralising the
 * strings avoids the drift the v2 review flagged — three different places
 * said "Booking Confirmed!", "Your appointment has been successfully
 * booked", and "Awaiting payment confirmation" for the same end-state.
 */

export const BOOKING_CONFIRMED = 'Booking confirmed';
export const PAY_AT_SPA = (amount: number): string => `Pay ₹${amount} at the spa`;
export const NO_PAYMENT_TAKEN = 'No online payment was taken';
export const MISSED = 'Missed';
export const ON_THE_WAY = 'On the way';
export const EARLIER_SLOTS_PASSED = 'Earlier slots today have passed.';
export const NO_MORE_SLOTS_TODAY = 'No more slots today — try tomorrow.';
export const LINK_ACCOUNTS_TITLE = 'Looking for older bookings?';
export const LINK_ACCOUNTS_BODY = 'They may be linked to another sign-in method.';
export const LINK_ACCOUNTS_CTA = 'Link accounts';
export const APP_CHECK_HELP_TITLE = 'Trouble loading bookings.';
export const APP_CHECK_HELP_BODY =
  "This phone needs a one-time security setup. We'll guide you through it.";
export const APP_CHECK_HELP_CTA = 'Get help';
export const CANCEL_NO_REFUND = "Since no payment was taken, there's nothing to refund.";
export const FRESH_START_HINT = 'Last booking confirmed. Starting a new one.';
// 2026-05-13: warmer voice — feels like an inviting concierge rather than a
// generic "0 results" label. Pairs with the redesigned EmptyState card.
export const EMPTY_UPCOMING = 'Your calendar is open.';
export const EMPTY_UPCOMING_SUB = 'Treat yourself to something restorative.';
export const EMPTY_PAST = 'Nothing in your history yet.';
export const EMPTY_PAST_SUB = 'Completed appointments will live here.';
export const EMPTY_CANCELLED = 'No cancellations.';
export const EMPTY_CANCELLED_SUB = 'A clean slate is a good thing.';
export const SUBMIT_GENERIC_ERROR = 'Something went wrong.';
export const SUBMIT_RETRY = 'Try again';
