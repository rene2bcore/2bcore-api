import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, closeTestApp, type TestApp } from './helpers/app.helper.js';
import { seedTestUser, cleanupIntegrationData, type SeedUserResult } from './helpers/db.helper.js';

describe('API Key scopes', () => {
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

  async function createKey(scopes?: string[], name = 'Test Key'): Promise<{ id: string; key: string; scopes: string[] }> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/keys',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { name, ...(scopes !== undefined && { scopes }) },
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

  // ── Key creation — scopes ──────────────────────────────────────────

  describe('POST /v1/keys — scopes field', () => {
    it('creates a wildcard key when scopes is omitted', async () => {
      const key = await createKey(undefined, 'Wildcard Key');
      expect(key.scopes).toEqual([]);
    });

    it('creates a wildcard key when scopes is empty array', async () => {
      const key = await createKey([], 'Empty Scopes Key');
      expect(key.scopes).toEqual([]);
    });

    it('creates a scoped key with specified scopes', async () => {
      const key = await createKey(['ai:chat'], 'AI Only Key');
      expect(key.scopes).toEqual(['ai:chat']);
    });

    it('creates a multi-scope key', async () => {
      const key = await createKey(['ai:chat', 'ai:usage'], 'Multi Scope Key');
      expect(key.scopes).toContain('ai:chat');
      expect(key.scopes).toContain('ai:usage');
    });

    it('returns 422 VAL_001 for unknown scope value', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { name: 'Bad Scope', scopes: ['not:a:real:scope'] },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('scopes are persisted and returned in GET /v1/keys/:id', async () => {
      const created = await createKey(['keys:read'], 'Scoped Inspect');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/keys/${created.id}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().scopes).toEqual(['keys:read']);
    });
  });

  // ── Wildcard key — no restrictions ────────────────────────────────

  describe('wildcard key (empty scopes) — full access', () => {
    it('can access GET /v1/keys', async () => {
      const { key } = await createKey([], 'Wildcard Keys');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: { 'x-api-key': key },
      });
      expect(res.statusCode).toBe(200);
    });

    it('can access GET /v1/users/me', async () => {
      const { key } = await createKey([], 'Wildcard Me');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: { 'x-api-key': key },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // ── Scoped key — keys:read ─────────────────────────────────────────

  describe('keys:read scope', () => {
    it('allows GET /v1/keys', async () => {
      const { key } = await createKey(['keys:read'], 'Keys Read Key');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: { 'x-api-key': key },
      });
      expect(res.statusCode).toBe(200);
    });

    it('allows GET /v1/keys/:id', async () => {
      const { key, id } = await createKey(['keys:read'], 'Keys Read By ID');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/keys/${id}`,
        headers: { 'x-api-key': key },
      });
      expect(res.statusCode).toBe(200);
    });

    it('blocks GET /v1/users/me with 403 KEY_004', async () => {
      const { key } = await createKey(['keys:read'], 'Keys Read No Me');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: { 'x-api-key': key },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('KEY_004');
    });
  });

  // ── Scoped key — users:read ────────────────────────────────────────

  describe('users:read scope', () => {
    it('allows GET /v1/users/me', async () => {
      const { key } = await createKey(['users:read'], 'Users Read Key');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: { 'x-api-key': key },
      });
      expect(res.statusCode).toBe(200);
    });

    it('blocks GET /v1/keys with 403 KEY_004', async () => {
      const { key } = await createKey(['users:read'], 'Users Read No Keys');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: { 'x-api-key': key },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('KEY_004');
    });
  });

  // ── JWT always bypasses scope checks ──────────────────────────────

  describe('JWT bypass', () => {
    it('JWT can access any endpoint regardless of scope semantics', async () => {
      const keysRes = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(keysRes.statusCode).toBe(200);

      const meRes = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(meRes.statusCode).toBe(200);
    });
  });
});
