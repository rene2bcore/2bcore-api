import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, closeTestApp, type TestApp } from './helpers/app.helper.js';
import { seedTestUser, cleanupIntegrationData, verifyUserEmail, TEST_EMAIL_DOMAIN } from './helpers/db.helper.js';
import { v4 as uuidv4 } from 'uuid';

// ── Test suite ───────────────────────────────────────────────────────────────

describe('Users routes', () => {
  let app: TestApp;

  async function register(email: string, password = 'SecureP@ss1') {
    return app.inject({ method: 'POST', url: '/v1/users', payload: { email, password } });
  }

  /** Register, verify email, then login — returns the access token. */
  async function registerAndLogin(email: string, password = 'SecureP@ss1'): Promise<string> {
    await register(email, password);
    await verifyUserEmail(email);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    });
    return res.json().accessToken as string;
  }

  async function login(email: string, password = 'SecureP@ss1'): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    });
    return res.json().accessToken as string;
  }

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

    it('returns 403 AUTH_007 when logging in without email verification', async () => {
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

      expect(loginRes.statusCode).toBe(403);
      expect(loginRes.json().code).toBe('AUTH_007');
    });

    it('allows login after email verification', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const password = 'SecureP@ss1';

      await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: { email, password },
      });
      await verifyUserEmail(email);

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

  // ── GET /v1/users/me ────────────────────────────────────────────────

  describe('GET /v1/users/me', () => {
    it('returns 200 with the authenticated user profile', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const token = await registerAndLogin(email);

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.email).toBe(email);
      expect(body.role).toBe('USER');
      expect(body.isActive).toBe(true);
      expect(body).not.toHaveProperty('passwordHash');
    });

    it('works with an API key', async () => {
      const seeded = await seedTestUser();
      const token = await login(seeded.user.email, seeded.password);

      const keyRes = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'me-test-key' },
      });
      const apiKey = keyRes.json().key as string;

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: { 'x-api-key': apiKey },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().email).toBe(seeded.user.email);
    });

    it('returns 401 without credentials', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/users/me' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── PATCH /v1/users/me ──────────────────────────────────────────────

  describe('PATCH /v1/users/me', () => {
    it('returns 200 and updated email', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const newEmail = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const token = await registerAndLogin(email);

      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: newEmail },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().email).toBe(newEmail);
    });

    it('allows login with updated email', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const newEmail = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const token = await registerAndLogin(email);

      await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: newEmail },
      });

      const loginRes = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: newEmail, password: 'SecureP@ss1' },
      });
      expect(loginRes.statusCode).toBe(200);
    });

    it('returns 200 and allows login with new password', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const token = await registerAndLogin(email);

      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { currentPassword: 'SecureP@ss1', newPassword: 'NewP@ss123!' },
      });
      expect(res.statusCode).toBe(200);

      const loginRes = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email, password: 'NewP@ss123!' },
      });
      expect(loginRes.statusCode).toBe(200);
    });

    it('returns 409 USR_001 when new email is already taken', async () => {
      const emailA = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const emailB = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      await register(emailB);
      const token = await registerAndLogin(emailA);

      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: emailB },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('USR_001');
    });

    it('returns 401 AUTH_001 when currentPassword is wrong', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const token = await registerAndLogin(email);

      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { currentPassword: 'WrongPass!1', newPassword: 'NewP@ss123!' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('AUTH_001');
    });

    it('returns 422 VAL_001 when newPassword is missing currentPassword', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const token = await registerAndLogin(email);

      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { newPassword: 'NewP@ss123!' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 422 VAL_001 when body is empty', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const token = await registerAndLogin(email);

      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 401 without credentials', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        payload: { email: 'any@example.com' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when called with an API key (JWT only)', async () => {
      const seeded = await seedTestUser();
      const token = await login(seeded.user.email, seeded.password);

      const keyRes = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'patch-me-key' },
      });
      const apiKey = keyRes.json().key as string;

      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        headers: { 'x-api-key': apiKey },
        payload: { email: `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}` },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── DELETE /v1/users/me ─────────────────────────────────────────────

  describe('DELETE /v1/users/me', () => {
    it('returns 204 and deletes the account', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const token = await registerAndLogin(email);

      const res = await app.inject({
        method: 'DELETE',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { password: 'SecureP@ss1' },
      });
      expect(res.statusCode).toBe(204);
    });

    it('cannot login after deletion', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const token = await registerAndLogin(email);

      await app.inject({
        method: 'DELETE',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { password: 'SecureP@ss1' },
      });

      const loginRes = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email, password: 'SecureP@ss1' },
      });
      expect(loginRes.statusCode).toBe(401);
    });

    it('access token is revoked after deletion', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const token = await registerAndLogin(email);

      await app.inject({
        method: 'DELETE',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { password: 'SecureP@ss1' },
      });

      const meRes = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(meRes.statusCode).toBe(401);
    });

    it('returns 401 AUTH_001 when password is wrong', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const token = await registerAndLogin(email);

      const res = await app.inject({
        method: 'DELETE',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { password: 'WrongPassword!1' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('AUTH_001');
    });

    it('returns 422 VAL_001 when password is missing', async () => {
      const email = `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
      const token = await registerAndLogin(email);

      const res = await app.inject({
        method: 'DELETE',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 401 without credentials', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/v1/users/me',
        payload: { password: 'SecureP@ss1' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when called with an API key (JWT only)', async () => {
      const seeded = await seedTestUser();
      const token = await login(seeded.user.email, seeded.password);

      const keyRes = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'delete-me-key' },
      });
      const apiKey = keyRes.json().key as string;

      const res = await app.inject({
        method: 'DELETE',
        url: '/v1/users/me',
        headers: { 'x-api-key': apiKey },
        payload: { password: seeded.password },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
