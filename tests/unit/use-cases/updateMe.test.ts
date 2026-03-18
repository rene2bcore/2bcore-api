import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateMeUseCase } from '../../../src/application/use-cases/users/updateMe.js';
import { NotFoundError, InvalidCredentialsError, UserAlreadyExistsError } from '../../../src/domain/errors/index.js';
import type { IUserRepository } from '../../../src/domain/repositories/IUserRepository.js';
import type { IAuditLogRepository } from '../../../src/domain/repositories/IAuditLogRepository.js';
import type { User } from '../../../src/domain/entities/User.js';

const bcrypt = await import('bcryptjs');
const KNOWN_HASH = await bcrypt.hash('CurrentP@ss1', 4); // low rounds for speed

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'usr_001',
    email: 'alice@example.com',
    passwordHash: KNOWN_HASH,
    role: 'USER',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('UpdateMeUseCase', () => {
  let userRepo: IUserRepository;
  let auditRepo: IAuditLogRepository;
  let updateMeUseCase: UpdateMeUseCase;

  beforeEach(() => {
    userRepo = {
      findById: vi.fn().mockResolvedValue(makeUser()),
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn().mockImplementation((_id, data) =>
        Promise.resolve(makeUser({ ...data })),
      ),
    };
    auditRepo = {
      create: vi.fn().mockResolvedValue({}),
      findByUserId: vi.fn(),
    };
    updateMeUseCase = new UpdateMeUseCase(userRepo, auditRepo);
  });

  it('throws NotFoundError when user does not exist', async () => {
    vi.mocked(userRepo.findById).mockResolvedValue(null);
    await expect(
      updateMeUseCase.execute('usr_999', { email: 'new@example.com' }, {}),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws UserAlreadyExistsError when new email is taken', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser({ id: 'usr_002' }));
    await expect(
      updateMeUseCase.execute('usr_001', { email: 'taken@example.com' }, {}),
    ).rejects.toThrow(UserAlreadyExistsError);
  });

  it('does not conflict when email is unchanged', async () => {
    // Same email — no uniqueness check needed, update call skips email
    await expect(
      updateMeUseCase.execute('usr_001', { email: 'alice@example.com' }, {}),
    ).resolves.toBeDefined();
    // findByEmail should not be called for the same email
    expect(userRepo.findByEmail).not.toHaveBeenCalled();
    // update should be called but without email (no change)
    expect(userRepo.update).toHaveBeenCalledWith('usr_001', {});
  });

  it('throws InvalidCredentialsError when currentPassword is wrong', async () => {
    await expect(
      updateMeUseCase.execute(
        'usr_001',
        { newPassword: 'NewP@ss123!', currentPassword: 'WrongPassword!' },
        {},
      ),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('updates email when provided and different', async () => {
    await updateMeUseCase.execute('usr_001', { email: 'new@example.com' }, {});
    expect(userRepo.update).toHaveBeenCalledWith(
      'usr_001',
      expect.objectContaining({ email: 'new@example.com' }),
    );
  });

  it('updates password hash (not plaintext) on valid currentPassword', async () => {
    await updateMeUseCase.execute(
      'usr_001',
      { newPassword: 'NewP@ss123!', currentPassword: 'CurrentP@ss1' },
      {},
    );
    const call = vi.mocked(userRepo.update).mock.calls[0][1];
    expect(call.passwordHash).toBeDefined();
    expect(call.passwordHash).not.toBe('NewP@ss123!');
    expect(call.passwordHash).toMatch(/^\$2[ab]\$/);
  });

  it('writes PASSWORD_CHANGED audit when password is updated', async () => {
    await updateMeUseCase.execute(
      'usr_001',
      { newPassword: 'NewP@ss123!', currentPassword: 'CurrentP@ss1' },
      { ipAddress: '1.2.3.4' },
    );
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PASSWORD_CHANGED', ipAddress: '1.2.3.4' }),
    );
  });

  it('writes RESOURCE_UPDATED audit when only email is updated', async () => {
    await updateMeUseCase.execute('usr_001', { email: 'new@example.com' }, {});
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESOURCE_UPDATED' }),
    );
  });

  it('returns public user without passwordHash', async () => {
    const result = await updateMeUseCase.execute('usr_001', { email: 'new@example.com' }, {});
    expect(result).not.toHaveProperty('passwordHash');
  });
});
