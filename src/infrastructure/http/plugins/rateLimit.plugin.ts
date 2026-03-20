import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import type Redis from 'ioredis';
import { env } from '../../../shared/config/env.js';
import { HTTP_STATUS } from '../../../shared/constants/index.js';

interface RateLimitPluginOptions {
  redis: Redis;
}

export const rateLimitPlugin = fp(async (fastify: FastifyInstance, opts: RateLimitPluginOptions) => {
  await fastify.register(rateLimit, {
    global: true,
    // max may be a function: use per-API-key limit when set, otherwise fall back to global default
    max(request, _key) {
      return request.apiKeyRateLimit ?? env.RATE_LIMIT_GLOBAL_MAX;
    },
    timeWindow: env.RATE_LIMIT_GLOBAL_WINDOW_MS,
    redis: opts.redis,
    keyGenerator(request) {
      // Per-user rate limiting if authenticated; fallback to IP
      return request.user?.sub ?? request.ip;
    },
    errorResponseBuilder(_request, context) {
      return {
        statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(context.ttl / 1000),
      };
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
});

/**
 * Stricter limits for auth endpoints (login, refresh).
 * Apply this as a per-route override.
 */
export const authRateLimitConfig = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: 15 * 60 * 1000, // 15 minutes
      keyGenerator: (request: { ip: string }) => `auth:${request.ip}`,
    },
  },
};

/**
 * Per-user rate limit for AI endpoints.
 * Tighter window to control token spend. Defaults: 20 req / 60 s per user.
 * Override via RATE_LIMIT_AI_MAX and RATE_LIMIT_AI_WINDOW_MS env vars.
 */
export const aiRateLimitConfig = {
  config: {
    rateLimit: {
      max: env.RATE_LIMIT_AI_MAX,
      timeWindow: env.RATE_LIMIT_AI_WINDOW_MS,
      keyGenerator: (request: { user?: { sub?: string }; ip: string }) =>
        `ai:${request.user?.sub ?? request.ip}`,
    },
  },
};
