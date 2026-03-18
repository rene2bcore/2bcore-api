import { buildApp, type AppOverrides } from '../../../src/interfaces/http/app.js';
import { connectDB } from '../../../src/infrastructure/db/prisma.js';
import { connectRedis } from '../../../src/infrastructure/redis/RedisClient.js';
import type { FastifyInstance } from 'fastify';

export type TestApp = FastifyInstance;

export async function createTestApp(overrides?: AppOverrides): Promise<TestApp> {
  await connectDB();
  await connectRedis();
  const app = await buildApp(overrides);
  await app.ready();
  return app;
}

export async function closeTestApp(app: TestApp): Promise<void> {
  try {
    await app.close();
  } catch (err) {
    console.warn('[test] closeTestApp error (non-fatal):', err);
  }
}
