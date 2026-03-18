import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LoginUseCase } from '../../../application/use-cases/auth/login.js';
import { RefreshTokenUseCase } from '../../../application/use-cases/auth/refresh.js';
import { LogoutUseCase } from '../../../application/use-cases/auth/logout.js';
import { LoginInputSchema } from '../../../application/dtos/auth.dto.js';
import { REFRESH_TOKEN_COOKIE, HTTP_STATUS } from '../../../shared/constants/index.js';
import { env } from '../../../shared/config/env.js';

interface AuthRoutesOptions {
  loginUseCase: LoginUseCase;
  refreshUseCase: RefreshTokenUseCase;
  logoutUseCase: LogoutUseCase;
}

export async function authRoutes(fastify: FastifyInstance, opts: AuthRoutesOptions): Promise<void> {
  const { loginUseCase, refreshUseCase, logoutUseCase } = opts;

  // ── POST /login ────────────────────────────────────────────────────
  fastify.post('/login', {
    config: {
      rateLimit: {
        max: env.RATE_LIMIT_AUTH_MAX,
        timeWindow: env.RATE_LIMIT_AUTH_WINDOW_MS,
        keyGenerator: (req: { ip: string }) => `auth_login:${req.ip}`,
      },
    },
    handler: async (request, reply) => {
      const body = LoginInputSchema.parse(request.body);

      const result = await loginUseCase.execute(body, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      const isProduction = env.NODE_ENV === 'production';

      reply.setCookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: `/${env.API_VERSION}/auth`,
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return reply.status(HTTP_STATUS.OK).send({
        accessToken: result.accessToken,
        tokenType: 'Bearer' as const,
        expiresIn: result.accessExpiresIn,
        user: result.user,
      });
    },
  });

  // ── POST /refresh ──────────────────────────────────────────────────
  fastify.post('/refresh', {
    config: {
      rateLimit: {
        max: env.RATE_LIMIT_AUTH_MAX,
        timeWindow: env.RATE_LIMIT_AUTH_WINDOW_MS,
        keyGenerator: (req: { ip: string }) => `auth_refresh:${req.ip}`,
      },
    },
    handler: async (request, reply) => {
      const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE];
      const userId = (request.body as { userId?: string })?.userId;

      if (!refreshToken || !userId) {
        return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
          error: 'Missing refresh token or user ID',
          code: 'AUTH_005',
        });
      }

      const result = await refreshUseCase.execute(userId, refreshToken, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      const isProduction = env.NODE_ENV === 'production';

      reply.setCookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: `/${env.API_VERSION}/auth`,
        maxAge: 7 * 24 * 60 * 60,
      });

      return reply.status(HTTP_STATUS.OK).send({
        accessToken: result.accessToken,
        tokenType: 'Bearer' as const,
        expiresIn: result.accessExpiresIn,
      });
    },
  });

  // ── POST /logout ───────────────────────────────────────────────────
  fastify.post('/logout', {
    preHandler: [(fastify as any).verifyJWT],
    handler: async (request, reply) => {
      const user = request.user!;
      const accessToken = request.headers.authorization!.slice(7);

      await logoutUseCase.execute({
        userId: user.sub,
        accessToken,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      reply.clearCookie(REFRESH_TOKEN_COOKIE, {
        path: `/${env.API_VERSION}/auth`,
      });

      return reply.status(HTTP_STATUS.NO_CONTENT).send();
    },
  });
}
