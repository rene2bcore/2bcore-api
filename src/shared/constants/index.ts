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
  // AI
  AI_BUDGET_EXCEEDED: 'AI_001',
  AI_PROVIDER_ERROR: 'AI_002',
  // General
  NOT_FOUND: 'GEN_001',
  INTERNAL_ERROR: 'GEN_500',
} as const;

// Model tier → canonical model ID
export const MODEL_TIERS = {
  fast: 'claude-haiku-4-5-20251001',
  standard: 'claude-sonnet-4-6',
  powerful: 'claude-opus-4-6',
} as const;

export type ModelTier = keyof typeof MODEL_TIERS;

// Pricing in USD per 1 million tokens
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
};
