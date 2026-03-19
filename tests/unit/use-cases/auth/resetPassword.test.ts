import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResetPasswordUseCase } from '../../../../src/application/use-cases/auth/resetPassword.js';
import type { IUserRepository } from '../../../../src/domain/repositories/IUserRepository.js';
import type { IPasswordResetRepository } from '../../../../src/domain/repositories/IPasswordResetRepository.js';
import type { IAuditLogRepository } from '../../../../src/domain/repositories/IAuditLogRepository.js';
import { AuthService } from '../../../../src/application/services/AuthService.js';
import { InvalidOrExpiredTokenError } from '../../../../src/domain/errors/index.js';

const validRecord = {
  id: 'rst_001',
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

  const passwordResetRepo: IPasswordResetRepository = {
    create: vi.fn(),
    findByTokenHash: vi.fn().mockResolvedValue(record),
    markUsed: vi.fn().mockResolvedValue(undefined),
    deleteByUserId: vi.fn(),
  };

  const authService = {
    revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthService;

  const auditRepo: IAuditLogRepository = { create: vi.fn().mockResolvedValue({}), findByUserId: vi.fn() };

  return { userRepo, passwordResetRepo, authService, auditRepo };
}

describe('ResetPasswordUseCase', () => {
  it('resets password and revokes sessions on valid token', async () => {
    const { userRepo, passwordResetRepo, authService, auditRepo } = makeRepos();
    const useCase = new ResetPasswordUseCase(userRepo, passwordResetRepo, authService, auditRepo);
    await useCase.execute('rawtoken', 'NewPass1!', {});
    expect(passwordResetRepo.markUsed).toHaveBeenCalledWith('rst_001');
    expect(userRepo.update).toHaveBeenCalledWith('usr_001', expect.objectContaining({ passwordHash: expect.any(String) }));
    expect(authService.revokeRefreshToken).toHaveBeenCalledWith('usr_001');
    expect(auditRepo.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_PASSWORD_RESET' }));
  });

  it('throws InvalidOrExpiredTokenError when token not found', async () => {
    const { userRepo, passwordResetRepo, authService, auditRepo } = makeRepos(null);
    const useCase = new ResetPasswordUseCase(userRepo, passwordResetRepo, authService, auditRepo);
    await expect(useCase.execute('bad', 'NewPass1!', {})).rejects.toThrow(InvalidOrExpiredTokenError);
  });

  it('throws InvalidOrExpiredTokenError when token is already used', async () => {
    const { userRepo, passwordResetRepo, authService, auditRepo } = makeRepos({ usedAt: new Date() });
    const useCase = new ResetPasswordUseCase(userRepo, passwordResetRepo, authService, auditRepo);
    await expect(useCase.execute('rawtoken', 'NewPass1!', {})).rejects.toThrow(InvalidOrExpiredTokenError);
  });

  it('throws InvalidOrExpiredTokenError when token is expired', async () => {
    const { userRepo, passwordResetRepo, authService, auditRepo } = makeRepos({ expiresAt: new Date(Date.now() - 1000) });
    const useCase = new ResetPasswordUseCase(userRepo, passwordResetRepo, authService, auditRepo);
    await expect(useCase.execute('rawtoken', 'NewPass1!', {})).rejects.toThrow(InvalidOrExpiredTokenError);
  });
});
