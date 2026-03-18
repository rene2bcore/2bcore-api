import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListUsersUseCase } from '../../../../src/application/use-cases/admin/listUsers.js';
import type { IUserRepository } from '../../../../src/domain/repositories/IUserRepository.js';
import type { User } from '../../../../src/domain/entities/User.js';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'usr_001',
    email: 'alice@example.com',
    passwordHash: 'hash',
    role: 'USER',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeRepo(data: User[] = [], total?: number): IUserRepository {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findAll: vi.fn().mockResolvedValue({ data, total: total ?? data.length }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as IUserRepository;
}

describe('ListUsersUseCase', () => {
  it('returns paginated public users', async () => {
    const users = [makeUser({ id: 'usr_001' }), makeUser({ id: 'usr_002' })];
    const repo = makeRepo(users, 2);
    const useCase = new ListUsersUseCase(repo);

    const result = await useCase.execute({ page: 1, limit: 20 });

    expect(result.data).toHaveLength(2);
    expect(result.data[0]).not.toHaveProperty('passwordHash');
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('calculates totalPages correctly', async () => {
    const repo = makeRepo(Array.from({ length: 20 }, (_, i) => makeUser({ id: `usr_${i}` })), 55);
    const useCase = new ListUsersUseCase(repo);

    const result = await useCase.execute({ page: 1, limit: 20 });

    expect(result.pagination.totalPages).toBe(3);
  });

  it('delegates page and limit to the repository', async () => {
    const repo = makeRepo([], 0);
    const useCase = new ListUsersUseCase(repo);

    await useCase.execute({ page: 3, limit: 10 });

    expect(repo.findAll).toHaveBeenCalledWith({ page: 3, limit: 10 });
  });

  it('strips passwordHash from results', async () => {
    const repo = makeRepo([makeUser()], 1);
    const useCase = new ListUsersUseCase(repo);

    const result = await useCase.execute({ page: 1, limit: 20 });

    expect(result.data[0]).not.toHaveProperty('passwordHash');
    expect(result.data[0]).not.toHaveProperty('updatedAt');
  });
});
