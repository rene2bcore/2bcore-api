import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteUserUseCase } from '../../../../src/application/use-cases/admin/deleteUser.js';
import { NotFoundError } from '../../../../src/domain/errors/index.js';
import type { IUserRepository } from '../../../../src/domain/repositories/IUserRepository.js';
import type { IAuditLogRepository } from '../../../../src/domain/repositories/IAuditLogRepository.js';
import type { AuthService } from '../../../../src/application/services/AuthService.js';
import type { User } from '../../../../src/domain/entities/User.js';

const baseUser: User = {
  id: 'usr_target',
  email: 'target@example.com',
  passwordHash: 'hash',
  role: 'USER',
  isActive: true,
  emailVerified: true,
  emailVerifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ctx = { adminId: 'admin_001', ipAddress: '127.0.0.1', userAgent: 'test' };

function makeRepo(user: User | null = baseUser): IUserRepository {
  return {
    findById: vi.fn().mockResolvedValue(user),
    findByEmail: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as IUserRepository;
}

function makeAuditRepo(): IAuditLogRepository {
  return { create: vi.fn().mockResolvedValue(undefined) } as unknown as IAuditLogRepository;
}

function makeAuthService(): AuthService {
  return {
    revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
    revokeAccessToken: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthService;
}

describe('DeleteUserUseCase', () => {
  let userRepo: IUserRepository;
  let auditRepo: IAuditLogRepository;
  let authService: AuthService;
  let useCase: DeleteUserUseCase;

  beforeEach(() => {
    userRepo = makeRepo();
    auditRepo = makeAuditRepo();
    authService = makeAuthService();
    useCase = new DeleteUserUseCase(userRepo, authService, auditRepo);
  });

  it('deletes the target user', async () => {
    await useCase.execute('usr_target', ctx);

    expect(userRepo.delete).toHaveBeenCalledWith('usr_target');
  });

  it('writes audit log BEFORE deletion with admin metadata', async () => {
    const callOrder: string[] = [];
    vi.mocked(auditRepo.create).mockImplementation(async () => { callOrder.push('audit'); });
    vi.mocked(userRepo.delete).mockImplementation(async () => { callOrder.push('delete'); });

    await useCase.execute('usr_target', ctx);

    expect(callOrder).toEqual(['audit', 'delete']);
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin_001',
        resourceId: 'usr_target',
        action: 'RESOURCE_DELETED',
        metadata: expect.objectContaining({ adminAction: true, deletedEmail: 'target@example.com' }),
      }),
    );
  });

  it('revokes the deleted user\'s refresh token', async () => {
    await useCase.execute('usr_target', ctx);

    expect(authService.revokeRefreshToken).toHaveBeenCalledWith('usr_target');
  });

  it('throws NotFoundError when user does not exist', async () => {
    userRepo = makeRepo(null);
    useCase = new DeleteUserUseCase(userRepo, authService, auditRepo);

    await expect(useCase.execute('nonexistent', ctx)).rejects.toBeInstanceOf(NotFoundError);
    expect(auditRepo.create).not.toHaveBeenCalled();
    expect(userRepo.delete).not.toHaveBeenCalled();
  });
});
