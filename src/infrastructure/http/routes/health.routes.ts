import type { FastifyInstance } from 'fastify';
import { pingDB } from '../../db/prisma.js';
import { pingRedis } from '../../redis/RedisClient.js';
import { HTTP_STATUS } from '../../../shared/constants/index.js';
import { env } from '../../../shared/config/env.js';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /health (liveness) ─────────────────────────────────────────
  fastify.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness check',
      description: 'Returns 200 if the process is alive.',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok'] },
            service: { type: 'string' },
            version: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    return reply.status(HTTP_STATUS.OK).send({
      status: 'ok',
      service: env.OTEL_SERVICE_NAME,
      version: env.OTEL_SERVICE_VERSION,
      timestamp: new Date().toISOString(),
    });
  });

  // ── GET /health/ready (readiness) ─────────────────────────────────
  fastify.get('/health/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness check',
      description: 'Returns 200 if the API can serve traffic (DB + Redis reachable).',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ready'] },
            checks: {
              type: 'object',
              properties: {
                database: { type: 'string', enum: ['ok', 'error'] },
                redis: { type: 'string', enum: ['ok', 'error'] },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['not_ready'] },
            checks: {
              type: 'object',
              properties: {
                database: { type: 'string', enum: ['ok', 'error'] },
                redis: { type: 'string', enum: ['ok', 'error'] },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const [dbOk, redisOk] = await Promise.all([pingDB(), pingRedis()]);

    const checks = {
      database: dbOk ? 'ok' : 'error',
      redis: redisOk ? 'ok' : 'error',
    };

    const allHealthy = dbOk && redisOk;
    const statusCode = allHealthy ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;

    return reply.status(statusCode).send({
      status: allHealthy ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}
