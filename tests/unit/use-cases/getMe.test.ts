import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetMeUseCase } from '../../../src/application/use-cases/users/getMe.js';
import { NotFoundError } from '../../../src/domain/errors/index.js';
import type { IUserRepository } from '../../../src/domain/repositories/IUserRepository.js';
import type { User } from '../../../src/domain/entities/User.js';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'usr_001',
    email: 'alice@example.com',
    passwordHash: 'hashed',
    role: 'USER',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('GetMeUseCase', () => {
  let userRepo: IUserRepository;
  let getMeUseCase: GetMeUseCase;

  beforeEach(() => {
    userRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    getMeUseCase = new GetMeUseCase(userRepo);
  });

  it('throws NotFoundError when user does not exist', async () => {
    vi.mocked(userRepo.findById).mockResolvedValue(null);
    await expect(getMeUseCase.execute('usr_999')).rejects.toThrow(NotFoundError);
  });

  it('returns public user without passwordHash', async () => {
    vi.mocked(userRepo.findById).mockResolvedValue(makeUser());
    const result = await getMeUseCase.execute('usr_001');

    expect(result).not.toHaveProperty('passwordHash');
    expect(result).toMatchObject({ id: 'usr_001', email: 'alice@example.com', role: 'USER' });
  });

  it('queries by the provided userId', async () => {
    vi.mocked(userRepo.findById).mockResolvedValue(makeUser());
    await getMeUseCase.execute('usr_001');
    expect(userRepo.findById).toHaveBeenCalledWith('usr_001');
  });
});
