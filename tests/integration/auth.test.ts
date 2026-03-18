import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPrismaClient } from '../../src/infrastructure/db/prisma.js';
import { createTestApp, closeTestApp, type TestApp } from './helpers/app.helper.js';
import { seedTestUser, cleanupIntegrationData, type SeedUserResult } from './helpers/db.helper.js';
import { extractRefreshCookie, cookiesFor } from './helpers/cookie.helper.js';

describe('Auth routes', () => {
  let app: TestApp;
  let active: SeedUserResult;
  let inactive: SeedUserResult;

  beforeAll(async () => {
    app = await createTestApp();
    [active, inactive] = await Promise.all([
      seedTestUser(),
      seedTestUser({ isActive: false }),
    ]);
  });

  afterAll(async () => {
    await closeTestApp(app);
    await cleanupIntegrationData();
  });

  // ── POST /v1/auth/login ──────────────────────────────────────────────

  describe('POST /v1/auth/login', () => {
    it('returns 200 with accessToken and user on valid credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: active.user.email, password: active.password },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.accessToken).toBeTypeOf('string');
      expect(body.tokenType).toBe('Bearer');
      expect(body.expiresIn).toBe(900);
      expect(body.user.id).toBe(active.user.id);
      expect(body.user.email).toBe(active.user.email);
      expect(body.user.role).toBe('USER');
    });

    it('sets HttpOnly refresh_token cookie on successful login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: active.user.email, password: active.password },
      });
      const token = extractRefreshCookie(res);
      expect(token).not.toBeNull();
      const rawCookie = (res.headers['set-cookie'] as string[] | string | undefined);
      const cookieStr = Array.isArray(rawCookie) ? rawCookie.join('; ') : (rawCookie ?? '');
      expect(cookieStr).toMatch(/HttpOnly/i);
      expect(cookieStr).toMatch(/SameSite=Strict/i);
    });

    it('returns 401 AUTH_001 on wrong password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: active.user.email, password: 'WrongPass999!' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('AUTH_001');
    });

    it('returns 401 AUTH_001 on unknown email (same code as wrong password)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'nobody@2bcore.test', password: 'SomePass123!' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('AUTH_001');
    });

    it('returns 422 VAL_001 when email is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { password: 'SomePass123!' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 422 VAL_001 on invalid email format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'not-an-email', password: 'SomePass123!' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 422 VAL_001 when password is too short', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: active.user.email, password: 'short' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 401 AUTH_003 for inactive account', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: inactive.user.email, password: inactive.password },
      });
      expect(res.statusCode).toBe(401);
    });

    it('creates a USER_LOGIN audit log entry in the DB on success', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: active.user.email, password: active.password },
      });
      const prisma = getPrismaClient();
      const log = await prisma.auditLog.findFirst({
        where: { userId: active.user.id, action: 'USER_LOGIN' },
      });
      expect(log).not.toBeNull();
    });
  });

  // ── POST /v1/auth/refresh ────────────────────────────────────────────

  describe('POST /v1/auth/refresh', () => {
    it('returns 200 with new accessToken and rotated refresh cookie', async () => {
      const login = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: active.user.email, password: active.password },
      });
      const oldRefresh = extractRefreshCookie(login)!;

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: cookiesFor(oldRefresh),
        payload: { userId: active.user.id },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.accessToken).toBeTypeOf('string');
      expect(body.tokenType).toBe('Bearer');
      const newRefresh = extractRefreshCookie(res);
      expect(newRefresh).not.toBeNull();
      expect(newRefresh).not.toBe(oldRefresh);
    });

    it('rejects reuse of the old refresh token after rotation (AUTH_004)', async () => {
      const login = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: active.user.email, password: active.password },
      });
      const oldRefresh = extractRefreshCookie(login)!;

      // First refresh — rotates the token
      await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: cookiesFor(oldRefresh),
        payload: { userId: active.user.id },
      });

      // Second refresh with the old token — must fail
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: cookiesFor(oldRefresh),
        payload: { userId: active.user.id },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('AUTH_004');
    });

    it('returns 401 when refresh_token cookie is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { userId: active.user.id },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 422 when userId body field is missing', async () => {
      const login = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: active.user.email, password: active.password },
      });
      const refresh = extractRefreshCookie(login)!;

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: cookiesFor(refresh),
        payload: {},
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 401 for a tampered refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: cookiesFor('totally-fake-token-value'),
        payload: { userId: active.user.id },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /v1/auth/logout ─────────────────────────────────────────────

  describe('POST /v1/auth/logout', () => {
    it('returns 204 and clears the refresh cookie', async () => {
      const login = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: active.user.email, password: active.password },
      });
      const token = login.json().accessToken as string;

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(204);
      // Cookie should be cleared (max-age=0 or empty value)
      const cookie = res.headers['set-cookie'];
      const cookieStr = Array.isArray(cookie) ? cookie.join('; ') : (cookie ?? '');
      expect(cookieStr).toMatch(/refresh_token/);
    });

    it('blacklists the access token — subsequent requests return 401 AUTH_004', async () => {
      const login = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: active.user.email, password: active.password },
      });
      const token = login.json().accessToken as string;

      await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        headers: { authorization: `Bearer ${token}` },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('AUTH_004');
    });

    it('returns 401 AUTH_003 when Authorization header is missing', async () => {
      const res = await app.inject({ method: 'POST', url: '/v1/auth/logout' });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('AUTH_003');
    });

    it('returns 401 on malformed Bearer token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        headers: { authorization: 'Bearer not.a.real.jwt' },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
