import type { FastifyInstance } from 'fastify';
import { CreateApiKeyUseCase } from '../../../application/use-cases/keys/createApiKey.js';
import { ListApiKeysUseCase } from '../../../application/use-cases/keys/listApiKeys.js';
import { RevokeApiKeyUseCase } from '../../../application/use-cases/keys/revokeApiKey.js';
import { GetApiKeyUseCase } from '../../../application/use-cases/keys/getApiKey.js';
import { CreateApiKeyInputSchema } from '../../../application/dtos/apikey.dto.js';
import { HTTP_STATUS } from '../../../shared/constants/index.js';

interface KeysRoutesOptions {
  createApiKeyUseCase: CreateApiKeyUseCase;
  listApiKeysUseCase: ListApiKeysUseCase;
  revokeApiKeyUseCase: RevokeApiKeyUseCase;
  getApiKeyUseCase: GetApiKeyUseCase;
}

const ErrorResponse = { $ref: 'ErrorResponse#' };

const ApiKeyMeta = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    prefix: { type: 'string', description: 'First 8 characters of the key for identification' },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
    revokedAt: { type: ['string', 'null'], format: 'date-time' },
  },
  required: ['id', 'name', 'prefix', 'isActive', 'createdAt'],
};

export async function keysRoutes(fastify: FastifyInstance, opts: KeysRoutesOptions): Promise<void> {
  const { createApiKeyUseCase, listApiKeysUseCase, revokeApiKeyUseCase, getApiKeyUseCase } = opts;

  const verifyJWT = (fastify as any).verifyJWT;
  const verifyAuth = (fastify as any).verifyAuth;

  // ── POST /keys ─────────────────────────────────────────────────────
  fastify.post('/', {
    schema: {
      tags: ['API Keys'],
      summary: 'Create API key',
      description: 'Create a new API key. The raw key (`sk-live-...`) is returned **once** and never stored in plaintext. JWT required.',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 64, description: 'Human-readable label for the key' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            key: { type: 'string', description: 'Full API key — shown once, store securely' },
            prefix: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'key', 'prefix', 'createdAt'],
        },
        401: ErrorResponse,
        422: ErrorResponse,
      },
    },
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
    schema: {
      tags: ['API Keys'],
      summary: 'List API keys',
      description: 'List all API keys for the authenticated user. Raw keys are never returned.',
      security: [{ BearerAuth: [] }, { ApiKeyHeader: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: ApiKeyMeta },
          },
          required: ['data'],
        },
        401: ErrorResponse,
      },
    },
    preHandler: [verifyAuth],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const keys = await listApiKeysUseCase.execute(userId);
      return reply.status(HTTP_STATUS.OK).send({ data: keys });
    },
  });

  // ── GET /keys/:id ──────────────────────────────────────────────────
  fastify.get('/:id', {
    schema: {
      tags: ['API Keys'],
      summary: 'Get API key',
      description: 'Retrieve metadata for a single API key by ID. Raw key is never returned. JWT or API Key auth accepted.',
      security: [{ BearerAuth: [] }, { ApiKeyHeader: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'API key ID' },
        },
      },
      response: {
        200: ApiKeyMeta,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
    preHandler: [verifyAuth],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      const result = await getApiKeyUseCase.execute(userId, id);
      return reply.status(HTTP_STATUS.OK).send(result);
    },
  });

  // ── DELETE /keys/:id ───────────────────────────────────────────────
  fastify.delete('/:id', {
    schema: {
      tags: ['API Keys'],
      summary: 'Revoke API key',
      description: 'Permanently revoke an API key by ID. JWT required.',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'API key ID' },
        },
      },
      response: {
        204: { type: 'null', description: 'Key revoked' },
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
    preHandler: [verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };

      await revokeApiKeyUseCase.execute(userId, id);

      return reply.status(HTTP_STATUS.NO_CONTENT).send();
    },
  });
}
