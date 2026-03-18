import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateApiKeyUseCase } from '../../../src/application/use-cases/keys/createApiKey.js';
import type { IApiKeyRepository } from '../../../src/domain/repositories/IApiKeyRepository.js';
import type { IAuditLogRepository } from '../../../src/domain/repositories/IAuditLogRepository.js';
import type { ApiKey } from '../../../src/domain/entities/ApiKey.js';

describe('CreateApiKeyUseCase', () => {
  let apiKeyRepo: IApiKeyRepository;
  let auditRepo: IAuditLogRepository;
  let useCase: CreateApiKeyUseCase;

  beforeEach(() => {
    apiKeyRepo = {
      findById: vi.fn(),
      findByHash: vi.fn(),
      findByUserId: vi.fn(),
      create: vi.fn().mockResolvedValue({
        id: 'key_001',
        userId: 'usr_001',
        name: 'Test Key',
        keyHash: 'hashed',
        prefix: 'sk-live-xxxxxxxxx…',
        isActive: true,
        lastUsedAt: null,
        createdAt: new Date('2026-01-01'),
        revokedAt: null,
      } satisfies ApiKey),
      revoke: vi.fn(),
      updateLastUsed: vi.fn(),
    };
    auditRepo = {
      create: vi.fn().mockResolvedValue({}),
      findByUserId: vi.fn(),
    };
    useCase = new CreateApiKeyUseCase(apiKeyRepo, auditRepo);
  });

  it('creates an API key and returns the raw key once', async () => {
    const result = await useCase.execute('usr_001', { name: 'Test Key' });

    expect(result.key).toMatch(/^sk-live-/);
    expect(result.id).toBe('key_001');
    expect(result.name).toBe('Test Key');
  });

  it('stores a hash, not the raw key', async () => {
    await useCase.execute('usr_001', { name: 'My Key' });

    const createCall = vi.mocked(apiKeyRepo.create).mock.calls[0]?.[0];
    expect(createCall?.keyHash).not.toMatch(/^sk-live-/);
    expect(createCall?.keyHash).toHaveLength(64); // SHA-256 hex
  });

  it('creates an audit log entry', async () => {
    await useCase.execute('usr_001', { name: 'My Key' });

    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'API_KEY_CREATED',
        userId: 'usr_001',
      }),
    );
  });
});
