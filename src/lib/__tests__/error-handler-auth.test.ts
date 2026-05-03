import { describe, it, expect } from 'vitest'
import {
  AuthError,
  getUserFriendlyMessage,
} from '../error-handler'

// =============================================================================
// getUserFriendlyMessage with AuthError — firebaseCode mapping
// =============================================================================
describe('getUserFriendlyMessage with AuthError', () => {
  // -------------------------------------------------------------------------
  // Known firebase codes → specific user-facing strings
  // -------------------------------------------------------------------------

  it('returns specific message for auth/wrong-password', () => {
    const err = new AuthError('', { firebaseCode: 'auth/wrong-password' })
    expect(getUserFriendlyMessage(err)).toBe('Incorrect password. Please try again.')
  })

  it('returns specific message for auth/user-not-found', () => {
    const err = new AuthError('', { firebaseCode: 'auth/user-not-found' })
    expect(getUserFriendlyMessage(err)).toBe('No account found with this email.')
  })

  it('returns specific message for auth/internal-error', () => {
    const err = new AuthError('', { firebaseCode: 'auth/internal-error' })
    expect(getUserFriendlyMessage(err)).toBe(
      'Sign-in failed. If this persists, try reinstalling the app.',
    )
  })

  it('returns specific message for app-check/token-error', () => {
    const err = new AuthError('', { firebaseCode: 'app-check/token-error' })
    expect(getUserFriendlyMessage(err)).toBe(
      'Device verification failed. Try reinstalling the app.',
    )
  })

  it('returns specific message for auth/credential-already-in-use', () => {
    const err = new AuthError('', { firebaseCode: 'auth/credential-already-in-use' })
    expect(getUserFriendlyMessage(err)).toBe(
      'An account with this email already exists with a different sign-in method.',
    )
  })

  it('returns specific message for auth/email-already-in-use', () => {
    const err = new AuthError('', { firebaseCode: 'auth/email-already-in-use' })
    expect(getUserFriendlyMessage(err)).toBe(
      'An account with this email already exists.',
    )
  })

  it('returns specific message for auth/popup-closed-by-user', () => {
    const err = new AuthError('', { firebaseCode: 'auth/popup-closed-by-user' })
    expect(getUserFriendlyMessage(err)).toBe('Sign-in was cancelled.')
  })

  // -------------------------------------------------------------------------
  // REGRESSION GUARD: unrecognised firebaseCode falls through to code table,
  // NOT to the generic "Something went wrong" or "An error occurred" strings.
  // The code table maps UNAUTHORIZED → "Please sign in to continue." which
  // is a specific, actionable message — not the banned generic fallback.
  // -------------------------------------------------------------------------

  it('falls through to UNAUTHORIZED code-table entry for an unrecognised firebaseCode', () => {
    const err = new AuthError('', { firebaseCode: 'auth/unknown-thing' })
    const result = getUserFriendlyMessage(err)
    // Must NOT produce the old generic fallback that leaked from every catch block.
    expect(result).not.toBe('An error occurred. Please try again.')
    // Must NOT produce the AppError-level fallback either.
    expect(result).not.toBe('Something went wrong. Please try again.')
    // Should resolve to the UNAUTHORIZED code-table entry.
    expect(result).toBe('Please sign in to continue.')
  })

  // -------------------------------------------------------------------------
  // AuthError without firebaseCode → code table (UNAUTHORIZED)
  // Verifies the guard path does not regress when firebaseCode is absent.
  // -------------------------------------------------------------------------

  it('falls back to UNAUTHORIZED code-table entry when firebaseCode is absent', () => {
    const err = new AuthError()
    const result = getUserFriendlyMessage(err)
    expect(result).toBe('Please sign in to continue.')
    expect(result).not.toBe('An error occurred. Please try again.')
  })

  // -------------------------------------------------------------------------
  // AuthError with ErrorCode.FORBIDDEN (statusCode 403) → FORBIDDEN message
  // -------------------------------------------------------------------------

  it('returns FORBIDDEN message when statusCode is 403', () => {
    const err = new AuthError('', { statusCode: 403 })
    expect(getUserFriendlyMessage(err)).toBe(
      "You don't have permission to perform this action.",
    )
  })
})
