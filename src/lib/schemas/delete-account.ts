/**
 * delete-account
 * --------------
 * Zod schema for the DeleteAccountSheet re-authentication step. The full
 * delete flow is a three-step state machine (explain → reauth → executing),
 * but only step 2 is an actual <form> with submittable values:
 *
 *   - `currentPassword`: required; min length 1 client-side (Firebase
 *     validates the actual strength). The ad-hoc UI previously only
 *     required `length > 0`, so this schema mirrors that behavior.
 *
 * Step 1's acknowledgement checkbox + exact-match confirmation phrase
 * remains local component state — a literal-equality gate rather than a
 * classical validated form field. Its strictness (`DELETE MY ACCOUNT`
 * case-sensitive) mirrors the backend contract in
 * `backend/functions/src/callable/deleteAccount.ts`.
 */

import { z } from 'zod';

export const deleteAccountReauthSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
});

export type DeleteAccountReauthValues = z.infer<typeof deleteAccountReauthSchema>;
