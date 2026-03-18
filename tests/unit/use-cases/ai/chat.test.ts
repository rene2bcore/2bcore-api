import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatUseCase } from '../../../../src/application/use-cases/ai/chat.js';
import { AiBudgetExceededError } from '../../../../src/domain/errors/index.js';
import type { IAnthropicClient, ChatParams, ChatResult } from '../../../../src/infrastructure/ai/AnthropicClient.js';
import type { CostTracker } from '../../../../src/application/services/CostTracker.js';
import type { ModelRouter } from '../../../../src/application/services/ModelRouter.js';
import type { IAuditLogRepository } from '../../../../src/domain/repositories/IAuditLogRepository.js';
import type { IAiUsageLogRepository } from '../../../../src/domain/repositories/IAiUsageLogRepository.js';

const MOCK_RESULT: ChatResult = {
  id: 'msg_test_123',
  content: 'Hello! How can I help?',
  inputTokens: 10,
  outputTokens: 8,
  model: 'claude-sonnet-4-6',
  stopReason: 'end_turn',
};

function makeAnthropicClient(): IAnthropicClient {
  return {
    chat: vi.fn().mockResolvedValue(MOCK_RESULT),
    chatStream: vi.fn().mockImplementation(async function* () {
      yield { type: 'delta' as const, text: 'Hello! ' };
      yield { type: 'delta' as const, text: 'How can I help?' };
      yield { type: 'done' as const, usage: { inputTokens: 10, outputTokens: 8 } };
    }),
  };
}

function makeCostTracker(): CostTracker {
  return {
    checkBudget: vi.fn().mockResolvedValue(undefined),
    calculateCost: vi.fn().mockReturnValue(0.000123),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    getMonthlyUsage: vi.fn().mockResolvedValue(0),
  } as unknown as CostTracker;
}

function makeModelRouter(): ModelRouter {
  return {
    resolve: vi.fn().mockReturnValue('claude-sonnet-4-6'),
    isKnown: vi.fn().mockReturnValue(true),
  } as unknown as ModelRouter;
}

function makeAuditRepo(): IAuditLogRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
  } as unknown as IAuditLogRepository;
}

function makeUsageRepo(): IAiUsageLogRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findByUserId: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  } as unknown as IAiUsageLogRepository;
}

describe('ChatUseCase', () => {
  let anthropic: IAnthropicClient;
  let costTracker: CostTracker;
  let modelRouter: ModelRouter;
  let auditRepo: IAuditLogRepository;
  let usageRepo: IAiUsageLogRepository;
  let useCase: ChatUseCase;

  beforeEach(() => {
    anthropic = makeAnthropicClient();
    costTracker = makeCostTracker();
    modelRouter = makeModelRouter();
    auditRepo = makeAuditRepo();
    usageRepo = makeUsageRepo();
    useCase = new ChatUseCase(anthropic, costTracker, modelRouter, auditRepo, usageRepo);
  });

  describe('execute()', () => {
    const input = { messages: [{ role: 'user' as const, content: 'Hi' }], stream: false };

    it('returns chat output with usage', async () => {
      const result = await useCase.execute('user1', input);
      expect(result.id).toBe('msg_test_123');
      expect(result.content).toBe('Hello! How can I help?');
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(8);
      expect(result.usage.totalTokens).toBe(18);
      expect(result.usage.estimatedCostUsd).toBe(0.000123);
    });

    it('routes model through ModelRouter', async () => {
      await useCase.execute('user1', { ...input, model: 'fast' });
      expect(modelRouter.resolve).toHaveBeenCalledWith('fast');
    });

    it('checks budget before calling Anthropic', async () => {
      const callOrder: string[] = [];
      vi.mocked(costTracker.checkBudget).mockImplementation(async () => { callOrder.push('budget'); });
      vi.mocked(anthropic.chat).mockImplementation(async () => { callOrder.push('anthropic'); return MOCK_RESULT; });
      await useCase.execute('user1', input);
      expect(callOrder).toEqual(['budget', 'anthropic']);
    });

    it('propagates AiBudgetExceededError', async () => {
      vi.mocked(costTracker.checkBudget).mockRejectedValue(new AiBudgetExceededError());
      await expect(useCase.execute('user1', input)).rejects.toBeInstanceOf(AiBudgetExceededError);
      expect(anthropic.chat).not.toHaveBeenCalled();
    });

    it('records usage and writes audit log', async () => {
      await useCase.execute('user1', input);
      expect(costTracker.recordUsage).toHaveBeenCalledWith('user1', 18);
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user1', action: 'AI_CHAT_REQUEST', metadata: expect.objectContaining({ stream: false }) }),
      );
    });

    it('persists usage log with correct fields', async () => {
      await useCase.execute('user1', input);
      expect(usageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          requestId: MOCK_RESULT.id,
          model: MOCK_RESULT.model,
          inputTokens: MOCK_RESULT.inputTokens,
          outputTokens: MOCK_RESULT.outputTokens,
          stream: false,
        }),
      );
    });
  });

  describe('executeStream()', () => {
    const input = { messages: [{ role: 'user' as const, content: 'Hi' }], stream: true };

    it('yields text deltas then a done chunk', async () => {
      const chunks: any[] = [];
      for await (const chunk of useCase.executeStream('user1', input)) {
        chunks.push(chunk);
      }
      expect(chunks.filter(c => c.type === 'delta')).toHaveLength(2);
      const done = chunks.find(c => c.type === 'done');
      expect(done).toBeDefined();
      expect(done.usage.totalTokens).toBe(18);
    });

    it('does NOT check budget internally (caller is responsible)', async () => {
      for await (const _ of useCase.executeStream('user1', input)) { /* drain */ }
      expect(costTracker.checkBudget).not.toHaveBeenCalled();
    });

    it('persists stream usage log after completion', async () => {
      for await (const _ of useCase.executeStream('user1', input)) { /* drain */ }
      // Fire-and-forget; flush microtasks before asserting
      await Promise.resolve();
      expect(usageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user1', stream: true, inputTokens: 10, outputTokens: 8 }),
      );
    });
  });

  describe('checkBudget()', () => {
    it('delegates to CostTracker', async () => {
      await useCase.checkBudget('user1');
      expect(costTracker.checkBudget).toHaveBeenCalledWith('user1');
    });
  });
});
