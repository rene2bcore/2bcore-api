import { IAiUsageLogRepository } from '../../../domain/repositories/IAiUsageLogRepository.js';
import { AiUsagePage } from '../ai/getUsage.js';
import { AdminListAiUsageQuery } from '../../dtos/admin.dto.js';

export class GetAllAiUsageUseCase {
  constructor(private readonly usageRepo: IAiUsageLogRepository) {}

  async execute(query: AdminListAiUsageQuery): Promise<AiUsagePage> {
    const { page, limit, userId, from, to } = query;

    const { data, total } = await this.usageRepo.findAll({
      page,
      limit,
      ...(userId !== undefined && { userId }),
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
      summary: { ...summary, totalCostUsd: Number(summary.totalCostUsd.toFixed(6)) },
    };
  }
}
