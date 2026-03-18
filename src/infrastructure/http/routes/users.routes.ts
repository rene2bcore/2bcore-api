import type { FastifyInstance } from 'fastify';
import { RegisterUserUseCase } from '../../../application/use-cases/users/register.js';
import { GetMeUseCase } from '../../../application/use-cases/users/getMe.js';
import { UpdateMeUseCase } from '../../../application/use-cases/users/updateMe.js';
import { DeleteMeUseCase } from '../../../application/use-cases/users/deleteMe.js';
import { RegisterUserInputSchema, UpdateMeInputSchema, DeleteMeInputSchema } from '../../../application/dtos/user.dto.js';
import { HTTP_STATUS } from '../../../shared/constants/index.js';
import { env } from '../../../shared/config/env.js';

interface UsersRoutesOptions {
  registerUserUseCase: RegisterUserUseCase;
  getMeUseCase: GetMeUseCase;
  updateMeUseCase: UpdateMeUseCase;
  deleteMeUseCase: DeleteMeUseCase;
}

const UserPublicRef = { $ref: 'UserPublic#' };
const ErrorResponse = { $ref: 'ErrorResponse#' };

const StrongPasswordSchema = {
  type: 'string',
  minLength: 8,
  maxLength: 128,
  description: 'Min 8 chars, must include uppercase, lowercase, number, and special character',
};

export async function usersRoutes(fastify: FastifyInstance, opts: UsersRoutesOptions): Promise<void> {
  const { registerUserUseCase, getMeUseCase, updateMeUseCase, deleteMeUseCase } = opts;
  const verifyAuth = (fastify as any).verifyAuth;
  const verifyJWT = (fastify as any).verifyJWT;

  // ── POST / (register) ──────────────────────────────────────────────
  fastify.post('/', {
    schema: {
      tags: ['Users'],
      summary: 'Register',
      description: 'Create a new user account. Returns the public profile (no passwordHash).',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: StrongPasswordSchema,
        },
      },
      response: {
        201: UserPublicRef,
        409: ErrorResponse,
        422: ErrorResponse,
        429: ErrorResponse,
      },
    },
    config: {
      rateLimit: {
        max: env.RATE_LIMIT_AUTH_MAX,
        timeWindow: env.RATE_LIMIT_AUTH_WINDOW_MS,
        keyGenerator: (req: { ip: string }) => `user_register:${req.ip}`,
      },
    },
    handler: async (request, reply) => {
      const body = RegisterUserInputSchema.parse(request.body);

      const user = await registerUserUseCase.execute(body, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.status(HTTP_STATUS.CREATED).send(user);
    },
  });

  // ── GET /me ────────────────────────────────────────────────────────
  fastify.get('/me', {
    schema: {
      tags: ['Users'],
      summary: 'Get my profile',
      description: 'Returns the authenticated user\'s public profile. Accepts JWT or API key.',
      security: [{ BearerAuth: [] }, { ApiKeyHeader: [] }],
      response: {
        200: UserPublicRef,
        401: ErrorResponse,
      },
    },
    preHandler: [verifyAuth],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const user = await getMeUseCase.execute(userId);
      return reply.status(HTTP_STATUS.OK).send(user);
    },
  });

  // ── PATCH /me ──────────────────────────────────────────────────────
  fastify.patch('/me', {
    schema: {
      tags: ['Users'],
      summary: 'Update my profile',
      description: 'Update email and/or password. JWT required (API keys not accepted). Changing password requires `currentPassword`.',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          currentPassword: { type: 'string', description: 'Required when setting newPassword' },
          newPassword: StrongPasswordSchema,
        },
      },
      response: {
        200: UserPublicRef,
        401: ErrorResponse,
        409: ErrorResponse,
        422: ErrorResponse,
      },
    },
    preHandler: [verifyJWT], // JWT only — password/email changes must not be done via API key
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const body = UpdateMeInputSchema.parse(request.body);

      const user = await updateMeUseCase.execute(userId, body, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.status(HTTP_STATUS.OK).send(user);
    },
  });

  // ── DELETE /me ─────────────────────────────────────────────────────
  fastify.delete('/me', {
    schema: {
      tags: ['Users'],
      summary: 'Delete my account',
      description: 'Permanently delete the authenticated user\'s account. Requires password confirmation. JWT required. All API keys are revoked and tokens invalidated.',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string', minLength: 1, description: 'Current password to confirm deletion' },
        },
      },
      response: {
        204: { type: 'null', description: 'Account deleted' },
        401: ErrorResponse,
        422: ErrorResponse,
      },
    },
    preHandler: [verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const { password } = DeleteMeInputSchema.parse(request.body);
      const accessToken = request.headers.authorization!.slice(7);

      await deleteMeUseCase.execute(userId, password, {
        accessToken,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.status(HTTP_STATUS.NO_CONTENT).send();
    },
  });
}
