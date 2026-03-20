import type { FastifyInstance } from 'fastify';
import { CreateWebhookEndpointUseCase } from '../../../application/use-cases/webhooks/createEndpoint.js';
import { ListWebhookEndpointsUseCase } from '../../../application/use-cases/webhooks/listEndpoints.js';
import { GetWebhookEndpointUseCase } from '../../../application/use-cases/webhooks/getEndpoint.js';
import { UpdateWebhookEndpointUseCase } from '../../../application/use-cases/webhooks/updateEndpoint.js';
import { DeleteWebhookEndpointUseCase } from '../../../application/use-cases/webhooks/deleteEndpoint.js';
import { ListWebhookDeliveriesUseCase } from '../../../application/use-cases/webhooks/listDeliveries.js';
import { RotateWebhookSecretUseCase } from '../../../application/use-cases/webhooks/rotateSecret.js';
import { CreateWebhookInputSchema, UpdateWebhookInputSchema } from '../../../application/dtos/webhook.dto.js';
import { HTTP_STATUS, ALL_WEBHOOK_EVENTS } from '../../../shared/constants/index.js';

interface WebhookRoutesOptions {
  createEndpointUseCase: CreateWebhookEndpointUseCase;
  listEndpointsUseCase: ListWebhookEndpointsUseCase;
  getEndpointUseCase: GetWebhookEndpointUseCase;
  updateEndpointUseCase: UpdateWebhookEndpointUseCase;
  deleteEndpointUseCase: DeleteWebhookEndpointUseCase;
  listDeliveriesUseCase: ListWebhookDeliveriesUseCase;
  rotateSecretUseCase: RotateWebhookSecretUseCase;
}

const ErrorResponse = { $ref: 'ErrorResponse#' };

const EventsProperty = {
  type: 'array',
  items: { type: 'string', enum: ALL_WEBHOOK_EVENTS },
  description: 'Events to subscribe to. Empty array = all events (wildcard).',
};

const EndpointPublic = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    url: { type: 'string' },
    events: EventsProperty,
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'userId', 'url', 'events', 'isActive', 'createdAt', 'updatedAt'],
};

const DeliverySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    endpointId: { type: 'string' },
    eventType: { type: 'string' },
    payload: { type: 'object', additionalProperties: true },
    statusCode: { type: ['integer', 'null'] },
    responseBody: { type: ['string', 'null'] },
    attempt: { type: 'integer' },
    success: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'endpointId', 'eventType', 'payload', 'attempt', 'success', 'createdAt'],
};

export async function webhookRoutes(fastify: FastifyInstance, opts: WebhookRoutesOptions): Promise<void> {
  const {
    createEndpointUseCase,
    listEndpointsUseCase,
    getEndpointUseCase,
    updateEndpointUseCase,
    deleteEndpointUseCase,
    listDeliveriesUseCase,
    rotateSecretUseCase,
  } = opts;

  const verifyJWT = (fastify as any).verifyJWT;

  // ── POST /webhooks ─────────────────────────────────────────────────
  fastify.post('/', {
    schema: {
      tags: ['Webhooks'],
      summary: 'Register webhook endpoint',
      description: 'Register a new webhook endpoint. The `secret` is returned **once** — store it securely to verify HMAC-SHA256 signatures. JWT required.',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri', maxLength: 2048, description: 'HTTPS URL to receive webhook POSTs' },
          events: {
            ...EventsProperty,
            default: [],
          },
        },
      },
      response: {
        201: {
          allOf: [
            EndpointPublic,
            {
              type: 'object',
              properties: {
                secret: { type: 'string', description: 'HMAC signing secret — shown once, store securely' },
              },
              required: ['secret'],
            },
          ],
        },
        401: ErrorResponse,
        422: ErrorResponse,
      },
    },
    preHandler: [verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const body = CreateWebhookInputSchema.parse(request.body);
      const result = await createEndpointUseCase.execute(userId, body);
      return reply.status(HTTP_STATUS.CREATED).send({
        ...result,
        createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : result.createdAt,
        updatedAt: result.updatedAt instanceof Date ? result.updatedAt.toISOString() : result.updatedAt,
      });
    },
  });

  // ── GET /webhooks ──────────────────────────────────────────────────
  fastify.get('/', {
    schema: {
      tags: ['Webhooks'],
      summary: 'List webhook endpoints',
      description: 'List all registered webhook endpoints for the authenticated user. Secrets are never returned after creation. JWT required.',
      security: [{ BearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: EndpointPublic },
          },
          required: ['data'],
        },
        401: ErrorResponse,
      },
    },
    preHandler: [verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const endpoints = await listEndpointsUseCase.execute(userId);
      return reply.status(HTTP_STATUS.OK).send({
        data: endpoints.map((ep) => ({
          ...ep,
          createdAt: ep.createdAt instanceof Date ? ep.createdAt.toISOString() : ep.createdAt,
          updatedAt: ep.updatedAt instanceof Date ? ep.updatedAt.toISOString() : ep.updatedAt,
        })),
      });
    },
  });

  // ── GET /webhooks/:id ──────────────────────────────────────────────
  fastify.get('/:id', {
    schema: {
      tags: ['Webhooks'],
      summary: 'Get webhook endpoint',
      description: 'Retrieve a single webhook endpoint by ID. JWT required.',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        200: EndpointPublic,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
    preHandler: [verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      const ep = await getEndpointUseCase.execute(userId, id);
      return reply.status(HTTP_STATUS.OK).send({
        ...ep,
        createdAt: ep.createdAt instanceof Date ? ep.createdAt.toISOString() : ep.createdAt,
        updatedAt: ep.updatedAt instanceof Date ? ep.updatedAt.toISOString() : ep.updatedAt,
      });
    },
  });

  // ── PATCH /webhooks/:id ────────────────────────────────────────────
  fastify.patch('/:id', {
    schema: {
      tags: ['Webhooks'],
      summary: 'Update webhook endpoint',
      description: 'Update URL, events, or active status of a webhook endpoint. JWT required.',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri', maxLength: 2048 },
          events: EventsProperty,
          isActive: { type: 'boolean' },
        },
      },
      response: {
        200: EndpointPublic,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        422: ErrorResponse,
      },
    },
    preHandler: [verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      const body = UpdateWebhookInputSchema.parse(request.body);
      const ep = await updateEndpointUseCase.execute(userId, id, body);
      return reply.status(HTTP_STATUS.OK).send({
        ...ep,
        createdAt: ep.createdAt instanceof Date ? ep.createdAt.toISOString() : ep.createdAt,
        updatedAt: ep.updatedAt instanceof Date ? ep.updatedAt.toISOString() : ep.updatedAt,
      });
    },
  });

  // ── DELETE /webhooks/:id ───────────────────────────────────────────
  fastify.delete('/:id', {
    schema: {
      tags: ['Webhooks'],
      summary: 'Delete webhook endpoint',
      description: 'Permanently delete a webhook endpoint and all its delivery history. JWT required.',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        204: { type: 'null', description: 'Endpoint deleted' },
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
    preHandler: [verifyJWT],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      await deleteEndpointUseCase.execute(userId, id);
      return reply.status(HTTP_STATUS.NO_CONTENT).send();
    },
  });

  // ── POST /webhooks/:id/rotate-secret ──────────────────────────────
  fastify.post('/:id/rotate-secret', {
    schema: {
      tags: ['Webhooks'],
      summary: 'Rotate webhook signing secret',
      description: 'Generate a new HMAC signing secret for a webhook endpoint. The new secret is returned **once** — update your receiver immediately. JWT required.',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        200: {
          allOf: [
            EndpointPublic,
            {
              type: 'object',
              properties: {
                secret: { type: 'string', description: 'New HMAC signing secret — shown once, store securely' },
              },
              required: ['secret'],
            },
          ],
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
      const result = await rotateSecretUseCase.execute(userId, id);
      return reply.status(HTTP_STATUS.OK).send({
        ...result,
        createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : result.createdAt,
        updatedAt: result.updatedAt instanceof Date ? result.updatedAt.toISOString() : result.updatedAt,
      });
    },
  });

  // ── GET /webhooks/:id/deliveries ───────────────────────────────────
  fastify.get('/:id/deliveries', {
    schema: {
      tags: ['Webhooks'],
      summary: 'List webhook deliveries',
      description: 'List recent delivery attempts for a webhook endpoint. Returns up to 50 most recent. JWT required.',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: DeliverySchema },
          },
          required: ['data'],
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
      const { limit } = (request.query as { limit?: number });
      const deliveries = await listDeliveriesUseCase.execute(userId, id, limit);
      return reply.status(HTTP_STATUS.OK).send({
        data: deliveries.map((d) => ({
          ...d,
          createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
        })),
      });
    },
  });
}
