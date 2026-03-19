import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerifyEmailUseCase } from '../../../../src/application/use-cases/auth/verifyEmail.js';
import type { IUserRepository } from '../../../../src/domain/repositories/IUserRepository.js';
import type { IEmailVerificationRepository } from '../../../../src/domain/repositories/IEmailVerificationRepository.js';
import type { IAuditLogRepository } from '../../../../src/domain/repositories/IAuditLogRepository.js';
import { InvalidOrExpiredTokenError } from '../../../../src/domain/errors/index.js';

const validRecord = {
  id: 'tok_001',
  userId: 'usr_001',
  tokenHash: 'aaa',
  expiresAt: new Date(Date.now() + 60_000),
  usedAt: null,
  createdAt: new Date(),
};

function makeRepos(recordOverride?: Partial<typeof validRecord> | null) {
  const record = recordOverride === null ? null : { ...validRecord, ...recordOverride };
  const userRepo: IUserRepository = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn(),
  } as unknown as IUserRepository;

  const emailVerificationRepo: IEmailVerificationRepository = {
    create: vi.fn(),
    findByTokenHash: vi.fn().mockResolvedValue(record),
    markUsed: vi.fn().mockResolvedValue(undefined),
    deleteByUserId: vi.fn(),
  };

  const auditRepo: IAuditLogRepository = {
    create: vi.fn().mockResolvedValue({}),
    findByUserId: vi.fn(),
  };

  return { userRepo, emailVerificationRepo, auditRepo };
}

describe('VerifyEmailUseCase', () => {
  let useCase: VerifyEmailUseCase;

  beforeEach(() => {
    const { userRepo, emailVerificationRepo, auditRepo } = makeRepos();
    useCase = new VerifyEmailUseCase(userRepo, emailVerificationRepo, auditRepo);
  });

  it('marks user email as verified on valid token', async () => {
    const { userRepo, emailVerificationRepo, auditRepo } = makeRepos();
    useCase = new VerifyEmailUseCase(userRepo, emailVerificationRepo, auditRepo);
    await useCase.execute('rawtoken', {});
    expect(emailVerificationRepo.markUsed).toHaveBeenCalledWith('tok_001');
    expect(userRepo.update).toHaveBeenCalledWith('usr_001', expect.objectContaining({ emailVerified: true }));
    expect(auditRepo.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_EMAIL_VERIFIED' }));
  });

  it('throws InvalidOrExpiredTokenError when token not found', async () => {
    const { userRepo, emailVerificationRepo, auditRepo } = makeRepos(null);
    useCase = new VerifyEmailUseCase(userRepo, emailVerificationRepo, auditRepo);
    await expect(useCase.execute('badtoken', {})).rejects.toThrow(InvalidOrExpiredTokenError);
  });

  it('throws InvalidOrExpiredTokenError when token is already used', async () => {
    const { userRepo, emailVerificationRepo, auditRepo } = makeRepos({ usedAt: new Date() });
    useCase = new VerifyEmailUseCase(userRepo, emailVerificationRepo, auditRepo);
    await expect(useCase.execute('rawtoken', {})).rejects.toThrow(InvalidOrExpiredTokenError);
  });

  it('throws InvalidOrExpiredTokenError when token is expired', async () => {
    const { userRepo, emailVerificationRepo, auditRepo } = makeRepos({ expiresAt: new Date(Date.now() - 1000) });
    useCase = new VerifyEmailUseCase(userRepo, emailVerificationRepo, auditRepo);
    await expect(useCase.execute('rawtoken', {})).rejects.toThrow(InvalidOrExpiredTokenError);
  });
});
