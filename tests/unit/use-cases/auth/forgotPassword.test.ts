import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForgotPasswordUseCase } from '../../../../src/application/use-cases/auth/forgotPassword.js';
import type { IUserRepository } from '../../../../src/domain/repositories/IUserRepository.js';
import type { IPasswordResetRepository } from '../../../../src/domain/repositories/IPasswordResetRepository.js';
import type { IAuditLogRepository } from '../../../../src/domain/repositories/IAuditLogRepository.js';
import type { IEmailService } from '../../../../src/domain/services/IEmailService.js';

const activeUser = {
  id: 'usr_001',
  email: 'alice@example.com',
  passwordHash: 'hash',
  role: 'USER' as const,
  isActive: true,
  emailVerified: true,
  emailVerifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRepos(userOverride?: Partial<typeof activeUser> | null) {
  const user = userOverride === null ? null : { ...activeUser, ...userOverride };

  const userRepo: IUserRepository = {
    findById: vi.fn(),
    findByEmail: vi.fn().mockResolvedValue(user),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as IUserRepository;

  const passwordResetRepo: IPasswordResetRepository = {
    create: vi.fn().mockResolvedValue({}),
    findByTokenHash: vi.fn(),
    markUsed: vi.fn(),
    deleteByUserId: vi.fn().mockResolvedValue(undefined),
  };

  const emailService: IEmailService = { send: vi.fn().mockResolvedValue(undefined) };
  const auditRepo: IAuditLogRepository = { create: vi.fn().mockResolvedValue({}), findByUserId: vi.fn() };

  return { userRepo, passwordResetRepo, emailService, auditRepo };
}

describe('ForgotPasswordUseCase', () => {
  it('sends reset email for existing active user', async () => {
    const { userRepo, passwordResetRepo, emailService, auditRepo } = makeRepos();
    const useCase = new ForgotPasswordUseCase(userRepo, passwordResetRepo, emailService, auditRepo);
    await useCase.execute('alice@example.com', {});
    expect(passwordResetRepo.create).toHaveBeenCalled();
    expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'alice@example.com' }));
    expect(auditRepo.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_PASSWORD_RESET_REQUESTED' }));
  });

  it('is a silent no-op when user does not exist (prevents enumeration)', async () => {
    const { userRepo, passwordResetRepo, emailService, auditRepo } = makeRepos(null);
    const useCase = new ForgotPasswordUseCase(userRepo, passwordResetRepo, emailService, auditRepo);
    await expect(useCase.execute('unknown@example.com', {})).resolves.toBeUndefined();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('is a silent no-op when user account is inactive', async () => {
    const { userRepo, passwordResetRepo, emailService, auditRepo } = makeRepos({ isActive: false });
    const useCase = new ForgotPasswordUseCase(userRepo, passwordResetRepo, emailService, auditRepo);
    await expect(useCase.execute('alice@example.com', {})).resolves.toBeUndefined();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('invalidates existing tokens before creating a new one', async () => {
    const { userRepo, passwordResetRepo, emailService, auditRepo } = makeRepos();
    const useCase = new ForgotPasswordUseCase(userRepo, passwordResetRepo, emailService, auditRepo);
    await useCase.execute('alice@example.com', {});
    expect(passwordResetRepo.deleteByUserId).toHaveBeenCalledWith('usr_001');
  });
});
