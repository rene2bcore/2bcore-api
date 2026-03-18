import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { v4 as uuidv4 } from 'uuid';

import { env } from '../../shared/config/env.js';
import { logger } from '../../infrastructure/observability/logger.js';
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from '../../shared/constants/index.js';

// Plugins
import { authPlugin } from '../../infrastructure/http/plugins/auth.plugin.js';
import { rateLimitPlugin } from '../../infrastructure/http/plugins/rateLimit.plugin.js';

// Routes
import { authRoutes } from '../../infrastructure/http/routes/auth.routes.js';
import { keysRoutes } from '../../infrastructure/http/routes/keys.routes.js';
import { healthRoutes } from '../../infrastructure/http/routes/health.routes.js';

// Infrastructure
import { getPrismaClient } from '../../infrastructure/db/prisma.js';
import { getRedisClient } from '../../infrastructure/redis/RedisClient.js';
import { TokenBlacklist } from '../../infrastructure/redis/tokenBlacklist.js';
import { RefreshTokenStore } from '../../infrastructure/redis/refreshTokenStore.js';

// Repositories
import { PrismaUserRepository } from '../../infrastructure/db/repositories/user.repository.js';
import { PrismaApiKeyRepository } from '../../infrastructure/db/repositories/apikey.repository.js';
import { PrismaAuditLogRepository } from '../../infrastructure/db/repositories/auditlog.repository.js';

// Services & Use Cases
import { AuthService } from '../../application/services/AuthService.js';
import { LoginUseCase } from '../../application/use-cases/auth/login.js';
import { RefreshTokenUseCase } from '../../application/use-cases/auth/refresh.js';
import { LogoutUseCase } from '../../application/use-cases/auth/logout.js';
import { CreateApiKeyUseCase } from '../../application/use-cases/keys/createApiKey.js';
import { ListApiKeysUseCase } from '../../application/use-cases/keys/listApiKeys.js';
import { RevokeApiKeyUseCase } from '../../application/use-cases/keys/revokeApiKey.js';

// Error types
import { DomainError } from '../../domain/errors/index.js';
import { ZodError } from 'zod';
import { HTTP_STATUS } from '../../shared/constants/index.js';
import type { FastifyError } from 'fastify';

export async function buildApp() {
  const fastify = Fastify({
    logger: false, // Pino logger configured separately
    genReqId: () => uuidv4(),
    trustProxy: true,
  });

  // ── Request logging ────────────────────────────────────────────────
  fastify.addHook('onRequest', async (request) => {
    const correlationId = (request.headers[CORRELATION_ID_HEADER] as string) ?? uuidv4();
    request.headers[CORRELATION_ID_HEADER] = correlationId;

    logger.info({
      requestId: request.id,
      correlationId,
      method: request.method,
      url: request.url,
      ip: request.ip,
    }, 'Incoming request');
  });

  fastify.addHook('onResponse', async (request, reply) => {
    logger.info({
      requestId: request.id,
      correlationId: request.headers[CORRELATION_ID_HEADER],
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
      userId: request.user?.sub ?? null,
    }, 'Request completed');
  });

  // ── Security plugins ───────────────────────────────────────────────
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  await fastify.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', CORRELATION_ID_HEADER],
    credentials: true,
    maxAge: 86_400,
  });

  await fastify.register(cookie);

  // ── Infrastructure ─────────────────────────────────────────────────
  const prisma = getPrismaClient();
  const redis = getRedisClient();
  const tokenBlacklist = new TokenBlacklist(redis);
  const refreshTokenStore = new RefreshTokenStore(redis);

  // ── Rate limiting ──────────────────────────────────────────────────
  await fastify.register(rateLimitPlugin, { redis });

  // ── Repositories ──────────────────────────────────────────────────
  const userRepo = new PrismaUserRepository(prisma);
  const apiKeyRepo = new PrismaApiKeyRepository(prisma);
  const auditRepo = new PrismaAuditLogRepository(prisma);

  // ── Services ───────────────────────────────────────────────────────
  const authService = new AuthService(tokenBlacklist, refreshTokenStore);

  // ── Auth plugin ────────────────────────────────────────────────────
  await fastify.register(authPlugin, { authService, apiKeyRepo });

  // ── Use cases ──────────────────────────────────────────────────────
  const loginUseCase = new LoginUseCase(userRepo, authService, auditRepo);
  const refreshUseCase = new RefreshTokenUseCase(userRepo, authService, auditRepo);
  const logoutUseCase = new LogoutUseCase(authService, auditRepo);
  const createApiKeyUseCase = new CreateApiKeyUseCase(apiKeyRepo, auditRepo);
  const listApiKeysUseCase = new ListApiKeysUseCase(apiKeyRepo);
  const revokeApiKeyUseCase = new RevokeApiKeyUseCase(apiKeyRepo, auditRepo);

  // ── Global error handler (must be set BEFORE route registrations) ──
  fastify.setErrorHandler<FastifyError>((error, request, reply) => {
    const correlationId = request.headers[CORRELATION_ID_HEADER];

    if (error instanceof ZodError) {
      logger.warn({ requestId: request.id, correlationId, issues: error.issues }, 'Validation error');
      return reply.status(HTTP_STATUS.UNPROCESSABLE).send({
        statusCode: HTTP_STATUS.UNPROCESSABLE,
        error: 'Validation Error',
        code: 'VAL_001',
        details: error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
    }

    if (error instanceof DomainError) {
      logger.warn({ requestId: request.id, correlationId, code: error.code, message: error.message }, 'Domain error');
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.message,
        code: error.code,
      });
    }

    // Rate limit errors from @fastify/rate-limit pass through as-is
    if ('statusCode' in error && error.statusCode === 429) {
      return reply.status(429).send(error);
    }

    logger.error({ requestId: request.id, correlationId, err: error }, 'Unhandled error');
    return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      code: 'GEN_500',
    });
  });

  // ── 404 handler (must be set BEFORE route registrations) ───────────
  fastify.setNotFoundHandler((request, reply) => {
    return reply.status(HTTP_STATUS.NOT_FOUND).send({
      statusCode: HTTP_STATUS.NOT_FOUND,
      error: 'Not Found',
      code: 'GEN_001',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  // ── Routes ─────────────────────────────────────────────────────────
  await fastify.register(healthRoutes);

  await fastify.register(authRoutes, {
    prefix: `/${env.API_VERSION}/auth`,
    loginUseCase,
    refreshUseCase,
    logoutUseCase,
  });

  await fastify.register(keysRoutes, {
    prefix: `/${env.API_VERSION}/keys`,
    createApiKeyUseCase,
    listApiKeysUseCase,
    revokeApiKeyUseCase,
  });

  return fastify;
}
