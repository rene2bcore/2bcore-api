import { readFileSync } from 'fs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../shared/config/env.js';
import { sha256, randomHex } from '../../shared/utils/crypto.js';
import {
  TokenExpiredError,
  TokenRevokedError,
  UnauthorizedError,
} from '../../domain/errors/index.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Cookie value: `<sessionId>.<refreshToken>` */
  refreshCookie: string;
  sessionId: string;
  accessExpiresIn: number;
}

export interface AccessTokenPayload {
  sub: string;      // userId
  email: string;
  role: string;
  jti: string;      // JWT ID for blacklisting
  sid: string;      // session ID for per-session revocation
  iat: number;
  exp: number;
}

export interface SessionMeta {
  createdAt: number;
  expiresAt: number;
  ipAddress?: string;
  userAgent?: string;
}

interface ITokenBlacklist {
  isBlacklisted(jti: string): Promise<boolean>;
  blacklist(jti: string, ttlSeconds: number): Promise<void>;
}

interface IRefreshTokenStore {
  store(userId: string, sessionId: string, meta: {
    tokenHash: string;
    createdAt: number;
    expiresAt: number;
    ipAddress?: string;
    userAgent?: string;
  }, ttlSeconds: number): Promise<void>;
  verify(userId: string, sessionId: string, tokenHash: string): Promise<boolean>;
  revokeSession(userId: string, sessionId: string): Promise<void>;
  revokeAll(userId: string): Promise<void>;
  listSessions(userId: string): Promise<Array<{ sessionId: string; createdAt: number; expiresAt: number; ipAddress?: string; userAgent?: string }>>;
}

export class AuthService {
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly accessExpiresIn = 15 * 60;          // 15 minutes
  private readonly refreshExpiresIn = 7 * 24 * 60 * 60; // 7 days

  constructor(
    private readonly blacklist: ITokenBlacklist,
    private readonly refreshStore: IRefreshTokenStore,
  ) {
    this.privateKey = readFileSync(env.JWT_PRIVATE_KEY_PATH, 'utf8');
    this.publicKey = readFileSync(env.JWT_PUBLIC_KEY_PATH, 'utf8');
  }

  async issueTokenPair(
    userId: string,
    email: string,
    role: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<TokenPair> {
    const sessionId = uuidv4();
    const jti = uuidv4();
    const now = Date.now();
    const expiresAt = now + this.refreshExpiresIn * 1000;

    const accessToken = jwt.sign(
      { sub: userId, email, role, jti, sid: sessionId },
      this.privateKey,
      {
        algorithm: 'RS256',
        expiresIn: this.accessExpiresIn,
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      },
    );

    const refreshToken = randomHex(48);
    const refreshHash = sha256(refreshToken);

    await this.refreshStore.store(userId, sessionId, {
      tokenHash: refreshHash,
      createdAt: now,
      expiresAt,
      ...(meta.ipAddress !== undefined && { ipAddress: meta.ipAddress }),
      ...(meta.userAgent !== undefined && { userAgent: meta.userAgent }),
    }, this.refreshExpiresIn);

    return {
      accessToken,
      refreshToken,
      refreshCookie: `${sessionId}.${refreshToken}`,
      sessionId,
      accessExpiresIn: this.accessExpiresIn,
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    let payload: AccessTokenPayload;

    try {
      payload = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      }) as AccessTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) throw new TokenExpiredError();
      throw new UnauthorizedError();
    }

    const revoked = await this.blacklist.isBlacklisted(payload.jti);
    if (revoked) throw new TokenRevokedError();

    return payload;
  }

  async revokeAccessToken(token: string): Promise<void> {
    let payload: AccessTokenPayload;
    try {
      payload = jwt.decode(token) as AccessTokenPayload;
    } catch {
      return;
    }
    if (!payload?.jti || !payload?.exp) return;

    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.blacklist.blacklist(payload.jti, ttl);
    }
  }

  /** Verify and rotate a specific session's refresh token. Returns the sessionId. */
  async verifyRefreshToken(userId: string, sessionId: string, refreshToken: string): Promise<boolean> {
    const hash = sha256(refreshToken);
    return this.refreshStore.verify(userId, sessionId, hash);
  }

  /** Revoke a single session (logout current session). */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.refreshStore.revokeSession(userId, sessionId);
  }

  /** Revoke all sessions for a user (password reset, account deletion, admin deactivation). */
  async revokeRefreshToken(userId: string): Promise<void> {
    await this.refreshStore.revokeAll(userId);
  }

  /** List active sessions for a user. */
  async listSessions(userId: string): Promise<Array<{ sessionId: string; createdAt: number; expiresAt: number; ipAddress?: string; userAgent?: string }>> {
    return this.refreshStore.listSessions(userId);
  }

  /** Parse cookie value of format `<sessionId>.<refreshToken>`. Returns null if malformed. */
  parseRefreshCookie(cookieValue: string): { sessionId: string; refreshToken: string } | null {
    const dotIndex = cookieValue.indexOf('.');
    if (dotIndex < 1) return null;
    const sessionId = cookieValue.slice(0, dotIndex);
    const refreshToken = cookieValue.slice(dotIndex + 1);
    if (!sessionId || !refreshToken) return null;
    return { sessionId, refreshToken };
  }
}
