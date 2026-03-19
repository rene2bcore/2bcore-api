import type Redis from 'ioredis';
import { REDIS_PREFIX } from '../../shared/constants/index.js';

export interface SessionMeta {
  tokenHash: string;
  createdAt: number;   // Unix ms
  expiresAt: number;   // Unix ms
  ipAddress?: string;
  userAgent?: string;
}

export class RefreshTokenStore {
  constructor(private readonly redis: Redis) {}

  /** Hash key that stores all sessions for a user. */
  private key(userId: string): string {
    return `${REDIS_PREFIX.REFRESH}${userId}`;
  }

  /** Store a single session under userId → sessionId. */
  async store(
    userId: string,
    sessionId: string,
    meta: SessionMeta,
    ttlSeconds: number,
  ): Promise<void> {
    const hashKey = this.key(userId);
    await this.redis.hset(hashKey, sessionId, JSON.stringify(meta));
    // Extend overall key TTL to at least the longest session
    await this.redis.expire(hashKey, ttlSeconds);
  }

  /** Verify a specific session's token hash. Returns false if session not found. */
  async verify(userId: string, sessionId: string, tokenHash: string): Promise<boolean> {
    const raw = await this.redis.hget(this.key(userId), sessionId);
    if (!raw) return false;
    const meta: SessionMeta = JSON.parse(raw);
    if (Date.now() > meta.expiresAt) {
      // Lazy cleanup of expired session
      await this.redis.hdel(this.key(userId), sessionId);
      return false;
    }
    return meta.tokenHash === tokenHash;
  }

  /** Revoke a single session. */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.redis.hdel(this.key(userId), sessionId);
  }

  /** Revoke all sessions for a user. */
  async revokeAll(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }

  /** List all active sessions for a user. */
  async listSessions(userId: string): Promise<Array<{ sessionId: string } & Omit<SessionMeta, 'tokenHash'>>> {
    const all = await this.redis.hgetall(this.key(userId));
    if (!all) return [];

    const now = Date.now();
    const sessions: Array<{ sessionId: string } & Omit<SessionMeta, 'tokenHash'>> = [];

    for (const [sessionId, raw] of Object.entries(all)) {
      const meta: SessionMeta = JSON.parse(raw);
      if (meta.expiresAt > now) {
        const { tokenHash: _, ...rest } = meta;
        sessions.push({ sessionId, ...rest });
      }
    }

    return sessions;
  }

  // ── Backward compatibility (single-session callers) ───────────────

  /** @deprecated Use store(userId, sessionId, meta, ttl) for multi-session support. */
  async revoke(userId: string): Promise<void> {
    return this.revokeAll(userId);
  }
}
