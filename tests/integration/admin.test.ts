import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, closeTestApp, type TestApp } from './helpers/app.helper.js';
import { seedTestUser, cleanupIntegrationData, type SeedUserResult } from './helpers/db.helper.js';
import type { IAnthropicClient, ChatParams, ChatResult } from '../../src/infrastructure/ai/AnthropicClient.js';

const mockAnthropicClient: IAnthropicClient = {
  async chat(_params: ChatParams): Promise<ChatResult> {
    return { id: 'msg_admin_test', content: 'mock', inputTokens: 5, outputTokens: 5, model: 'claude-sonnet-4-6', stopReason: 'end_turn' };
  },
  async *chatStream(_params: ChatParams) {
    yield { type: 'done' as const, usage: { inputTokens: 5, outputTokens: 5 } };
  },
};

describe('Admin routes', () => {
  let app: TestApp;
  let adminUser: SeedUserResult;
  let regularUser: SeedUserResult;
  let adminToken: string;
  let userToken: string;

  async function login(u: SeedUserResult): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: u.user.email, password: u.password },
    });
    return res.json().accessToken as string;
  }

  beforeAll(async () => {
    app = await createTestApp({ anthropicClient: mockAnthropicClient });
    adminUser = await seedTestUser({ role: 'ADMIN' });
    regularUser = await seedTestUser({ role: 'USER' });
    adminToken = await login(adminUser);
    userToken = await login(regularUser);

    // Seed some AI usage logs
    for (let i = 0; i < 2; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { messages: [{ role: 'user', content: `Admin seed ${i}` }] },
      });
    }
  });

  afterAll(async () => {
    await closeTestApp(app);
    await cleanupIntegrationData();
  });

  // ── GET /v1/admin/users ────────────────────────────────────────────

  describe('GET /v1/admin/users', () => {
    it('returns 200 with paginated user list for ADMIN', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('totalPages');
      expect(body).toHaveProperty('page');
      expect(body).toHaveProperty('limit');
    });

    it('does not include passwordHash in response', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const user = res.json().data[0];
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('isActive');
    });

    it('returns 403 for regular USER', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/users',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('AUTHZ_001');
    });

    it('returns 401 without credentials', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/admin/users' });
      expect(res.statusCode).toBe(401);
    });

    it('respects page and limit query params', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/users?page=1&limit=1',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(1);
      expect(res.json().limit).toBe(1);
    });
  });

  // ── GET /v1/admin/users/:id ────────────────────────────────────────

  describe('GET /v1/admin/users/:id', () => {
    it('returns 200 with user details for ADMIN', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/admin/users/${regularUser.user.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(regularUser.user.id);
      expect(body.email).toBe(regularUser.user.email);
      expect(body).not.toHaveProperty('passwordHash');
    });

    it('returns 404 for unknown user ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/users/nonexistent_id',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 403 for regular USER', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/admin/users/${regularUser.user.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── PATCH /v1/admin/users/:id ──────────────────────────────────────

  describe('PATCH /v1/admin/users/:id', () => {
    it('deactivates a user', async () => {
      const target = await seedTestUser({ role: 'USER' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/admin/users/${target.user.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isActive: false },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().isActive).toBe(false);
    });

    it('promotes a user to ADMIN', async () => {
      const target = await seedTestUser({ role: 'USER' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/admin/users/${target.user.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { role: 'ADMIN' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().role).toBe('ADMIN');
    });

    it('returns 404 for unknown user ID', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/admin/users/nonexistent',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isActive: false },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 422 when body is empty (no fields provided)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/admin/users/${regularUser.user.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 403 for regular USER', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/admin/users/${regularUser.user.id}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { isActive: false },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── DELETE /v1/admin/users/:id ────────────────────────────────────

  describe('DELETE /v1/admin/users/:id', () => {
    it('returns 204 and hard-deletes the user', async () => {
      const target = await seedTestUser({ role: 'USER' });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/admin/users/${target.user.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(204);

      // Confirm user no longer retrievable
      const check = await app.inject({
        method: 'GET',
        url: `/v1/admin/users/${target.user.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(check.statusCode).toBe(404);
    });

    it('returns 404 for non-existent user', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/v1/admin/users/nonexistent_id',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 403 for regular USER', async () => {
      const target = await seedTestUser({ role: 'USER' });
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/admin/users/${target.user.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 401 without credentials', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/admin/users/${regularUser.user.id}`,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /v1/admin/ai/usage ─────────────────────────────────────────

  describe('GET /v1/admin/ai/usage', () => {
    it('returns 200 with cross-user usage logs for ADMIN', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/ai/usage',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body).toHaveProperty('total');
      expect(body.summary).toHaveProperty('totalCostUsd');
    });

    it('filters by userId query param', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/admin/ai/usage?userId=${adminUser.user.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      // All returned logs should belong to the admin user
      body.data.forEach((log: any) => {
        expect(log.userId).toBe(adminUser.user.id);
      });
    });

    it('returns 403 for regular USER', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/ai/usage',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('AUTHZ_001');
    });

    it('returns 401 without credentials', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/admin/ai/usage' });
      expect(res.statusCode).toBe(401);
    });
  });
});
