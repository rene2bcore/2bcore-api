import type { FastifyInstance } from 'fastify';
import { CreateApiKeyUseCase } from '../../../application/use-cases/keys/createApiKey.js';
import { ListApiKeysUseCase } from '../../../application/use-cases/keys/listApiKeys.js';
import { RevokeApiKeyUseCase } from '../../../application/use-cases/keys/revokeApiKey.js';
import { GetApiKeyUseCase } from '../../../application/use-cases/keys/getApiKey.js';
import { RotateApiKeyUseCase } from '../../../application/use-cases/keys/rotateApiKey.js';
import { CreateApiKeyInputSchema } from '../../../application/dtos/apikey.dto.js';
import { HTTP_STATUS, ALL_SCOPES } from '../../../shared/constants/index.js';

interface KeysRoutesOptions {
  createApiKeyUseCase: CreateApiKeyUseCase;
  listApiKeysUseCase: ListApiKeysUseCase;
  revokeApiKeyUseCase: RevokeApiKeyUseCase;
  getApiKeyUseCase: GetApiKeyUseCase;
  rotateApiKeyUseCase: RotateApiKeyUseCase;
}

const ErrorResponse = { $ref: 'ErrorResponse#' };

const ScopesProperty = {
  type: 'array',
  items: { type: 'string', enum: ALL_SCOPES },
  description: 'Scopes granted to this key. Empty array = full access (wildcard).',
};

const ApiKeyMeta = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    prefix: { type: 'string', description: 'First 8 characters of the key for identification' },
    scopes: ScopesProperty,
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
    revokedAt: { type: ['string', 'null'], format: 'date-time' },
  },
  required: ['id', 'name', 'prefix', 'scopes', 'isActive', 'createdAt'],
};

export async function keysRoutes(fastify: FastifyInstance, opts: KeysRoutesOptions): Promise<void> {
  const { createApiKeyUseCase, listApiKeysUseCase, revokeApiKeyUseCase, getApiKeyUseCase, rotateApiKeyUseCase } = opts;

  const verifyJWT = (fastify as any).verifyJWT;
  const verifyAuth = (fastify as any).verifyAuth;
  const requireScope = (fastify as any).requireScope;

  // ── POST /keys ─────────────────────────────────────────────────────
  fastify.post('/', {
    schema: {
      tags: ['API Keys'],
      summary: 'Create API key',
      description: 'Create a new API key. The raw key (`sk-live-...`) is returned **once** and never stored in plaintext. Optionally restrict to specific scopes. JWT required.',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 64, description: 'Human-readable label for the key' },
          scopes: {
            ...ScopesProperty,
            default: [],
          },
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
            scopes: ScopesProperty,
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'key', 'prefix', 'scopes', 'createdAt'],
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
      description: 'List all API keys for the authenticated user. Raw keys are never returned. Requires `keys:read` scope when using an API key.',
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
        403: ErrorResponse,
      },
    },
    preHandler: [verifyAuth, requireScope('keys:read')],
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
      description: 'Retrieve metadata for a single API key by ID. Raw key is never returned. Requires `keys:read` scope when using an API key.',
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
    preHandler: [verifyAuth, requireScope('keys:read')],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      const result = await getApiKeyUseCase.execute(userId, id);
      return reply.status(HTTP_STATUS.OK).send(result);
    },
  });

  // ── POST /keys/:id/rotate ──────────────────────────────────────────
  fastify.post('/:id/rotate', {
    schema: {
      tags: ['API Keys'],
      summary: 'Rotate API key',
      description: 'Issue a new key value for an existing API key record. The old key is immediately invalidated. The new raw key is returned **once** — store it securely. JWT required.',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'API key ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            key: { type: 'string', description: 'New raw key — shown once, store securely' },
            prefix: { type: 'string' },
            scopes: ScopesProperty,
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'key', 'prefix', 'scopes', 'createdAt'],
        },
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
    preHandler: [verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      const result = await rotateApiKeyUseCase.execute(userId, id);
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
