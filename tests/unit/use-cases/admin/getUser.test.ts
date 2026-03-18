import { describe, it, expect, vi } from 'vitest';
import { GetUserUseCase } from '../../../../src/application/use-cases/admin/getUser.js';
import { NotFoundError } from '../../../../src/domain/errors/index.js';
import type { IUserRepository } from '../../../../src/domain/repositories/IUserRepository.js';
import type { User } from '../../../../src/domain/entities/User.js';

const mockUser: User = {
  id: 'usr_001',
  email: 'alice@example.com',
  passwordHash: 'hash',
  role: 'USER',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRepo(user: User | null = mockUser): IUserRepository {
  return {
    findById: vi.fn().mockResolvedValue(user),
    findByEmail: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as IUserRepository;
}

describe('GetUserUseCase', () => {
  it('returns public user when found', async () => {
    const repo = makeRepo();
    const useCase = new GetUserUseCase(repo);

    const result = await useCase.execute('usr_001');

    expect(result.id).toBe('usr_001');
    expect(result.email).toBe('alice@example.com');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws NotFoundError when user does not exist', async () => {
    const repo = makeRepo(null);
    const useCase = new GetUserUseCase(repo);

    await expect(useCase.execute('nonexistent')).rejects.toBeInstanceOf(NotFoundError);
  });
});
