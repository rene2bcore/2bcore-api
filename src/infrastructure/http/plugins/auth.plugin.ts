import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AuthService, AccessTokenPayload } from '../../../application/services/AuthService.js';
import { IApiKeyRepository } from '../../../domain/repositories/IApiKeyRepository.js';
import { sha256 } from '../../../shared/utils/crypto.js';
import {
  UnauthorizedError,
  ApiKeyInvalidError,
  ApiKeyRevokedError,
  ForbiddenError,
  InsufficientScopeError,
} from '../../../domain/errors/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload & {
      type: 'jwt' | 'apikey';
      sid: string;
      /** Scopes attached to the API key. Empty = wildcard. Only set for apikey type. */
      scopes?: string[];
    };
    /** Per-API-key rate limit (requests/minute). Null means use global default. */
    apiKeyRateLimit: number | null;
  }
}

interface AuthPluginOptions {
  authService: AuthService;
  apiKeyRepo: IApiKeyRepository;
}

export const authPlugin = fp(async (fastify: FastifyInstance, opts: AuthPluginOptions) => {
  const { authService, apiKeyRepo } = opts;

  // Initialise apiKeyRateLimit to null for every request (JWT or unauthenticated)
  fastify.addHook('onRequest', async (request) => {
    request.apiKeyRateLimit = null;
  });

  /**
   * Decorator: verifyJWT
   * Validates Bearer token from Authorization header.
   */
  fastify.decorate('verifyJWT', async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }
    const token = authHeader.slice(7);
    const payload = await authService.verifyAccessToken(token);
    request.user = { ...payload, type: 'jwt' };
  });

  /**
   * Decorator: verifyApiKey
   * Validates sk-live-xxx API key from Authorization header (Bearer) or X-API-Key header.
   * Attaches key scopes to request.user for downstream scope enforcement.
   */
  fastify.decorate('verifyApiKey', async (request: FastifyRequest) => {
    const apiKey =
      request.headers['x-api-key'] as string | undefined ??
      request.headers.authorization?.replace('Bearer ', '');

    if (!apiKey) throw new ApiKeyInvalidError();

    const hash = sha256(apiKey);
    const key = await apiKeyRepo.findByHash(hash);

    if (!key) throw new ApiKeyInvalidError();
    if (!key.isActive) throw new ApiKeyRevokedError();

    // Update last used async — don't await to avoid adding latency
    void apiKeyRepo.updateLastUsed(key.id);

    // Attach per-key rate limit for use by the rate-limit plugin
    request.apiKeyRateLimit = key.rateLimit;

    request.user = {
      sub: key.userId,
      email: '',
      role: 'USER',
      jti: key.id,
      sid: '',
      iat: 0,
      exp: 0,
      type: 'apikey',
      scopes: key.scopes,
    };
  });

  /**
   * Decorator: requireAdmin
   * Must be used AFTER verifyJWT. Throws 403 if the user is not an ADMIN.
   */
  fastify.decorate('requireAdmin', async (request: FastifyRequest) => {
    if (!request.user || request.user.role !== 'ADMIN') {
      throw new ForbiddenError();
    }
  });

  /**
   * Decorator: verifyAuth
   * Accepts either JWT or API Key (flexible for endpoints that support both).
   */
  fastify.decorate('verifyAuth', async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    const apiKeyHeader = request.headers['x-api-key'] as string | undefined;

    if (apiKeyHeader || authHeader?.startsWith('Bearer sk-')) {
      await (fastify as any).verifyApiKey(request);
    } else {
      await (fastify as any).verifyJWT(request);
    }
  });

  /**
   * Decorator factory: requireScope(scope)
   * Returns a preHandler that enforces a specific scope on API key requests.
   * JWT requests bypass scope checks (users always have full access).
   * API keys with empty scopes array are wildcards and also bypass checks.
   */
  fastify.decorate('requireScope', (scope: string) => async (request: FastifyRequest) => {
    const user = request.user;
    if (!user || user.type !== 'apikey') return; // JWT → no scope restriction

    const keyScopes = user.scopes ?? [];
    if (keyScopes.length === 0) return; // wildcard key → full access

    if (!keyScopes.includes(scope)) {
      throw new InsufficientScopeError(scope);
    }
  });
});
