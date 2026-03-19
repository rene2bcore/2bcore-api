import type { IAnthropicClient } from '../../../infrastructure/ai/AnthropicClient.js';
import type { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import type { IAiUsageLogRepository } from '../../../domain/repositories/IAiUsageLogRepository.js';
import type { CostTracker } from '../../services/CostTracker.js';
import type { ModelRouter } from '../../services/ModelRouter.js';
import type { ChatInput, ChatOutput, ChatUsage } from '../../dtos/ai.dto.js';
import type { IWebhookService } from '../../../domain/services/IWebhookService.js';
import { WEBHOOK_EVENTS } from '../../../shared/constants/index.js';
import { env } from '../../../shared/config/env.js';

interface RequestContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export type StreamChunk =
  | { type: 'delta'; text: string }
  | { type: 'done'; usage: ChatUsage };

export class ChatUseCase {
  constructor(
    private readonly anthropic: IAnthropicClient,
    private readonly costTracker: CostTracker,
    private readonly modelRouter: ModelRouter,
    private readonly auditRepo: IAuditLogRepository,
    private readonly usageRepo: IAiUsageLogRepository,
    private readonly webhookService?: IWebhookService,
  ) {}

  /**
   * Pre-flight budget check — call before hijacking the response for streaming
   * so budget errors can be returned as proper HTTP responses.
   */
  async checkBudget(userId: string): Promise<void> {
    await this.costTracker.checkBudget(userId);
  }

  async execute(
    userId: string,
    input: ChatInput,
    context?: RequestContext,
  ): Promise<ChatOutput> {
    await this.costTracker.checkBudget(userId);

    const model = this.modelRouter.resolve(input.model);
    const maxTokens = input.maxTokens ?? env.AI_DEFAULT_MAX_TOKENS;

    const result = await this.anthropic.chat({ model, messages: input.messages, system: input.system, maxTokens });

    const totalTokens = result.inputTokens + result.outputTokens;
    const estimatedCostUsd = this.costTracker.calculateCost(result.model, result.inputTokens, result.outputTokens);

    await Promise.all([
      this.costTracker.recordUsage(userId, totalTokens),
      this.auditRepo.create({
        userId,
        action: 'AI_CHAT_REQUEST',
        resourceType: 'ai_message',
        resourceId: result.id,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedCostUsd, stream: false },
      }),
      this.usageRepo.create({
        userId,
        requestId: result.id,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCostUsd,
        stream: false,
      }),
    ]);

    const output: ChatOutput = {
      id: result.id,
      model: result.model,
      content: result.content,
      usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, totalTokens, estimatedCostUsd },
    };

    this.webhookService?.emit(userId, WEBHOOK_EVENTS.AI_CHAT_COMPLETED, {
      requestId: result.id,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd,
      stream: false,
    });

    return output;
  }

  /**
   * Streaming variant — budget must be checked via checkBudget() before calling.
   * Yields text deltas followed by a single 'done' chunk with usage.
   */
  async *executeStream(
    userId: string,
    input: ChatInput,
    context?: RequestContext,
  ): AsyncGenerator<StreamChunk> {
    const model = this.modelRouter.resolve(input.model);
    const maxTokens = input.maxTokens ?? env.AI_DEFAULT_MAX_TOKENS;

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of this.anthropic.chatStream({ model, messages: input.messages, system: input.system, maxTokens })) {
      if (chunk.type === 'delta' && chunk.text) {
        yield { type: 'delta', text: chunk.text };
      } else if (chunk.type === 'done' && chunk.usage) {
        inputTokens = chunk.usage.inputTokens;
        outputTokens = chunk.usage.outputTokens;
      }
    }

    const totalTokens = inputTokens + outputTokens;
    const estimatedCostUsd = this.costTracker.calculateCost(model, inputTokens, outputTokens);
    const usage: ChatUsage = { inputTokens, outputTokens, totalTokens, estimatedCostUsd };

    // Fire-and-forget — don't block the final SSE event on DB/Redis writes
    const streamRequestId = `stream_${Date.now()}_${userId}`;
    void Promise.all([
      this.costTracker.recordUsage(userId, totalTokens),
      this.auditRepo.create({
        userId,
        action: 'AI_CHAT_REQUEST',
        resourceType: 'ai_message',
        resourceId: 'stream',
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { model, inputTokens, outputTokens, estimatedCostUsd, stream: true },
      }),
      this.usageRepo.create({
        userId,
        requestId: streamRequestId,
        model,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        stream: true,
      }),
    ]);

    this.webhookService?.emit(userId, WEBHOOK_EVENTS.AI_CHAT_COMPLETED, {
      requestId: streamRequestId,
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      stream: true,
    });

    yield { type: 'done', usage };
  }
}
