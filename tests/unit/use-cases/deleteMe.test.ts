import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteMeUseCase } from '../../../src/application/use-cases/users/deleteMe.js';
import { NotFoundError, InvalidCredentialsError } from '../../../src/domain/errors/index.js';
import type { IUserRepository } from '../../../src/domain/repositories/IUserRepository.js';
import type { IAuditLogRepository } from '../../../src/domain/repositories/IAuditLogRepository.js';
import type { AuthService } from '../../../src/application/services/AuthService.js';
import type { User } from '../../../src/domain/entities/User.js';

const bcrypt = await import('bcryptjs');
const KNOWN_HASH = await bcrypt.hash('CorrectP@ss1', 4);

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

const CTX = { accessToken: 'tok.tok.tok', ipAddress: '1.2.3.4' };

describe('DeleteMeUseCase', () => {
  let userRepo: IUserRepository;
  let authService: AuthService;
  let auditRepo: IAuditLogRepository;
  let deleteMeUseCase: DeleteMeUseCase;

  beforeEach(() => {
    userRepo = {
      findById: vi.fn().mockResolvedValue(makeUser()),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    authService = {
      issueTokenPair: vi.fn(),
      verifyAccessToken: vi.fn(),
      revokeAccessToken: vi.fn().mockResolvedValue(undefined),
      revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
      verifyRefreshToken: vi.fn(),
      rotateRefreshToken: vi.fn(),
      getRefreshTokenKey: vi.fn(),
    } as unknown as AuthService;
    auditRepo = {
      create: vi.fn().mockResolvedValue({}),
      findByUserId: vi.fn(),
    };
    deleteMeUseCase = new DeleteMeUseCase(userRepo, authService, auditRepo);
  });

  it('throws NotFoundError when user does not exist', async () => {
    vi.mocked(userRepo.findById).mockResolvedValue(null);
    await expect(
      deleteMeUseCase.execute('usr_999', 'CorrectP@ss1', CTX),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws InvalidCredentialsError when password is wrong', async () => {
    await expect(
      deleteMeUseCase.execute('usr_001', 'WrongPassword!1', CTX),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('does not delete when password is wrong', async () => {
    await expect(
      deleteMeUseCase.execute('usr_001', 'WrongPassword!1', CTX),
    ).rejects.toThrow();
    expect(userRepo.delete).not.toHaveBeenCalled();
  });

  it('hard-deletes the user on correct password', async () => {
    await deleteMeUseCase.execute('usr_001', 'CorrectP@ss1', CTX);
    expect(userRepo.delete).toHaveBeenCalledWith('usr_001');
  });

  it('writes a RESOURCE_DELETED audit log with email metadata', async () => {
    await deleteMeUseCase.execute('usr_001', 'CorrectP@ss1', CTX);
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RESOURCE_DELETED',
        resourceType: 'user',
        userId: 'usr_001',
        metadata: expect.objectContaining({ email: 'alice@example.com' }),
      }),
    );
  });

  it('blacklists access token after deletion', async () => {
    await deleteMeUseCase.execute('usr_001', 'CorrectP@ss1', CTX);
    expect(authService.revokeAccessToken).toHaveBeenCalledWith('tok.tok.tok');
  });

  it('revokes refresh token after deletion', async () => {
    await deleteMeUseCase.execute('usr_001', 'CorrectP@ss1', CTX);
    expect(authService.revokeRefreshToken).toHaveBeenCalledWith('usr_001');
  });

  it('audit log is written before deletion', async () => {
    const callOrder: string[] = [];
    vi.mocked(auditRepo.create).mockImplementation(async () => { callOrder.push('audit'); return {} as any; });
    vi.mocked(userRepo.delete).mockImplementation(async () => { callOrder.push('delete'); });

    await deleteMeUseCase.execute('usr_001', 'CorrectP@ss1', CTX);
    expect(callOrder).toEqual(['audit', 'delete']);
  });
});
