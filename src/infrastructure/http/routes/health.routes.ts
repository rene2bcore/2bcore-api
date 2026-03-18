import type { FastifyInstance } from 'fastify';
import { pingDB } from '../../db/prisma.js';
import { pingRedis } from '../../redis/RedisClient.js';
import { HTTP_STATUS } from '../../../shared/constants/index.js';
import { env } from '../../../shared/config/env.js';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /health (liveness) ─────────────────────────────────────────
  fastify.get('/health', async (_request, reply) => {
    return reply.status(HTTP_STATUS.OK).send({
      status: 'ok',
      service: env.OTEL_SERVICE_NAME,
      version: env.OTEL_SERVICE_VERSION,
      timestamp: new Date().toISOString(),
    });
  });

  // ── GET /health/ready (readiness) ─────────────────────────────────
  fastify.get('/health/ready', async (_request, reply) => {
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
