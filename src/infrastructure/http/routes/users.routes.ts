import type { FastifyInstance } from 'fastify';
import { RegisterUserUseCase } from '../../../application/use-cases/users/register.js';
import { GetMeUseCase } from '../../../application/use-cases/users/getMe.js';
import { UpdateMeUseCase } from '../../../application/use-cases/users/updateMe.js';
import { RegisterUserInputSchema, UpdateMeInputSchema } from '../../../application/dtos/user.dto.js';
import { HTTP_STATUS } from '../../../shared/constants/index.js';
import { env } from '../../../shared/config/env.js';

interface UsersRoutesOptions {
  registerUserUseCase: RegisterUserUseCase;
  getMeUseCase: GetMeUseCase;
  updateMeUseCase: UpdateMeUseCase;
}

export async function usersRoutes(fastify: FastifyInstance, opts: UsersRoutesOptions): Promise<void> {
  const { registerUserUseCase, getMeUseCase, updateMeUseCase } = opts;
  const verifyAuth = (fastify as any).verifyAuth;
  const verifyJWT = (fastify as any).verifyJWT;

  // ── POST / (register) ──────────────────────────────────────────────
  fastify.post('/', {
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
    preHandler: [verifyAuth],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const user = await getMeUseCase.execute(userId);
      return reply.status(HTTP_STATUS.OK).send(user);
    },
  });

  // ── PATCH /me ──────────────────────────────────────────────────────
  fastify.patch('/me', {
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
}
