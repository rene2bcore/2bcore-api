import { describe, it, expect, vi } from 'vitest';
import { GetAllAiUsageUseCase } from '../../../../src/application/use-cases/admin/getAllAiUsage.js';
import type { IAiUsageLogRepository } from '../../../../src/domain/repositories/IAiUsageLogRepository.js';
import type { AiUsageLog } from '../../../../src/domain/entities/AiUsageLog.js';

function makeLog(overrides: Partial<AiUsageLog> = {}): AiUsageLog {
  return {
    id: 'log_001',
    userId: 'usr_001',
    requestId: 'msg_abc',
    model: 'claude-sonnet-4-6',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    estimatedCostUsd: 0.0001,
    stream: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeRepo(data: AiUsageLog[] = [], total?: number): IAiUsageLogRepository {
  return {
    create: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn().mockResolvedValue({ data, total: total ?? data.length }),
  } as unknown as IAiUsageLogRepository;
}

describe('GetAllAiUsageUseCase', () => {
  const defaultQuery = { page: 1, limit: 20 };

  it('returns paginated cross-user usage', async () => {
    const logs = [
      makeLog({ id: 'log_001', userId: 'usr_001' }),
      makeLog({ id: 'log_002', userId: 'usr_002' }),
    ];
    const repo = makeRepo(logs, 2);
    const useCase = new GetAllAiUsageUseCase(repo);

    const result = await useCase.execute(defaultQuery);

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('passes optional userId filter to repository', async () => {
    const repo = makeRepo([], 0);
    const useCase = new GetAllAiUsageUseCase(repo);

    await useCase.execute({ ...defaultQuery, userId: 'usr_001' });

    expect(repo.findAll).toHaveBeenCalledWith(expect.objectContaining({ userId: 'usr_001' }));
  });

  it('does not include userId in options when not provided', async () => {
    const repo = makeRepo([], 0);
    const useCase = new GetAllAiUsageUseCase(repo);

    await useCase.execute(defaultQuery);

    const callArg = vi.mocked(repo.findAll).mock.calls[0][0];
    expect(callArg).not.toHaveProperty('userId');
  });

  it('computes summary across all returned logs', async () => {
    const logs = [
      makeLog({ inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCostUsd: 0.0001 }),
      makeLog({ inputTokens: 200, outputTokens: 100, totalTokens: 300, estimatedCostUsd: 0.0002 }),
    ];
    const repo = makeRepo(logs, 2);
    const useCase = new GetAllAiUsageUseCase(repo);

    const result = await useCase.execute(defaultQuery);

    expect(result.summary.totalInputTokens).toBe(300);
    expect(result.summary.totalOutputTokens).toBe(150);
    expect(result.summary.totalTokens).toBe(450);
    expect(result.summary.totalCostUsd).toBe(0.0003);
  });
});
