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
  EMAIL_NOT_VERIFIED: 'AUTH_006',
  INVALID_OR_EXPIRED_TOKEN: 'AUTH_008',
  EMAIL_VERIFICATION_REQUIRED: 'AUTH_007',
  // API Keys
  API_KEY_INVALID: 'KEY_001',
  API_KEY_REVOKED: 'KEY_002',
  API_KEY_NOT_FOUND: 'KEY_003',
  API_KEY_INSUFFICIENT_SCOPE: 'KEY_004',
  // Authorization
  FORBIDDEN: 'AUTHZ_001',
  // Validation
  VALIDATION_ERROR: 'VAL_001',
  // AI
  AI_BUDGET_EXCEEDED: 'AI_001',
  AI_PROVIDER_ERROR: 'AI_002',
  // Users
  USER_ALREADY_EXISTS: 'USR_001',
  // 2FA / TOTP
  TOTP_REQUIRED: 'MFA_001',
  TOTP_INVALID_CODE: 'MFA_002',
  TOTP_ALREADY_ENABLED: 'MFA_003',
  TOTP_NOT_ENABLED: 'MFA_004',
  TOTP_CHALLENGE_INVALID: 'MFA_005',
  // General
  NOT_FOUND: 'GEN_001',
  INTERNAL_ERROR: 'GEN_500',
} as const;

// Webhook events — empty subscriptions array means subscribe to all (wildcard)
export const WEBHOOK_EVENTS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  KEY_CREATED: 'key.created',
  KEY_REVOKED: 'key.revoked',
  AI_CHAT_COMPLETED: 'ai.chat_completed',
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];
export const ALL_WEBHOOK_EVENTS: WebhookEvent[] = Object.values(WEBHOOK_EVENTS) as WebhookEvent[];

// Defined API key scopes — empty array means wildcard (full access)
export const API_KEY_SCOPES = {
  AI_CHAT: 'ai:chat',
  AI_USAGE: 'ai:usage',
  KEYS_READ: 'keys:read',
  KEYS_WRITE: 'keys:write',
  USERS_READ: 'users:read',
} as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[keyof typeof API_KEY_SCOPES];

export const ALL_SCOPES: ApiKeyScope[] = Object.values(API_KEY_SCOPES) as ApiKeyScope[];

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
