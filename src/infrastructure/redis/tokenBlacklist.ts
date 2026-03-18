import type Redis from 'ioredis';
import { REDIS_PREFIX } from '../../shared/constants/index.js';

export class TokenBlacklist {
  constructor(private readonly redis: Redis) {}

  async isBlacklisted(jti: string): Promise<boolean> {
    const exists = await this.redis.exists(`${REDIS_PREFIX.BLACKLIST}${jti}`);
    return exists === 1;
  }

  async blacklist(jti: string, ttlSeconds: number): Promise<void> {
    await this.redis.setex(`${REDIS_PREFIX.BLACKLIST}${jti}`, ttlSeconds, '1');
  }
}
