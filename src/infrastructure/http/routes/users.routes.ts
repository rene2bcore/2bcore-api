import type { FastifyInstance } from 'fastify';
import { RegisterUserUseCase } from '../../../application/use-cases/users/register.js';
import { RegisterUserInputSchema } from '../../../application/dtos/user.dto.js';
import { HTTP_STATUS } from '../../../shared/constants/index.js';
import { env } from '../../../shared/config/env.js';

interface UsersRoutesOptions {
  registerUserUseCase: RegisterUserUseCase;
}

export async function usersRoutes(fastify: FastifyInstance, opts: UsersRoutesOptions): Promise<void> {
  const { registerUserUseCase } = opts;

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
}
