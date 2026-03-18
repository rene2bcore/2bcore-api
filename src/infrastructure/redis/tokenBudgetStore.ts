import type Redis from 'ioredis';
import { REDIS_PREFIX } from '../../shared/constants/index.js';

// 33 days — safely covers any month and auto-expires stale keys
const MONTHLY_BUDGET_TTL_SECONDS = 33 * 24 * 60 * 60;

export class TokenBudgetStore {
  constructor(private readonly redis: Redis) {}

  private key(userId: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${REDIS_PREFIX.TOKEN_BUDGET}${userId}:${year}-${month}`;
  }

  async increment(userId: string, tokens: number): Promise<number> {
    const key = this.key(userId);
    const pipeline = this.redis.pipeline();
    pipeline.incrby(key, tokens);
    pipeline.expire(key, MONTHLY_BUDGET_TTL_SECONDS);
    const results = await pipeline.exec();
    return (results?.[0]?.[1] as number) ?? 0;
  }

  async getMonthlyUsage(userId: string): Promise<number> {
    const value = await this.redis.get(this.key(userId));
    return value ? parseInt(value, 10) : 0;
  }
}
