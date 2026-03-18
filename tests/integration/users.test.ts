import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, closeTestApp, type TestApp } from './helpers/app.helper.js';
import { cleanupIntegrationData, TEST_EMAIL_DOMAIN } from './helpers/db.helper.js';
import { v4 as uuidv4 } from 'uuid';

// ── Test suite ───────────────────────────────────────────────────────────────

describe('Users routes', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
    await cleanupIntegrationData();
  });

  // ── POST /v1/users ─────────────────────────────────────────────────

  describe('POST /v1/users', () => {
    it('returns 201 with public user on valid registration', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const res = await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: { email, password: 'SecureP@ss1' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeTypeOf('string');
      expect(body.email).toBe(email);
      expect(body.role).toBe('USER');
      expect(body.isActive).toBe(true);
      expect(body.createdAt).toBeTypeOf('string');
    });

    it('does not expose passwordHash in response', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: { email: `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`, password: 'SecureP@ss1' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).not.toHaveProperty('passwordHash');
    });

    it('allows login with registered credentials', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const password = 'SecureP@ss1';

      await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: { email, password },
      });

      const loginRes = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email, password },
      });

      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.json().accessToken).toBeTypeOf('string');
    });

    it('returns 409 USR_001 when email is already registered', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const payload = { email, password: 'SecureP@ss1' };

      await app.inject({ method: 'POST', url: '/v1/users', payload });

      const res = await app.inject({ method: 'POST', url: '/v1/users', payload });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('USR_001');
    });

    it('returns 422 VAL_001 when email is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: { email: 'not-an-email', password: 'SecureP@ss1' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 422 VAL_001 when password is too short', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: { email: `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`, password: 'Short1!' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 422 VAL_001 when password has no uppercase', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: { email: `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`, password: 'nouppercase1!' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 422 VAL_001 when password has no number', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: { email: `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`, password: 'NoNumber!!' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 422 VAL_001 when password has no special character', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: { email: `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`, password: 'NoSpecial1' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 422 VAL_001 when body is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: {},
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });
  });
});
