/**
 * FE-side re-export of the canonical AuthErrorCode Zod enum from
 * shared/contracts/auth. Single import location for FE consumers of
 * BE-emitted wire codes (auth middleware 401 envelopes + Firebase
 * HttpsError codes from callables).
 *
 * Note: Firebase SDK 'auth/*' codes (e.g. 'auth/wrong-password') live
 * OUTSIDE this enum's namespace — they're Firebase-side identifiers
 * mapped via lib/account/auth-error-map.ts.
 *
 * Compile-time drift guard: TOKEN_EXPIRED_CODE (from shared/contracts/
 * envelope.ts) is asserted to be a member of AuthErrorCode. If the wire
 * code is ever renamed in shared/contracts/auth.ts (or vice-versa), the
 * assertion below fails to compile and surfaces the drift at typecheck.
 */
import { TOKEN_EXPIRED_CODE } from '@/shared/contracts';
export { AuthErrorCode } from '@/shared/contracts/auth';
export type { AuthErrorCode as AuthErrorCodeT } from '@/shared/contracts/auth';
import type { AuthErrorCode } from '@/shared/contracts/auth';
export const TOKEN_EXPIRED_CODE_TYPED: AuthErrorCode = TOKEN_EXPIRED_CODE;
