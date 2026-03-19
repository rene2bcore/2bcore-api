import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, closeTestApp, type TestApp } from './helpers/app.helper.js';
import { seedTestUser, cleanupIntegrationData, type SeedUserResult } from './helpers/db.helper.js';

describe('API Keys routes', () => {
  let app: TestApp;
  let primary: SeedUserResult;
  let secondary: SeedUserResult;
  let primaryToken: string;

  async function login(user: SeedUserResult): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: user.user.email, password: user.password },
    });
    return res.json().accessToken as string;
  }

  async function createKey(token: string, name = 'Test Key'): Promise<{
    id: string;
    name: string;
    key: string;
    prefix: string;
    createdAt: string;
  }> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/keys',
      headers: { authorization: `Bearer ${token}` },
      payload: { name },
    });
    return res.json();
  }

  beforeAll(async () => {
    app = await createTestApp();
    [primary, secondary] = await Promise.all([seedTestUser(), seedTestUser()]);
    primaryToken = await login(primary);
  });

  afterAll(async () => {
    await closeTestApp(app);
    await cleanupIntegrationData();
  });

  // ── POST /v1/keys ──────────────────────────────────────────────────

  describe('POST /v1/keys', () => {
    it('returns 201 with key metadata and raw key', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${primaryToken}` },
        payload: { name: 'My Service Key' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeTypeOf('string');
      expect(body.name).toBe('My Service Key');
      expect(body.key).toBeTypeOf('string');
      expect(body.prefix).toBeTypeOf('string');
      expect(body.createdAt).toBeTypeOf('string');
    });

    it('raw key starts with sk-live-', async () => {
      const body = await createKey(primaryToken, 'Prefix Check');
      expect(body.key).toMatch(/^sk-live-/);
    });

    it('GET /v1/keys does not expose the raw key', async () => {
      const created = await createKey(primaryToken, 'Hidden Key');
      const list = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${primaryToken}` },
      });
      const keys = list.json().data as Array<Record<string, unknown>>;
      const found = keys.find((k) => k['id'] === created.id);
      expect(found).toBeDefined();
      expect(found!['key']).toBeUndefined();
    });

    it('returns 422 VAL_001 when name is empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${primaryToken}` },
        payload: { name: '' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 422 VAL_001 when name exceeds 64 characters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${primaryToken}` },
        payload: { name: 'a'.repeat(65) },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 401 without credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        payload: { name: 'No Auth' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 — API keys cannot bootstrap more keys (verifyJWT only)', async () => {
      const created = await createKey(primaryToken, 'Bootstrap Attempt');
      const res = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: { 'x-api-key': created.key },
        payload: { name: 'Should Fail' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /v1/keys ───────────────────────────────────────────────────

  describe('GET /v1/keys', () => {
    it('returns 200 with data array via JWT', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${primaryToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json().data)).toBe(true);
    });

    it('returns 200 via X-API-Key header (verifyAuth)', async () => {
      const created = await createKey(primaryToken, 'API Auth Key');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: { 'x-api-key': created.key },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 200 via Authorization: Bearer sk-live-... header', async () => {
      const created = await createKey(primaryToken, 'Bearer API Key');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${created.key}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 401 without credentials', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/keys' });
      expect(res.statusCode).toBe(401);
    });

    it('newly created key has isActive:true and revokedAt:null', async () => {
      const created = await createKey(primaryToken, 'Active Key Check');
      const list = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${primaryToken}` },
      });
      const key = (list.json().data as Array<Record<string, unknown>>)
        .find((k) => k['id'] === created.id);
      expect(key!['isActive']).toBe(true);
      expect(key!['revokedAt']).toBeNull();
    });

    it('does not return keys belonging to another user', async () => {
      const secondaryToken = await login(secondary);
      const secondaryKey = await createKey(secondaryToken, 'Secondary Key');

      const res = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${primaryToken}` },
      });
      const ids = (res.json().data as Array<Record<string, unknown>>).map((k) => k['id']);
      expect(ids).not.toContain(secondaryKey.id);
    });
  });

  // ── DELETE /v1/keys/:id ────────────────────────────────────────────

  describe('DELETE /v1/keys/:id', () => {
    it('returns 204 and revokes the key', async () => {
      const created = await createKey(primaryToken, 'To Revoke');
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/keys/${created.id}`,
        headers: { authorization: `Bearer ${primaryToken}` },
      });
      expect(res.statusCode).toBe(204);
    });

    it('revoked key returns 401 KEY_002 on subsequent use', async () => {
      const created = await createKey(primaryToken, 'Revoke Then Use');

      await app.inject({
        method: 'DELETE',
        url: `/v1/keys/${created.id}`,
        headers: { authorization: `Bearer ${primaryToken}` },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: { 'x-api-key': created.key },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('KEY_002');
    });

    it("returns 403 when deleting another user's key", async () => {
      const secondaryToken = await login(secondary);
      const secondaryKey = await createKey(secondaryToken, "Other User's Key");

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/keys/${secondaryKey.id}`,
        headers: { authorization: `Bearer ${primaryToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 404 for a non-existent key id', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/v1/keys/nonexistent-id-000',
        headers: { authorization: `Bearer ${primaryToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 401 without credentials', async () => {
      const created = await createKey(primaryToken, 'No Auth Revoke');
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/keys/${created.id}`,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /v1/keys/:id ───────────────────────────────────────────────

  describe('GET /v1/keys/:id', () => {
    it('returns 200 with key metadata for the owner', async () => {
      const created = await createKey(primaryToken, 'Inspect Me');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/keys/${created.id}`,
        headers: { authorization: `Bearer ${primaryToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(created.id);
      expect(body.name).toBe('Inspect Me');
      expect(body).not.toHaveProperty('keyHash');
      expect(body).toHaveProperty('isActive');
      expect(body).toHaveProperty('prefix');
    });

    it('returns 200 via API key auth', async () => {
      const created = await createKey(primaryToken, 'Self Inspect Key');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/keys/${created.id}`,
        headers: { 'x-api-key': created.key },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 403 when requesting another user\'s key', async () => {
      const secondaryToken = await login(secondary);
      const secondaryKey = await createKey(secondaryToken, 'Other Key');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/keys/${secondaryKey.id}`,
        headers: { authorization: `Bearer ${primaryToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 404 for non-existent key', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/keys/nonexistent-key-id',
        headers: { authorization: `Bearer ${primaryToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 401 without credentials', async () => {
      const created = await createKey(primaryToken, 'Unauth Inspect');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/keys/${created.id}`,
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
