import type { FastifyInstance } from 'fastify';
import { LoginUseCase } from '../../../application/use-cases/auth/login.js';
import { RefreshTokenUseCase } from '../../../application/use-cases/auth/refresh.js';
import { LogoutUseCase } from '../../../application/use-cases/auth/logout.js';
import { ListSessionsUseCase } from '../../../application/use-cases/auth/listSessions.js';
import { RevokeSessionUseCase } from '../../../application/use-cases/auth/revokeSession.js';
import { SendVerificationEmailUseCase } from '../../../application/use-cases/auth/sendVerificationEmail.js';
import { VerifyEmailUseCase } from '../../../application/use-cases/auth/verifyEmail.js';
import { ForgotPasswordUseCase } from '../../../application/use-cases/auth/forgotPassword.js';
import { ResetPasswordUseCase } from '../../../application/use-cases/auth/resetPassword.js';
import { SetupTotpUseCase } from '../../../application/use-cases/auth/setupTotp.js';
import { EnableTotpUseCase } from '../../../application/use-cases/auth/enableTotp.js';
import { DisableTotpUseCase } from '../../../application/use-cases/auth/disableTotp.js';
import { VerifyTotpChallengeUseCase } from '../../../application/use-cases/auth/verifyTotpChallenge.js';
import { GetTotpStatusUseCase } from '../../../application/use-cases/auth/getTotpStatus.js';
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
  listSessionsUseCase: ListSessionsUseCase;
  revokeSessionUseCase: RevokeSessionUseCase;
  sendVerificationEmailUseCase: SendVerificationEmailUseCase;
  verifyEmailUseCase: VerifyEmailUseCase;
  forgotPasswordUseCase: ForgotPasswordUseCase;
  resetPasswordUseCase: ResetPasswordUseCase;
  setupTotpUseCase: SetupTotpUseCase;
  enableTotpUseCase: EnableTotpUseCase;
  disableTotpUseCase: DisableTotpUseCase;
  verifyTotpChallengeUseCase: VerifyTotpChallengeUseCase;
  getTotpStatusUseCase: GetTotpStatusUseCase;
}

const TokenResponse = {
  type: 'object',
  properties: {
    accessToken: { type: 'string' },
    tokenType: { type: 'string', enum: ['Bearer'] },
    expiresIn: { type: 'number', description: 'Seconds until the access token expires' },
    sessionId: { type: 'string', description: 'Active session ID' },
  },
  required: ['accessToken', 'tokenType', 'expiresIn', 'sessionId'],
} as const;

const ErrorResponse = { $ref: 'ErrorResponse#' };

const authRateLimit = {
  max: env.RATE_LIMIT_AUTH_MAX,
  timeWindow: env.RATE_LIMIT_AUTH_WINDOW_MS,
};

const SessionSchema = {
  type: 'object',
  properties: {
    sessionId: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    expiresAt: { type: 'string', format: 'date-time' },
    ipAddress: { type: 'string' },
    userAgent: { type: 'string' },
  },
  required: ['sessionId', 'createdAt', 'expiresAt'],
} as const;

function setRefreshCookie(reply: any, cookieValue: string): void {
  const isProduction = env.NODE_ENV === 'production';
  reply.setCookie(REFRESH_TOKEN_COOKIE, cookieValue, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: `/${env.API_VERSION}/auth`,
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function authRoutes(fastify: FastifyInstance, opts: AuthRoutesOptions): Promise<void> {
  const {
    loginUseCase,
    refreshUseCase,
    logoutUseCase,
    listSessionsUseCase,
    revokeSessionUseCase,
    sendVerificationEmailUseCase,
    verifyEmailUseCase,
    forgotPasswordUseCase,
    resetPasswordUseCase,
    setupTotpUseCase,
    enableTotpUseCase,
    disableTotpUseCase,
    verifyTotpChallengeUseCase,
    getTotpStatusUseCase,
  } = opts;

  const verifyJWT = (fastify as any).verifyJWT;

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
          oneOf: [
            // Full login (2FA not enabled)
            {
              type: 'object',
              properties: {
                requires2fa: { type: 'boolean', enum: [false] },
                accessToken: { type: 'string' },
                tokenType: { type: 'string', enum: ['Bearer'] },
                expiresIn: { type: 'number' },
                sessionId: { type: 'string' },
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
              required: ['requires2fa', 'accessToken', 'tokenType', 'expiresIn', 'sessionId', 'user'],
            },
            // 2FA challenge required
            {
              type: 'object',
              properties: {
                requires2fa: { type: 'boolean', enum: [true] },
                challengeToken: { type: 'string', description: 'Short-lived token to complete 2FA challenge' },
              },
              required: ['requires2fa', 'challengeToken'],
            },
          ],
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

      if (result.requires2fa) {
        return reply.status(HTTP_STATUS.OK).send({
          requires2fa: true,
          challengeToken: result.challengeToken,
        });
      }

      setRefreshCookie(reply, result.refreshCookie);

      return reply.status(HTTP_STATUS.OK).send({
        requires2fa: false,
        accessToken: result.accessToken,
        tokenType: 'Bearer' as const,
        expiresIn: result.accessExpiresIn,
        sessionId: result.sessionId,
        user: result.user,
      });
    },
  });

  // ── POST /refresh ──────────────────────────────────────────────────
  fastify.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      description: 'Exchange the HttpOnly refresh_token cookie for a new access token. Rotates the session.',
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
      const cookieValue = request.cookies?.[REFRESH_TOKEN_COOKIE];
      const userId = (request.body as { userId?: string })?.userId;

      if (!cookieValue || !userId) {
        return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
          error: 'Missing refresh token or user ID',
          code: 'AUTH_005',
        });
      }

      const result = await refreshUseCase.execute(userId, cookieValue, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      setRefreshCookie(reply, result.refreshCookie);

      return reply.status(HTTP_STATUS.OK).send({
        accessToken: result.accessToken,
        tokenType: 'Bearer' as const,
        expiresIn: result.accessExpiresIn,
        sessionId: result.sessionId,
      });
    },
  });

  // ── POST /logout ───────────────────────────────────────────────────
  fastify.post('/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Logout',
      description: 'Revoke the current session and clear the refresh token cookie. Other sessions remain active.',
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
        sessionId: user.sid,
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

  // ── GET /sessions ──────────────────────────────────────────────────
  fastify.get('/sessions', {
    schema: {
      tags: ['Auth'],
      summary: 'List active sessions',
      description: 'Returns all active sessions for the authenticated user.',
      security: [{ BearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: SessionSchema },
          },
          required: ['data'],
        },
        401: ErrorResponse,
      },
    },
    preHandler: [(fastify as any).verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const sessions = await listSessionsUseCase.execute(userId);
      return reply.status(HTTP_STATUS.OK).send({ data: sessions });
    },
  });

  // ── DELETE /sessions/:sessionId ───────────────────────────────────
  fastify.delete('/sessions/:sessionId', {
    schema: {
      tags: ['Auth'],
      summary: 'Revoke a session',
      description: 'Revoke a specific session by its ID. Users can only revoke their own sessions.',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        required: ['sessionId'],
        properties: { sessionId: { type: 'string' } },
      },
      response: {
        204: { type: 'null', description: 'Session revoked' },
        401: ErrorResponse,
      },
    },
    preHandler: [(fastify as any).verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const { sessionId } = request.params as { sessionId: string };

      await revokeSessionUseCase.execute(userId, sessionId, {
        requestingUserId: userId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
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

  // ── GET /2fa/status ────────────────────────────────────────────────
  fastify.get('/2fa/status', {
    schema: {
      tags: ['2FA'],
      summary: 'Get 2FA status',
      description: 'Returns whether TOTP two-factor authentication is enabled for the authenticated user.',
      security: [{ BearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            isEnabled: { type: 'boolean' },
            enabledAt: { type: ['string', 'null'], format: 'date-time' },
          },
          required: ['isEnabled', 'enabledAt'],
        },
        401: ErrorResponse,
      },
    },
    preHandler: [verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const status = await getTotpStatusUseCase.execute(userId);
      return reply.status(HTTP_STATUS.OK).send(status);
    },
  });

  // ── POST /2fa/setup ────────────────────────────────────────────────
  fastify.post('/2fa/setup', {
    schema: {
      tags: ['2FA'],
      summary: 'Setup TOTP 2FA',
      description: 'Generate a TOTP secret and QR code. The secret is **not enabled** until confirmed via `POST /2fa/enable`. JWT required.',
      security: [{ BearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            secret: { type: 'string', description: 'Base32 secret for manual entry into authenticator app' },
            otpauthUrl: { type: 'string', description: 'otpauth:// URI for authenticator app QR scan' },
            qrDataUrl: { type: 'string', description: 'PNG QR code as data URL (data:image/png;base64,...)' },
          },
          required: ['secret', 'otpauthUrl', 'qrDataUrl'],
        },
        401: ErrorResponse,
      },
    },
    preHandler: [verifyJWT],
    handler: async (request, reply) => {
      const user = request.user!;
      const result = await setupTotpUseCase.execute(user.sub, user.email);
      return reply.status(HTTP_STATUS.OK).send(result);
    },
  });

  // ── POST /2fa/enable ───────────────────────────────────────────────
  fastify.post('/2fa/enable', {
    schema: {
      tags: ['2FA'],
      summary: 'Enable TOTP 2FA',
      description: 'Confirm a valid TOTP code to activate 2FA. Returns one-time backup codes — store securely. JWT required.',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', minLength: 6, maxLength: 8, description: '6-digit TOTP code from authenticator app' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            backupCodes: {
              type: 'array',
              items: { type: 'string' },
              description: 'One-time backup codes — shown once, store securely',
            },
          },
          required: ['backupCodes'],
        },
        401: ErrorResponse,
        409: ErrorResponse,
        422: ErrorResponse,
      },
    },
    preHandler: [verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const { code } = request.body as { code: string };
      const result = await enableTotpUseCase.execute(userId, code);
      return reply.status(HTTP_STATUS.OK).send(result);
    },
  });

  // ── DELETE /2fa/disable ────────────────────────────────────────────
  fastify.delete('/2fa/disable', {
    schema: {
      tags: ['2FA'],
      summary: 'Disable TOTP 2FA',
      description: 'Disable two-factor authentication. Requires a valid TOTP code or backup code. JWT required.',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', minLength: 6, maxLength: 10, description: 'Current TOTP code or backup code' },
        },
      },
      response: {
        204: { type: 'null', description: '2FA disabled' },
        400: ErrorResponse,
        401: ErrorResponse,
        422: ErrorResponse,
      },
    },
    preHandler: [verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const { code } = request.body as { code: string };
      await disableTotpUseCase.execute(userId, code);
      return reply.status(HTTP_STATUS.NO_CONTENT).send();
    },
  });

  // ── POST /2fa/challenge ────────────────────────────────────────────
  fastify.post('/2fa/challenge', {
    schema: {
      tags: ['2FA'],
      summary: 'Complete 2FA challenge',
      description: 'Exchange a challenge token (from login) + TOTP code for full session tokens.',
      body: {
        type: 'object',
        required: ['challengeToken', 'code'],
        properties: {
          challengeToken: { type: 'string', description: 'Challenge token returned by POST /login' },
          code: { type: 'string', minLength: 6, maxLength: 10, description: 'TOTP code or backup code' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            tokenType: { type: 'string', enum: ['Bearer'] },
            expiresIn: { type: 'number' },
            sessionId: { type: 'string' },
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
          required: ['accessToken', 'tokenType', 'expiresIn', 'sessionId', 'user'],
        },
        401: ErrorResponse,
        422: ErrorResponse,
        429: ErrorResponse,
      },
    },
    config: {
      rateLimit: { ...authRateLimit, keyGenerator: (req: { ip: string }) => `auth_2fa_challenge:${req.ip}` },
    },
    handler: async (request, reply) => {
      const { challengeToken, code } = request.body as { challengeToken: string; code: string };
      const result = await verifyTotpChallengeUseCase.execute(
        { challengeToken, code },
        { ipAddress: request.ip, userAgent: request.headers['user-agent'] },
      );

      setRefreshCookie(reply, result.refreshCookie);

      return reply.status(HTTP_STATUS.OK).send({
        accessToken: result.accessToken,
        tokenType: 'Bearer' as const,
        expiresIn: result.accessExpiresIn,
        sessionId: result.sessionId,
        user: result.user,
      });
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
