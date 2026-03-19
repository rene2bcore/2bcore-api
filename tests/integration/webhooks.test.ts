import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, closeTestApp, type TestApp } from './helpers/app.helper.js';
import { seedTestUser, cleanupIntegrationData, type SeedUserResult } from './helpers/db.helper.js';

describe('Webhook endpoints', () => {
  let app: TestApp;
  let user: SeedUserResult;
  let jwtToken: string;

  async function login(): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: user.user.email, password: user.password },
    });
    return res.json().accessToken as string;
  }

  async function createEndpoint(
    url = 'https://example.com/hook',
    events: string[] = [],
  ): Promise<{ id: string; url: string; events: string[]; isActive: boolean; secret: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/webhooks',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { url, events },
    });
    expect(res.statusCode).toBe(201);
    return res.json();
  }

  beforeAll(async () => {
    app = await createTestApp();
    user = await seedTestUser();
    jwtToken = await login();
  });

  afterAll(async () => {
    await closeTestApp(app);
    await cleanupIntegrationData();
  });

  // ── POST /v1/webhooks ──────────────────────────────────────────────

  describe('POST /v1/webhooks', () => {
    it('creates endpoint and returns secret once', async () => {
      const ep = await createEndpoint('https://example.com/hook1');
      expect(ep.id).toBeTruthy();
      expect(ep.url).toBe('https://example.com/hook1');
      expect(ep.events).toEqual([]);
      expect(ep.isActive).toBe(true);
      expect(ep.secret).toMatch(/^[0-9a-f]{64}$/); // 64-char hex
    });

    it('creates endpoint with specific event subscriptions', async () => {
      const ep = await createEndpoint('https://example.com/hook2', ['user.created', 'key.created']);
      expect(ep.events).toEqual(['user.created', 'key.created']);
    });

    it('returns 401 without JWT', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/webhooks',
        payload: { url: 'https://example.com/hook' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 422 for invalid URL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/webhooks',
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { url: 'not-a-url' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 422 for unknown event type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/webhooks',
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { url: 'https://example.com/hook', events: ['unknown.event'] },
      });
      expect(res.statusCode).toBe(422);
    });
  });

  // ── GET /v1/webhooks ───────────────────────────────────────────────

  describe('GET /v1/webhooks', () => {
    it('lists endpoints without secrets', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/webhooks',
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(res.statusCode).toBe(200);
      const { data } = res.json();
      expect(Array.isArray(data)).toBe(true);
      // Secret must NOT be present in list response
      for (const ep of data) {
        expect(ep).not.toHaveProperty('secret');
        expect(ep.id).toBeTruthy();
        expect(ep.url).toBeTruthy();
      }
    });

    it('returns 401 without JWT', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/webhooks' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /v1/webhooks/:id ───────────────────────────────────────────

  describe('GET /v1/webhooks/:id', () => {
    it('returns endpoint by id', async () => {
      const created = await createEndpoint('https://example.com/hook-get');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/webhooks/${created.id}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(res.statusCode).toBe(200);
      const ep = res.json();
      expect(ep.id).toBe(created.id);
      expect(ep.url).toBe('https://example.com/hook-get');
      expect(ep).not.toHaveProperty('secret');
    });

    it('returns 404 for unknown id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/webhooks/nonexistent-id',
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 401 without JWT', async () => {
      const created = await createEndpoint('https://example.com/hook-auth');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/webhooks/${created.id}`,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── PATCH /v1/webhooks/:id ─────────────────────────────────────────

  describe('PATCH /v1/webhooks/:id', () => {
    it('updates URL', async () => {
      const ep = await createEndpoint('https://example.com/hook-update');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/webhooks/${ep.id}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { url: 'https://updated.example.com/hook' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().url).toBe('https://updated.example.com/hook');
    });

    it('updates events', async () => {
      const ep = await createEndpoint('https://example.com/hook-events');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/webhooks/${ep.id}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { events: ['user.created'] },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().events).toEqual(['user.created']);
    });

    it('deactivates endpoint', async () => {
      const ep = await createEndpoint('https://example.com/hook-deactivate');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/webhooks/${ep.id}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { isActive: false },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().isActive).toBe(false);
    });

    it('returns 422 for empty body', async () => {
      const ep = await createEndpoint('https://example.com/hook-empty-patch');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/webhooks/${ep.id}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: {},
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 404 for unknown id', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/webhooks/nonexistent-id',
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { isActive: false },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── DELETE /v1/webhooks/:id ────────────────────────────────────────

  describe('DELETE /v1/webhooks/:id', () => {
    it('deletes endpoint and returns 204', async () => {
      const ep = await createEndpoint('https://example.com/hook-delete');
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/webhooks/${ep.id}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(res.statusCode).toBe(204);

      // Confirm it's gone
      const getRes = await app.inject({
        method: 'GET',
        url: `/v1/webhooks/${ep.id}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(getRes.statusCode).toBe(404);
    });

    it('returns 404 for already-deleted endpoint', async () => {
      const ep = await createEndpoint('https://example.com/hook-double-delete');
      await app.inject({
        method: 'DELETE',
        url: `/v1/webhooks/${ep.id}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/webhooks/${ep.id}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 401 without JWT', async () => {
      const ep = await createEndpoint('https://example.com/hook-noauth');
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/webhooks/${ep.id}`,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /v1/webhooks/:id/deliveries ───────────────────────────────

  describe('GET /v1/webhooks/:id/deliveries', () => {
    it('returns empty deliveries list for new endpoint', async () => {
      const ep = await createEndpoint('https://example.com/hook-deliveries');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/webhooks/${ep.id}/deliveries`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });

    it('returns 404 for unknown endpoint id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/webhooks/nonexistent-id/deliveries',
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 401 without JWT', async () => {
      const ep = await createEndpoint('https://example.com/hook-deliveries-auth');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/webhooks/${ep.id}/deliveries`,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── Cross-user isolation ───────────────────────────────────────────

  describe('cross-user isolation', () => {
    it('prevents user B from accessing user A endpoint', async () => {
      const ep = await createEndpoint('https://example.com/hook-isolation');

      // Register second user
      const regRes = await app.inject({
        method: 'POST',
        url: '/v1/users/register',
        payload: { email: `webhook-isolation-${Date.now()}@test.com`, password: 'Password123!' },
      });
      expect(regRes.statusCode).toBe(201);

      const loginRes = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: regRes.json().email, password: 'Password123!' },
      });
      const otherToken = loginRes.json().accessToken as string;

      // User B tries to GET user A's endpoint
      const getRes = await app.inject({
        method: 'GET',
        url: `/v1/webhooks/${ep.id}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(getRes.statusCode).toBe(403);

      // User B tries to DELETE user A's endpoint
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/v1/webhooks/${ep.id}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(delRes.statusCode).toBe(403);
    });
  });
});
