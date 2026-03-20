import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, closeTestApp, type TestApp } from './helpers/app.helper.js';
import { seedTestUser, seedAdminUser, cleanupIntegrationData, type SeedUserResult } from './helpers/db.helper.js';

describe('Audit log query API', () => {
  let app: TestApp;
  let admin: SeedUserResult;
  let user: SeedUserResult;
  let adminToken: string;
  let userToken: string;

  async function loginAs(email: string, password: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    });
    return res.json().accessToken as string;
  }

  beforeAll(async () => {
    app = await createTestApp();
    admin = await seedAdminUser();
    user = await seedTestUser();
    adminToken = await loginAs(admin.user.email, admin.password);
    userToken = await loginAs(user.user.email, user.password);
  });

  afterAll(async () => {
    await closeTestApp(app);
    await cleanupIntegrationData();
  });

  // ── GET /v1/admin/audit-logs ───────────────────────────────────────

  describe('GET /v1/admin/audit-logs', () => {
    it('returns paginated audit logs for admin', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/audit-logs',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('contains login events after authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/audit-logs?action=USER_LOGIN&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const { data } = res.json();
      expect(data.length).toBeGreaterThan(0);
      for (const entry of data) {
        expect(entry.action).toBe('USER_LOGIN');
      }
    });

    it('filters by userId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/admin/audit-logs?userId=${user.user.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const { data } = res.json();
      for (const entry of data) {
        expect(entry.userId).toBe(user.user.id);
      }
    });

    it('respects pagination params', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/audit-logs?page=1&limit=2',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.page).toBe(1);
    });

    it('returns 403 for non-admin users', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/audit-logs',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/audit-logs',
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 422 for invalid limit value', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/audit-logs?limit=9999',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(422);
    });
  });
});
