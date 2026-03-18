import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateUserUseCase } from '../../../../src/application/use-cases/admin/updateUser.js';
import { NotFoundError } from '../../../../src/domain/errors/index.js';
import type { IUserRepository } from '../../../../src/domain/repositories/IUserRepository.js';
import type { IAuditLogRepository } from '../../../../src/domain/repositories/IAuditLogRepository.js';
import type { User } from '../../../../src/domain/entities/User.js';

const baseUser: User = {
  id: 'usr_001',
  email: 'alice@example.com',
  passwordHash: 'hash',
  role: 'USER',
  isActive: true,
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
    update: vi.fn().mockImplementation(async (_id, data) => ({ ...baseUser, ...data })),
    delete: vi.fn(),
  } as unknown as IUserRepository;
}

function makeAuditRepo(): IAuditLogRepository {
  return { create: vi.fn().mockResolvedValue(undefined) } as unknown as IAuditLogRepository;
}

describe('UpdateUserUseCase', () => {
  let userRepo: IUserRepository;
  let auditRepo: IAuditLogRepository;
  let useCase: UpdateUserUseCase;

  beforeEach(() => {
    userRepo = makeRepo();
    auditRepo = makeAuditRepo();
    useCase = new UpdateUserUseCase(userRepo, auditRepo);
  });

  it('deactivates a user and writes audit log', async () => {
    const result = await useCase.execute('usr_001', { isActive: false }, ctx);

    expect(userRepo.update).toHaveBeenCalledWith('usr_001', expect.objectContaining({ isActive: false }));
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin_001', resourceId: 'usr_001', action: 'RESOURCE_UPDATED' }),
    );
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('promotes a user to ADMIN', async () => {
    await useCase.execute('usr_001', { role: 'ADMIN' }, ctx);

    expect(userRepo.update).toHaveBeenCalledWith('usr_001', expect.objectContaining({ role: 'ADMIN' }));
  });

  it('throws NotFoundError when user does not exist', async () => {
    userRepo = makeRepo(null);
    useCase = new UpdateUserUseCase(userRepo, auditRepo);

    await expect(useCase.execute('nonexistent', { isActive: false }, ctx)).rejects.toBeInstanceOf(NotFoundError);
    expect(auditRepo.create).not.toHaveBeenCalled();
  });
});
