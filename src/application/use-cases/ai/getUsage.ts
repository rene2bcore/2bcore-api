import { IAiUsageLogRepository } from '../../../domain/repositories/IAiUsageLogRepository.js';
import { AiUsageQuery } from '../../dtos/aiusage.dto.js';
import { AiUsageLog } from '../../../domain/entities/AiUsageLog.js';

export interface AiUsagePage {
  data: AiUsageLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCostUsd: number;
  };
}

export class GetAiUsageUseCase {
  constructor(private readonly usageRepo: IAiUsageLogRepository) {}

  async execute(userId: string, query: AiUsageQuery): Promise<AiUsagePage> {
    const { page, limit, from, to } = query;
    const { data, total } = await this.usageRepo.findByUserId({
      userId,
      page,
      limit,
      ...(from !== undefined && { from }),
      ...(to !== undefined && { to }),
    });

    const summary = data.reduce(
      (acc, log) => ({
        totalInputTokens: acc.totalInputTokens + log.inputTokens,
        totalOutputTokens: acc.totalOutputTokens + log.outputTokens,
        totalTokens: acc.totalTokens + log.totalTokens,
        totalCostUsd: acc.totalCostUsd + log.estimatedCostUsd,
      }),
      { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalCostUsd: 0 },
    );

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        ...summary,
        totalCostUsd: Number(summary.totalCostUsd.toFixed(6)),
      },
    };
  }
}
