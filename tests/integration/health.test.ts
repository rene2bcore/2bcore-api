import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, closeTestApp, type TestApp } from './helpers/app.helper.js';

describe('Health endpoints', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('2bcore-api');
      expect(body.version).toBeDefined();
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it('returns JSON content-type', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('includes helmet security headers', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('GET /health/ready', () => {
    it('returns 200 with ready status and passing checks', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ready');
      expect(body.checks.database).toBe('ok');
      expect(body.checks.redis).toBe('ok');
    });
  });

  describe('404 handler', () => {
    it('returns 404 with GEN_001 code for unknown routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/nonexistent' });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('GEN_001');
    });
  });
});
