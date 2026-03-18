export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';

export const REDIS_PREFIX = {
  BLACKLIST: 'blacklist:',
  REFRESH: 'refresh:',
  RATE_LIMIT: 'rl:',
  TOKEN_BUDGET: 'budget:',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const ERROR_CODES = {
  // Auth
  INVALID_CREDENTIALS: 'AUTH_001',
  TOKEN_EXPIRED: 'AUTH_002',
  TOKEN_INVALID: 'AUTH_003',
  TOKEN_REVOKED: 'AUTH_004',
  REFRESH_TOKEN_INVALID: 'AUTH_005',
  // API Keys
  API_KEY_INVALID: 'KEY_001',
  API_KEY_REVOKED: 'KEY_002',
  API_KEY_NOT_FOUND: 'KEY_003',
  // Authorization
  FORBIDDEN: 'AUTHZ_001',
  // Validation
  VALIDATION_ERROR: 'VAL_001',
  // General
  NOT_FOUND: 'GEN_001',
  INTERNAL_ERROR: 'GEN_500',
} as const;
