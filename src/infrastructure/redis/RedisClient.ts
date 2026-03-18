import Redis from 'ioredis';
import { env } from '../../shared/config/env.js';
import { logger } from '../observability/logger.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnecting');
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => logger.info('Redis connected'));
    redisClient.on('error', (err) => logger.error({ err }, 'Redis error'));
    redisClient.on('close', () => logger.warn('Redis connection closed'));
  }
  return redisClient;
}

export async function connectRedis(): Promise<void> {
  await getRedisClient().connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export async function pingRedis(): Promise<boolean> {
  try {
    const res = await getRedisClient().ping();
    return res === 'PONG';
  } catch {
    return false;
  }
}
