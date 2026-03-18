import { MODEL_PRICING } from '../../shared/constants/index.js';
import type { TokenBudgetStore } from '../../infrastructure/redis/tokenBudgetStore.js';
import { AiBudgetExceededError } from '../../domain/errors/index.js';

export class CostTracker {
  constructor(
    private readonly budgetStore: TokenBudgetStore,
    private readonly monthlyTokenBudget: number, // 0 = unlimited
  ) {}

  /**
   * Estimated cost in USD, rounded to 6 decimal places.
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) return 0;
    const cost = (inputTokens / 1_000_000) * pricing.input
               + (outputTokens / 1_000_000) * pricing.output;
    return Math.round(cost * 1_000_000) / 1_000_000;
  }

  /**
   * Throws AiBudgetExceededError if the user has hit their monthly limit.
   * Skipped when budget is 0 (unlimited).
   */
  async checkBudget(userId: string): Promise<void> {
    if (this.monthlyTokenBudget === 0) return;
    const usage = await this.budgetStore.getMonthlyUsage(userId);
    if (usage >= this.monthlyTokenBudget) {
      throw new AiBudgetExceededError();
    }
  }

  async recordUsage(userId: string, totalTokens: number): Promise<void> {
    await this.budgetStore.increment(userId, totalTokens);
  }

  async getMonthlyUsage(userId: string): Promise<number> {
    return this.budgetStore.getMonthlyUsage(userId);
  }
}
