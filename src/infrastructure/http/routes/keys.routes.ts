import type { FastifyInstance } from 'fastify';
import { CreateApiKeyUseCase } from '../../../application/use-cases/keys/createApiKey.js';
import { ListApiKeysUseCase } from '../../../application/use-cases/keys/listApiKeys.js';
import { RevokeApiKeyUseCase } from '../../../application/use-cases/keys/revokeApiKey.js';
import { CreateApiKeyInputSchema } from '../../../application/dtos/apikey.dto.js';
import { HTTP_STATUS } from '../../../shared/constants/index.js';

interface KeysRoutesOptions {
  createApiKeyUseCase: CreateApiKeyUseCase;
  listApiKeysUseCase: ListApiKeysUseCase;
  revokeApiKeyUseCase: RevokeApiKeyUseCase;
}

export async function keysRoutes(fastify: FastifyInstance, opts: KeysRoutesOptions): Promise<void> {
  const { createApiKeyUseCase, listApiKeysUseCase, revokeApiKeyUseCase } = opts;

  const verifyJWT = (fastify as any).verifyJWT;
  const verifyAuth = (fastify as any).verifyAuth;

  // ── POST /keys ─────────────────────────────────────────────────────
  fastify.post('/', {
    preHandler: [verifyJWT], // key creation requires JWT — not bootstrappable via API key
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const body = CreateApiKeyInputSchema.parse(request.body);

      const result = await createApiKeyUseCase.execute(userId, body);

      return reply.status(HTTP_STATUS.CREATED).send(result);
    },
  });

  // ── GET /keys ──────────────────────────────────────────────────────
  fastify.get('/', {
    preHandler: [verifyAuth],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const keys = await listApiKeysUseCase.execute(userId);
      return reply.status(HTTP_STATUS.OK).send({ data: keys });
    },
  });

  // ── DELETE /keys/:id ───────────────────────────────────────────────
  fastify.delete('/:id', {
    preHandler: [verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };

      await revokeApiKeyUseCase.execute(userId, id);

      return reply.status(HTTP_STATUS.NO_CONTENT).send();
    },
  });
}
