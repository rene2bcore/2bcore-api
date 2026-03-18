// Tracing must be initialized BEFORE any other imports that instrument code
import { initTracing, shutdownTracing } from '../../infrastructure/observability/tracing.js';
initTracing();

import { buildApp } from './app.js';
import { env } from '../../shared/config/env.js';
import { logger } from '../../infrastructure/observability/logger.js';
import { connectDB, disconnectDB } from '../../infrastructure/db/prisma.js';
import { connectRedis, disconnectRedis } from '../../infrastructure/redis/RedisClient.js';

async function main(): Promise<void> {
  // Connect to external services before starting HTTP server
  await connectDB();
  await connectRedis();

  const app = await buildApp();

  const address = await app.listen({ port: env.PORT, host: env.HOST });
  logger.info({ address, env: env.NODE_ENV }, '2BCORE API server started');

  // ── Graceful shutdown ──────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully...');
    try {
      await app.close();
      await disconnectDB();
      await disconnectRedis();
      await shutdownTracing();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
