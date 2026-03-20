import { describe, it, expect, vi } from 'vitest';
import { GetApiKeyUseCase } from '../../../../src/application/use-cases/keys/getApiKey.js';
import { NotFoundError, ForbiddenError } from '../../../../src/domain/errors/index.js';
import type { IApiKeyRepository } from '../../../../src/domain/repositories/IApiKeyRepository.js';
import type { ApiKey } from '../../../../src/domain/entities/ApiKey.js';

const baseKey: ApiKey = {
  id: 'key_001',
  userId: 'usr_001',
  name: 'My Key',
  keyHash: 'hash',
  prefix: 'sk-live-abc',
  scopes: [],
  isActive: true,
  lastUsedAt: null,
  createdAt: new Date(),
  revokedAt: null,
  rateLimit: null,
};

function makeRepo(key: ApiKey | null = baseKey): IApiKeyRepository {
  return {
    findById: vi.fn().mockResolvedValue(key),
    findByHash: vi.fn(),
    findByUserId: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
    updateLastUsed: vi.fn(),
  } as unknown as IApiKeyRepository;
}

describe('GetApiKeyUseCase', () => {
  it('returns public key metadata when owner requests it', async () => {
    const repo = makeRepo();
    const useCase = new GetApiKeyUseCase(repo);

    const result = await useCase.execute('usr_001', 'key_001');

    expect(result.id).toBe('key_001');
    expect(result.name).toBe('My Key');
    expect(result).not.toHaveProperty('keyHash');
  });

  it('throws NotFoundError when key does not exist', async () => {
    const repo = makeRepo(null);
    const useCase = new GetApiKeyUseCase(repo);

    await expect(useCase.execute('usr_001', 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ForbiddenError when key belongs to a different user', async () => {
    const repo = makeRepo({ ...baseKey, userId: 'usr_999' });
    const useCase = new GetApiKeyUseCase(repo);

    await expect(useCase.execute('usr_001', 'key_001')).rejects.toBeInstanceOf(ForbiddenError);
  });
});
