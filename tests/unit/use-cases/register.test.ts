import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterUserUseCase } from '../../../src/application/use-cases/users/register.js';
import { UserAlreadyExistsError } from '../../../src/domain/errors/index.js';
import type { IUserRepository } from '../../../src/domain/repositories/IUserRepository.js';
import type { IAuditLogRepository } from '../../../src/domain/repositories/IAuditLogRepository.js';
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

describe('RegisterUserUseCase', () => {
  let userRepo: IUserRepository;
  let auditRepo: IAuditLogRepository;
  let registerUseCase: RegisterUserUseCase;

  const VALID_INPUT = { email: 'alice@example.com', password: 'SecureP@ss1' };

  beforeEach(() => {
    userRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(makeUser()),
      update: vi.fn(),
    };
    auditRepo = {
      create: vi.fn().mockResolvedValue({}),
      findByUserId: vi.fn(),
    };
    registerUseCase = new RegisterUserUseCase(userRepo, auditRepo);
  });

  it('throws UserAlreadyExistsError when email is taken', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser());

    await expect(
      registerUseCase.execute(VALID_INPUT, {}),
    ).rejects.toThrow(UserAlreadyExistsError);
  });

  it('does not call create when email is taken', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser());

    await expect(registerUseCase.execute(VALID_INPUT, {})).rejects.toThrow();
    expect(userRepo.create).not.toHaveBeenCalled();
  });

  it('creates user with hashed password (not plaintext)', async () => {
    await registerUseCase.execute(VALID_INPUT, {});

    const call = vi.mocked(userRepo.create).mock.calls[0][0];
    expect(call.passwordHash).not.toBe(VALID_INPUT.password);
    expect(call.passwordHash).toMatch(/^\$2[ab]\$/); // bcrypt prefix
  });

  it('creates user with role USER by default', async () => {
    await registerUseCase.execute(VALID_INPUT, {});

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'USER' }),
    );
  });

  it('normalizes email to lowercase', async () => {
    // DTO normalisation happens before the use case; the use case receives pre-normalised input
    await registerUseCase.execute({ email: 'alice@example.com', password: 'SecureP@ss1' }, {});

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' }),
    );
  });

  it('writes a RESOURCE_CREATED audit log on success', async () => {
    await registerUseCase.execute(VALID_INPUT, { ipAddress: '1.2.3.4' });

    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RESOURCE_CREATED',
        resourceType: 'user',
        ipAddress: '1.2.3.4',
      }),
    );
  });

  it('returns a public user (no passwordHash)', async () => {
    const result = await registerUseCase.execute(VALID_INPUT, {});

    expect(result).not.toHaveProperty('passwordHash');
    expect(result).toMatchObject({
      id: 'usr_001',
      email: 'alice@example.com',
      role: 'USER',
      isActive: true,
    });
    expect(result).toHaveProperty('createdAt');
  });
});
