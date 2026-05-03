/**
 * change-password
 * ---------------
 * Zod schema for the ChangePasswordSheet form. Mirrors the client-side
 * strength expectations documented in ChangePasswordSheet's `scorePassword`
 * helper:
 *
 *   - `currentPassword`: required.
 *   - `newPassword`: length >= 8 AND at least two of {lower+upper, digit,
 *     symbol} (length always counted). Matches `PasswordStrength.meetsMinimum`.
 *   - `confirmNewPassword`: must equal `newPassword`.
 *
 * The field-level messages intentionally duplicate the pre-existing inline
 * UI copy ("Passwords do not match.") so the visible error stays identical
 * for users after the RHF refactor.
 */

import { z } from 'zod';

/**
 * Minimum-strength predicate. Kept in lock-step with
 * `ChangePasswordSheet#scorePassword#meetsMinimum`.
 */
function meetsMinimumStrength(value: string): boolean {
  if (value.length < 8) return false;
  const hasLowerAndUpper = /[a-z]/.test(value) && /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  const metClassCount = [hasLowerAndUpper, hasDigit, hasSymbol].filter(Boolean).length;
  return metClassCount >= 1;
}

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters.')
      .refine(
        meetsMinimumStrength,
        'Mix letters, numbers, or symbols so the password meets the minimum strength.',
      ),
    confirmNewPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine(({ newPassword, confirmNewPassword }) => newPassword === confirmNewPassword, {
    message: 'Passwords do not match.',
    path: ['confirmNewPassword'],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
