import { describe, it, expect } from 'vitest'
import {
  AppError,
  NetworkError,
  AuthError,
  ValidationError,
  NotFoundError,
  FirebaseError,
  TimeoutError,
  ErrorCode,
  parseError,
  getUserFriendlyMessage,
  isRetryableError,
  isAuthError,
  getQueryRetryCount,
  getQueryRetryDelay,
} from '../error-handler'

// =============================================================================
// AppError
// =============================================================================
describe('AppError', () => {
  it('should use sensible defaults', () => {
    const err = new AppError('something went wrong')
    expect(err.message).toBe('something went wrong')
    expect(err.code).toBe(ErrorCode.UNKNOWN)
    expect(err.statusCode).toBe(500)
    expect(err.isRetryable).toBe(false)
    expect(err.timestamp).toBeInstanceOf(Date)
  })

  it('should accept custom options', () => {
    const cause = new Error('root cause')
    const err = new AppError('bad request', {
      code: ErrorCode.VALIDATION_ERROR,
      statusCode: 400,
      isRetryable: false,
      context: { field: 'email' },
      cause,
    })

    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(err.statusCode).toBe(400)
    expect(err.context).toEqual({ field: 'email' })
    expect(err.cause).toBe(cause)
  })

  it('should serialise to JSON with toJSON()', () => {
    const err = new AppError('test', { code: ErrorCode.NOT_FOUND, statusCode: 404 })
    const json = err.toJSON()

    expect(json.name).toBe('AppError')
    expect(json.message).toBe('test')
    expect(json.code).toBe(ErrorCode.NOT_FOUND)
    expect(json.statusCode).toBe(404)
    expect(typeof json.timestamp).toBe('string')
  })
})

// =============================================================================
// Specific error classes
// =============================================================================
describe('NetworkError', () => {
  it('should default to retryable with status 0', () => {
    const err = new NetworkError()
    expect(err.code).toBe(ErrorCode.NETWORK_ERROR)
    expect(err.statusCode).toBe(0)
    expect(err.isRetryable).toBe(true)
    expect(err.name).toBe('NetworkError')
  })
})

describe('AuthError', () => {
  it('should be UNAUTHORIZED by default', () => {
    const err = new AuthError()
    expect(err.code).toBe(ErrorCode.UNAUTHORIZED)
    expect(err.statusCode).toBe(401)
    expect(err.isRetryable).toBe(false)
  })

  it('should be FORBIDDEN when statusCode is 403', () => {
    const err = new AuthError('forbidden', { statusCode: 403 })
    expect(err.code).toBe(ErrorCode.FORBIDDEN)
    expect(err.statusCode).toBe(403)
  })
})

describe('ValidationError', () => {
  it('should carry field errors', () => {
    const err = new ValidationError('bad input', {
      fieldErrors: { email: ['invalid email format'] },
    })
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(err.statusCode).toBe(400)
    expect(err.fieldErrors).toEqual({ email: ['invalid email format'] })
  })
})

describe('NotFoundError', () => {
  it('should include resource metadata', () => {
    const err = new NotFoundError('Spa not found', {
      resourceType: 'Spa',
      resourceId: 'spa-123',
    })
    expect(err.code).toBe(ErrorCode.NOT_FOUND)
    expect(err.statusCode).toBe(404)
    expect(err.resourceType).toBe('Spa')
    expect(err.resourceId).toBe('spa-123')
  })
})

describe('TimeoutError', () => {
  it('should default to retryable', () => {
    const err = new TimeoutError()
    expect(err.code).toBe(ErrorCode.TIMEOUT)
    expect(err.statusCode).toBe(408)
    expect(err.isRetryable).toBe(true)
  })
})

// =============================================================================
// parseError
// =============================================================================
describe('parseError', () => {
  it('should pass through an existing AppError unchanged', () => {
    const original = new AppError('original', { code: ErrorCode.NOT_FOUND })
    expect(parseError(original)).toBe(original)
  })

  it('should detect a network/fetch TypeError', () => {
    const err = new TypeError('Failed to fetch')
    const parsed = parseError(err)
    expect(parsed).toBeInstanceOf(NetworkError)
    expect(parsed.isRetryable).toBe(true)
  })

  it('should detect "network" keyword in error message', () => {
    const err = new Error('network connection lost')
    const parsed = parseError(err)
    expect(parsed).toBeInstanceOf(NetworkError)
  })

  it('should detect timeout errors from message', () => {
    const err = new Error('Request timeout exceeded')
    const parsed = parseError(err)
    expect(parsed).toBeInstanceOf(TimeoutError)
  })

  it('should detect AbortError as a timeout', () => {
    const err = new Error('signal aborted')
    err.name = 'AbortError'
    const parsed = parseError(err)
    expect(parsed).toBeInstanceOf(TimeoutError)
  })

  it('should detect Firebase auth/ errors as AuthError', () => {
    const err = Object.assign(new Error('invalid token'), {
      name: 'FirebaseError',
      code: 'auth/invalid-token',
    })
    const parsed = parseError(err)
    expect(parsed).toBeInstanceOf(AuthError)
  })

  it('should detect Firebase firestore/ errors as FirebaseError', () => {
    const err = Object.assign(new Error('quota exceeded'), {
      code: 'firestore/resource-exhausted',
    })
    const parsed = parseError(err)
    expect(parsed).toBeInstanceOf(FirebaseError)
    expect(parsed.isRetryable).toBe(true)
  })

  it('should handle API response objects with status 401', () => {
    const parsed = parseError({ status: 401, message: 'Not logged in' })
    expect(parsed).toBeInstanceOf(AuthError)
    expect(parsed.message).toBe('Not logged in')
  })

  it('should handle API response objects with status 404', () => {
    const parsed = parseError({ statusCode: 404, message: 'Missing' })
    expect(parsed).toBeInstanceOf(NotFoundError)
  })

  it('should handle API response objects with status 400', () => {
    const parsed = parseError({ status: 400, message: 'Bad input' })
    expect(parsed).toBeInstanceOf(ValidationError)
  })

  it('should handle API response objects with status 422', () => {
    const parsed = parseError({ status: 422, message: 'Unprocessable' })
    expect(parsed).toBeInstanceOf(ValidationError)
  })

  it('should mark 5xx API errors as retryable', () => {
    const parsed = parseError({ status: 503, message: 'Service down' })
    expect(parsed.isRetryable).toBe(true)
  })

  it('should handle plain string errors', () => {
    const parsed = parseError('something broke')
    expect(parsed).toBeInstanceOf(AppError)
    expect(parsed.message).toBe('something broke')
  })

  it('should handle objects with only a message field', () => {
    const parsed = parseError({ message: 'unknown issue' })
    expect(parsed.message).toBe('unknown issue')
  })

  it('should return a generic AppError for unknown types', () => {
    const parsed = parseError(42)
    expect(parsed).toBeInstanceOf(AppError)
    expect(parsed.message).toBe('An unknown error occurred')
  })

  it('should return a generic AppError for null', () => {
    const parsed = parseError(null)
    expect(parsed.message).toBe('An unknown error occurred')
  })
})

// =============================================================================
// getUserFriendlyMessage
// =============================================================================
describe('getUserFriendlyMessage', () => {
  it('should return the mapped message for NETWORK_ERROR', () => {
    const err = new NetworkError()
    expect(getUserFriendlyMessage(err)).toBe(
      'Unable to connect. Please check your internet connection.'
    )
  })

  it('should return the mapped message for UNAUTHORIZED', () => {
    const err = new AuthError()
    expect(getUserFriendlyMessage(err)).toBe('Please sign in to continue.')
  })

  it('should return the mapped message for NOT_FOUND', () => {
    const err = new NotFoundError()
    expect(getUserFriendlyMessage(err)).toBe('The requested resource was not found.')
  })

  it('should return the mapped message for TIMEOUT', () => {
    const err = new TimeoutError()
    expect(getUserFriendlyMessage(err)).toBe(
      'The request took too long. Please try again.'
    )
  })

  it('should return the mapped message for VALIDATION_ERROR', () => {
    const err = new ValidationError()
    expect(getUserFriendlyMessage(err)).toBe(
      'Please check your input and try again.'
    )
  })

  it('should fall back to the error message for unmapped codes', () => {
    const err = new AppError('custom problem')
    expect(getUserFriendlyMessage(err)).toBe('custom problem')
  })
})

// =============================================================================
// isRetryableError / isAuthError
// =============================================================================
describe('isRetryableError', () => {
  it('should return true for a NetworkError', () => {
    expect(isRetryableError(new NetworkError())).toBe(true)
  })

  it('should return false for an AuthError', () => {
    expect(isRetryableError(new AuthError())).toBe(false)
  })
})

describe('isAuthError', () => {
  it('should return true for an AuthError instance', () => {
    expect(isAuthError(new AuthError())).toBe(true)
  })

  it('should return true for a 401 API response', () => {
    expect(isAuthError({ status: 401, message: 'Unauthorized' })).toBe(true)
  })

  it('should return false for a NotFoundError', () => {
    expect(isAuthError(new NotFoundError())).toBe(false)
  })
})

// =============================================================================
// React Query helpers
// =============================================================================
describe('getQueryRetryCount', () => {
  it('should never retry auth errors', () => {
    expect(getQueryRetryCount(0, new AuthError())).toBe(false)
  })

  it('should retry retryable errors up to 3 times', () => {
    const err = new NetworkError()
    expect(getQueryRetryCount(0, err)).toBe(true)
    expect(getQueryRetryCount(2, err)).toBe(true)
    expect(getQueryRetryCount(3, err)).toBe(false)
  })
})

describe('getQueryRetryDelay', () => {
  it('should use exponential backoff', () => {
    expect(getQueryRetryDelay(0)).toBe(1000)
    expect(getQueryRetryDelay(1)).toBe(2000)
    expect(getQueryRetryDelay(2)).toBe(4000)
  })

  it('should cap at 30000 ms', () => {
    expect(getQueryRetryDelay(10)).toBe(30000)
  })
})
