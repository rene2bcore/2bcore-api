import { readFileSync } from 'fs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../shared/config/env.js';
import { sha256, randomHex } from '../../shared/utils/crypto.js';
import { REDIS_PREFIX } from '../../shared/constants/index.js';
import {
  TokenExpiredError,
  TokenRevokedError,
  UnauthorizedError,
} from '../../domain/errors/index.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
}

export interface AccessTokenPayload {
  sub: string;   // userId
  email: string;
  role: string;
  jti: string;   // JWT ID for blacklisting
  iat: number;
  exp: number;
}

interface ITokenBlacklist {
  isBlacklisted(jti: string): Promise<boolean>;
  blacklist(jti: string, ttlSeconds: number): Promise<void>;
}

interface IRefreshTokenStore {
  store(userId: string, tokenHash: string, ttlSeconds: number): Promise<void>;
  verify(userId: string, tokenHash: string): Promise<boolean>;
  revoke(userId: string): Promise<void>;
}

export class AuthService {
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly accessExpiresIn = 15 * 60; // 15 minutes in seconds
  private readonly refreshExpiresIn = 7 * 24 * 60 * 60; // 7 days

  constructor(
    private readonly blacklist: ITokenBlacklist,
    private readonly refreshStore: IRefreshTokenStore,
  ) {
    this.privateKey = readFileSync(env.JWT_PRIVATE_KEY_PATH, 'utf8');
    this.publicKey = readFileSync(env.JWT_PUBLIC_KEY_PATH, 'utf8');
  }

  async issueTokenPair(userId: string, email: string, role: string): Promise<TokenPair> {
    const jti = uuidv4();

    const accessToken = jwt.sign(
      { sub: userId, email, role, jti },
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

    await this.refreshStore.store(userId, refreshHash, this.refreshExpiresIn);

    return { accessToken, refreshToken, accessExpiresIn: this.accessExpiresIn };
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
      return; // Cannot decode — nothing to revoke
    }
    if (!payload?.jti || !payload?.exp) return;

    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.blacklist.blacklist(payload.jti, ttl);
    }
  }

  async rotateRefreshToken(userId: string, oldRefreshToken: string): Promise<TokenPair & { email: string; role: string }> {
    const oldHash = sha256(oldRefreshToken);
    const valid = await this.refreshStore.verify(userId, oldHash);
    if (!valid) throw new TokenRevokedError();

    // Revoke old refresh token before issuing new (rotation)
    await this.refreshStore.revoke(userId);

    // Caller must provide user context to re-issue
    return { accessToken: '', refreshToken: '', accessExpiresIn: 0, email: '', role: '' };
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    await this.refreshStore.revoke(userId);
  }

  async verifyRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const hash = sha256(refreshToken);
    return this.refreshStore.verify(userId, hash);
  }

  getRefreshTokenKey(userId: string): string {
    return `${REDIS_PREFIX.REFRESH}${userId}`;
  }
}
