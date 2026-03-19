import type { FastifyInstance } from 'fastify';
import { LoginUseCase } from '../../../application/use-cases/auth/login.js';
import { RefreshTokenUseCase } from '../../../application/use-cases/auth/refresh.js';
import { LogoutUseCase } from '../../../application/use-cases/auth/logout.js';
import { SendVerificationEmailUseCase } from '../../../application/use-cases/auth/sendVerificationEmail.js';
import { VerifyEmailUseCase } from '../../../application/use-cases/auth/verifyEmail.js';
import { ForgotPasswordUseCase } from '../../../application/use-cases/auth/forgotPassword.js';
import { ResetPasswordUseCase } from '../../../application/use-cases/auth/resetPassword.js';
import {
  LoginInputSchema,
  VerifyEmailInputSchema,
  ResendVerificationInputSchema,
  ForgotPasswordInputSchema,
  ResetPasswordInputSchema,
} from '../../../application/dtos/auth.dto.js';
import { REFRESH_TOKEN_COOKIE, HTTP_STATUS } from '../../../shared/constants/index.js';
import { env } from '../../../shared/config/env.js';

interface AuthRoutesOptions {
  loginUseCase: LoginUseCase;
  refreshUseCase: RefreshTokenUseCase;
  logoutUseCase: LogoutUseCase;
  sendVerificationEmailUseCase: SendVerificationEmailUseCase;
  verifyEmailUseCase: VerifyEmailUseCase;
  forgotPasswordUseCase: ForgotPasswordUseCase;
  resetPasswordUseCase: ResetPasswordUseCase;
}

const TokenResponse = {
  type: 'object',
  properties: {
    accessToken: { type: 'string' },
    tokenType: { type: 'string', enum: ['Bearer'] },
    expiresIn: { type: 'number', description: 'Seconds until the access token expires' },
  },
  required: ['accessToken', 'tokenType', 'expiresIn'],
} as const;

const ErrorResponse = { $ref: 'ErrorResponse#' };

const authRateLimit = {
  max: env.RATE_LIMIT_AUTH_MAX,
  timeWindow: env.RATE_LIMIT_AUTH_WINDOW_MS,
};

export async function authRoutes(fastify: FastifyInstance, opts: AuthRoutesOptions): Promise<void> {
  const {
    loginUseCase,
    refreshUseCase,
    logoutUseCase,
    sendVerificationEmailUseCase,
    verifyEmailUseCase,
    forgotPasswordUseCase,
    resetPasswordUseCase,
  } = opts;

  // ── POST /login ────────────────────────────────────────────────────
  fastify.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login',
      description: 'Authenticate with email and password. Returns a JWT access token and sets an HttpOnly refresh token cookie.',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8, maxLength: 128 },
        },
      },
      response: {
        200: {
          ...TokenResponse,
          properties: {
            ...TokenResponse.properties,
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string', format: 'email' },
                role: { type: 'string' },
              },
              required: ['id', 'email', 'role'],
            },
          },
          required: [...TokenResponse.required, 'user'],
        },
        401: ErrorResponse,
        422: ErrorResponse,
        429: ErrorResponse,
      },
    },
    config: {
      rateLimit: { ...authRateLimit, keyGenerator: (req: { ip: string }) => `auth_login:${req.ip}` },
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
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      description: 'Exchange the HttpOnly refresh_token cookie for a new access token. Rotates the refresh token.',
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', description: 'ID of the user whose token to refresh' },
        },
      },
      response: {
        200: TokenResponse,
        401: ErrorResponse,
        429: ErrorResponse,
      },
    },
    config: {
      rateLimit: { ...authRateLimit, keyGenerator: (req: { ip: string }) => `auth_refresh:${req.ip}` },
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
    schema: {
      tags: ['Auth'],
      summary: 'Logout',
      description: 'Revoke the current access token and clear the refresh token cookie.',
      security: [{ BearerAuth: [] }],
      response: {
        204: { type: 'null', description: 'Successfully logged out' },
        401: ErrorResponse,
      },
    },
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

  // ── POST /verify-email ─────────────────────────────────────────────
  fastify.post('/verify-email', {
    schema: {
      tags: ['Auth'],
      summary: 'Verify email address',
      description: 'Consume a one-time email verification token. Token is valid for 24 hours.',
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', minLength: 1 },
        },
      },
      response: {
        204: { type: 'null', description: 'Email successfully verified' },
        400: ErrorResponse,
        422: ErrorResponse,
      },
    },
    handler: async (request, reply) => {
      const { token } = VerifyEmailInputSchema.parse(request.body);
      await verifyEmailUseCase.execute(token, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return reply.status(HTTP_STATUS.NO_CONTENT).send();
    },
  });

  // ── POST /resend-verification ──────────────────────────────────────
  fastify.post('/resend-verification', {
    schema: {
      tags: ['Auth'],
      summary: 'Resend verification email',
      description: 'Request a new email verification link. Rate-limited to prevent abuse.',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
      response: {
        204: { type: 'null', description: 'Verification email sent (if account exists and is unverified)' },
        422: ErrorResponse,
        429: ErrorResponse,
      },
    },
    config: {
      rateLimit: { ...authRateLimit, keyGenerator: (req: { ip: string }) => `auth_resend:${req.ip}` },
    },
    handler: async (request, reply) => {
      const { email } = ResendVerificationInputSchema.parse(request.body);
      // Silent no-op if user not found or already verified — prevents email enumeration
      await sendVerificationEmailUseCase.executeByEmail(email).catch(() => {});
      return reply.status(HTTP_STATUS.NO_CONTENT).send();
    },
  });

  // ── POST /forgot-password ──────────────────────────────────────────
  fastify.post('/forgot-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Request password reset',
      description: 'Send a password reset link to the given email address. Always returns 204 to prevent email enumeration.',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
      response: {
        204: { type: 'null', description: 'Reset email sent (if account exists)' },
        422: ErrorResponse,
        429: ErrorResponse,
      },
    },
    config: {
      rateLimit: { ...authRateLimit, keyGenerator: (req: { ip: string }) => `auth_forgot:${req.ip}` },
    },
    handler: async (request, reply) => {
      const { email } = ForgotPasswordInputSchema.parse(request.body);
      await forgotPasswordUseCase.execute(email, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return reply.status(HTTP_STATUS.NO_CONTENT).send();
    },
  });

  // ── POST /reset-password ───────────────────────────────────────────
  fastify.post('/reset-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Reset password',
      description: 'Consume a one-time password reset token and set a new password. Invalidates all active sessions.',
      body: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 8, maxLength: 128 },
        },
      },
      response: {
        204: { type: 'null', description: 'Password successfully reset' },
        400: ErrorResponse,
        422: ErrorResponse,
      },
    },
    handler: async (request, reply) => {
      const { token, password } = ResetPasswordInputSchema.parse(request.body);
      await resetPasswordUseCase.execute(token, password, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return reply.status(HTTP_STATUS.NO_CONTENT).send();
    },
  });
}
