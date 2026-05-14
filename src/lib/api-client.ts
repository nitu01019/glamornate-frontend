export {
  setIdTokenProvider,
  setOnTokenRevoked,
  apiClient,
  ApiError,
  ApiTimeoutError,
  isApiError,
} from '@/auth/client';
export type {
  IdTokenProvider,
  TokenRevokedHandler,
  ApiRequestOptions,
  ApiClient,
  ApiResponse,
} from '@/auth/client';
