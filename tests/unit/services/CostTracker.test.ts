import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostTracker } from '../../../src/application/services/CostTracker.js';
import { AiBudgetExceededError } from '../../../src/domain/errors/index.js';
import type { TokenBudgetStore } from '../../../src/infrastructure/redis/tokenBudgetStore.js';

function makeBudgetStore(usage = 0): TokenBudgetStore {
  return {
    increment: vi.fn().mockResolvedValue(usage + 100),
    getMonthlyUsage: vi.fn().mockResolvedValue(usage),
  } as unknown as TokenBudgetStore;
}

describe('CostTracker', () => {
  describe('calculateCost()', () => {
    const tracker = new CostTracker(makeBudgetStore(), 0);

    it('calculates cost for sonnet', () => {
      // 1000 input + 500 output = (1000/1e6)*3 + (500/1e6)*15 = 0.003 + 0.0075 = 0.0105
      expect(tracker.calculateCost('claude-sonnet-4-6', 1000, 500)).toBeCloseTo(0.0105, 6);
    });

    it('calculates cost for haiku', () => {
      // (1000/1e6)*0.8 + (500/1e6)*4 = 0.0008 + 0.002 = 0.0028
      expect(tracker.calculateCost('claude-haiku-4-5-20251001', 1000, 500)).toBeCloseTo(0.0028, 6);
    });

    it('calculates cost for opus', () => {
      // (1000/1e6)*15 + (500/1e6)*75 = 0.015 + 0.0375 = 0.0525
      expect(tracker.calculateCost('claude-opus-4-6', 1000, 500)).toBeCloseTo(0.0525, 6);
    });

    it('returns 0 for unknown models', () => {
      expect(tracker.calculateCost('unknown-model', 1000, 500)).toBe(0);
    });

    it('returns 0 for zero tokens', () => {
      expect(tracker.calculateCost('claude-sonnet-4-6', 0, 0)).toBe(0);
    });
  });

  describe('checkBudget()', () => {
    it('passes when budget is 0 (unlimited)', async () => {
      const store = makeBudgetStore(9_999_999);
      const tracker = new CostTracker(store, 0);
      await expect(tracker.checkBudget('user1')).resolves.toBeUndefined();
      expect(store.getMonthlyUsage).not.toHaveBeenCalled();
    });

    it('passes when usage is below budget', async () => {
      const store = makeBudgetStore(500);
      const tracker = new CostTracker(store, 1000);
      await expect(tracker.checkBudget('user1')).resolves.toBeUndefined();
    });

    it('throws AiBudgetExceededError when usage equals budget', async () => {
      const store = makeBudgetStore(1000);
      const tracker = new CostTracker(store, 1000);
      await expect(tracker.checkBudget('user1')).rejects.toBeInstanceOf(AiBudgetExceededError);
    });

    it('throws AiBudgetExceededError when usage exceeds budget', async () => {
      const store = makeBudgetStore(1500);
      const tracker = new CostTracker(store, 1000);
      await expect(tracker.checkBudget('user1')).rejects.toBeInstanceOf(AiBudgetExceededError);
    });
  });

  describe('recordUsage()', () => {
    it('increments the budget store', async () => {
      const store = makeBudgetStore(0);
      const tracker = new CostTracker(store, 0);
      await tracker.recordUsage('user1', 150);
      expect(store.increment).toHaveBeenCalledWith('user1', 150);
    });
  });
});
