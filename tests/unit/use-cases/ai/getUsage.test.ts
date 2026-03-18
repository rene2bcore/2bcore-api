import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAiUsageUseCase } from '../../../../src/application/use-cases/ai/getUsage.js';
import type { IAiUsageLogRepository } from '../../../../src/domain/repositories/IAiUsageLogRepository.js';
import type { AiUsageLog } from '../../../../src/domain/entities/AiUsageLog.js';

function makeLog(overrides: Partial<AiUsageLog> = {}): AiUsageLog {
  return {
    id: 'log_001',
    userId: 'user1',
    requestId: 'msg_abc',
    model: 'claude-sonnet-4-6',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    estimatedCostUsd: 0.000456,
    stream: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeRepo(data: AiUsageLog[] = [], total?: number): IAiUsageLogRepository {
  return {
    create: vi.fn().mockResolvedValue(data[0] ?? makeLog()),
    findByUserId: vi.fn().mockResolvedValue({ data, total: total ?? data.length }),
  } as unknown as IAiUsageLogRepository;
}

describe('GetAiUsageUseCase', () => {
  const defaultQuery = { page: 1, limit: 20 };

  it('returns paginated data and pagination metadata', async () => {
    const logs = [makeLog({ id: 'log_001' }), makeLog({ id: 'log_002' })];
    const repo = makeRepo(logs, 2);
    const useCase = new GetAiUsageUseCase(repo);

    const result = await useCase.execute('user1', defaultQuery);

    expect(result.data).toHaveLength(2);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(20);
    expect(result.pagination.total).toBe(2);
    expect(result.pagination.totalPages).toBe(1);
  });

  it('calculates totalPages correctly for multi-page results', async () => {
    const repo = makeRepo(Array.from({ length: 10 }, (_, i) => makeLog({ id: `log_${i}` })), 45);
    const useCase = new GetAiUsageUseCase(repo);

    const result = await useCase.execute('user1', { page: 1, limit: 10 });

    expect(result.pagination.totalPages).toBe(5);
  });

  it('computes summary totals across returned page', async () => {
    const logs = [
      makeLog({ inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCostUsd: 0.0001 }),
      makeLog({ inputTokens: 200, outputTokens: 80, totalTokens: 280, estimatedCostUsd: 0.0002 }),
    ];
    const repo = makeRepo(logs, 2);
    const useCase = new GetAiUsageUseCase(repo);

    const result = await useCase.execute('user1', defaultQuery);

    expect(result.summary.totalInputTokens).toBe(300);
    expect(result.summary.totalOutputTokens).toBe(130);
    expect(result.summary.totalTokens).toBe(430);
    expect(result.summary.totalCostUsd).toBe(0.0003);
  });

  it('rounds totalCostUsd to 6 decimal places', async () => {
    const logs = [
      makeLog({ estimatedCostUsd: 0.000001 }),
      makeLog({ estimatedCostUsd: 0.0000005 }),
    ];
    const repo = makeRepo(logs, 2);
    const useCase = new GetAiUsageUseCase(repo);

    const result = await useCase.execute('user1', defaultQuery);

    expect(result.summary.totalCostUsd).toBe(Number((0.0000015).toFixed(6)));
  });

  it('returns empty summary when no logs', async () => {
    const repo = makeRepo([], 0);
    const useCase = new GetAiUsageUseCase(repo);

    const result = await useCase.execute('user1', defaultQuery);

    expect(result.data).toHaveLength(0);
    expect(result.summary).toEqual({ totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalCostUsd: 0 });
    expect(result.pagination.totalPages).toBe(0);
  });

  it('passes from/to date filters to the repository', async () => {
    const repo = makeRepo([], 0);
    const useCase = new GetAiUsageUseCase(repo);
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-01-31T23:59:59Z');

    await useCase.execute('user1', { page: 1, limit: 10, from, to });

    expect(repo.findByUserId).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user1', from, to }),
    );
  });
});
