import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, closeTestApp, type TestApp } from './helpers/app.helper.js';
import { seedTestUser, cleanupIntegrationData, type SeedUserResult } from './helpers/db.helper.js';
import type { IAnthropicClient, ChatParams, ChatResult } from '../../src/infrastructure/ai/AnthropicClient.js';

// ── Mock Anthropic client ────────────────────────────────────────────────────

const MOCK_RESPONSE: ChatResult = {
  id: 'msg_inttest_001',
  content: 'This is a mock AI response for integration testing.',
  inputTokens: 12,
  outputTokens: 10,
  model: 'claude-sonnet-4-6',
  stopReason: 'end_turn',
};

const mockAnthropicClient: IAnthropicClient = {
  async chat(_params: ChatParams): Promise<ChatResult> {
    return { ...MOCK_RESPONSE };
  },
  async *chatStream(_params: ChatParams) {
    yield { type: 'delta' as const, text: 'This is a mock ' };
    yield { type: 'delta' as const, text: 'AI response.' };
    yield { type: 'done' as const, usage: { inputTokens: 12, outputTokens: 10 } };
  },
};

// ── Test suite ───────────────────────────────────────────────────────────────

describe('AI routes', () => {
  let app: TestApp;
  let user: SeedUserResult;
  let token: string;
  let apiKey: string;

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
    user = await seedTestUser();
    token = await login(user);

    // Create an API key for auth tests
    const keyRes = await app.inject({
      method: 'POST',
      url: '/v1/keys',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'AI Test Key' },
    });
    apiKey = keyRes.json().key as string;
  });

  afterAll(async () => {
    await closeTestApp(app);
    await cleanupIntegrationData();
  });

  // ── POST /v1/ai/chat ───────────────────────────────────────────────

  describe('POST /v1/ai/chat', () => {
    it('returns 200 with content and usage (JWT auth)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: { messages: [{ role: 'user', content: 'Hello' }] },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBeTypeOf('string');
      expect(body.model).toBeTypeOf('string');
      expect(body.content).toBeTypeOf('string');
      expect(body.usage.inputTokens).toBeTypeOf('number');
      expect(body.usage.outputTokens).toBeTypeOf('number');
      expect(body.usage.totalTokens).toBe(body.usage.inputTokens + body.usage.outputTokens);
      expect(body.usage.estimatedCostUsd).toBeTypeOf('number');
    });

    it('returns 200 via X-API-Key header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: { 'x-api-key': apiKey },
        payload: { messages: [{ role: 'user', content: 'Hello' }] },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 200 via Bearer sk-live-... header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { messages: [{ role: 'user', content: 'Hello' }] },
      });
      expect(res.statusCode).toBe(200);
    });

    it('routes to fast model when model="fast"', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: { messages: [{ role: 'user', content: 'Hello' }], model: 'fast' },
      });
      expect(res.statusCode).toBe(200);
      // The mock returns the same content regardless of model;
      // correctness of routing is covered in unit tests
    });

    it('respects maxTokens from request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: { messages: [{ role: 'user', content: 'Hello' }], maxTokens: 256 },
      });
      expect(res.statusCode).toBe(200);
    });

    it('supports multi-turn conversation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          messages: [
            { role: 'user', content: 'My name is Alice.' },
            { role: 'assistant', content: 'Hello Alice!' },
            { role: 'user', content: 'What is my name?' },
          ],
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it('accepts a system prompt', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
          system: 'You are a helpful assistant.',
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 401 without credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        payload: { messages: [{ role: 'user', content: 'Hello' }] },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 422 VAL_001 when messages is empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: { messages: [] },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 422 VAL_001 when message content is empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: { messages: [{ role: 'user', content: '' }] },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 422 VAL_001 when role is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: { messages: [{ role: 'system', content: 'Hello' }] },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    it('returns 422 VAL_001 when maxTokens exceeds limit', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: { messages: [{ role: 'user', content: 'Hi' }], maxTokens: 99999 },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });

    // ── Budget enforcement ─────────────────────────────────────────
    // Budget logic (AiBudgetExceededError → 429 AI_001) is exhaustively
    // covered in unit tests (CostTracker.test.ts, chat.test.ts).
    // Integration-level budget testing requires env-configurable budgets
    // per test, which is handled in the unit layer.

    // ── Streaming ──────────────────────────────────────────────────

    it('returns SSE stream when stream=true', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: { messages: [{ role: 'user', content: 'Hello' }], stream: true },
      });
      // inject() buffers the full SSE response
      expect(res.headers['content-type']).toMatch(/text\/event-stream/);
      const body = res.body;
      expect(body).toContain('data: ');
      expect(body).toContain('[DONE]');
      // Verify delta events
      const lines = body.split('\n').filter((l: string) => l.startsWith('data: ') && !l.includes('[DONE]'));
      const events = lines.map((l: string) => JSON.parse(l.slice(6)));
      expect(events.some((e: any) => e.type === 'delta')).toBe(true);
      const done = events.find((e: any) => e.type === 'done');
      expect(done).toBeDefined();
      expect(done.usage.totalTokens).toBe(22);
    });

    it('returns 401 for streaming without credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        payload: { messages: [{ role: 'user', content: 'Hello' }], stream: true },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /v1/ai/usage ───────────────────────────────────────────────

  describe('GET /v1/ai/usage', () => {
    // Seed some usage logs by making real (mocked) chat requests first
    beforeAll(async () => {
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: 'POST',
          url: '/v1/ai/chat',
          headers: { authorization: `Bearer ${token}` },
          payload: { messages: [{ role: 'user', content: `Seed message ${i}` }] },
        });
      }
    });

    it('returns 200 with paginated usage logs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ai/usage',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThanOrEqual(3);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(20);
      expect(body.total).toBeGreaterThanOrEqual(3);
      expect(body.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('returns correct log shape', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ai/usage',
        headers: { authorization: `Bearer ${token}` },
      });
      const log = res.json().data[0];
      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('requestId');
      expect(log).toHaveProperty('model');
      expect(log.inputTokens).toBeTypeOf('number');
      expect(log.outputTokens).toBeTypeOf('number');
      expect(log.totalTokens).toBe(log.inputTokens + log.outputTokens);
      expect(log.estimatedCostUsd).toBeTypeOf('number');
      expect(log.stream).toBeTypeOf('boolean');
      expect(log.createdAt).toBeTypeOf('string');
    });

    it('returns non-zero summary totals', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ai/usage',
        headers: { authorization: `Bearer ${token}` },
      });
      const { summary } = res.json();
      expect(summary.totalInputTokens).toBeGreaterThan(0);
      expect(summary.totalOutputTokens).toBeGreaterThan(0);
      expect(summary.totalTokens).toBe(summary.totalInputTokens + summary.totalOutputTokens);
      expect(summary.totalCostUsd).toBeGreaterThan(0);
    });

    it('respects page and limit query params', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ai/usage?page=1&limit=1',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
      expect(body.limit).toBe(1);
    });

    it('returns 401 without credentials', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ai/usage',
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with API key (endpoint accepts both JWT and API key auth)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ai/usage',
        headers: { 'x-api-key': apiKey },
      });
      expect(res.statusCode).toBe(200);
    });

    it('filters by from date — past date returns logs', async () => {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString();
      const res = await app.inject({
        method: 'GET',
        url: `/v1/ai/usage?from=${encodeURIComponent(yesterday)}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('filters by to date — future date returns logs', async () => {
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
      const res = await app.inject({
        method: 'GET',
        url: `/v1/ai/usage?to=${encodeURIComponent(tomorrow)}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('filters by from/to range — past range returns no logs', async () => {
      const from = new Date('2020-01-01T00:00:00Z').toISOString();
      const to = new Date('2020-01-02T00:00:00Z').toISOString();
      const res = await app.inject({
        method: 'GET',
        url: `/v1/ai/usage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it('returns 422 VAL_001 for invalid from date', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ai/usage?from=not-a-date',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VAL_001');
    });
  });
});
