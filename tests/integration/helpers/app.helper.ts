import { buildApp } from '../../../src/interfaces/http/app.js';
import { connectDB } from '../../../src/infrastructure/db/prisma.js';
import { connectRedis } from '../../../src/infrastructure/redis/RedisClient.js';
import type { FastifyInstance } from 'fastify';

export type TestApp = FastifyInstance;

export async function createTestApp(): Promise<TestApp> {
  await connectDB();
  await connectRedis();
  const app = await buildApp();
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
