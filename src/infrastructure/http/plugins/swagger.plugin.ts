import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export const swaggerPlugin = fp(async (fastify: FastifyInstance) => {
  // ── Shared reusable schemas ──────────────────────────────────────────
  fastify.addSchema({
    $id: 'ErrorResponse',
    type: 'object',
    properties: {
      statusCode: { type: 'number' },
      error: { type: 'string' },
      code: { type: 'string' },
      message: { type: 'string' },
    },
  });

  fastify.addSchema({
    $id: 'UserPublic',
    type: 'object',
    properties: {
      id: { type: 'string' },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['USER', 'ADMIN'] },
      isActive: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'email', 'role', 'isActive', 'createdAt'],
  });

  // ── OpenAPI spec ───────────────────────────────────────────────────
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: '2BCORE API',
        description:
          'AI-first engine API — authentication, API key management, and AI chat with streaming.',
        version: '1.0.0',
        contact: { name: '2BCORE', email: 'dev@2bcore.io' },
      },
      servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT access token issued by POST /v1/auth/login',
          },
          ApiKeyHeader: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key',
            description: 'API key (sk-live-...) created via POST /v1/keys',
          },
        },
      },
      tags: [
        { name: 'Health', description: 'Liveness and readiness probes' },
        { name: 'Auth', description: 'JWT authentication and token management' },
        { name: 'Users', description: 'User registration and profile management' },
        { name: 'API Keys', description: 'Machine-to-machine API key management' },
        { name: 'AI', description: 'AI chat completions with streaming support' },
        { name: 'Admin', description: 'Admin-only endpoints for user and billing management' },
      ],
    },
  });

  // ── Swagger UI ─────────────────────────────────────────────────────
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true,
    },
    staticCSP: true,
  });
});
