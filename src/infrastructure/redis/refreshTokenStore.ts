import type Redis from 'ioredis';
import { REDIS_PREFIX } from '../../shared/constants/index.js';

export class RefreshTokenStore {
  constructor(private readonly redis: Redis) {}

  private key(userId: string): string {
    return `${REDIS_PREFIX.REFRESH}${userId}`;
  }

  async store(userId: string, tokenHash: string, ttlSeconds: number): Promise<void> {
    await this.redis.setex(this.key(userId), ttlSeconds, tokenHash);
  }

  async verify(userId: string, tokenHash: string): Promise<boolean> {
    const stored = await this.redis.get(this.key(userId));
    return stored === tokenHash;
  }

  async revoke(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }
}
