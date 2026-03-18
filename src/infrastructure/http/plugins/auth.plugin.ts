import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AuthService, AccessTokenPayload } from '../../../application/services/AuthService.js';
import { IApiKeyRepository } from '../../../domain/repositories/IApiKeyRepository.js';
import { sha256 } from '../../../shared/utils/crypto.js';
import { UnauthorizedError, ApiKeyInvalidError, ApiKeyRevokedError, ForbiddenError } from '../../../domain/errors/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload & { type: 'jwt' | 'apikey' };
  }
}

interface AuthPluginOptions {
  authService: AuthService;
  apiKeyRepo: IApiKeyRepository;
}

export const authPlugin = fp(async (fastify: FastifyInstance, opts: AuthPluginOptions) => {
  const { authService, apiKeyRepo } = opts;

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

    request.user = {
      sub: key.userId,
      email: '',
      role: 'USER',
      jti: key.id,
      iat: 0,
      exp: 0,
      type: 'apikey',
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
});
